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
Markdown. This is necessary because the server intentionally does not schedule
Dream's WebSocket close frame (see below); client sockets are released when the
client process exits.

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
  profile deliberately shows the queuing cost: move RTT p50 rises from about
  12 ms at 40 clients to about 51 ms at 80 clients, while every event is still
  delivered exactly once.
- The server uses `Dream.websocket ~close:false`. Dream 1.0.0~alpha8's close
  frame can spin the write loop after a peer reset, so the server does not
  schedule it. Clean client closes are therefore released by the client's TCP
  teardown rather than by a server close frame.

### Recorded results

The latest runs on the benchmark machine:

| Profile | Requests | Throughput | Snapshot p50 | Move p50 | Event lag p50 | CPU avg / peak | RSS | fds peak → after exit |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `default` | 596 | ~1,592/s | 1.9 ms | 12.4 ms | 12.1 ms | 21.4% / 69.3% | 511 → 524 MiB | 51 → 6 |
| `stress` | 1,176 | ~2,068/s | 3.2 ms | 51.2 ms | 50.4 ms | 45.7% / 89.1% | 511 → 536 MiB | 91 → 6 |

Both runs had 100% move acceptance, 100% valid snapshots, exactly one event per
move per active client, no duplicates or misses, no events leaked to silent
clients, and no unexpected closes. See the generated `.md` files for the full
percentiles and accuracy counters.

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
