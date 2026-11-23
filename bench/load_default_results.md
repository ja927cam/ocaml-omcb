# Live load test results

Profile: default

Generated: 2026-11-23T00:06:18.528Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 319 ms, throughput 1870 requests/s

## Latency

- Snapshot RTT: p50 1.6 ms, p95 8.2 ms, p99 9.3 ms, max 9.4 ms
- Move RTT: p50 1.8 ms, p95 4.5 ms, p99 6.6 ms, max 6.6 ms
- Client event delivery lag: p50 3.9 ms, p95 6.3 ms, p99 7.9 ms, max 8.7 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)
- worker queue wait: p50 0.019 ms, p95 0.066 ms, p99 0.234 ms, max 0.234 ms (n=100)
- move processing: p50 0.001 ms, p95 0.002 ms, p99 0.006 ms, max 0.006 ms (n=100)
- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- broadcast wait: p50 0.069 ms, p95 0.262 ms, p99 0.345 ms, max 0.345 ms (n=100)
- recipient lookup: p50 0.003 ms, p95 0.005 ms, p99 0.007 ms, max 0.007 ms (n=100)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- outbox enqueue: p50 0.002 ms, p95 0.006 ms, p99 0.010 ms, max 0.010 ms (n=100)
- WebSocket write: p50 0.010 ms, p95 0.017 ms, p99 0.032 ms, max 0.417 ms (n=334)
- end-to-end broadcast: p50 1.982 ms, p95 2.980 ms, p99 3.157 ms, max 3.157 ms (n=100)

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

- RSS: 518 MiB baseline, 526 MiB peak, 527 MiB after close requests
- fds: 7 baseline, 51 with clients, 51 peak, 52 after close requests
- CPU: 9.4% average, 19.5% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 6, RSS: 527 MiB, idle: 0 ticks/s
