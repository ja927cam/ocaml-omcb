# Live load test results

Profile: default

Generated: 2026-11-22T00:22:46.672Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 318 ms, throughput 1873 requests/s

## Latency

- Snapshot RTT: p50 1.7 ms, p95 7.8 ms, p99 9.0 ms, max 9.2 ms
- Move RTT: p50 2.3 ms, p95 4.8 ms, p99 6.0 ms, max 6.0 ms
- Client event delivery lag: p50 3.4 ms, p95 6.9 ms, p99 7.2 ms, max 7.8 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)
- worker queue wait: p50 0.020 ms, p95 0.110 ms, p99 0.143 ms, max 0.143 ms (n=100)
- move processing: p50 0.000 ms, p95 0.002 ms, p99 0.005 ms, max 0.005 ms (n=100)
- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- broadcast wait: p50 0.069 ms, p95 0.446 ms, p99 0.574 ms, max 0.574 ms (n=100)
- recipient lookup: p50 0.003 ms, p95 0.005 ms, p99 0.007 ms, max 0.007 ms (n=100)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- outbox enqueue: p50 0.002 ms, p95 0.005 ms, p99 0.010 ms, max 0.010 ms (n=100)
- WebSocket write: p50 0.010 ms, p95 0.021 ms, p99 0.064 ms, max 0.469 ms (n=295)
- end-to-end broadcast: p50 2.140 ms, p95 3.175 ms, p99 3.341 ms, max 3.341 ms (n=100)

- Broadcasts: 100 events, 40.0 recipients/event average, 40 max
- Outbox: 0 max depth, 256 capacity, 903 enqueues
- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters

## Accuracy

- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 400/400 active valid, 8 silent valid, 0 silent failures
- Events: 0 missing, 0 duplicate, 0 extra; 40/40 clients received events
- Expected/actual per client: 100-100 expected, 100-100 actual
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 514 MiB baseline, 523 MiB peak, 523 MiB after close requests
- fds: 7 baseline, 51 with clients, 51 peak, 52 after close requests
- CPU: 12.6% average, 38.9% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 6, RSS: 523 MiB, idle: 0 ticks/s
