# Live load test results

Profile: high640_tmpfs

Generated: 2026-11-26T23:54:58.513Z

## Load

- 640 active clients, 4 silent clients, high subscription distribution
- 3176 requests: 644 connections, 644 subscriptions, 1288 snapshots, 600 moves
- 300 move drivers on a 25 x 25 fresh block, 25 x 25 subscriptions
- Duration: 1030 ms, throughput 3084 requests/s

## Latency

- Snapshot RTT: p50 153.5 ms, p95 195.1 ms, p99 198.8 ms, max 201.4 ms
- Move RTT: p50 184.5 ms, p95 332.4 ms, p99 369.8 ms, max 417.3 ms
- Client event delivery lag: p50 227.7 ms, p95 362.5 ms, p99 426.6 ms, max 507.1 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.000 ms, p99 0.003 ms, max 0.008 ms (n=600)
- worker queue wait: p50 93.639 ms, p95 166.099 ms, p99 166.314 ms, max 166.348 ms (n=600)
- move processing: p50 0.002 ms, p95 0.004 ms, p99 0.025 ms, max 0.360 ms (n=600)
- commit → broadcaster: p50 0.027 ms, p95 0.052 ms, p99 0.397 ms, max 0.409 ms (n=600)
- broadcast wait: p50 7.500 ms, p95 18.504 ms, p99 24.609 ms, max 26.102 ms (n=600)
- recipient lookup: p50 0.063 ms, p95 0.151 ms, p99 1.464 ms, max 5.202 ms (n=600)
- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.005 ms, max 0.010 ms (n=600)
- outbox enqueue: p50 0.054 ms, p95 0.305 ms, p99 2.483 ms, max 5.751 ms (n=600)
- WebSocket write: p50 0.014 ms, p95 0.032 ms, p99 0.056 ms, max 2.105 ms (n=6990)
- end-to-end broadcast: p50 136.130 ms, p95 207.576 ms, p99 209.935 ms, max 210.323 ms (n=600)

- Broadcasts: 600 events, 640.0 recipients/event average, 640 max
- Outbox: 0 max depth, 256 capacity, 9503 enqueues
- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters

## Accuracy

- Moves: 600/600 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 1280/1280 active valid, 8 silent valid, 0 silent failures
- Events: 0 missing, 0 duplicate, 0 extra; 640/640 clients received events
- Expected/actual per client: 600-600 expected, 600-600 actual
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 536 MiB baseline, 659 MiB peak, 659 MiB after close requests
- fds: 8 baseline, 652 with clients, 652 peak, 653 after close requests
- CPU: 54.4% average, 109.1% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 7, RSS: 659 MiB, idle: 0 ticks/s
