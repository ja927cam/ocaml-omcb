# Deployment

The server is a single OCaml process with one authoritative writer. It is
designed to run behind a TLS reverse proxy on one machine; the WAL and
snapshots must live on persistent local storage.

## Build

```bash
scripts/pin-httpun-ws.sh
dune build --profile release
```

The binary is `_build/default/server/server.exe`. Install it at
`/opt/sim-map/server.exe` (or adjust `ExecStart`).

## Docker

The supplied multi-stage `Dockerfile` builds the server, the WASM client and
the piece atlas, then copies only the runtime artifacts into a slim Debian
image. The container runs as UID/GID `10001` and persists WAL and snapshots in
`/var/lib/sim-map/data`.

```bash
# Build and run with Compose (named volume, healthcheck, graceful stop):
docker compose up --build -d
docker compose logs -f
curl -fsS http://localhost:8080/healthz
docker compose down

# Or without Compose:
docker build -t sim-map .
docker run --rm --init -p 8080:8080 \
  -v sim-map-data:/var/lib/sim-map/data sim-map
```

The image sets `SIM_MAP_INTERFACE=0.0.0.0`, `SIM_MAP_PORT=8080` and
`SIM_MAP_DATA_DIR=/var/lib/sim-map/data`. The Compose service
waits 45 seconds on `SIGTERM` so the server can drain the worker and finish an
in-flight snapshot. `docker stop` therefore returns after the drain completes.

For a host bind mount instead of a named volume, make the directory writable by
UID/GID `10001`:

```bash
sudo install -d -o 10001 -g 10001 /srv/sim-map/data
docker run --rm --init -p 8080:8080 \
  -v /srv/sim-map/data:/var/lib/sim-map/data sim-map
```

The first start initialises the full world and creates an empty WAL. The
healthcheck uses `/healthz`; readiness is available at `/readyz` once the
listener is accepting. The container does not include a TLS proxy; terminate
TLS in front of it as described below.

## First install

```bash
sudo useradd --system --home /var/lib/sim-map --shell /usr/sbin/nologin sim-map
sudo install -d -o sim-map -g sim-map /var/lib/sim-map /var/lib/sim-map/data
sudo install -d /etc/sim-map /opt/sim-map
sudo install -m 0755 _build/default/server/server.exe /opt/sim-map/server.exe
sudo install -m 0644 deploy/sim-map.service /etc/systemd/system/sim-map.service
sudo install -m 0600 deploy/env.example /etc/sim-map/env
sudo systemctl daemon-reload
sudo systemctl enable --now sim-map
```

Use a reverse proxy such as the supplied `nginx.conf.example` for TLS and
WebSocket upgrades. Do not expose the OCaml process directly to the internet
without a proxy.

## Health and readiness

- `GET /healthz` — process is alive.
- `GET /readyz` — HTTP listener is accepting; startup recovery has completed
  before the listener starts.
- `GET /metrics` — JSON pipeline, worker, connection, persistence, memory and
  adaptive-controller metrics.
- `GET /state-hash` — sequence and full-world digest (diagnostics; expensive).
- `GET /debug/gc` — test-only full GC/compaction; returns 404 unless
  `SIM_MAP_DEBUG_GC=1`. Never enable it in production: it blocks the server.
- `GET /debug/memprof` — test-only Lwt/major-allocation sampling; returns 404
  unless `SIM_MAP_MEMPROF=1`. Never enable it in production.

## Shutdown and durability

`SIGTERM` now drains the worker, waits up to 30 seconds for an in-flight
snapshot, closes the WAL and exits 0. `SIGKILL` remains a crash test: recovery
replays the WAL and ignores incomplete snapshots.

Acknowledged moves are always past their group fsync. A crash can lose only
unacknowledged work or live events; clients should reconnect and resnapshot.

## Backups

Back up `SIM_MAP_DATA_DIR` (`wal-*.log` and `snapshot-*.snap`) as one unit.
Keep at least the newest snapshot and the WAL segments after the previous
retained snapshot. Do not copy a snapshot while it is still being written:
`SIGTERM` drains or wait for `/metrics` `persistence.snapshot_writing=false`.

## Capacity notes

- World RSS is roughly 520–550 MiB before persistence overhead.
- One reusable snapshot buffer adds about 512 MiB. Snapshot writes are about
  537 MiB; the buffer is retained so repeated snapshots do not inflate RSS.
  The final 30-minute soak (96 writers, 256 subscribers, repeated snapshots)
  held RSS at roughly 1.2 GiB. Budget 1.5 GiB plus headroom for the runtime
  and allocator; a 2 GiB service limit is a reasonable starting point.
- Set `LimitNOFILE` above the expected client count (default 65536).
- The single writer is usually limited by fsync and fan-out, not chess
  validation. Use the adaptive controller unless a fixed policy is required.

## Fixed/strict modes

```bash
# Fixed group commit, 64 moves per fsync
SIM_MAP_ADAPTIVE=0 SIM_MAP_WAL_GROUP=64

# Strict per-move fsync
SIM_MAP_ADAPTIVE=0 SIM_MAP_WAL_GROUP=1

# Development only: no fsync
SIM_MAP_WAL_SYNC=0
```
