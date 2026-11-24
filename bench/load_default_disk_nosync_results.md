# Live load test results

Profile: default-disk-nosync

Generated: 2026-11-24T10:17:46.838Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 321 ms, throughput 1855 requests/s

## Latency

- Snapshot RTT: p50 1.8 ms, p95 7.5 ms, p99 8.2 ms, max 8.4 ms
- Move RTT: p50 2.4 ms, p95 6.1 ms, p99 6.4 ms, max 6.4 ms
- Client event delivery lag: p50 4.3 ms, p95 6.9 ms, p99 7.6 ms, max 8.3 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)
- worker queue wait: p50 0.065 ms, p95 0.141 ms, p99 0.548 ms, max 0.548 ms (n=100)
- move processing: p50 0.005 ms, p95 0.023 ms, p99 0.052 ms, max 0.052 ms (n=100)
- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)
- broadcast wait: p50 0.174 ms, p95 0.998 ms, p99 1.062 ms, max 1.062 ms (n=100)
- recipient lookup: p50 0.003 ms, p95 0.007 ms, p99 0.043 ms, max 0.043 ms (n=100)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.001 ms, max 0.001 ms (n=100)
- outbox enqueue: p50 0.002 ms, p95 0.011 ms, p99 0.390 ms, max 0.390 ms (n=100)
- WebSocket write: p50 0.011 ms, p95 0.021 ms, p99 0.036 ms, max 0.062 ms (n=373)
- end-to-end broadcast: p50 1.769 ms, p95 2.709 ms, p99 2.736 ms, max 2.736 ms (n=100)

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

- RSS: 534 MiB baseline, 543 MiB peak, 543 MiB after close requests
- fds: 8 baseline, 52 with clients, 52 peak, 53 after close requests
- CPU: 12.5% average, 29.7% peak; 0 idle ticks/s after close requests
