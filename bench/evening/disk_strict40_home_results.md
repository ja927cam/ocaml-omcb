# Live load test results

Profile: disk_strict40_home

Generated: 2026-11-26T23:55:35.334Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 621 ms, throughput 960 requests/s

## Latency

- Snapshot RTT: p50 2.2 ms, p95 7.2 ms, p99 8.5 ms, max 8.7 ms
- Move RTT: p50 35.3 ms, p95 178.2 ms, p99 178.6 ms, max 178.6 ms
- Client event delivery lag: p50 40.6 ms, p95 179.4 ms, p99 179.8 ms, max 180.1 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)
- worker queue wait: p50 9.788 ms, p95 90.803 ms, p99 95.740 ms, max 95.740 ms (n=100)
- move processing: p50 1.395 ms, p95 4.278 ms, p99 78.734 ms, max 78.734 ms (n=100)
- commit → broadcaster: p50 0.002 ms, p95 0.011 ms, p99 0.034 ms, max 0.034 ms (n=100)
- broadcast wait: p50 8.296 ms, p95 24.782 ms, p99 89.252 ms, max 89.252 ms (n=100)
- recipient lookup: p50 0.004 ms, p95 0.011 ms, p99 0.015 ms, max 0.015 ms (n=100)
- event encoding: p50 0.000 ms, p95 0.002 ms, p99 0.004 ms, max 0.004 ms (n=100)
- outbox enqueue: p50 0.003 ms, p95 0.014 ms, p99 0.037 ms, max 0.037 ms (n=100)
- WebSocket write: p50 0.017 ms, p95 0.040 ms, p99 0.082 ms, max 0.803 ms (n=295)
- end-to-end broadcast: p50 36.571 ms, p95 99.513 ms, p99 178.552 ms, max 178.552 ms (n=100)

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

- RSS: 533 MiB baseline, 542 MiB peak, 542 MiB after close requests
- fds: 8 baseline, 52 with clients, 52 peak, 53 after close requests
- CPU: 9.7% average, 19.6% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 542 MiB, idle: 0 ticks/s
