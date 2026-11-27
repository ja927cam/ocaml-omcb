# Live load test results

Profile: strict40_tmpfs

Generated: 2026-11-26T23:55:06.108Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 317 ms, throughput 1880 requests/s

## Latency

- Snapshot RTT: p50 1.8 ms, p95 7.5 ms, p99 8.6 ms, max 8.8 ms
- Move RTT: p50 2.2 ms, p95 4.2 ms, p99 6.0 ms, max 6.0 ms
- Client event delivery lag: p50 4.0 ms, p95 6.2 ms, p99 6.6 ms, max 6.9 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- worker queue wait: p50 0.049 ms, p95 0.112 ms, p99 0.125 ms, max 0.125 ms (n=100)
- move processing: p50 0.003 ms, p95 0.012 ms, p99 0.022 ms, max 0.022 ms (n=100)
- commit → broadcaster: p50 0.000 ms, p95 0.002 ms, p99 0.011 ms, max 0.011 ms (n=100)
- broadcast wait: p50 0.111 ms, p95 0.332 ms, p99 0.419 ms, max 0.419 ms (n=100)
- recipient lookup: p50 0.003 ms, p95 0.006 ms, p99 0.009 ms, max 0.009 ms (n=100)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- outbox enqueue: p50 0.002 ms, p95 0.006 ms, p99 0.010 ms, max 0.010 ms (n=100)
- WebSocket write: p50 0.010 ms, p95 0.023 ms, p99 0.043 ms, max 0.372 ms (n=334)
- end-to-end broadcast: p50 2.113 ms, p95 3.230 ms, p99 3.259 ms, max 3.259 ms (n=100)

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
- CPU: 9.5% average, 19.1% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 542 MiB, idle: 0 ticks/s
