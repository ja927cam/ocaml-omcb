# Live load test results

Profile: stress

Generated: 2026-11-23T00:06:28.796Z

## Load

- 80 active clients, 4 silent clients, high subscription distribution
- 1176 requests: 84 connections, 84 subscriptions, 808 snapshots, 200 moves
- 40 move drivers on a 15 x 15 fresh block, 25 x 25 subscriptions
- Duration: 354 ms, throughput 3318 requests/s

## Latency

- Snapshot RTT: p50 3.5 ms, p95 17.8 ms, p99 19.4 ms, max 19.8 ms
- Move RTT: p50 7.8 ms, p95 16.1 ms, p99 18.9 ms, max 20.2 ms
- Client event delivery lag: p50 8.5 ms, p95 19.2 ms, p99 22.1 ms, max 23.5 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.004 ms, max 0.005 ms (n=200)
- worker queue wait: p50 0.043 ms, p95 0.281 ms, p99 0.554 ms, max 0.560 ms (n=200)
- move processing: p50 0.001 ms, p95 0.004 ms, p99 0.008 ms, max 0.209 ms (n=200)
- commit → broadcaster: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=200)
- broadcast wait: p50 0.168 ms, p95 0.644 ms, p99 0.784 ms, max 0.821 ms (n=200)
- recipient lookup: p50 0.008 ms, p95 0.014 ms, p99 0.029 ms, max 0.454 ms (n=200)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=200)
- outbox enqueue: p50 0.005 ms, p95 0.018 ms, p99 0.029 ms, max 0.029 ms (n=200)
- WebSocket write: p50 0.012 ms, p95 0.020 ms, p99 0.031 ms, max 0.673 ms (n=1306)
- end-to-end broadcast: p50 2.748 ms, p95 3.895 ms, p99 4.236 ms, max 4.248 ms (n=200)

- Broadcasts: 200 events, 80.0 recipients/event average, 80 max
- Outbox: 0 max depth, 256 capacity, 2539 enqueues
- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters

## Accuracy

- Moves: 200/200 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 800/800 active valid, 8 silent valid, 0 silent failures
- Events: 0 missing, 0 duplicate, 0 extra; 80/80 clients received events
- Expected/actual per client: 200-200 expected, 200-200 actual
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 518 MiB baseline, 538 MiB peak, 538 MiB after close requests
- fds: 7 baseline, 91 with clients, 91 peak, 92 after close requests
- CPU: 22.6% average, 69.1% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 6, RSS: 538 MiB, idle: 0 ticks/s
