# Live load test results

Profile: high160_tmpfs

Generated: 2026-11-26T23:54:42.039Z

## Load

- 160 active clients, 4 silent clients, high subscription distribution
- 2336 requests: 164 connections, 164 subscriptions, 1608 snapshots, 400 moves
- 80 move drivers on a 20 x 20 fresh block, 25 x 25 subscriptions
- Duration: 507 ms, throughput 4606 requests/s

## Latency

- Snapshot RTT: p50 7.0 ms, p95 33.7 ms, p99 38.1 ms, max 40.6 ms
- Move RTT: p50 31.2 ms, p95 51.7 ms, p99 73.1 ms, max 73.9 ms
- Client event delivery lag: p50 22.3 ms, p95 57.5 ms, p99 69.3 ms, max 79.3 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.013 ms (n=400)
- worker queue wait: p50 0.115 ms, p95 0.688 ms, p99 0.785 ms, max 0.801 ms (n=400)
- move processing: p50 0.002 ms, p95 0.016 ms, p99 0.026 ms, max 0.299 ms (n=400)
- commit → broadcaster: p50 0.016 ms, p95 0.043 ms, p99 0.049 ms, max 0.353 ms (n=400)
- broadcast wait: p50 0.420 ms, p95 3.118 ms, p99 4.466 ms, max 4.680 ms (n=400)
- recipient lookup: p50 0.015 ms, p95 0.032 ms, p99 0.204 ms, max 0.575 ms (n=400)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.003 ms (n=400)
- outbox enqueue: p50 0.010 ms, p95 0.037 ms, p99 0.127 ms, max 0.322 ms (n=400)
- WebSocket write: p50 0.011 ms, p95 0.022 ms, p99 0.037 ms, max 0.496 ms (n=4693)
- end-to-end broadcast: p50 4.707 ms, p95 8.799 ms, p99 8.960 ms, max 8.991 ms (n=400)

- Broadcasts: 400 events, 160.0 recipients/event average, 160 max
- Outbox: 0 max depth, 256 capacity, 7101 enqueues
- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters

## Accuracy

- Moves: 400/400 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 1600/1600 active valid, 8 silent valid, 0 silent failures
- Events: 0 missing, 0 duplicate, 0 extra; 160/160 clients received events
- Expected/actual per client: 400-400 expected, 400-400 actual
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 534 MiB baseline, 579 MiB peak, 579 MiB after close requests
- fds: 8 baseline, 172 with clients, 172 peak, 173 after close requests
- CPU: 39.4% average, 96.6% peak; 1 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 579 MiB, idle: 0 ticks/s
