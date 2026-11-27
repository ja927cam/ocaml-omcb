# Overnight performance and stress report

Generated: 2026-11-27 (Europe/Berlin)

Commit under test: `6e8ee0b` (server and client), plus the measurement
harnesses added in this report.

Machine: AMD Ryzen 7 250 (8 cores / 16 threads, 3.3 GHz boost), 29 GiB RAM,
btrfs on `/home` with `compress=zstd:3`, tmpfs on `/dev/shm` and `/tmp`.
Everything ran on one host over loopback unless a result explicitly says
"production" or "WAN".

This report is the evidence base for the systems chapters appended to
`docs/ALGORITHMS.md`. Raw results are in `bench/evening/`.

---

## Executive summary

| Path | Result | Conditions |
|---|---:|---|
| Chess engine, one core | **202 ns/move** (~4.9 M moves/s) | warm state, no I/O, microbenchmark |
| State worker | **412k moves/s** | sequential awaiter, no I/O |
| Durable write path | **11.9k–12.5k moves/s** | btrfs, fsync, 64 clients, group commit |
| Durable write path, strict fsync | **577 moves/s** | one fsync per move, 256 clients |
| Durable write path, no fsync | **21.1k moves/s** | same workload, `WAL_SYNC=0` |
| Write path on tmpfs | **35.1k moves/s** | 2,000,000 moves, ledger wrap verified |
| Snapshot batches | **~600k boards/s** | compact protocol, standard boards |
| Browser initial load | **462 ms for 841 boards** | production HTTPS, cold cache |
| Browser rendering | **59–60 fps** | 1200×900 and 390×844, idle/pan/zoom |
| Production move RTT | **27.2 ms p50** | WAN, TLS, event delivery included |
| Crash recovery | **0 acked moves lost** | 3 SIGKILL trials, 15k acked moves each |
| Restart after 500k WAL records | **1.7 s** | 41 MiB WAL, no snapshot |
| Restart from snapshot + 89k WAL | **1.4 s** | 528 MiB data directory |

The short version:

- The chess logic is effectively free. Storage, fan-out and the single writer
  are the real limits.
- Group commit is the single most important durability optimisation. It is the
  difference between 577 and 12,500 durable moves/s on this disk.
- Snapshot reads are cheap in bytes but serialise on the state worker; the
  aggregate ceiling is about 600k board copies/s.
- The browser client is not the bottleneck: 60 fps and 3–6 MiB of JS heap.
- Production is latency-dominated by the network RTT (~24 ms), not by the
  server (sub-millisecond processing).

---

## 1. Microbenchmarks

Command:

```bash
dune exec bench/bench.exe
```

Selected results from `bench/evening/microbench.json`:

| Group | Operation | ns/op | ops/s |
|---|---|---:|---:|
| Board | index, checked | 6.16 | 162 M |
| Board | index, raw arithmetic | 2.68 | 374 M |
| Board | read, checked | 14.01 | 71 M |
| Board | read, `get_world` | 11.59 | 86 M |
| Piece | create packed `int64` | 7.55 | 132 M |
| Piece | inspect fields | 9.62 | 104 M |
| Piece | metadata update | 17.21 | 58 M |
| Protocol | move encode (6 B) | 27.36 | 36.5 M |
| Protocol | move decode (6 B) | 19.39 | 51.6 M |
| Protocol | request encode (14 B) | 58.96 | 17.0 M |
| Protocol | request decode (14 B) | 39.02 | 25.6 M |
| Protocol | wire response encode (4096 B) | 1,145.86 | 0.87 M |
| Protocol | wire response decode (4096 B) | 48.69 | 20.5 M |
| Protocol | move event encode (4096 B frame) | 1,231.38 | 0.81 M |
| Protocol | move event decode | 77.79 | 12.9 M |
| Protocol | snapshot response encode (81 B) | 52.54 | 19.0 M |
| Validation | path, record+checked get | 503.37 | 2.0 M |
| Validation | path, `get_world` | 247.35 | 4.0 M |
| Validation | long queen, 36 squares | 301.99 | 3.3 M |
| Processing | prepare long queen | 26.70 | 37.5 M |
| Processing | apply plan long queen | 25.82 | 38.7 M |
| Ledger | append | 14.39 | 69.5 M |
| Ledger | event read | 13.51 | 74.0 M |
| Snapshot | copy 64-piece board | 280.79 | 3.56 M |
| Engine | full move | **202.53** | **4.94 M** |
| Worker | submit/process, sequential | 2,422.86 | 412,736 |
| Worker | submit/process, pipelined 4,000 | 2,164.07 | 462,093 |
| Worker | snapshot, pipelined 4,000 | 3,431.58 | 291,411 |

Startup:

- 512 MiB board + 16 MiB ledger allocation: **46 ms**
- initialise 1,000,000 boards / 32,000,000 pieces: **309 ms**
- verify occupied count over 64,000,000 squares: **142 ms**

The 4096-byte wire-response encode is 42× more expensive than the 14-byte
request decode because it allocates and zero-fills the padded frame. It is still
only 1.15 µs, so at 10k moves/s it consumes about 1.1% of one core. The padding
is a transport workaround, not a protocol necessity.

---

## 2. Storage and fsync

`bench/evening/fsync_micro.py` writes 64-byte records and calls `fsync` once per
group. This isolates the durability cost from the chess engine.

### btrfs (`/home`, zstd:3)

| Group | Records/s | fsync p50 | fsync p95 |
|---:|---:|---:|---:|
| 1 | 640 | 1.48 ms | 1.69 ms |
| 2 | 1,271 | 1.49 ms | 1.73 ms |
| 4 | 2,607 | 1.48 ms | 1.63 ms |
| 8 | 5,065 | 1.55 ms | 1.69 ms |
| 16 | 9,339 | 1.53 ms | 1.93 ms |
| 32 | 19,586 | 1.46 ms | 1.68 ms |
| 64 | 32,338 | 1.63 ms | 1.91 ms |
| 128 | 56,886 | 1.55 ms | 1.85 ms |
| 256 | 93,299 | 1.58 ms | 1.74 ms |

### tmpfs (`/dev/shm`)

| Group | Records/s | fsync p50 |
|---:|---:|---:|
| 1 | 580,500 | 0.6 µs |
| 16 | 1,065,694 | 0.6 µs |
| 64 | 1,114,847 | 0.6 µs |
| 256 | 1,114,649 | 0.7 µs |

The disk's fsync latency is essentially constant at ~1.5 ms, so group commit
scales almost linearly with group size until CPU or the client becomes the
limit. tmpfs has no durability, so its fsync path only measures syscall and
memory overhead.

### Write bursts (5,120 moves per run)

`bench/write_burst.js`: 256 clients, 20 moves each, no subscriptions, distinct
boards.

| Configuration | Moves/s | Move p50 | Move p95 | Avg group | Syncs |
|---|---:|---:|---:|---:|---:|
| btrfs, strict (group 1) | 577 | 298.9 ms | 440.3 ms | 1.0 | 5,120 |
| btrfs, group 16 | 5,861 | 25.0 ms | 47.1 ms | 15.1 | 340 |
| btrfs, group 64 | 8,682 | 13.5 ms | 96.4 ms | 51.2 | 100 |
| btrfs, adaptive | 9,585 | 11.9 ms | 45.1 ms | 48.8 | 105 |
| btrfs, no fsync | 21,117 | 6.1 ms | 13.0 ms | 1.0 | 0 |
| tmpfs, group 64 | 22,205 | 5.7 ms | 10.7 ms | 32.8 | 156 |

Client-count effect with group 64 on btrfs:

| Clients | Moves/s | Move p50 | Move p95 | Avg group |
|---:|---:|---:|---:|---:|
| 64 | 9,338 | 4.6 ms | 6.3 ms | 31.8 |
| 256 | 8,682 | 13.5 ms | 96.4 ms | 51.2 |
| 512 | 10,227 | 26.2 ms | 96.2 ms | 56.9 |

More concurrency buys throughput but costs tail latency. 64 clients is the
sweet spot for interactive latency on this disk.

---

## 3. Long soak

`bench/evening/soak_probe.js`: 64 connections, each on its own board,
alternating a knight, no subscriptions. `/metrics` sampled once per second.
Every board was snapshotted and the final knight square verified.

| Storage | Moves | Duration | Moves/s | p50 | p95 | p99 | Duplicates | Verify |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| btrfs, group 64 | 500,032 | 41.9 s | 11,932 | 4.31 ms | 6.80 ms | 9.18 ms | 0 | ok |
| btrfs, adaptive | 500,032 | 39.9 s | 12,523 | 4.29 ms | 6.91 ms | 9.92 ms | 0 | ok |
| tmpfs, group 64 | 2,000,000 | 57.0 s | 35,095 | 1.57 ms | 2.69 ms | 3.56 ms | 0 | ok |

Observations:

- The 2,000,000-move run wraps the 1,048,576-entry ledger and still verifies
  every final board. No sequence duplicates, no rejection, no lost update.
- RSS rose from ~549 MiB to ~577 MiB and then stayed there across both the
  500k and 2M runs. The growth is allocator/GC high-water, not per-move growth.
- WAL size was 41 MiB for 500k moves and 166 MiB for 2M moves, about 83 bytes
  per move. This matches the WAL record frame: 12-byte header + ~63-byte
  payload + 8-byte checksum.
- Adaptive commit settled at an average group of ~46 on btrfs, with fsync p50
  ~1.67 ms and p95 ~1.94 ms. That is the expected storage-bound regime.

---

## 4. Conflicts and ordering

`bench/evening/conflict_probe.js`:

| Scenario | Requests | Accepted | Rejected | Result |
|---|---:|---:|---:|---|
| 32 clients move the same knight at once | 1,280 | 40 | 1,240 | exactly 1 winner per trial |
| 32 clients move on 32 independent boards | 32 | 32 | 0 | 32 unique sequences |
| stale replay from an emptied square | 1 | 0 | 1 | rejection code 2 |
| dependent capture (black d7–d5 vs white e4xd5) | 80 | 40 black, 20 white | 20 white | order decides the capture |

The same-piece race produced exactly one accepted move in all 40 trials.
Rejection code 2 is `empty_source`: the winner moved the knight, so every
later request found the source square empty.

The dependent-capture experiment is the important one. Both moves are legal
in isolation, but the white capture is only legal if black's pawn has already
arrived on d5:

- black first: both accepted (20/20)
- white first: black accepted, white rejected with code 7 (20/20)

This is the concrete case a move-dependency protocol would solve. Today the
client must wait for the black move to be acknowledged before offering the
capture, or retry after rejection. Chapter 6 of `docs/ALGORITHMS.md` describes
a dependency-tree and cancellation design; it is not implemented.

### Pipelining limitation

While building the write probe I found that sending more than one move request
on a single WebSocket without waiting for the response loses the last request.
Ten small frames sent back-to-back produced nine responses; four in flight
produced 18/20. The server loop processes one `Dream.receive` at a time and the
pinned `httpun-ws` integration does not wake for the residual frame in the
same read. The production client keeps one request in flight, so it is not
affected. The load harnesses and `write_burst` are sequential per connection
for the same reason. This should be fixed before pipelining is used as an
optimisation.

---

## 5. Snapshot and read path

`bench/evening/snapshot_probe.js`, compact batch protocol (kind 6):

Single connection, standard boards:

| Region | Boards | Req/s | Boards/s | p50 | Payload |
|---:|---:|---:|---:|---:|---:|
| 1×1 | 1 | 2,891 | 2,891 | 0.22 ms | 15 B |
| 5×5 | 25 | 5,859 | 146,477 | 0.15 ms | 63 B |
| 15×15 | 225 | 2,221 | 499,682 | 0.43 ms | 463 B |
| 25×25 | 625 | 796 | 497,805 | 1.25 ms | 1,263 B |
| 50×50 | 2,500 | 230 | 575,358 | 4.37 ms | 5,013 B |
| 64×64 | 4,096 | 148 | 605,862 | 6.64 ms | 8,205 B |

40 concurrent connections:

| Region | Req/s | Boards/s | p50 | Payload |
|---:|---:|---:|---:|---:|
| 5×5 | 12,329 | 308,226 | 3.08 ms | 63 B |
| 25×25 | 810 | 506,107 | 47.24 ms | 1,263 B |
| 64×64 | 125 | 511,660 | 307.30 ms | 8,205 B |

The aggregate ceiling is ~500–600k boards/s, independent of batch size. The
worker copies 64 `int64` values per board and the encoder compresses standard
boards to a 2-byte tag. A 625-board browser window costs about 1.25 ms of
server time and 1.3 KiB on the wire.

`test/client_load_perf_test.js` compares the batched protocol with the legacy
per-board path:

```text
wire:   batch 1.36 ms / 1,263 bytes
        legacy 625 singles 48 ms / 2,560,000 bytes
        (36× latency, 2,027× bytes)
browser: 729 boards in 15.9 ms (183 ms wall including page boot)
```

---

## 6. End-to-end load scaling

`bench/run_scaling.js`, 100 moves, 4 snapshots/client, 25×25 windows, btrfs,
adaptive commit. Each level gets a fresh server.

| Clients | Requests | Req/s | Snap p50 | Move p50 | Event lag p50 | CPU avg | RSS peak | fds |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 40 | 356 | 1,028 | 2.5 ms | 12.5 ms | 14.8 ms | 8.7% | 541 MiB | 53 |
| 80 | 596 | 1,606 | 4.7 ms | 14.7 ms | 39.8 ms | 13.5% | 547 MiB | 93 |
| 160 | 1,076 | 2,494 | 9.4 ms | 21.3 ms | 25.0 ms | 18.5% | 560 MiB | 173 |
| 320 | 2,036 | 3,845 | 20.1 ms | 34.0 ms | 46.2 ms | 32.1% | 584 MiB | 333 |
| 640 | 3,956 | 4,836 | 35.9 ms | 82.1 ms | 108.1 ms | 44.0% | 635 MiB | 653 |
| 1,020 | 6,236 | 5,407 | 58.4 ms | 145.8 ms | 176.7 ms | 48.6% | 685 MiB | 1,033 |

All levels had 100% move acceptance, zero missing/duplicate/extra events, zero
cross-window leakage, and zero unexpected closes. CPU includes the whole app
container process, not the Node harness. At 1,020 clients the single Node
process parses 102,000 events and is a material part of the latency; server CPU
is still below 50%.

The earlier tmpfs runs in `bench/evening/*_tmpfs_results.md` show the same
shape without disk latency: 40 clients at move p50 2.6 ms, 80 at 7.9 ms, 160 at
31.2 ms, 320 at 98.8 ms, 640 at 184.5 ms. Disk durability adds roughly 4–10 ms
at low concurrency and dominates the low-load p50.

---

## 7. Browser client

`bench/evening/client_perf.js`, headless Chromium, 1200×900 desktop and
390×844 mobile emulation. The page was loaded with `?x=500&y=500` so the
client booted immediately.

| Metric | Local | Production |
|---|---:|---:|
| Boards loaded | 841 | 841 |
| Time to 841 boards | 214 ms | 462 ms |
| Navigation duration | 95 ms | 194 ms |
| JS heap | 5.6 MiB | 3.4 MiB |
| Idle FPS | 60.4 | 60.3 |
| Pan FPS | 59.6 | 59.6 |
| Zoom FPS | 59.9 | 60.2 |

Mobile:

| Metric | Local | Production |
|---|---:|---:|
| Boards loaded | 841 | 841 |
| Time to 841 boards | 179 ms | 412 ms |
| Idle FPS | 60.6 | 59.0 |
| Pan/zoom FPS | 59.6 / 59.5 | 59.6 / 60.4 |

Production transfer sizes (Caddy zstd/gzip):

- client JS: 8,035 bytes on the wire (20,516 decoded)
- WASM: 64,977 bytes on the wire (184,694 decoded)
- pieces atlas: 421,620 bytes
- HTML: 11,746 bytes

The production page is network-bound: 462 ms to a playable board on a cold
cache, of which ~24 ms is TCP RTT and ~55–90 ms is TLS. Frame rate is a solid
60 fps in both layouts.

---

## 8. Production WAN

From the development machine to `https://chess.jamesashwood.com`:

### HTTP

| Request | TTFB | Total |
|---|---:|---:|
| cold `/healthz` | 82–164 ms | 88–165 ms |
| warm keep-alive `/healthz` | 24–32 ms | 25–32 ms |
| cold `/` (41,941 B HTML) | 90–113 ms | 123–166 ms |

TCP connect was 23–33 ms; TLS added 30–65 ms on a cold connection.

### WebSocket

A real move on a pristine production board, with a 25×25 subscription:

| Metric | p50 | p95 |
|---|---:|---:|
| WebSocket connect (TLS + upgrade) | 205 ms | — |
| Snapshot RTT | 25.3 ms | — |
| Move RTT | 27.2 ms | 43.3 ms |
| Event delivery lag | 27.2 ms | 43.3 ms |

The server adds well under 1 ms. The remaining 27 ms is the network RTT plus
client scheduling, which matches the 24–32 ms HTTP TTFB.

---

## 9. Crash, recovery and fault injection

### SIGKILL with acknowledged moves

`bench/evening/crash_probe.js`, btrfs, group 64, 64 clients:

| Trial | Moves sent before kill | Last ack | Recovered | Restart ready | Acked lost |
|---:|---:|---:|---:|---:|---:|
| 1 | ~16k | 15,834 | 15,841 | 520 ms | 0 |
| 2 | ~16k | 15,409 | 15,466 | 471 ms | 0 |
| 3 | ~16k | 16,802 | 16,844 | 471 ms | 0 |

The recovered sequence is always at least the last acknowledged sequence, and
slightly ahead because some unacknowledged moves in the last fsync group were
already durable. No acknowledged move was lost.

### Restart cost

| Data directory | Restart to ready | Recovery detail |
|---|---:|---|
| empty world | 0.37–0.42 s | allocate + initialise 32M pieces |
| 100k WAL records, 8.1 MiB | 0.64–0.67 s | replay 100,032 |
| 500k WAL records, 41 MiB | 1.71–1.74 s | replay 500,032 |
| snapshot at 211k + 89k WAL, 528 MiB | 1.37–1.44 s | load snapshot + replay |

Snapshot writing itself took 2.2–2.3 s per 512 MiB snapshot (~230 MiB/s).
WAL replay costs about 2.6 µs per move.

### Fault injection

`test/failure_injection_test.js`: **10/10 passed**.

- `wal-fsync` after 1 move: server exits, no committed event lost, restart
  sequence 32, no torn tail.
- `wal-append` after 20 moves: server exits, restart sequence 20, torn tail
  detected and truncated.
- `wal-rotate`, `snapshot-write`, `snapshot-fsync`, `snapshot-rename`,
  `snapshot-dir-fsync`, shutdown with acked moves, queued moves and a snapshot
  in flight all preserved the committed prefix and removed temporary files.

`test/ws_write_failure_test.js`: 37,500 moves, 9,486 dropped events, 24 failed
sends, 0 idle CPU ticks, file descriptors 14 → 14. A dead client cannot spin
the server or leak descriptors.

`bench/slow_client_test.js`:

| Scenario | Normal missing | Max outbox | Drops | Failures | Recovery |
|---|---:|---:|---:|---:|---|
| baseline | 0 | 1/8 | 0 | 0 | n/a |
| paused-short | 0 | 8/8 | 3,387 | 7 | reconnect, rev 1500 |
| paused-long | 0 | 8/8 | 3,476 | 7 | reconnect, rev 1500 |
| slow-read | 0 | 8/8 | 3,579 | 8 | reconnect, rev 1500 |

Normal clients are unaffected; the slow client's outbox is bounded and it
repairs with a fresh snapshot.

### Adaptive commit transitions

`bench/adaptive_commit_test.js` (1 repetition, 3 modes, quiet → heavy → quiet →
fan-out → mixed → snapshot):

| Phase | Adaptive batch | Classification | Avg group |
|---|---:|---|---:|
| quiet | 16 → 64 | storage_bound | 1.1 |
| heavy | 64 → 128 | heavy | 86.2 |
| quiet again | 128 → 8 | quiet | 1.7 |
| fan-out | 16 | broadcast_bound | 6.1 |
| mixed | 16 | broadcast_bound | 12.9 |
| snapshot | 16 | broadcast_bound | 12.9 |

All three modes were correct: 18,230 / 30,805 / 33,868 moves, zero missing,
zero duplicates, zero unexpected closes. Adaptive delivered the most total
moves and the best heavy-phase p50 (12.8 ms vs 28.3 ms fixed-16 and 15.7 ms
fixed-64).

---

## 10. Weak points, ranked

1. **fsync latency on btrfs (~1.5 ms).** Strict durability caps a single writer
   at ~600 moves/s. Group commit raises it to ~12k, but every group still pays
   the latency. Mitigations: larger groups under load, `fdatasync` where
   appropriate, a dedicated WAL device, `io_uring`, or a battery-backed device.
2. **Single state worker.** All moves and all snapshot copies serialise. The
   engine is 202 ns/move, but a 625-board snapshot is ~1.25 ms and a 4,096-board
   batch is ~6.6 ms. Snapshot floods steal worker time from moves. Mitigations:
   copy snapshots outside the worker from an immutable revision, shard by board
   with per-shard writers, or use a read-only shadow.
3. **Event fan-out and the single Node harness.** At 1,020 clients the server
   is below 50% CPU but move p50 is 146 ms. Recipient lookup and encoding are
   sub-millisecond; the cost is 102,000 client-side event parses plus batching
   and socket writes. A multi-process load generator would separate server
   capacity from harness capacity.
4. **4 KiB padded frames.** Every move response and event frame is 4,096 bytes
   to work around Dream 1.0.0~alpha8 buffering. The encode cost is small
   (1.15 µs) but the bandwidth is not: 4,000 events = 16 MiB on the wire instead
   of a few hundred KiB. Batching already reduces frame count; a fixed Dream,
   or a transport that flushes on message boundaries, would remove the padding.
5. **One in-flight request per connection.** The server drops residual frames
   when a client pipelines requests. This blocks a simple client-side
   throughput optimisation and makes the protocol stricter than it looks.
6. **Snapshot recovery reads 512 MiB.** Snapshot restart is 1.4 s mostly
   because the whole world is read and checksummed. Incremental or
   copy-on-write snapshots would reduce this.
7. **No dependency or cancellation protocol.** Order-sensitive moves are
   rejected and must be retried by the client. This is correct but adds
   latency and user-visible failure in contested positions.
8. **Client-side 25×25 cache.** Loading 625–841 boards is fast (214–462 ms),
   but panning beyond the prefetch margin triggers another batch. A larger
   cache or predictive prefetch would smooth long pans.

---

## 11. Recommendations

| Change | Expected effect | Risk |
|---|---|---|
| Keep adaptive group commit as default | 10–30% over fixed-64; much better under burst | low |
| Add `fdatasync` option for WAL | avoids metadata journal writes; small gain on btrfs | low |
| Snapshot copy outside worker / revisioned shadow | removes 1–7 ms stalls from move path | medium |
| Shard boards across 2–4 writer domains | near-linear move scaling until fsync | high |
| Multi-process load generator | measures true server ceiling above 1k clients | low (test-only) |
| Fix pipelined request handling | enables client batching, fewer syscalls | medium |
| Replace 4 KiB padding with a flush primitive | 10–100× less event bandwidth | medium (vendor patch) |
| Dependency-tree + cancellation protocol | removes retry latency in contested moves | high |
| Incremental snapshot / reflink | faster restart, less 512 MiB I/O | medium |
| Bitset subscriptions / reusable recipient buffer | less allocation at high fan-out | low |

The highest return for the least risk is the snapshot/worker separation and a
multi-process load generator. The highest return overall is sharding the state
writer, but that changes the correctness model and should follow the
dependency-tree work.

---

## 12. Reproduction

Start a fresh server for write-sensitive runs:

```bash
D=$(mktemp -d /dev/shm/omcb-bench-XXXXXX)
OCAML_OMCB_DATA_DIR="$D" \
OCAML_OMCB_PORT=8080 OCAML_OMCB_INTERFACE=127.0.0.1 \
OCAML_OMCB_SNAPSHOT_MOVES=0 OCAML_OMCB_SNAPSHOT_SECONDS=0 \
./_build/default/server/server.exe
```

Then, from another shell:

```bash
# microbenchmarks
dune exec bench/bench.exe

# fsync cost
python3 bench/evening/fsync_micro.py --dir /home/... --label home \
  --output bench/evening/fsync_home.json

# durable write bursts
LOAD_SERVER_PID=<pid> WB_CLIENTS=256 WB_ROUNDS=20 \
  WB_LABEL=disk-g64 WB_OUTPUT=evening/wb_disk-g64 \
  node bench/write_burst.js

# long soak
SOAK_CLIENTS=64 SOAK_MOVES=500000 \
  SOAK_LABEL=disk-g64 SOAK_OUTPUT=soak_disk-g64 \
  node bench/evening/soak_probe.js

# conflicts
CP_CLIENTS=32 CP_TRIALS=40 \
  CP_LABEL=conflict CP_OUTPUT=conflict \
  node bench/evening/conflict_probe.js

# snapshots
SP_CLIENTS=40 SP_REPEATS=10 SP_SIZES=5,25,64 \
  SP_LABEL=forty SP_OUTPUT=sp_forty \
  node bench/evening/snapshot_probe.js

# scaling (fresh server per level)
SCALE_CLIENTS=40,80,160,320,640,1020 SCALE_MOVES=100 \
  node bench/run_scaling.js

# browser
CLIENT_URL='https://chess.jamesashwood.com/?x=500&y=500' \
  CLIENT_LABEL=prod-desktop CLIENT_OUTPUT=client_prod_desktop \
  node bench/evening/client_perf.js

# crash
CRASH_TRIALS=3 CRASH_CLIENTS=64 CRASH_KILL_MS=1200 \
  node bench/evening/crash_probe.js

# faults
node test/failure_injection_test.js
node test/ws_write_failure_test.js   # needs a server on 8080
node bench/slow_client_test.js
```

---

## 13. Raw result map

| File | Contents |
|---|---|
| `bench/evening/microbench.json` | full microbenchmark run |
| `bench/evening/fsync_home.json` | btrfs fsync groups |
| `bench/evening/fsync_shm.json` | tmpfs fsync groups |
| `bench/evening/wb_*_results.json` | write bursts |
| `bench/evening/soak_*_results.json` | 500k/2M move soaks |
| `bench/evening/conflict_results.json` | conflict and ordering |
| `bench/evening/sp_one_results.json` | single-connection snapshots |
| `bench/evening/sp_forty_results.json` | 40-connection snapshots |
| `bench/evening/scale_results.json` | 40–1,020 client scaling |
| `bench/evening/client_*_results.json` | browser load/frame-rate |
| `bench/evening/crash_results.json` | 1-client SIGKILL trials |
| `bench/evening/crash64_results.json` | 64-client SIGKILL trials |
| `bench/evening/adaptive_commit_results.md` | adaptive policy transitions |
| `bench/evening/slow_results.json` | slow-client isolation |
| `bench/evening/write_failure_results.json` | dead-socket test |
| `bench/evening/recovery_*_results.json` | soak results before restart tests |
| `bench/evening/*_metrics.json` | `/metrics` snapshots |

Logs for the restart tests are in `/tmp/recovery-wal100k.log`,
`/tmp/recovery-wal500k.log` and `/tmp/recovery-snap300k.log` on the benchmark
machine.
