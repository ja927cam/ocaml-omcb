# Live load test results

Profile: high320_tmpfs

Generated: 2026-11-26T23:54:49.986Z

## Load

- 320 active clients, 4 silent clients, high subscription distribution
- 2856 requests: 324 connections, 324 subscriptions, 1608 snapshots, 600 moves
- 160 move drivers on a 25 x 25 fresh block, 25 x 25 subscriptions
- Duration: 788 ms, throughput 3623 requests/s

## Latency

- Snapshot RTT: p50 17.1 ms, p95 74.3 ms, p99 78.8 ms, max 86.3 ms
- Move RTT: p50 98.8 ms, p95 152.4 ms, p99 232.6 ms, max 237.6 ms
- Client event delivery lag: p50 78.1 ms, p95 181.3 ms, p99 222.8 ms, max 289.4 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.238 ms (n=600)
- worker queue wait: p50 0.417 ms, p95 26.975 ms, p99 27.386 ms, max 27.427 ms (n=600)
- move processing: p50 0.003 ms, p95 0.019 ms, p99 0.026 ms, max 0.767 ms (n=600)
- commit → broadcaster: p50 0.022 ms, p95 0.051 ms, p99 0.077 ms, max 0.819 ms (n=600)
- broadcast wait: p50 1.460 ms, p95 9.743 ms, p99 13.811 ms, max 14.862 ms (n=600)
- recipient lookup: p50 0.030 ms, p95 0.072 ms, p99 0.215 ms, max 2.385 ms (n=600)
- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.002 ms, max 0.012 ms (n=600)
- outbox enqueue: p50 0.023 ms, p95 0.111 ms, p99 0.663 ms, max 1.612 ms (n=600)
- WebSocket write: p50 0.013 ms, p95 0.024 ms, p99 0.037 ms, max 2.010 ms (n=10170)
- end-to-end broadcast: p50 19.124 ms, p95 51.638 ms, p99 51.942 ms, max 52.006 ms (n=600)

- Broadcasts: 600 events, 320.0 recipients/event average, 320 max
- Outbox: 0 max depth, 256 capacity, 13003 enqueues
- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters

## Accuracy

- Moves: 600/600 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 1600/1600 active valid, 8 silent valid, 0 silent failures
- Events: 0 missing, 0 duplicate, 0 extra; 320/320 clients received events
- Expected/actual per client: 600-600 expected, 600-600 actual
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 536 MiB baseline, 614 MiB peak, 615 MiB after close requests
- fds: 8 baseline, 332 with clients, 332 peak, 333 after close requests
- CPU: 52.0% average, 104.8% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 615 MiB, idle: 1 ticks/s
