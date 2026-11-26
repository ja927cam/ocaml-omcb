#!/usr/bin/env python3
"""Hourly email summary for chess.jamesashwood.com.

Fetches the public live metrics, compares them with the previous successful
run, flags operational issues and sends a plain-text email through msmtp.

The state file is only advanced after a successful send, so a failed send is
covered by the next report instead of creating a silent gap.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

def env(name: str, default: str) -> str:
    """Read the renamed variable, falling back to the pre-rename name."""
    value = os.environ.get(name)
    if value is not None:
        return value
    legacy = name.replace("OCAML_OMCB_", "SIM_MAP_", 1)
    return os.environ.get(legacy, default)


BASE_URL = env("OCAML_OMCB_REPORT_URL", "https://chess.jamesashwood.com")
DEFAULT_TO = env("OCAML_OMCB_REPORT_TO", "contact@jamesashwood.com")
DEFAULT_FROM = env("OCAML_OMCB_REPORT_FROM", "jamesashwood.contact@gmail.com")
STATE_FILE = Path(
    env(
        "OCAML_OMCB_REPORT_STATE",
        str(Path.home() / ".local/state/ocaml-omcb-hourly-report/state.json"),
    )
)
LEGACY_STATE_FILE = Path.home() / ".local/state/sim-map-hourly-report/state.json"
TIMEOUT = 20

if not STATE_FILE.exists() and LEGACY_STATE_FILE.exists():
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        STATE_FILE.write_bytes(LEGACY_STATE_FILE.read_bytes())
    except OSError:
        pass


def get_json(path: str) -> Any:
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        headers={"User-Agent": "ocaml-omcb-hourly-report/1.0"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.load(response)


def get_text(path: str) -> str:
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        headers={"User-Agent": "ocaml-omcb-hourly-report/1.0"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read().decode("utf-8", "replace")


def number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def integer(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def nested(data: Any, *keys: str, default: Any = None) -> Any:
    value = data
    for key in keys:
        if not isinstance(value, dict) or key not in value:
            return default
        value = value[key]
    return value


def fmt_int(value: Any) -> str:
    return f"{integer(value):,}"


def fmt_ms(value: Any) -> str:
    value = number(value)
    if value >= 1000:
        return f"{value / 1000:.2f} s"
    if value >= 10:
        return f"{value:.1f} ms"
    return f"{value:.2f} ms"


def fmt_bytes(value: Any) -> str:
    value = number(value)
    if value >= 1024 * 1024 * 1024:
        return f"{value / 1024 / 1024 / 1024:.2f} GiB"
    if value >= 1024 * 1024:
        return f"{value / 1024 / 1024:.1f} MiB"
    if value >= 1024:
        return f"{value / 1024:.1f} KiB"
    return f"{value:.0f} B"


def fmt_duration(seconds: float) -> str:
    seconds = max(0, int(round(seconds)))
    days, seconds = divmod(seconds, 86400)
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours or days:
        parts.append(f"{hours}h")
    if minutes or hours or days:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    return " ".join(parts)


def snapshot(metrics: dict[str, Any]) -> dict[str, Any]:
    """The small subset of metrics used to compute deltas."""

    def value(*keys: str) -> Any:
        return nested(metrics, *keys, default=0)

    return {
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "started_ns": integer(value("started_ns")),
        "uptime_ms": number(value("uptime_ms")),
        "moves_processed": integer(value("worker", "moves_processed")),
        "requests_processed": integer(value("worker", "requests_processed")),
        "requests_rejected": integer(value("worker", "requests_rejected")),
        "events_broadcast": integer(value("counters", "events_broadcast")),
        "recipients": integer(value("counters", "recipients")),
        "outbox_dropped": integer(value("counters", "outbox_dropped")),
        "send_failures": integer(value("counters", "send_failures")),
        "outbox_full_unregisters": integer(
            value("counters", "outbox_full_unregisters")
        ),
        "board_requests": integer(value("board_load", "overall", "requests")),
        "board_boards": integer(value("board_load", "overall", "boards")),
        "board_failures": integer(value("board_load", "overall", "failures")),
        "sequence": integer(value("persistence", "sequence")),
        "kings_white": integer(value("kings_captured", "white")),
        "kings_black": integer(value("kings_captured", "black")),
        "clients": integer(value("connections", "clients")),
        "subscriptions": integer(value("connections", "subscriptions")),
    }


def load_state() -> dict[str, Any] | None:
    try:
        with STATE_FILE.open("r", encoding="utf-8") as handle:
            state = json.load(handle)
        return state if isinstance(state, dict) else None
    except (FileNotFoundError, OSError, ValueError):
        return None


def save_state(state: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(
        prefix="state-", suffix=".json", dir=STATE_FILE.parent
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary, STATE_FILE)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def delta(current: dict[str, Any], previous: dict[str, Any] | None, key: str) -> int | None:
    if previous is None:
        return None
    then = previous.get(key)
    if not isinstance(then, (int, float)):
        return None
    return max(0, int(current.get(key, 0)) - int(then))


def window_label(previous: dict[str, Any] | None, now: datetime) -> tuple[str, float | None]:
    if not previous:
        return "baseline run — no previous hour to compare", None
    try:
        started = datetime.fromisoformat(str(previous.get("captured_at")))
    except (TypeError, ValueError):
        return "previous run — timestamp unavailable", None
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    seconds = max(0.0, (now - started).total_seconds())
    return (
        f"{started.astimezone(timezone.utc):%Y-%m-%d %H:%M} → "
        f"{now.astimezone(timezone.utc):%Y-%m-%d %H:%M} UTC "
        f"({fmt_duration(seconds)})",
        seconds,
    )


def build_report(
    metrics: dict[str, Any],
    health: dict[str, Any] | None,
    ready: dict[str, Any] | None,
    previous: dict[str, Any] | None,
    now: datetime,
) -> tuple[str, str]:
    current = snapshot(metrics)
    uptime_s = current["uptime_ms"] / 1000.0
    window, window_seconds = window_label(previous, now)

    issues: list[tuple[str, str]] = []
    notes: list[str] = []

    def issue(severity: str, text: str) -> None:
        issues.append((severity, text))

    def note(text: str) -> None:
        notes.append(text)

    if health is None:
        issue("CRITICAL", "health endpoint failed")
    elif str(health.get("status")) != "ok":
        issue("CRITICAL", f"health endpoint returned {health!r}")

    if ready is None:
        issue("CRITICAL", "readiness endpoint failed")
    elif str(ready.get("status")) != "ready":
        issue("CRITICAL", f"readiness endpoint returned {ready!r}")

    previous_start = previous.get("started_ns") if previous else None
    restarted = bool(
        previous
        and (
            current["uptime_ms"] < number(previous.get("uptime_ms"))
            or (
                isinstance(previous_start, (int, float))
                and previous_start != current["started_ns"]
            )
        )
    )
    if restarted:
        issue("WATCH", "process restarted during the window (deploy or crash)")
        window = "process restarted — deltas reset"
        window_seconds = None
    comparison = None if restarted else previous

    d_moves = delta(current, comparison, "moves_processed")
    d_requests = delta(current, comparison, "requests_processed")
    d_rejected = delta(current, comparison, "requests_rejected")
    d_events = delta(current, comparison, "events_broadcast")
    d_recipients = delta(current, comparison, "recipients")
    d_board_requests = delta(current, comparison, "board_requests")
    d_board_boards = delta(current, comparison, "board_boards")
    d_board_failures = delta(current, comparison, "board_failures")
    d_sequence = delta(current, comparison, "sequence")
    d_kings_white = delta(current, comparison, "kings_white")
    d_kings_black = delta(current, comparison, "kings_black")
    d_outbox_dropped = delta(current, comparison, "outbox_dropped")
    d_send_failures = delta(current, comparison, "send_failures")
    d_outbox_unregisters = delta(current, comparison, "outbox_full_unregisters")

    if d_outbox_dropped and d_outbox_dropped > 0:
        issue("CRITICAL", f"{d_outbox_dropped} outbox drop(s) during the window")
    if d_send_failures and d_send_failures > 0:
        if d_outbox_dropped and d_outbox_dropped > 0 or d_send_failures >= 3:
            issue("WATCH", f"{d_send_failures} websocket send failure(s)")
        else:
            note(
                f"{d_send_failures} websocket send failure(s) "
                "(usually a disconnected client)"
            )
    if d_outbox_unregisters and d_outbox_unregisters > 0:
        issue("WATCH", f"{d_outbox_unregisters} outbox-full disconnect(s)")
    if d_board_failures and d_board_failures > 0:
        issue("WATCH", f"{d_board_failures} board-load failure(s)")
    if d_rejected and d_requests and d_requests > 0:
        ratio = d_rejected / d_requests
        if d_requests >= 20 and ratio >= 0.2:
            issue(
                "WATCH",
                f"{d_rejected}/{d_requests} requests rejected ({ratio:.0%})",
            )

    queue_depth = integer(nested(metrics, "worker", "queue_depth", default=0))
    if queue_depth > 0:
        issue("WATCH", f"move queue is not empty ({queue_depth} queued)")
    max_queue_wait = number(nested(metrics, "worker", "max_queue_wait_ms", default=0))
    if max_queue_wait > 1000:
        issue("WATCH", f"max queue wait reached {fmt_ms(max_queue_wait)}")

    e2e = nested(metrics, "stages", "end_to_end_broadcast", default={}) or {}
    e2e_n = integer(e2e.get("n", 0))
    e2e_p50 = number(e2e.get("p50_ms", 0))
    e2e_p95 = number(e2e.get("p95_ms", 0))
    if e2e_n >= 8 and e2e_p95 > 1000:
        if e2e_p50 > 250:
            issue(
                "WATCH",
                f"end-to-end broadcast p95 {fmt_ms(e2e_p95)} "
                f"(median {fmt_ms(e2e_p50)}) across {e2e_n} samples",
            )
        else:
            note(
                f"one or two slow broadcasts lifted end-to-end p95 to "
                f"{fmt_ms(e2e_p95)}; median was {fmt_ms(e2e_p50)}"
            )

    persistence = nested(metrics, "persistence", default={}) or {}
    if bool(persistence.get("truncated_wal")):
        issue("CRITICAL", "WAL has a truncated tail")
    if bool(persistence.get("dirty")):
        issue("WATCH", "persistence is dirty")
    if bool(persistence.get("snapshot_pending")):
        issue("WATCH", "a snapshot is pending")
    if bool(persistence.get("snapshot_active")) or bool(
        persistence.get("snapshot_writing")
    ):
        note("snapshot write is active at report time")

    rss_kb = number(nested(metrics, "memory", "rss_kb", default=0))
    if rss_kb > 1_500_000:
        issue("WATCH", f"RSS is high ({rss_kb / 1024:.0f} MiB)")

    if comparison:
        if d_moves == 0:
            note("no accepted moves in the window")
        if current["clients"] == 0:
            note("no websocket clients connected at report time")

    severity = "OK"
    if any(level == "CRITICAL" for level, _ in issues):
        severity = "CRITICAL"
    elif issues:
        severity = "WATCH"

    if comparison and window_seconds is not None:
        hours = max(window_seconds / 3600.0, 1.0 / 60.0)
    else:
        hours = None

    def rate(value: int | None) -> str:
        if value is None or not hours:
            return "—"
        return f"{value / hours:,.1f}/h"

    lines: list[str] = [
        "One Million Chessboards — hourly report",
        f"Window: {window}",
        f"Status: {severity}",
        f"Health: {'ok' if health and health.get('status') == 'ok' else 'FAILED'}, "
        f"ready: {'ready' if ready and ready.get('status') == 'ready' else 'FAILED'}",
        f"Process uptime: {fmt_duration(uptime_s)}",
        "",
        "ACTIVITY",
        f"  Moves accepted:      {fmt_int(d_moves) if d_moves is not None else '—':>8}  ({rate(d_moves)})",
        f"  Requests processed:  {fmt_int(d_requests) if d_requests is not None else '—':>8}  ({rate(d_requests)})",
        f"  Requests rejected:   {fmt_int(d_rejected) if d_rejected is not None else '—':>8}",
        f"  Broadcast events:    {fmt_int(d_events) if d_events is not None else '—':>8}",
        f"  Event recipients:    {fmt_int(d_recipients) if d_recipients is not None else '—':>8}",
        f"  Board batches:       {fmt_int(d_board_requests) if d_board_requests is not None else '—':>8}",
        f"  Boards loaded:       {fmt_int(d_board_boards) if d_board_boards is not None else '—':>8}",
        f"  Kings captured:      white {fmt_int(d_kings_white) if d_kings_white is not None else '—'} "
        f"(total {fmt_int(current['kings_white'])}), black "
        f"{fmt_int(d_kings_black) if d_kings_black is not None else '—'} "
        f"(total {fmt_int(current['kings_black'])})",
        f"  Viewers now:         {fmt_int(current['clients'])} clients, "
        f"{fmt_int(current['subscriptions'])} subscriptions",
        "",
        "PERFORMANCE (live rolling window)",
        "  Move processing:     p50 {p50} / p95 {p95} / max {maxv}".format(
            p50=fmt_ms(nested(metrics, "stages", "move_processing", "p50_ms", default=0)),
            p95=fmt_ms(nested(metrics, "stages", "move_processing", "p95_ms", default=0)),
            maxv=fmt_ms(nested(metrics, "stages", "move_processing", "max_ms", default=0)),
        ),
        "  End-to-end broadcast: p50 {p50} / p95 {p95} / max {maxv}".format(
            p50=fmt_ms(e2e.get("p50_ms", 0)),
            p95=fmt_ms(e2e.get("p95_ms", 0)),
            maxv=fmt_ms(e2e.get("max_ms", 0)),
        ),
        "  WebSocket write:     p50 {p50} / p95 {p95} / max {maxv}".format(
            p50=fmt_ms(nested(metrics, "stages", "websocket_write", "p50_ms", default=0)),
            p95=fmt_ms(nested(metrics, "stages", "websocket_write", "p95_ms", default=0)),
            maxv=fmt_ms(nested(metrics, "stages", "websocket_write", "max_ms", default=0)),
        ),
        "  Board loading:       p50 {p50} / p95 {p95} / max {maxv}".format(
            p50=fmt_ms(nested(metrics, "board_load", "overall", "p50_ms", default=0)),
            p95=fmt_ms(nested(metrics, "board_load", "overall", "p95_ms", default=0)),
            maxv=fmt_ms(nested(metrics, "board_load", "overall", "max_ms", default=0)),
        ),
        "",
        "STORAGE / MEMORY",
        f"  Sequence:            {fmt_int(current['sequence'])}"
        + (f"  (+{fmt_int(d_sequence)})" if d_sequence is not None else ""),
        f"  WAL:                 {fmt_bytes(persistence.get('wal_bytes', 0))}, "
        f"{'dirty' if persistence.get('dirty') else 'clean'}, "
        f"{'truncated' if persistence.get('truncated_wal') else 'not truncated'}",
        f"  Last snapshot:       seq {persistence.get('last_snapshot_sequence', '—')}, "
        f"{fmt_ms(number(persistence.get('snapshot_write_ms', 0)))} write, "
        f"pending {'yes' if bool(persistence.get('snapshot_pending')) else 'no'}",
        f"  Commits since snap:  {fmt_int(persistence.get('commits_since_snapshot', 0))}",
        f"  RSS:                 {rss_kb / 1024:.0f} MiB "
        f"(snapshot copy {number(nested(metrics, 'memory', 'snapshot_copy_live_bytes', default=0)) / 1024 / 1024:.0f} MiB)",
        "",
    ]

    if issues:
        lines.append("ISSUES")
        for level, text in issues:
            lines.append(f"  [{level}] {text}")
    else:
        lines.append("ISSUES")
        lines.append("  None detected.")

    if notes:
        lines.extend(["", "NOTES"])
        for text in notes:
            lines.append(f"  - {text}")

    lines.extend(
        [
            "",
            "Report generated from the public /metrics, /healthz and /readyz endpoints.",
        ]
    )

    subject = (
        f"[chess.jamesashwood.com] Hourly report "
        f"{now.astimezone(timezone.utc):%Y-%m-%d %H:%M} UTC — {severity}"
    )
    return subject, "\n".join(lines) + "\n"


def send_mail(subject: str, body: str, to: str, from_addr: str) -> None:
    message = (
        f"From: {from_addr}\n"
        f"To: {to}\n"
        f"Subject: {subject}\n"
        f"Date: {datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')}\n"
        "MIME-Version: 1.0\n"
        "Content-Type: text/plain; charset=utf-8\n"
        "Content-Transfer-Encoding: 8bit\n"
        "\n"
        f"{body}"
    )
    command = ["msmtp", "-a", "default", "-t"]
    try:
        result = subprocess.run(
            command,
            input=message.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60,
        )
    except FileNotFoundError:
        command = ["sendmail", "-t"]
        result = subprocess.run(
            command,
            input=message.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60,
        )
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", "replace").strip()
        raise RuntimeError(
            f"mail command failed with exit {result.returncode}: {detail}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print, do not send or save")
    parser.add_argument("--to", default=DEFAULT_TO, help=f"recipient (default: {DEFAULT_TO})")
    parser.add_argument("--from", dest="from_addr", default=DEFAULT_FROM)
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    previous = load_state()

    try:
        metrics = get_json("/metrics")
        health = get_json("/healthz")
        ready = get_json("/readyz")
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as error:
        subject = (
            f"[chess.jamesashwood.com] Hourly report "
            f"{now:%Y-%m-%d %H:%M} UTC — CRITICAL"
        )
        body = (
            "One Million Chessboards — hourly report\n"
            f"Window: {window_label(previous, now)[0]}\n"
            "Status: CRITICAL\n\n"
            "ISSUES\n"
            f"  [CRITICAL] could not fetch production metrics: {error}\n\n"
            "The previous successful state was left unchanged.\n"
        )
        if args.dry_run:
            print(f"Subject: {subject}\n\n{body}")
            return 1
        try:
            send_mail(subject, body, args.to, args.from_addr)
        except Exception as send_error:  # noqa: BLE001 - report the send failure
            print(f"failed to send critical report: {send_error}", file=sys.stderr)
            return 1
        return 1

    if health is None or str(health.get("status")) != "ok":
        # build_report handles the issue text; this branch only keeps typing
        # simple for the normal path.
        pass

    subject, body = build_report(metrics, health, ready, previous, now)
    if args.dry_run:
        print(f"Subject: {subject}\n")
        print(body)
        return 0

    try:
        send_mail(subject, body, args.to, args.from_addr)
    except Exception as error:  # noqa: BLE001 - surface the failure to systemd
        print(f"failed to send hourly report: {error}", file=sys.stderr)
        return 1

    save_state(snapshot(metrics))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
