# Live load test results

Profile: disk_nosync40_home

Generated: 2026-11-26T23:55:42.622Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 322 ms, throughput 1851 requests/s

## Latency

- Snapshot RTT: p50 1.9 ms, p95 7.3 ms, p99 8.8 ms, max 9.1 ms
- Move RTT: p50 3.4 ms, p95 5.2 ms, p99 6.1 ms, max 6.1 ms
- Client event delivery lag: p50 4.3 ms, p95 7.3 ms, p99 7.9 ms, max 8.2 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- worker queue wait: p50 0.644 ms, p95 1.447 ms, p99 1.791 ms, max 1.791 ms (n=100)
- move processing: p50 0.005 ms, p95 0.021 ms, p99 0.041 ms, max 0.041 ms (n=100)
- commit → broadcaster: p50 0.025 ms, p95 0.075 ms, p99 0.100 ms, max 0.100 ms (n=100)
- broadcast wait: p50 0.162 ms, p95 0.560 ms, p99 1.344 ms, max 1.344 ms (n=100)
- recipient lookup: p50 0.004 ms, p95 0.008 ms, p99 0.012 ms, max 0.012 ms (n=100)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.008 ms, max 0.008 ms (n=100)
- outbox enqueue: p50 0.002 ms, p95 0.007 ms, p99 0.085 ms, max 0.085 ms (n=100)
- WebSocket write: p50 0.010 ms, p95 0.020 ms, p99 0.051 ms, max 0.065 ms (n=373)
- end-to-end broadcast: p50 2.716 ms, p95 3.565 ms, p99 3.640 ms, max 3.640 ms (n=100)

- Broadcasts: 100 events, 40.0 recipients/event average, 40 max
- Outbox: 0 max depth, 256 capacity, 981 enqueues
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
- CPU: 9.3% average, 29.7% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 543 MiB, idle: 1 ticks/s
