# Live load test results

Profile: disk40_home

Generated: 2026-11-26T23:55:27.835Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 450 ms, throughput 1324 requests/s

## Latency

- Snapshot RTT: p50 1.7 ms, p95 7.6 ms, p99 9.0 ms, max 9.2 ms
- Move RTT: p50 10.7 ms, p95 92.0 ms, p99 104.4 ms, max 104.4 ms
- Client event delivery lag: p50 13.0 ms, p95 107.2 ms, p99 107.8 ms, max 108.1 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)
- worker queue wait: p50 1.268 ms, p95 13.501 ms, p99 29.908 ms, max 29.908 ms (n=100)
- move processing: p50 0.008 ms, p95 0.039 ms, p99 0.066 ms, max 0.066 ms (n=100)
- commit → broadcaster: p50 1.883 ms, p95 27.678 ms, p99 73.413 ms, max 73.413 ms (n=100)
- broadcast wait: p50 0.364 ms, p95 1.086 ms, p99 1.288 ms, max 1.288 ms (n=100)
- recipient lookup: p50 0.005 ms, p95 0.014 ms, p99 0.017 ms, max 0.017 ms (n=100)
- event encoding: p50 0.001 ms, p95 0.004 ms, p99 0.004 ms, max 0.004 ms (n=100)
- outbox enqueue: p50 0.004 ms, p95 0.021 ms, p99 0.025 ms, max 0.025 ms (n=100)
- WebSocket write: p50 0.015 ms, p95 0.040 ms, p99 0.110 ms, max 0.909 ms (n=295)
- end-to-end broadcast: p50 7.989 ms, p95 105.441 ms, p99 105.507 ms, max 105.507 ms (n=100)

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
- CPU: 6.7% average, 19.0% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 542 MiB, idle: 0 ticks/s
