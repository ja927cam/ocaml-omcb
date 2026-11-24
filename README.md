# One Million Chessboards — OCaml

Server-authoritative world of 1,000 × 1,000 chessboards (64,000,000 squares,
32,000,000 starting pieces), with a pannable WASM/Brr grid client, a 25 × 25
board snapshot cache, one-byte snapshot pieces, live move broadcasts over a
binary WebSocket protocol.

## Build and run

```bash
# once per opam switch: apply the pinned httpun-ws failed-write patch
scripts/pin-httpun-ws.sh

dune build
dune runtest
_build/default/server/server.exe
```

With the server running, the browser grid integration test can be run with:

```bash
node test/client_snapshot_test.js
```

Live update tests:

```bash
node test/live_update_test.js   # real two-client fan-out and subscriptions
node test/live_client_test.js   # browser cache apply, duplicate and gap handling
node test/snapshot_consistency_test.js  # snapshot/move race and concurrent clients
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
pans by one board, that the client stays within a 25 × 25 cache window, that
cross-board quiet moves work, that off-board and off-home captures are
blocked, and that moves persist across board switches and a
cache eviction/re-fetch. On each run it probes a pristine 5 × 5 block
(revision 0 and the standard starting position) because moves are
authoritative and remain on the running server.

Operational failure injection covers WAL append/fsync/rotation, snapshot
write/fsync/rename/directory-fsync failures and shutdown during writes:

```bash
node test/failure_injection_test.js
```

Adaptive-mode stability is exercised by a changing-workload soak test:

```bash
node test/adaptive_soak_test.js                  # 30 minutes
SOAK_PHASE_SECONDS=10 node test/adaptive_soak_test.js  # smoke
```

See `docs/FAILURE_AUDIT.md` for the hardening audit, defects and results.

The server listens on `http://localhost:8080`. On first startup it creates the
complete world and an empty write-ahead log. On later startups it restores the
newest valid snapshot and replays committed WAL records before accepting any
connection.

## Persistence

The authoritative world is durable by default:

- `data/` (or `SIM_MAP_DATA_DIR`) holds `wal-<first-sequence>.log` segments and
  `snapshot-<sequence>.snap` files.
- Every accepted move is appended to the WAL, and responses/events are
  published only after the group's fsync. By default a bounded adaptive
  controller chooses the commit batch from move arrivals, queued moves, recent
  fsync percentiles, client outbox depth and broadcast lag. Fixed group commit
  remains the fallback: `SIM_MAP_ADAPTIVE=0` commits up to 64 consecutive moves
  per fsync, `SIM_MAP_WAL_GROUP=1` (with adaptive off) gives strict per-move
  fsync, and `SIM_MAP_WAL_SYNC=0` disables fsync for development.
- The controller never validates or orders moves, and every group is still
  fsynced before responses or events are published.
- A full-world snapshot is taken after `SIM_MAP_SNAPSHOT_MOVES` commits
  (default 100,000) or `SIM_MAP_SNAPSHOT_SECONDS` seconds (default 600),
  whichever comes first.
- Snapshots are written to a temporary file, fsynced, renamed into place and
  the directory fsynced. Two snapshot generations are retained; WAL segments
  covered by the older retained snapshot are removed only after the newer
  snapshot is durable.

Environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `SIM_MAP_DATA_DIR` | `data` | Directory for the WAL and snapshots |
| `SIM_MAP_WAL_GROUP` | `64` | Fallback max consecutive moves per commit fsync (`1` = strict per-move) |
| `SIM_MAP_WAL_SYNC` | `1` | Enable WAL fsync (`0` for development only) |
| `SIM_MAP_ADAPTIVE` | `1` | Adaptive commit controller (`0` = fixed fallback policy) |
| `SIM_MAP_ADAPTIVE_MIN` | `1` | Minimum adaptive batch size |
| `SIM_MAP_ADAPTIVE_MAX` | `256` | Maximum adaptive batch size |
| `SIM_MAP_ADAPTIVE_MIN_DELAY_US` | `0` | Minimum adaptive group-formation delay |
| `SIM_MAP_ADAPTIVE_MAX_DELAY_US` | `2000` | Maximum adaptive group-formation delay |
| `SIM_MAP_ADAPTIVE_HYSTERESIS` | `3` | Samples required before increasing the policy |
| `SIM_MAP_SNAPSHOT_MOVES` | `100000` | Commit count between snapshots (`0` disables) |
| `SIM_MAP_SNAPSHOT_SECONDS` | `600` | Seconds between snapshots (`0` disables) |

`GET /state-hash` returns the current global sequence and a digest of the
board, revisions and bounded ledger. It is intended for recovery tests and
diagnostics; computing it reads the whole world and takes about a second.

## Controls

The board grid fills the whole window.

- Drag empty space (or use a non-left button) to pan.
- Drag a piece to move it. Quiet moves may cross board boundaries. A piece
  can only capture while it is on its own original board; leaving clears the
  capturable bit and returning restores it.
- The current centre is shown in the top-right corner.
- `?x=<board_x>&y=<board_y>` opens the client centred on that board.
- At 216 px per board, roughly three boards fit vertically in a 700 px
  window; larger windows show more of the world.

## Documentation

- `SPEC.md` — complete implementation specification and invariants.
- `docs/ALGORITHMS.md` — algorithm design, complexity, benchmarks, testing and
  formal-verification opportunities.
- `bench/README.md` — benchmark runner and dashboard.
- `docs/FAILURE_AUDIT.md` — production-hardening and failure-injection audit.

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
curl -s http://localhost:8080/metrics
```

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
