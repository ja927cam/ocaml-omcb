# Live load test results

Profile: stress

Generated: 2026-11-22T00:22:56.942Z

## Load

- 80 active clients, 4 silent clients, high subscription distribution
- 1176 requests: 84 connections, 84 subscriptions, 808 snapshots, 200 moves
- 40 move drivers on a 15 x 15 fresh block, 25 x 25 subscriptions
- Duration: 369 ms, throughput 3186 requests/s

## Latency

- Snapshot RTT: p50 2.8 ms, p95 16.5 ms, p99 18.1 ms, max 18.4 ms
- Move RTT: p50 7.3 ms, p95 18.2 ms, p99 20.6 ms, max 21.0 ms
- Client event delivery lag: p50 7.5 ms, p95 15.7 ms, p99 20.4 ms, max 22.5 ms

## Server pipeline

- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=200)
- worker queue wait: p50 0.031 ms, p95 0.329 ms, p99 0.409 ms, max 0.414 ms (n=200)
- move processing: p50 0.000 ms, p95 0.004 ms, p99 0.007 ms, max 0.008 ms (n=200)
- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.003 ms (n=200)
- broadcast wait: p50 0.108 ms, p95 0.635 ms, p99 0.895 ms, max 1.080 ms (n=200)
- recipient lookup: p50 0.007 ms, p95 0.015 ms, p99 0.028 ms, max 0.029 ms (n=200)
- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.003 ms (n=200)
- outbox enqueue: p50 0.004 ms, p95 0.014 ms, p99 0.266 ms, max 0.553 ms (n=200)
- WebSocket write: p50 0.010 ms, p95 0.020 ms, p99 0.032 ms, max 0.781 ms (n=1306)
- end-to-end broadcast: p50 2.432 ms, p95 3.426 ms, p99 3.486 ms, max 3.547 ms (n=200)

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

- RSS: 514 MiB baseline, 534 MiB peak, 534 MiB after close requests
- fds: 7 baseline, 91 with clients, 91 peak, 92 after close requests
- CPU: 21.7% average, 77.1% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 6, RSS: 534 MiB, idle: 0 ticks/s
