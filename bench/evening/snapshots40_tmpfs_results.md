# Live load test results

Profile: snapshots40_tmpfs

Generated: 2026-11-26T23:55:49.955Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 2196 requests: 44 connections, 44 subscriptions, 2008 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 477 ms, throughput 4601 requests/s

## Latency

- Snapshot RTT: p50 1.3 ms, p95 3.4 ms, p99 6.1 ms, max 7.1 ms
- Move RTT: p50 7.4 ms, p95 101.0 ms, p99 101.6 ms, max 101.6 ms
- Client event delivery lag: p50 8.6 ms, p95 103.0 ms, p99 103.8 ms, max 104.0 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)
- worker queue wait: p50 0.109 ms, p95 0.452 ms, p99 8.156 ms, max 8.156 ms (n=100)
- move processing: p50 0.007 ms, p95 0.039 ms, p99 0.055 ms, max 0.055 ms (n=100)
- commit → broadcaster: p50 1.941 ms, p95 7.991 ms, p99 73.532 ms, max 73.532 ms (n=100)
- broadcast wait: p50 0.345 ms, p95 74.337 ms, p99 76.187 ms, max 76.187 ms (n=100)
- recipient lookup: p50 0.004 ms, p95 0.010 ms, p99 0.015 ms, max 0.015 ms (n=100)
- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.004 ms, max 0.004 ms (n=100)
- outbox enqueue: p50 0.003 ms, p95 0.021 ms, p99 0.142 ms, max 0.142 ms (n=100)
- WebSocket write: p50 0.013 ms, p95 0.031 ms, p99 0.115 ms, max 0.969 ms (n=295)
- end-to-end broadcast: p50 4.989 ms, p95 85.711 ms, p99 101.974 ms, max 101.974 ms (n=100)

- Broadcasts: 100 events, 40.0 recipients/event average, 40 max
- Outbox: 0 max depth, 256 capacity, 2503 enqueues
- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters

## Accuracy

- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 2000/2000 active valid, 8 silent valid, 0 silent failures
- Events: 0 missing, 0 duplicate, 0 extra; 40/40 clients received events
- Expected/actual per client: 100-100 expected, 100-100 actual
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 533 MiB baseline, 547 MiB peak, 548 MiB after close requests
- fds: 8 baseline, 52 with clients, 52 peak, 53 after close requests
- CPU: 16.8% average, 47.9% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 548 MiB, idle: 0 ticks/s
