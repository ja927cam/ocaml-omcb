# Benchmarks

Run from the repository root:

```bash
dune exec bench/bench.exe
```

This writes:

- `bench/results.json` — machine-readable results;
- `bench/results.js` — the same results for the static dashboard.

Open `bench/dashboard.html` in a browser after a run.

## Live load test

`bench/load_test.js` is the end-user load harness. It opens concurrent
WebSocket clients, subscribes each to a 25 × 25 board window, floods snapshots,
drives moves from several clients, and checks every broadcast frame.

Start a fresh server in one terminal:

```bash
_build/default/server/server.exe
```

Then, in another terminal, run the representative profile:

```bash
LOAD_PROFILE=default node bench/load_test.js
```

For the stress profile, restart the server first (the harness needs boards that
are still at revision 0 with their starting pawns), then run:

```bash
LOAD_PROFILE=stress node bench/load_test.js
```

The profiles are:

| Profile | Clients | Silent | Snapshots | Moves | Drivers | Fresh block | Requests |
|---|---:|---:|---:|---:|---:|---:|---:|
| `default` | 40 | 4 | 408 | 100 | 20 | 10 × 10 | 596 |
| `stress` | 80 | 4 | 808 | 200 | 40 | 15 × 15 | 1,176 |

Every value can be overridden, for example
`LOAD_CLIENTS=120 LOAD_MOVES=300 LOAD_BLOCK=20 LOAD_OUTPUT=load_custom
node bench/load_test.js`. `LOAD_MOVES` may not exceed `LOAD_BLOCK²`, and the
window radius is fixed at 12 (a 25 × 25 window).

The harness writes:

- `load_default_results.json` / `load_stress_results.json` — machine-readable
  results;
- the matching `.md` summaries;
- the matching `.js` files, which the dashboard loads.

A detached helper (`bench/load_after.js`) waits for the load process to exit,
then appends the server's final fd count, RSS and idle CPU to the JSON and
Markdown. `ws_write_failure_test.js` covers the deliberate dead-socket path.

### What is measured

- Active clients and silent clients. Both issue snapshots; silent clients
  subscribe to a far-away window and must receive **zero** move events.
- Snapshot RTT, move RTT, and event delivery lag (first arrival relative to the
  move send time), with p50/p95/p99/max.
- Move acceptance and rejection counts, request-ID echo, sequence uniqueness,
  and per-client event coverage.
- Event contents: board coordinates, per-board revision, request ID, square
  count, source emptied, destination occupied.
- Duplicate and missing event detection, extra events, and unexpected closes.
- Server RSS, file descriptors, process-wide CPU average and peak, and idle CPU
  after clients leave.

### Method and limits

- Snapshots are issued sequentially per connection, matching the browser
  client, which keeps one request in flight. Concurrency comes from the number
  of connections, not from pipelining one client.
- Moves are `e2e4` on distinct boards in a freshly probed block. Each board is
  expected to move from revision 0 to revision 1, so a wrong or duplicate
  event is unambiguous.
- The load runs over loopback on one machine. It measures server and protocol
  behaviour, not WAN latency, TLS, or multi-host effects.
- CPU is process-wide. Linux accounts CPU in 10 ms ticks, so the peak is
  computed over ~100 ms windows; averages use the whole run.
- Event fan-out cost grows with the number of subscribed clients. The stress
  profile deliberately shows the fan-out cost: move RTT p50 rises from about
  2.3 ms at 40 clients to about 7.3 ms at 80 clients, while every event is
  still delivered exactly once.
- Above roughly 400 clients the single Node load process is itself part of the
  bottleneck: it parses every event and drives the move stream. Server CPU
  stays below 62% at 1,020 clients, so the top-end latency is not purely server
  saturation. The server-side stage timings separate the two.
- The server uses Dream's normal WebSocket close path with the pinned
  `httpun-ws` patch described in `vendor/README.md`. A failed write discards
  pending bytes and closes both loops, so a dead client cannot spin the server.
- The 4,096-byte wire frame is deliberate: Dream buffers until 4 KiB. Event
  frames are batched by default: one kind-4 frame carries up to ~150 compact
  event records, so a burst of 4,000 recipient events can use ~300 writes
  instead of 4,000. The origin connection is flushed before its response; other
  clients batch for a 1 ms window. Set `EVENT_BATCHING=0` to compare against
  one-event-per-frame behaviour, or `EVENT_BATCH_WINDOW_MS` to tune the batch
  window.

### Recorded results

Current default: synchronous WAL fsync, data directory on `/home` (btrfs,
`compress=zstd:3`), event batching enabled.

| Profile | Requests | Throughput | Snapshot p50 | Move p50 | Event lag p50 | CPU avg / peak | RSS peak | fds peak |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `default` | 596 | 1,065/s | 2.6 ms | 35.0 ms | 38.9 ms | 8.9% / 19.6% | 543 MiB | 52 |
| `stress` | 1,176 | 1,546/s | 3.1 ms | 57.2 ms | 63.9 ms | 15.8% / 29.7% | 552 MiB | 92 |

Both runs had 100% move acceptance, 100% valid snapshots, exactly one event per
move per active client, no duplicates or misses, no events leaked to silent
clients, and no unexpected closes.

The same profiles with the WAL on tmpfs, or with `SIM_MAP_WAL_SYNC=0`, are much
faster: `default` ~1,822-2,006 requests/s with move p50 2.6 ms; `stress`
~3,112 requests/s with move p50 9.0 ms. On the real filesystem, fsync adds
about 1.4 ms at p50 and 30-80 ms at p99, which is the dominant move-latency
term. A 37,500-move acknowledged stream took 73.6 s (about 510 moves/s) with
synchronous fsync on btrfs, versus about 11.6 s on tmpfs. This is the explicit
durable-before-publish trade-off; group commit is the next optimisation.

Event frames are batched: the default run used 334 WebSocket writes for 4,000
recipient events, and the stress run used 1,306 writes for 16,000.

### Server pipeline metrics

The server exposes an aggregate `/metrics` endpoint:

```bash
curl -s http://localhost:8080/metrics
```

Every move is recorded through these stages:

| Stage | Meaning |
|---|---|
| `receive_to_submit` | request bytes received → queued for the state worker |
| `worker_queue_wait` | queued → worker starts processing |
| `move_processing` | actual `Move_engine.process` cost |
| `commit_to_broadcast` | commit → event handed to the broadcaster |
| `broadcast_wait` | handed to broadcaster → `flush_through` starts (batching/scheduler wait) |
| `broadcast_dispatch` | recipient lookup |
| `encoding` | event serialisation |
| `outbox_enqueue` | appending the event to every recipient outbox |
| `websocket_write` | per-recipient send completion (measured per written frame) |
| `end_to_end_broadcast` | request received → last recipient write |

The endpoint also reports:

- worker queue depth/capacity and processed/rejected counts;
- aggregate events, recipients, outbox enqueues, drops, send failures and
  full-outbox unregisters;
- client count, total subscription count, current/max outbox depth and the
  configured capacity.

The server records aggregate ring-buffer samples, not per-event logs. The
latest default run shows why the stage breakdown matters:

| Stage | p50 | p95 |
|---|---:|---:|
| receive → submit | 0.0002 ms | 0.0006 ms |
| worker queue wait | 0.019 ms | 0.12 ms |
| move processing | 0.0006 ms | 0.002 ms |
| commit → broadcaster | 0.0003 ms | 0.0007 ms |
| broadcast wait | 0.069 ms | 0.45 ms |
| recipient lookup | 0.003 ms | 0.005 ms |
| encoding | 0.0003 ms | 0.0007 ms |
| outbox enqueue | 0.002 ms | 0.005 ms |
| WebSocket write | 0.010 ms | 0.021 ms |
| end-to-end broadcast | 1.98 ms | 3.2 ms |

The dominant term is no longer dispatch: **broadcast wait** fell from ~4.3 ms
to ~0.07 ms after event batching, and outbox enqueue fell from ~0.45 ms to
~0.002 ms. The remaining end-to-end time is mostly the timer window that lets
non-origin clients accumulate a batch, plus the last recipient write. Recipient
lookup and encoding remain negligible. The server-side end-to-end figure
excludes client receive/scheduling; client event lag is consistently a few
milliseconds higher.

## Client-count scaling

Run the progressive matrix:

```bash
SCALE_CLIENTS=0,20,40,80,160,200,320,400,600,640,800,1020 \
SCALE_MOVES=100 SCALE_SNAPSHOTS=4 \
node bench/run_scaling.js
```

`run_scaling.js` starts a fresh server child per level, waits for `/metrics`,
runs `load_test.js` with the exact child PID, waits for the post-exit
measurement, then stops only that child. It writes `scale_results.json` and
`scale_results.js` after every level. If a level is unstable the runner stops
by default (`SCALE_STOP_ON_FAIL=0` continues).

### Current default: synchronous persistence on btrfs

`SCALE_CLIENTS=0,20,40,80,160,320,640,800,1020`, 100 moves and 4 snapshots per
client, data directory on `/home`:

| Clients | Requests | Req/s | Snapshot p50 | Move p50 | Event lag p50 | CPU avg | RSS | fds | Errors |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | 236 | 441 | 1.4 ms | 30.2 ms | 31.8 ms | 7.5% | 538 MiB | 32 | 0 |
| 40 | 356 | 744 | 1.9 ms | 72.9 ms | 75.5 ms | 8.4% | 541 MiB | 52 | 0 |
| 80 | 596 | 1,149 | 6.2 ms | 96.3 ms | 99.1 ms | 13.5% | 546 MiB | 92 | 0 |
| 160 | 1,076 | 1,828 | 9.3 ms | 55.9 ms | 66.0 ms | 17.0% | 558 MiB | 172 | 0 |
| 320 | 2,036 | 2,840 | 19.9 ms | 102.4 ms | 115.6 ms | 25.1% | 581 MiB | 332 | 0 |
| 640 | 3,956 | 3,203 | 37.7 ms | 209.9 ms | 248.3 ms | 31.6% | 636 MiB | 652 | 0 |
| 800 | 4,916 | 4,075 | 52.1 ms | 197.6 ms | 219.4 ms | 39.0% | 655 MiB | 812 | 0 |
| 1,020 | 6,236 | 4,540 | 60.8 ms | 202.3 ms | 236.3 ms | 41.5% | 687 MiB | 1,033 | 0 |

Every level delivered every event exactly once, with zero errors. Move latency
is dominated by fsync: the worker serialises commits, and individual btrfs
fsyncs occasionally spike to tens of milliseconds (visible in the non-monotonic
40/80/160 ms and the 1,020-client p95 of 241 ms). CPU average falls at the top
end because the worker is blocked on durability, not because the fan-out became
cheap. Group commit is the next optimisation if sustained move throughput
matters.

### Earlier baseline: no synchronous fsync / tmpfs

The same matrix before persistence was added:

| Clients | Requests | Req/s | Snapshot p50 | Move p50 | Event lag p50 | CPU avg | RSS | fds | Errors |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | 236 | 791 | 1.6 ms | 3.1 ms | 2.6 ms | 6.7% | 522 MiB | 32 | 0 |
| 40 | 356 | 1,145 | 2.8 ms | 5.8 ms | 5.6 ms | 6.4% | 525 MiB | 52 | 0 |
| 80 | 596 | 1,777 | 4.3 ms | 10.1 ms | 9.1 ms | 11.9% | 531 MiB | 92 | 0 |
| 160 | 1,076 | 2,859 | 8.5 ms | 10.7 ms | 16.3 ms | 18.6% | 542 MiB | 172 | 0 |
| 200 | 1,316 | 3,487 | 10.2 ms | 12.6 ms | 21.0 ms | 26.5% | 548 MiB | 212 | 0 |
| 320 | 2,036 | 4,224 | 20.1 ms | 25.2 ms | 29.3 ms | 37.3% | 568 MiB | 332 | 0 |
| 400 | 2,516 | 4,610 | 25.1 ms | 21.4 ms | 29.1 ms | 40.3% | 579 MiB | 412 | 0 |
| 600 | 3,716 | 5,549 | 33.1 ms | 38.1 ms | 51.1 ms | 50.8% | 615 MiB | 612 | 0 |
| 640 | 3,956 | 5,629 | 34.3 ms | 28.8 ms | 55.1 ms | 52.6% | 620 MiB | 652 | 0 |
| 800 | 4,916 | 6,166 | 44.5 ms | 55.3 ms | 66.6 ms | 57.7% | 639 MiB | 812 | 0 |
| 1,020 | 6,236 | 6,976 | 55.4 ms | 62.2 ms | 85.5 ms | 60.4% | 666 MiB | 1,032 | 0 |

This baseline is partly client-harness limited at the top end: the single Node
process parses and applies 102,000 events while driving 100 moves. At 1,020
clients, recipient lookup p50 is ~0.13 ms and outbox enqueue p50 is ~0.11 ms;
the end-to-end time is dominated by the batch window and client processing.
The persistence run above is instead dominated by per-move fsync.

## Subscription distributions

Run the three overlap scenarios at the same client count and the same number
of 25 × 25 windows:

```bash
SCALE_CLIENTS=80 SCALE_DISTRIBUTIONS=high,low,partial \
SCALE_MOVES=100 SCALE_SNAPSHOTS=4 \
node bench/run_scaling.js
```

Results on the same machine:

| Overlap | Recipients / move | Move p50 | Move p95 | Event lag p50 | Missing | Extra |
|---|---:|---:|---:|---:|---:|---:|
| High (all clients share one region) | 80.0 | 7.6 ms | 17.4 ms | 9.0 ms | 0 | 0 |
| Low (clients spread across the world) | 1.0 | 1.6 ms | 2.7 ms | 1.8 ms | 0 | 0 |
| Partial (clusters around several regions) | 20.0 | 3.6 ms | 7.4 ms | 3.4 ms | 0 | 0 |

Each client still owns 625 subscriptions, so the total subscription count is
comparable. Low overlap proves unrelated clients are not involved; high overlap
isolates fan-out cost; partial overlap is the representative middle.

## Slow and non-reading clients

`bench/slow_client_test.js` starts its own server with
`CONNECTION_OUTBOX_CAPACITY=8`, then runs four scenarios against 20 normal
clients and 37,500 moves (25 boards × 1,500 rounds):

```bash
node bench/slow_client_test.js
```

| Scenario | Slow behavior | Normal lag p50 / p95 | Max outbox | Dropped events | Send failures | Recovery |
|---|---|---:|---:|---:|---:|---|
| `baseline` | no slow client | 0.81 / 2.18 ms | 1 / 8 | 0 | 0 | n/a |
| `paused-short` | stops reading, resumes after the burst | 0.79 / 2.05 ms | 8 / 8 | 11,746 | 0 | same connection, rev 1500 |
| `paused-long` | stops reading past the 2 s send timeout | 0.79 / 2.05 ms | 8 / 8 | 11,099 | 27 | reconnected, rev 1500 |
| `slow-read` | reads one chunk every 200 ms | 0.79 / 2.08 ms | 8 / 8 | 12,430 | 0 | same connection, rev 1500 |

This is the key reliability result: one non-reading client does **not** block
the broadcaster, and normal-client lag is effectively identical to the
baseline. When the outbox is at capacity, the server drops the oldest event
frames (keeping response promises intact), so the queue is bounded. A client
that resumes can detect the revision gap and recover with a fresh snapshot.
A client that stays blocked past the 2 s sender timeout is unregistered; a new
connection recovers with a snapshot.

## Write-failure reliability

Apply the pinned `httpun-ws` patch once per opam switch:

```bash
scripts/pin-httpun-ws.sh
```

Then, with a server running:

```bash
node test/ws_write_failure_test.js
```

The test pauses a raw client, generates 37,500 moves, resets its TCP socket,
and checks that the server remains responsive with 0 idle CPU ticks/s, records
failed sends, unregisters the connection, and still serves a surviving client.
`test/test_wsd.ml` tests the failed-write transition directly.

## Snapshot consistency

The snapshot handoff is tested at two levels:

- `test/test_connection_manager.ml` deterministically checks that a pending
  snapshot buffers events, discards records represented by the snapshot
  revision, releases newer records in revision order, splits a cross-board
  move when one board is pending, and ignores a superseded snapshot token.
- `test/snapshot_consistency_test.js` races a snapshot request against a move
  on 20 fresh boards, then races five snapshot clients against one move. Each
  client must end with the moved pawn regardless of whether the move landed
  before or after the snapshot. The latest run recorded 20/20
  buffered-after-snapshot races and 25 concurrent snapshot clients.

The server-side sequence is: register subscription → submit snapshot to the
worker → capture board + int64 revision → mark snapshot complete and filter
buffered events → enqueue snapshot → release newer events. No WebSocket write
ever runs inside the worker.

## Crash recovery

`test/crash_recovery_test.js` spawns real servers against isolated data
directories and kills them with SIGKILL, including deliberate WAL and snapshot
fault points. It compares `/state-hash` before and after restart and also
checks cross-board and special-move squares. Results are written to
`bench/crash_recovery_results.json` and `.js`.

Reference run: 9/9 cases passed in about 47 seconds. Recovery of 37,538
replayed WAL records took about 0.4 s; a 536,777,268-byte snapshot write took
about 1.3 s including checksum and fsync; loading a snapshot took about
0.9-1.9 s.

The in-process `test/test_persistence.ml` additionally covers WAL/snapshot
format round trips, torn records, corrupt snapshots, promotion and a 200-move
synchronous WAL replay.

## Adding a benchmark

Use `run_bench` in `bench/bench.ml`:

```ocaml
run_bench ~group:"Group" ~name:"thing" ~variant:"algorithm A"
  ~iterations:100_000 (fun n ->
    for _ = 1 to n do
      (* operation *)
    done)
```

To compare algorithms, use the same `group` and `name` with different
`variant` labels. The dashboard scales bars against the fastest variant and
shows ns/op and operations per second.

Use `~single:true` for one-shot measurements such as startup phases; the
dashboard shows those in milliseconds.

## Method

- Monotonic timing via `Mtime_clock.now_ns`.
- Warmup followed by the median of three repetitions for loop benchmarks.
- Inputs are prepared outside the timed loop.
- Single-shot startup phases are labelled explicitly.
- Results include OCaml version, commit, CPU model and process RSS.

See `docs/ALGORITHMS.md` for the algorithm rationale and benchmark analysis.
