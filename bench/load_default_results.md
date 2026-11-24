# Live load test results

Profile: default

Generated: 2026-11-24T15:13:12.591Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 449 ms, throughput 1327 requests/s

## Latency

- Snapshot RTT: p50 4.9 ms, p95 16.8 ms, p99 20.3 ms, max 20.9 ms
- Move RTT: p50 9.3 ms, p95 69.6 ms, p99 72.0 ms, max 72.0 ms
- Client event delivery lag: p50 11.6 ms, p95 72.7 ms, p99 73.6 ms, max 74.1 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.005 ms, p99 0.006 ms, max 0.006 ms (n=100)
- worker queue wait: p50 0.287 ms, p95 0.580 ms, p99 1.670 ms, max 1.670 ms (n=100)
- move processing: p50 0.012 ms, p95 0.069 ms, p99 0.210 ms, max 0.210 ms (n=100)
- commit → broadcaster: p50 2.056 ms, p95 4.216 ms, p99 58.995 ms, max 58.995 ms (n=100)
- broadcast wait: p50 0.484 ms, p95 3.081 ms, p99 3.380 ms, max 3.380 ms (n=100)
- recipient lookup: p50 0.006 ms, p95 0.015 ms, p99 0.050 ms, max 0.050 ms (n=100)
- event encoding: p50 0.001 ms, p95 0.004 ms, p99 0.011 ms, max 0.011 ms (n=100)
- outbox enqueue: p50 0.005 ms, p95 0.026 ms, p99 0.047 ms, max 0.047 ms (n=100)
- WebSocket write: p50 0.022 ms, p95 0.048 ms, p99 0.095 ms, max 1.130 ms (n=373)
- end-to-end broadcast: p50 6.184 ms, p95 9.890 ms, p99 67.818 ms, max 67.818 ms (n=100)

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
- CPU: 17.8% average, 48.4% peak; 0 idle ticks/s after close requests
