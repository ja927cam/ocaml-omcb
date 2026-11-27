# Live load test results

Profile: nosync40_tmpfs

Generated: 2026-11-26T23:55:13.252Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 318 ms, throughput 1871 requests/s

## Latency

- Snapshot RTT: p50 2.0 ms, p95 6.3 ms, p99 7.4 ms, max 7.6 ms
- Move RTT: p50 2.4 ms, p95 4.6 ms, p99 6.6 ms, max 6.6 ms
- Client event delivery lag: p50 4.2 ms, p95 7.0 ms, p99 8.3 ms, max 9.0 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- worker queue wait: p50 0.035 ms, p95 0.083 ms, p99 0.113 ms, max 0.113 ms (n=100)
- move processing: p50 0.002 ms, p95 0.008 ms, p99 0.017 ms, max 0.017 ms (n=100)
- commit → broadcaster: p50 0.009 ms, p95 0.029 ms, p99 0.037 ms, max 0.037 ms (n=100)
- broadcast wait: p50 0.073 ms, p95 0.298 ms, p99 0.652 ms, max 0.652 ms (n=100)
- recipient lookup: p50 0.003 ms, p95 0.005 ms, p99 0.008 ms, max 0.008 ms (n=100)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.001 ms, max 0.001 ms (n=100)
- outbox enqueue: p50 0.002 ms, p95 0.005 ms, p99 0.011 ms, max 0.011 ms (n=100)
- WebSocket write: p50 0.009 ms, p95 0.016 ms, p99 0.029 ms, max 0.404 ms (n=334)
- end-to-end broadcast: p50 2.067 ms, p95 3.035 ms, p99 3.070 ms, max 3.070 ms (n=100)

- Broadcasts: 100 events, 40.0 recipients/event average, 40 max
- Outbox: 0 max depth, 256 capacity, 942 enqueues
- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters

## Accuracy

- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 400/400 active valid, 8 silent valid, 0 silent failures
- Events: 0 missing, 0 duplicate, 0 extra; 40/40 clients received events
- Expected/actual per client: 100-100 expected, 100-100 actual
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 533 MiB baseline, 542 MiB peak, 542 MiB after close requests
- fds: 8 baseline, 52 with clients, 52 peak, 53 after close requests
- CPU: 9.4% average, 19.7% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 542 MiB, idle: 0 ticks/s
