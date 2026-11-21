# Live load test results

Profile: stress

Generated: 2026-11-21T23:14:33.824Z

## Load

- 80 active clients, 4 silent clients
- 1176 requests: 84 connections, 84 subscriptions, 808 snapshots, 200 moves
- 40 move drivers on a 15 x 15 fresh block, 25 x 25 subscriptions
- Duration: 569 ms, throughput 2068 requests/s

## Latency

- Snapshot RTT: p50 3.2 ms, p95 17.9 ms, p99 19.7 ms, max 22.1 ms
- Move RTT: p50 51.2 ms, p95 56.9 ms, p99 61.1 ms, max 61.2 ms
- Event delivery lag: p50 50.4 ms, p95 56.1 ms, p99 59.8 ms, max 69.1 ms

## Accuracy

- Moves: 200/200 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 800/800 active valid, 8 silent valid, 0 silent failures
- Events: 200-200 per active client, 0 missing, 0 duplicate, 0 extra
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 511 MiB baseline, 536 MiB peak, 536 MiB after close requests
- fds: 7 baseline, 91 with clients, 91 peak, 91 after close requests
- CPU: 45.7% average, 89.1% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 6, RSS: 536 MiB, idle: 0 ticks/s
