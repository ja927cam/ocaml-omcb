# Live load test results

Profile: default-disk-sync

Generated: 2026-11-24T10:17:29.823Z

## Load

- 40 active clients, 4 silent clients, high subscription distribution
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 560 ms, throughput 1065 requests/s

## Latency

- Snapshot RTT: p50 2.6 ms, p95 9.1 ms, p99 10.0 ms, max 10.3 ms
- Move RTT: p50 35.0 ms, p95 128.8 ms, p99 130.3 ms, max 130.3 ms
- Client event delivery lag: p50 38.9 ms, p95 132.1 ms, p99 133.2 ms, max 142.0 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.003 ms, p99 0.004 ms, max 0.004 ms (n=100)
- worker queue wait: p50 10.308 ms, p95 106.269 ms, p99 111.932 ms, max 111.932 ms (n=100)
- move processing: p50 1.393 ms, p95 1.801 ms, p99 82.463 ms, max 82.463 ms (n=100)
- commit → broadcaster: p50 0.001 ms, p95 0.005 ms, p99 0.009 ms, max 0.009 ms (n=100)
- broadcast wait: p50 9.419 ms, p95 20.735 ms, p99 30.858 ms, max 30.858 ms (n=100)
- recipient lookup: p50 0.004 ms, p95 0.010 ms, p99 0.012 ms, max 0.012 ms (n=100)
- event encoding: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)
- outbox enqueue: p50 0.003 ms, p95 0.016 ms, p99 0.522 ms, max 0.522 ms (n=100)
- WebSocket write: p50 0.016 ms, p95 0.032 ms, p99 0.097 ms, max 0.788 ms (n=295)
- end-to-end broadcast: p50 23.464 ms, p95 116.002 ms, p99 126.272 ms, max 126.272 ms (n=100)

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

- RSS: 534 MiB baseline, 543 MiB peak, 543 MiB after close requests
- fds: 8 baseline, 52 with clients, 52 peak, 53 after close requests
- CPU: 8.9% average, 19.6% peak; 0 idle ticks/s after close requests
