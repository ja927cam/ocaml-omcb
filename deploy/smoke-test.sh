#!/usr/bin/env bash
#
# Container smoke test used by CI before publishing.
#
#   deploy/smoke-test.sh <image:tag> [port]
#
# Starts the image on a loopback port, checks HTTP and the WASM/static assets,
# performs a real WebSocket move, verifies a graceful SIGTERM shutdown, then
# replaces the container against the same data directory and checks that the
# WAL replayed (persistence.sequence > 0).
set -Eeuo pipefail

IMAGE="${1:?usage: deploy/smoke-test.sh <image:tag> [port]}"
PORT="${2:-18080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="ocaml-omcb-smoke-$$"
DATA_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ocaml-omcb-smoke-data.XXXXXX")"

cleanup() {
  docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
  rm -rf "${DATA_DIR}"
}
trap cleanup EXIT

fail() {
  printf 'smoke: ERROR: %s\n' "$*" >&2
  docker logs "${CONTAINER}" >&2 2>/dev/null || true
  exit 1
}

wait_ready() {
  local attempt
  for attempt in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${PORT}/readyz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_container() {
  docker run -d --name "${CONTAINER}" --init \
    -p "127.0.0.1:${PORT}:8080" \
    -e OCAML_OMCB_INTERFACE=0.0.0.0 \
    -e OCAML_OMCB_PORT=8080 \
    -e OCAML_OMCB_DATA_DIR=/var/lib/ocaml-omcb/data \
    -v "${DATA_DIR}:/var/lib/ocaml-omcb/data" \
    "${IMAGE}" >/dev/null
}

command -v docker >/dev/null || fail "docker is required"
command -v curl >/dev/null || fail "curl is required"
command -v node >/dev/null || fail "node is required"

# The app runs as UID 10001; this temporary directory belongs to the CI user.
chmod 0777 "${DATA_DIR}"

start_container
wait_ready || fail "container did not become ready"

curl -fsS "http://127.0.0.1:${PORT}/" | grep -q "One Million Chessboards" \
  || fail "index page was not served"
curl -fsS "http://127.0.0.1:${PORT}/static/main.bc.wasm.js" >/dev/null \
  || fail "client script was not served"
curl -fsS "http://127.0.0.1:${PORT}/static/pieces.png" >/dev/null \
  || fail "piece atlas was not served"

NODE_WS_FLAG=""
if ! node -e 'process.exit(typeof WebSocket === "undefined" ? 1 : 0)' >/dev/null 2>&1; then
  if node --experimental-websocket -e 'process.exit(typeof WebSocket === "undefined" ? 1 : 0)' >/dev/null 2>&1; then
    NODE_WS_FLAG="--experimental-websocket"
  else
    fail "node does not provide a WebSocket client"
  fi
fi
OCAML_OMCB_WS_URL="ws://127.0.0.1:${PORT}/ws" \
  node ${NODE_WS_FLAG} "${SCRIPT_DIR}/smoke-client.js" \
  || fail "websocket move failed"

find "${DATA_DIR}" -maxdepth 1 -name 'wal-*.log' -print -quit | grep -q . \
  || fail "no WAL file was written"

docker stop -t 45 "${CONTAINER}" >/dev/null || fail "docker stop failed"
code="$(docker inspect -f '{{.State.ExitCode}}' "${CONTAINER}")"
[[ "${code}" -eq 0 ]] || fail "graceful shutdown exited ${code} (expected 0)"

docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true

# Replace the container against the same persistent data directory.
start_container
wait_ready || fail "replacement container did not become ready"

sequence="$(curl -fsS "http://127.0.0.1:${PORT}/metrics" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["persistence"]["sequence"])')"
[[ "${sequence}" -gt 0 ]] \
  || fail "WAL did not replay after container replacement (sequence=${sequence})"

docker stop -t 45 "${CONTAINER}" >/dev/null || true
printf 'smoke: container, HTTP, WebSocket, graceful shutdown and WAL replay passed\n'
