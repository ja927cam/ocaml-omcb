# Live load test results

Profile: stress-disk-sync

Generated: 2026-11-24T10:18:02.813Z

## Load

- 80 active clients, 4 silent clients, high subscription distribution
- 1176 requests: 84 connections, 84 subscriptions, 808 snapshots, 200 moves
- 40 move drivers on a 15 x 15 fresh block, 25 x 25 subscriptions
- Duration: 761 ms, throughput 1546 requests/s

## Latency

- Snapshot RTT: p50 3.1 ms, p95 14.9 ms, p99 17.3 ms, max 18.2 ms
- Move RTT: p50 57.2 ms, p95 165.3 ms, p99 166.8 ms, max 167.0 ms
- Client event delivery lag: p50 63.9 ms, p95 170.4 ms, p99 171.4 ms, max 172.1 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.005 ms, max 0.214 ms (n=200)
- worker queue wait: p50 24.082 ms, p95 77.765 ms, p99 88.845 ms, max 90.129 ms (n=200)
- move processing: p50 1.399 ms, p95 1.960 ms, p99 31.164 ms, max 67.195 ms (n=200)
- commit → broadcaster: p50 0.001 ms, p95 0.007 ms, p99 0.010 ms, max 0.012 ms (n=200)
- broadcast wait: p50 21.366 ms, p95 45.201 ms, p99 86.622 ms, max 89.119 ms (n=200)
- recipient lookup: p50 0.010 ms, p95 0.022 ms, p99 0.033 ms, max 0.037 ms (n=200)
- event encoding: p50 0.000 ms, p95 0.002 ms, p99 0.005 ms, max 0.019 ms (n=200)
- outbox enqueue: p50 0.007 ms, p95 0.029 ms, p99 0.078 ms, max 0.083 ms (n=200)
- WebSocket write: p50 0.016 ms, p95 0.043 ms, p99 0.088 ms, max 1.297 ms (n=753)
- end-to-end broadcast: p50 53.018 ms, p95 95.731 ms, p99 95.897 ms, max 163.492 ms (n=200)

- Broadcasts: 200 events, 80.0 recipients/event average, 80 max
- Outbox: 0 max depth, 256 capacity, 1986 enqueues
- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters

## Accuracy

- Moves: 200/200 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 800/800 active valid, 8 silent valid, 0 silent failures
- Events: 0 missing, 0 duplicate, 0 extra; 80/80 clients received events
- Expected/actual per client: 200-200 expected, 200-200 actual
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 534 MiB baseline, 552 MiB peak, 553 MiB after close requests
- fds: 8 baseline, 92 with clients, 92 peak, 93 after close requests
- CPU: 15.8% average, 29.7% peak; 0 idle ticks/s after close requests
