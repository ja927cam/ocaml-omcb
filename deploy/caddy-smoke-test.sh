#!/usr/bin/env bash
#
# WebSocket-through-Caddy smoke test used by CI.
#
#   deploy/caddy-smoke-test.sh <image:tag> [port]
#
# Runs the application and Caddy on an isolated Docker network with a local
# HTTP-only Caddyfile, then drives a real WebSocket move through Caddy. This
# validates the same reverse_proxy path used in production, without ACME.
set -Eeuo pipefail

IMAGE="${1:?usage: deploy/caddy-smoke-test.sh <image:tag> [port]}"
PORT="${2:-$((18100 + RANDOM % 300))}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUFFIX="$$-$RANDOM"
APP="sim-map-caddy-app-${SUFFIX}"
CADDY="sim-map-caddy-${SUFFIX}"
NETWORK="sim-map-caddy-net-${SUFFIX}"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/sim-map-caddy-smoke.XXXXXX")"
DATA_DIR="${TMP}/data"
CADDYFILE="${TMP}/Caddyfile"

cleanup() {
  docker rm -f "${APP}" "${CADDY}" >/dev/null 2>&1 || true
  docker network rm "${NETWORK}" >/dev/null 2>&1 || true
  rm -rf "${TMP}"
}
trap cleanup EXIT

fail() {
  printf 'caddy-smoke: ERROR: %s\n' "$*" >&2
  docker logs "${APP}" >&2 2>/dev/null || true
  docker logs "${CADDY}" >&2 2>/dev/null || true
  exit 1
}

mkdir -p "${DATA_DIR}"
chmod 0777 "${DATA_DIR}"

cat > "${CADDYFILE}" <<'CADDY'
:80 {
	reverse_proxy app:8080
}
CADDY

docker network create "${NETWORK}" >/dev/null

docker run -d --name "${APP}" --network "${NETWORK}" --network-alias app --init \
  -e SIM_MAP_INTERFACE=0.0.0.0 \
  -e SIM_MAP_PORT=8080 \
  -e SIM_MAP_DATA_DIR=/var/lib/sim-map/data \
  -v "${DATA_DIR}:/var/lib/sim-map/data" \
  "${IMAGE}" >/dev/null

for attempt in $(seq 1 60); do
  if docker exec "${APP}" curl -fsS http://127.0.0.1:8080/readyz >/dev/null 2>&1; then
    break
  fi
  [[ "${attempt}" -eq 60 ]] && fail "application did not become ready"
  sleep 1
done

# Caddy's site is ":80"; use an upstream name that resolves on the network.
docker run -d --name "${CADDY}" --network "${NETWORK}" \
  -p "127.0.0.1:${PORT}:80" \
  -v "${CADDYFILE}:/etc/caddy/Caddyfile:ro" \
  caddy:2.8.4-alpine >/dev/null

for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
    break
  fi
  [[ "${attempt}" -eq 30 ]] && fail "Caddy did not proxy the health endpoint"
  sleep 1
done

NODE_WS_FLAG=""
if ! node -e 'process.exit(typeof WebSocket === "undefined" ? 1 : 0)' >/dev/null 2>&1; then
  if node --experimental-websocket -e 'process.exit(typeof WebSocket === "undefined" ? 1 : 0)' >/dev/null 2>&1; then
    NODE_WS_FLAG="--experimental-websocket"
  else
    fail "node does not provide a WebSocket client"
  fi
fi

SIM_MAP_WS_URL="ws://127.0.0.1:${PORT}/ws" \
  node ${NODE_WS_FLAG} "${SCRIPT_DIR}/smoke-client.js" \
  || fail "WebSocket move through Caddy failed"

printf 'caddy-smoke: WebSocket upgrade through Caddy passed\n'
