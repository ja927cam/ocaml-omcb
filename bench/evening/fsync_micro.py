#!/usr/bin/env python3
"""Measure fsync latency and group-commit throughput on a real filesystem.

The game server appends one small WAL record per accepted move and calls
fsync once per commit group. This probe writes synthetic records of the same
order of magnitude and measures the cost of the fsync itself, separated from
the chess engine.

Usage:
  python3 bench/evening/fsync_micro.py --dir /home/... --label home
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import time
from pathlib import Path


def percentile(sorted_values: list[float], fraction: float) -> float:
    if not sorted_values:
        return 0.0
    index = min(len(sorted_values) - 1, max(0, int(len(sorted_values) * fraction) - 1))
    return sorted_values[index]


def run_case(directory: Path, group: int, records: int, payload: int, sync: str) -> dict:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"fsync-{os.getpid()}-{group}.bin"
    data = os.urandom(payload)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    sync_fn = os.fsync if sync == "fsync" else os.fdatasync
    latencies: list[float] = []
    try:
        # Warm the page cache and the filesystem's allocator.
        for _ in range(min(32, records)):
            os.write(fd, data)
        sync_fn(fd)
        started = time.perf_counter()
        for index in range(records):
            os.write(fd, data)
            if (index + 1) % group == 0:
                before = time.perf_counter_ns()
                sync_fn(fd)
                latencies.append((time.perf_counter_ns() - before) / 1000.0)
        if records % group != 0:
            before = time.perf_counter_ns()
            sync_fn(fd)
            latencies.append((time.perf_counter_ns() - before) / 1000.0)
        elapsed = time.perf_counter() - started
    finally:
        os.close(fd)
        try:
            path.unlink()
        except OSError:
            pass

    latencies.sort()
    return {
        "group": group,
        "records": records,
        "payload_bytes": payload,
        "sync": sync,
        "elapsed_s": elapsed,
        "records_per_s": records / elapsed,
        "bytes_per_s": records * payload / elapsed,
        "fsync_count": len(latencies),
        "fsync_p50_us": percentile(latencies, 0.50),
        "fsync_p95_us": percentile(latencies, 0.95),
        "fsync_p99_us": percentile(latencies, 0.99),
        "fsync_max_us": max(latencies),
        "fsync_mean_us": statistics.fmean(latencies),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--records", type=int, default=4096)
    parser.add_argument("--payload", type=int, default=64)
    parser.add_argument("--groups", default="1,2,4,8,16,32,64,128,256")
    parser.add_argument("--sync", default="fsync")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    directory = Path(args.dir) / f"fsync-{args.label}"
    groups = [int(value) for value in args.groups.split(",")]
    cases = []
    for group in groups:
        case = run_case(directory, group, args.records, args.payload, args.sync)
        case["label"] = args.label
        cases.append(case)
        print(
            f"{args.label:10s} group={group:4d} "
            f"{case['records_per_s']:10.0f} records/s "
            f"fsync p50={case['fsync_p50_us']:8.1f} us "
            f"p95={case['fsync_p95_us']:8.1f} us",
            flush=True,
        )

    payload = {"label": args.label, "directory": str(directory), "cases": cases}
    Path(args.output).write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    main()
