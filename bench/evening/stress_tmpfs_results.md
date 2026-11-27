# Live load test results

Profile: stress_tmpfs

Generated: 2026-11-26T23:54:34.553Z

## Load

- 80 active clients, 4 silent clients, high subscription distribution
- 1176 requests: 84 connections, 84 subscriptions, 808 snapshots, 200 moves
- 40 move drivers on a 15 x 15 fresh block, 25 x 25 subscriptions
- Duration: 372 ms, throughput 3165 requests/s

## Latency

- Snapshot RTT: p50 2.9 ms, p95 17.2 ms, p99 18.5 ms, max 19.8 ms
- Move RTT: p50 7.9 ms, p95 18.2 ms, p99 21.3 ms, max 21.4 ms
- Client event delivery lag: p50 7.4 ms, p95 16.3 ms, p99 20.6 ms, max 24.0 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=200)
- worker queue wait: p50 0.061 ms, p95 0.172 ms, p99 0.217 ms, max 0.218 ms (n=200)
- move processing: p50 0.002 ms, p95 0.011 ms, p99 0.020 ms, max 0.021 ms (n=200)
- commit → broadcaster: p50 0.012 ms, p95 0.041 ms, p99 0.053 ms, max 0.374 ms (n=200)
- broadcast wait: p50 0.138 ms, p95 1.035 ms, p99 1.187 ms, max 1.219 ms (n=200)
- recipient lookup: p50 0.007 ms, p95 0.015 ms, p99 0.022 ms, max 0.086 ms (n=200)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=200)
- outbox enqueue: p50 0.005 ms, p95 0.016 ms, p99 0.032 ms, max 0.559 ms (n=200)
- WebSocket write: p50 0.010 ms, p95 0.021 ms, p99 0.034 ms, max 0.431 ms (n=1306)
- end-to-end broadcast: p50 2.528 ms, p95 3.983 ms, p99 4.049 ms, max 4.218 ms (n=200)

- Broadcasts: 200 events, 80.0 recipients/event average, 80 max
- Outbox: 0 max depth, 256 capacity, 2539 enqueues
- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters

## Accuracy

- Moves: 200/200 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 800/800 active valid, 8 silent valid, 0 silent failures
- Events: 0 missing, 0 duplicate, 0 extra; 80/80 clients received events
- Expected/actual per client: 200-200 expected, 200-200 actual
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 534 MiB baseline, 553 MiB peak, 553 MiB after close requests
- fds: 8 baseline, 92 with clients, 92 peak, 93 after close requests
- CPU: 21.5% average, 76.2% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 553 MiB, idle: 0 ticks/s
