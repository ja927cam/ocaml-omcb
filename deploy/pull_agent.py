#!/usr/bin/env python3
"""Pull-based deployment agent for the ocaml-omcb production VPS.

The agent runs as root under the dedicated systemd timer. It reads the public
(or read-only private) GHCR manifest for the `latest` tag, extracts the
immutable Git commit SHA from the image's OCI revision label, and invokes the
root-owned /opt/ocaml-omcb/deploy.sh directly.

Change detection uses the registry's Docker-Content-Digest for `latest`, not
the GitHub API. Registry/network failures are logged and leave the running
service untouched. Deployment failures are backed off for a while so a broken
image does not cause a deploy loop.
"""

from __future__ import annotations

import base64
import fcntl
import hashlib
import http.client
import json
import os
import platform
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

EXPECTED_IMAGE = "ghcr.io/ja927cam/ocaml-omcb"
EXPECTED_REPOSITORY = "ja927cam/ocaml-omcb"
EXPECTED_SOURCE = "https://github.com/ja927cam/ocaml-omcb"
# Existing VPS installs still read the pre-rename image. Keep accepting it
# until the host pull agent and .env have been migrated.
LEGACY_IMAGE = "ghcr.io/ja927cam/sim-map"
LEGACY_REPOSITORY = "ja927cam/sim-map"
LEGACY_SOURCE = "https://github.com/ja927cam/sim-map"
GHCR_BASE = "https://ghcr.io"
DEFAULT_IMAGE = EXPECTED_IMAGE
DEFAULT_STATE_DIR = "/var/lib/ocaml-omcb-pull"
DEPLOY_SCRIPT = str(Path(__file__).resolve().parent / "deploy.sh")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
MAX_RESPONSE_BYTES = 16 * 1024 * 1024
ACCEPT_ALL = ", ".join(
    [
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.v2+json",
    ]
)
ACCEPT_IMAGE = ", ".join(
    [
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.v2+json",
    ]
)


def log(message: str, *, error: bool = False) -> None:
    stream = sys.stderr if error else sys.stdout
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(f"{stamp} pull-agent: {message}", file=stream, flush=True)


def registry_base() -> str:
    return GHCR_BASE


def parse_image(image: str) -> tuple[str, str]:
    image = image.strip().split("@", 1)[0]
    last = image.rsplit("/", 1)[-1]
    if ":" in last:
        image = image.rsplit(":", 1)[0]
    if image == EXPECTED_IMAGE:
        return "ghcr.io", EXPECTED_REPOSITORY
    if image == LEGACY_IMAGE:
        return "ghcr.io", LEGACY_REPOSITORY
    raise ValueError(
        f"APP_IMAGE must be {EXPECTED_IMAGE!r} or {LEGACY_IMAGE!r}, got {image!r}"
    )


def basic_auth_header() -> str | None:
    username = os.environ.get("GHCR_USERNAME", "").strip()
    token = os.environ.get("GHCR_TOKEN", "").strip()
    if not username or not token:
        return None
    encoded = base64.b64encode(f"{username}:{token}".encode()).decode()
    return f"Basic {encoded}"


def http_get(url: str, headers: dict[str, str]) -> tuple[bytes, dict[str, str]]:
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise RuntimeError("registry response is too large")
        return body, dict(response.headers)


def get_token(base: str, repository: str) -> str:
    url = (
        f"{base}/token?service=ghcr.io"
        f"&scope=repository:{repository}:pull"
    )
    headers = {"Accept": "application/json"}
    auth = basic_auth_header()
    if auth:
        headers["Authorization"] = auth
    body, _ = http_get(url, headers)
    data = json.loads(body)
    if not isinstance(data, dict):
        raise RuntimeError("registry token response is not an object")
    token = data.get("token") or data.get("access_token")
    if not isinstance(token, str) or not token:
        raise RuntimeError("registry token response has no token")
    return token


def get_manifest(
    base: str,
    repository: str,
    reference: str,
    token: str,
    accept: str = ACCEPT_ALL,
) -> tuple[str, dict]:
    url = f"{base}/v2/{repository}/manifests/{reference}"
    body, headers = http_get(
        url, {"Authorization": f"Bearer {token}", "Accept": accept}
    )
    computed = "sha256:" + hashlib.sha256(body).hexdigest()
    header = next(
        (
            value
            for name, value in headers.items()
            if name.lower() == "docker-content-digest"
        ),
        "",
    ).strip()
    if header and header != computed:
        raise RuntimeError("manifest digest does not match its content")
    digest = header or computed
    if not DIGEST_RE.match(digest):
        raise RuntimeError(f"invalid manifest digest: {digest!r}")
    if reference.startswith("sha256:") and reference != digest:
        raise RuntimeError("manifest digest does not match the requested digest")
    manifest = json.loads(body)
    if not isinstance(manifest, dict):
        raise RuntimeError("manifest is not an object")
    return digest, manifest


def host_arch() -> str:
    machine = platform.machine().lower()
    return {
        "x86_64": "amd64",
        "amd64": "amd64",
        "aarch64": "arm64",
        "arm64": "arm64",
    }.get(machine, machine)


def select_platform_manifest(index: dict, arch: str) -> str:
    for entry in index.get("manifests") or []:
        if not isinstance(entry, dict):
            continue
        platform = entry.get("platform") or {}
        if not isinstance(platform, dict):
            continue
        if (
            platform.get("os") == "linux"
            and platform.get("architecture") == arch
        ):
            platform_digest = entry.get("digest")
            if isinstance(platform_digest, str) and DIGEST_RE.match(
                platform_digest
            ):
                return platform_digest
    raise RuntimeError(f"latest image index has no linux/{arch} manifest")


def get_config_labels(
    base: str, repository: str, config_digest: str, token: str
) -> dict[str, str]:
    if not DIGEST_RE.match(config_digest):
        raise RuntimeError(f"invalid config digest: {config_digest!r}")
    url = f"{base}/v2/{repository}/blobs/{config_digest}"
    body, _ = http_get(url, {"Authorization": f"Bearer {token}"})
    computed = "sha256:" + hashlib.sha256(body).hexdigest()
    if computed != config_digest:
        raise RuntimeError("config blob digest does not match its content")
    config = json.loads(body)
    if not isinstance(config, dict):
        raise RuntimeError("image config is not an object")
    inner = config.get("config")
    if not isinstance(inner, dict):
        raise RuntimeError("image config has no config object")
    labels = inner.get("Labels")
    if labels is None:
        return {}
    if not isinstance(labels, dict):
        raise RuntimeError("image config labels are not an object")
    return labels


def fetch_latest(base: str, repository: str) -> tuple[str, str]:
    """Return (latest manifest digest, immutable revision SHA)."""
    token = get_token(base, repository)
    digest, manifest = get_manifest(base, repository, "latest", token)

    manifests = manifest.get("manifests")
    if manifests is not None:
        if not isinstance(manifests, list):
            raise RuntimeError("image index manifests is not a list")
        platform_digest = select_platform_manifest(manifest, host_arch())
        _, manifest = get_manifest(
            base, repository, platform_digest, token, ACCEPT_IMAGE
        )

    config = manifest.get("config")
    if not isinstance(config, dict):
        raise RuntimeError("image manifest has no config object")
    config_digest = config.get("digest")
    if not isinstance(config_digest, str) or not DIGEST_RE.match(config_digest):
        raise RuntimeError("image manifest has an invalid config digest")

    labels = get_config_labels(base, repository, config_digest, token)
    source = labels.get("org.opencontainers.image.source", "").strip()
    if source not in {EXPECTED_SOURCE, LEGACY_SOURCE}:
        raise RuntimeError(
            "latest image source label must be "
            f"{EXPECTED_SOURCE!r} or {LEGACY_SOURCE!r}"
        )
    revision = labels.get("org.opencontainers.image.revision", "").strip()
    if not SHA_RE.match(revision):
        raise RuntimeError(
            "latest image has no valid org.opencontainers.image.revision label"
        )
    return digest, revision


def read_text(path: Path) -> str | None:
    try:
        value = path.read_text().strip()
        return value or None
    except FileNotFoundError:
        return None


def write_atomic(path: Path, value: str) -> None:
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(value + "\n")
    os.replace(temporary, path)


def read_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None


def within_backoff(
    failure: dict | None, *, now: float | None = None, backoff: int = 1800
) -> bool:
    if not failure or not isinstance(failure, dict):
        return False
    try:
        failed_at = float(failure.get("failed_at", 0))
    except (TypeError, ValueError):
        failed_at = 0
    return (time.time() if now is None else now) - failed_at < backoff


def main(argv: list[str]) -> int:
    check_only = "--check-only" in argv
    os.umask(0o077)

    image = os.environ.get("APP_IMAGE", DEFAULT_IMAGE)
    state_dir = Path(os.environ.get("STATE_DIR", DEFAULT_STATE_DIR))
    base = registry_base()

    try:
        _, repository = parse_image(image)
        digest, revision = fetch_latest(base, repository)
    except (
        ValueError,
        RuntimeError,
        urllib.error.URLError,
        urllib.error.HTTPError,
        http.client.HTTPException,
        TimeoutError,
        json.JSONDecodeError,
        OSError,
    ) as exc:
        log(f"registry check failed: {exc}", error=True)
        return 1

    log(f"latest digest={digest} revision={revision}")
    if check_only:
        return 0

    try:
        state_dir.mkdir(parents=True, exist_ok=True)
        lock_fd = os.open(
            state_dir / "lock", os.O_CREAT | os.O_RDWR, 0o600
        )
    except OSError as exc:
        log(f"cannot prepare state directory: {exc}", error=True)
        return 1

    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log("another pull-agent run is active")
        return 0

    last_digest = read_text(state_dir / "last-digest")
    last_sha = read_text(state_dir / "last-sha")
    if digest == last_digest and revision == last_sha:
        log("no new image")
        return 0

    failure_path = state_dir / "failure.json"
    failure = read_json(failure_path)
    if failure is not None and not isinstance(failure, dict):
        failure = None
    backoff = int(os.environ.get("FAILURE_BACKOFF_SECONDS", "1800"))
    if (
        failure
        and failure.get("digest") == digest
        and within_backoff(failure, backoff=backoff)
    ):
        log(f"same digest failed recently; backing off for {backoff}s")
        return 0

    log(f"new image detected; deploying {revision}")
    try:
        result = subprocess.run(
            [DEPLOY_SCRIPT, "--tag", revision],
            check=False,
        )
    except OSError as exc:
        log(f"cannot run deploy script: {exc}", error=True)
        return 1

    if result.returncode == 0:
        write_atomic(state_dir / "last-digest", digest)
        write_atomic(state_dir / "last-sha", revision)
        try:
            failure_path.unlink()
        except FileNotFoundError:
            pass
        log(f"deployed {revision} successfully")
        return 0

    attempts = int((failure or {}).get("attempts", 0)) + 1
    write_atomic(
        failure_path,
        json.dumps(
            {
                "digest": digest,
                "sha": revision,
                "failed_at": time.time(),
                "attempts": attempts,
            },
            sort_keys=True,
        ),
    )
    log(
        f"deployment of {revision} failed; deploy.sh handles rollback",
        error=True,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
