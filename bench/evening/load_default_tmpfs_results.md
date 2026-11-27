# Live load test results

Profile: default

Generated: 2026-11-26T23:54:11.021Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 318 ms, throughput 1876 requests/s

## Latency

- Snapshot RTT: p50 2.0 ms, p95 6.2 ms, p99 6.9 ms, max 7.0 ms
- Move RTT: p50 2.6 ms, p95 5.2 ms, p99 6.7 ms, max 6.7 ms
- Client event delivery lag: p50 4.2 ms, p95 7.4 ms, p99 8.1 ms, max 8.7 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- worker queue wait: p50 0.043 ms, p95 0.129 ms, p99 0.154 ms, max 0.154 ms (n=100)
- move processing: p50 0.002 ms, p95 0.011 ms, p99 0.020 ms, max 0.020 ms (n=100)
- commit → broadcaster: p50 0.012 ms, p95 0.035 ms, p99 0.043 ms, max 0.043 ms (n=100)
- broadcast wait: p50 0.086 ms, p95 0.456 ms, p99 0.986 ms, max 0.986 ms (n=100)
- recipient lookup: p50 0.003 ms, p95 0.007 ms, p99 0.012 ms, max 0.012 ms (n=100)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- outbox enqueue: p50 0.002 ms, p95 0.009 ms, p99 0.435 ms, max 0.435 ms (n=100)
- WebSocket write: p50 0.010 ms, p95 0.019 ms, p99 0.038 ms, max 0.097 ms (n=334)
- end-to-end broadcast: p50 1.949 ms, p95 3.182 ms, p99 3.225 ms, max 3.225 ms (n=100)

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
- CPU: 12.6% average, 19.8% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 542 MiB, idle: 0 ticks/s
