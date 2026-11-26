# One Million Chessboards — OCaml

Project: **`ocaml-omcb`**. The public site remains
**https://chess.jamesashwood.com**.

Server-authoritative world of 1,000 × 1,000 chessboards (64,000,000 squares,
32,000,000 starting pieces), with a pannable WASM/Brr grid client, a bounded
900-board LRU cache with a 25 × 25 prefetch window plus a small margin,
one-byte snapshot pieces, live move broadcasts over a binary WebSocket
protocol.

## Branches and production

- **`main` is the production branch.** Every push to `main` is tested, built and
  published to GHCR, then deployed to **https://chess.jamesashwood.com** by the
  VPS pull agent, normally within five minutes.
- **`develop` is the development/integration branch.** Push local work here (or
  to feature branches merged into it). Pushes to `develop` do not build or
  deploy production.
- Release by merging `develop` into `main`.

Existing production installs that were created before the `sim-map` rename
keep working from `/opt/sim-map` and pull the legacy
`ghcr.io/ja927cam/sim-map` image. The workflow publishes that legacy image
alongside `ghcr.io/ja927cam/ocaml-omcb`; the server also still reads
`SIM_MAP_*` environment variables as fallbacks. Migrate the host pull agent
and `/opt/sim-map` files to `/opt/ocaml-omcb` when convenient, then remove the
legacy image push.

## Build and run

```bash
# once per opam switch: apply the pinned httpun-ws failed-write patch
scripts/pin-httpun-ws.sh

dune build
dune runtest
_build/default/server/server.exe
```

## Docker

```bash
docker compose up --build -d
# open http://localhost:8080/
docker compose logs -f
docker compose down
```

The multi-stage image builds the OCaml server, the WASM client and the piece
atlas, then runs them as UID 10001 with a named volume for WAL/snapshot data.
See `deploy/README.md` for bind mounts and production notes.

With the server running, the browser grid integration test can be run with:

```bash
node test/client_snapshot_test.js
node test/client_load_perf_test.js   # isolated-server initial-load budget
node test/client_colour_test.js      # per-device colour assignment/persistence
node test/client_ownership_test.js   # devices only move their own colour
node test/client_piece_info_test.js  # double/triple-click piece information
```

The load performance test asserts that the initial 29 x 29 prefetch window
arrives in at most a few compact batch frames, under 16 KiB and under 500 ms in
a headless browser. A fresh standard window is one ~1.7 KiB frame. It also
compares the batched frame with the legacy per-board / 2.56 MiB path.

Live update tests:

```bash
node test/live_update_test.js   # real two-client fan-out and subscriptions
node test/live_client_test.js   # browser cache apply, duplicate and gap handling
node test/snapshot_consistency_test.js  # snapshot/move race and concurrent clients
node test/client_panning_test.js    # rapid panning, cache bound and settle time
node test/client_ui_test.js         # intro, help, zoom, minimap, mobile, status page
node test/client_tap_move_test.js   # touch tap-to-select and tap-to-move
node test/client_touch_test.js      # DPR-3 iPhone touch tap, move and pan
node test/client_cross_board_test.js  # same-square move onto an adjacent board
node test/client_activity_tally_test.js  # join-near-activity and king tally
node test/client_reconnect_test.js  # server restart / automatic reconnect
MODE=bounded node test/subscription_stress_test.js  # subscription/RSS bounds
MODE=add-only node test/subscription_stress_test.js # before comparison
node test/subscription_transition_test.js          # moves during window replacement
```

The WebSocket teardown regression test (Linux) repeatedly kills a headless
browser and verifies the server returns to idle:

```bash
node test/ws_teardown_test.js
node test/ws_write_failure_test.js  # deliberate socket reset + failed writes
```

Crash recovery is tested end to end by spawning real server processes against
isolated data directories and killing them at WAL and snapshot boundaries:

```bash
node test/crash_recovery_test.js
```

It checks that the nine centre boards are visible, that dragging empty space
pans by one board, that the bounded cache and 25 × 25 prefetch window stay
within their limits, that cross-board quiet moves work, that off-board and
off-home captures are blocked, and that moves persist across board switches
and a cache eviction/re-fetch. On each run it probes a pristine 5 × 5 block
(revision 0 and the standard starting position) because moves are
authoritative and remain on the running server.

Operational failure injection covers WAL append/fsync/rotation, snapshot
write/fsync/rename/directory-fsync failures and shutdown during writes:

```bash
node test/failure_injection_test.js
node test/deployment_smoke_test.js
```

Adaptive-mode stability is exercised by a changing-workload soak test:

```bash
node test/adaptive_soak_test.js                  # 30 minutes
SOAK_PHASE_SECONDS=10 node test/adaptive_soak_test.js  # smoke
```

Snapshot memory retention is profiled with:

```bash
node test/memory_profile_test.js
```

See `docs/FAILURE_AUDIT.md` for the hardening audit, defects and results.

The server listens on `http://localhost:8080`. On first startup it creates the
complete world and an empty write-ahead log. On later startups it restores the
newest valid snapshot and replays committed WAL records before accepting any
connection.

## Persistence

The authoritative world is durable by default:

- `data/` (or `OCAML_OMCB_DATA_DIR`) holds `wal-<first-sequence>.log` segments and
  `snapshot-<sequence>.snap` files.
- Every accepted move is appended to the WAL, and responses/events are
  published only after the group's fsync. By default a bounded adaptive
  controller chooses the commit batch from move arrivals, queued moves, recent
  fsync percentiles, client outbox depth and broadcast lag. Fixed group commit
  remains the fallback: `OCAML_OMCB_ADAPTIVE=0` commits up to 64 consecutive moves
  per fsync, `OCAML_OMCB_WAL_GROUP=1` (with adaptive off) gives strict per-move
  fsync, and `OCAML_OMCB_WAL_SYNC=0` disables fsync for development.
- The controller never validates or orders moves, and every group is still
  fsynced before responses or events are published.
- A full-world snapshot is taken after `OCAML_OMCB_SNAPSHOT_MOVES` commits
  (default 100,000) or `OCAML_OMCB_SNAPSHOT_SECONDS` seconds (default 600),
  whichever comes first.
- Snapshots are written to a temporary file, fsynced, renamed into place and
  the directory fsynced. Two snapshot generations are retained; WAL segments
  covered by the older retained snapshot are removed only after the newer
  snapshot is durable.

Environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `OCAML_OMCB_DATA_DIR` | `data` | Directory for the WAL and snapshots |
| `OCAML_OMCB_PORT` | `8080` | HTTP/WebSocket listen port |
| `OCAML_OMCB_WAL_GROUP` | `64` | Fallback max consecutive moves per commit fsync (`1` = strict per-move) |
| `OCAML_OMCB_WAL_SYNC` | `1` | Enable WAL fsync (`0` for development only) |
| `OCAML_OMCB_ADAPTIVE` | `1` | Adaptive commit controller (`0` = fixed fallback policy) |
| `OCAML_OMCB_ADAPTIVE_MIN` | `1` | Minimum adaptive batch size |
| `OCAML_OMCB_ADAPTIVE_MAX` | `256` | Maximum adaptive batch size |
| `OCAML_OMCB_ADAPTIVE_MIN_DELAY_US` | `0` | Minimum adaptive group-formation delay |
| `OCAML_OMCB_ADAPTIVE_MAX_DELAY_US` | `2000` | Maximum adaptive group-formation delay |
| `OCAML_OMCB_ADAPTIVE_HYSTERESIS` | `3` | Samples required before increasing the policy |
| `OCAML_OMCB_SNAPSHOT_MOVES` | `100000` | Commit count between snapshots (`0` disables) |
| `OCAML_OMCB_SNAPSHOT_SECONDS` | `600` | Seconds between snapshots (`0` disables) |
| `OCAML_OMCB_DEBUG_GC` | `0` | Test-only `/debug/gc` endpoint (`1` enables) |

`GET /state-hash` returns the current global sequence and a digest of the
board, revisions and bounded ledger. It is intended for recovery tests and
diagnostics; computing it reads the whole world and takes about a second.
`GET /healthz` and `GET /readyz` are lightweight liveness/readiness probes.
`GET /active.json` suggests a board near the densest cluster of current
viewers, or near recent moves when nobody else is connected. It also returns
bounded `viewers` and `recent` move lists used by the world minimap.
`GET /tally.json` returns the cumulative black/white king captures still
retained in the ledger. `GET /metrics` also includes `/proc` RSS, OCaml GC
statistics and explicit live-snapshot-copy accounting for operational
profiling.

`SIGTERM`/`SIGINT` drain the worker, wait up to 30 seconds for an in-flight
snapshot, fsync/close the WAL and exit 0. `SIGKILL` remains a crash. See
`deploy/README.md` for systemd, TLS reverse-proxy and backup guidance.

## Controls

The board grid fills the whole window.

- Scroll to zoom in and out around the pointer.
- Drag empty space (or use a non-left button) to pan.
- Drag a piece to move it, or tap a piece and then tap one of its highlighted
  destinations. Quiet moves may cross board boundaries. A piece can only
  capture while it is on its own original board; leaving clears the capturable
  bit and returning restores it.
- Castling can span boards. An unmoved king and rook on the same rank, with a
  clear path up to 36 squares apart, move to the two central squares between
  them and swap sides. Drag the king onto its destination, or drag the king
  onto the rook or the rook onto the king. Either piece loses this right after
  any move.
- The current centre is shown just above the minimap. Click it to enter
  coordinates, or call `window.simMapGoto(x, y)` from the console.
- `?x=<board_x>&y=<board_y>` opens the client centred on that board.
- Click a green viewer dot or a gold recent-move dot on the minimap to jump
  directly to that board.
- The bottom-left corner shows the running tally of black and white kings
  captured across the world. The minimap shows green dots for live viewers
  and fading gold dots for recent moves.
- At 216 px per board, roughly three boards fit vertically in a 700 px
  window; larger windows show more of the world.

## Hourly email report

`scripts/hourly_report.py` fetches `/metrics`, `/healthz` and `/readyz`,
compares the live counters with the previous successful run, and emails a
plain-text summary through `msmtp`. It flags queue buildup, websocket drops or
send failures, board-load failures, restarts, WAL/snapshot problems, high RSS
and sustained broadcast latency. The previous state is only advanced after a
successful send, so a failed email is covered by the next report.

Production runs it from the VPS as the `ocaml-omcb-hourly-report` systemd
timer. The compatibility install during the rename uses:

```text
/opt/sim-map/hourly_report.py
/root/.msmtprc                     (root-only SMTP config)
/var/lib/sim-map-hourly-report/   (comparison state)
```

Install or refresh it as root:

```bash
install -m 0755 scripts/hourly_report.py /opt/sim-map/hourly_report.py
install -m 0644 deploy/ocaml-omcb-hourly-report.service \
  /etc/systemd/system/ocaml-omcb-hourly-report.service
install -m 0644 deploy/ocaml-omcb-hourly-report.timer \
  /etc/systemd/system/ocaml-omcb-hourly-report.timer
install -d -m 0700 /var/lib/sim-map-hourly-report
systemctl daemon-reload
systemctl enable --now ocaml-omcb-hourly-report.timer
systemctl list-timers ocaml-omcb-hourly-report.timer
```

Preview a report without sending it or advancing the state:

```bash
OCAML_OMCB_REPORT_STATE=/var/lib/sim-map-hourly-report/state.json \
  python3 /opt/sim-map/hourly_report.py --dry-run
```

Recent runs and delivery errors:

```bash
journalctl -u ocaml-omcb-hourly-report.service
```

A first run establishes a baseline; later runs report one-hour deltas. The
timer's `Persistent=true` sends a missed report after the VPS wakes. For local
development, the same script can be run from the checkout; its default state
lives at `~/.local/state/ocaml-omcb-hourly-report/state.json`.

## Documentation

- `SPEC.md` — complete implementation specification and invariants.
- `docs/ALGORITHMS.md` — algorithm design, complexity, benchmarks, testing and
  formal-verification opportunities.
- `bench/README.md` — benchmark runner and dashboard.
- `docs/FAILURE_AUDIT.md` — production-hardening and failure-injection audit.
- `CHANGELOG.md` — recent release and hardening notes.
- `deploy/README.md` — systemd, reverse proxy, health, backups and capacity.
- `client/assets/README.md` — piece artwork source and attribution.

## Benchmarks

```bash
dune exec bench/bench.exe
```

Then open `bench/dashboard.html`. The suite measures board indexing and reads,
packed pieces, protocol codecs, move validation/application, ledger operations,
the full move engine, the Lwt worker, board snapshots, and startup phases.

The group-commit experiment sweeps batch sizes under write-only and fan-out
stress, checks client-visible correctness, and writes plots:

```bash
node bench/group_commit_experiment.js
# open bench/group_commit_report.html
```

The adaptive experiment compares fixed batches 16 and 64 with the controller
across quiet → heavy writes → quiet → high fan-out → mixed → snapshot
transitions. It checks every move and event and writes plots and a Markdown
summary:

```bash
ADAPTIVE_REPS=5 node bench/adaptive_commit_test.js   # 5 repetitions per mode
# open bench/adaptive_commit_report.html
```

## Live load test

With a freshly started server, run the representative end-user flood:

```bash
LOAD_PROFILE=default node bench/load_test.js
```

Restart the server, then run the larger profile:

```bash
LOAD_PROFILE=stress node bench/load_test.js
```

Each run opens 40–80 active WebSocket clients plus four silent clients,
subscribes them to 25 × 25 windows, issues hundreds of snapshots and 100–200
moves, and checks every event frame. Results are written to
`bench/load_default_results.*` and `bench/load_stress_results.*`; the dashboard
shows both profiles. See `bench/README.md` for the methodology and recorded
numbers.

The server exposes aggregate pipeline metrics while it runs:

```bash
curl -s http://localhost:8080/metrics          # JSON
curl -s http://localhost:8080/metrics.prom     # Prometheus text format
```

Both are public on production (`https://chess.jamesashwood.com/metrics`).
A human-readable dashboard is at
[`https://chess.jamesashwood.com/status`](https://chess.jamesashwood.com/status).
The JSON `board_load` object and the `ocaml_omcb_board_region_*` Prometheus
metrics group snapshot loading by 100 x 100 board regions (request/board
counts and p50/p95/max/last latency).

Live events are batched into kind-4 4 KiB frames by default, with the origin
connection flushed before its response and other clients batched on a 1 ms
window. Set `EVENT_BATCHING=0` to compare against one-event frames. The
instrumentation records receive→submit, worker queue, engine, commit→broadcaster,
broadcast wait, recipient lookup, encoding, outbox enqueue, WebSocket write and
end-to-end broadcast separately.

Progressive scaling and subscription-distribution matrices are self-contained
(they start and stop their own server child processes):

```bash
SCALE_CLIENTS=0,20,40,80,160,200,320,400,600,640,800,1020 \
  node bench/run_scaling.js
SCALE_CLIENTS=80 SCALE_DISTRIBUTIONS=high,low,partial \
  node bench/run_scaling.js
node bench/slow_client_test.js
```

`scale_results.js`, `dist_results.js` and `slow_results.js` drive the dashboard
sections for client-count scaling, overlapping subscriptions and slow/non-reading
clients. The slow test uses a deliberately small `CONNECTION_OUTBOX_CAPACITY`
and verifies that one bad client cannot block the broadcaster.

## Repository map

| Path | Contents |
|---|---|
| `lib/` | Piece, Board, Move, validation/application, ledger, state, engine, worker, connection manager |
| `protocol/` | Binary move/request/response codecs |
| `client/` | Canvas client in OCaml/WASM (Brr) |
| `server/` | Dream server and WebSocket endpoint |
| `test/` | Unit, browser, live-update and teardown integration tests |
| `bench/` | Speed benchmarks and static dashboard |
| `docs/` | Engineering/algorithm notes |
