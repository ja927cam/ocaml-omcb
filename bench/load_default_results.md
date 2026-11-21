# Live load test results

Profile: default

Generated: 2026-11-21T23:14:22.799Z

## Load

- 40 active clients, 4 silent clients
- 596 requests: 44 connections, 44 subscriptions, 408 snapshots, 100 moves
- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions
- Duration: 374 ms, throughput 1592 requests/s

## Latency

- Snapshot RTT: p50 1.9 ms, p95 9.6 ms, p99 11.9 ms, max 12.1 ms
- Move RTT: p50 12.4 ms, p95 18.0 ms, p99 18.9 ms, max 18.9 ms
- Event delivery lag: p50 12.1 ms, p95 17.7 ms, p99 19.4 ms, max 22.1 ms

## Accuracy

- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences
- Snapshots: 400/400 active valid, 8 silent valid, 0 silent failures
- Events: 100-100 per active client, 0 missing, 0 duplicate, 0 extra
- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count
- Isolation: 0 events leaked to silent clients, 0 unexpected closes

## Server resources

- RSS: 511 MiB baseline, 524 MiB peak, 524 MiB after close requests
- fds: 7 baseline, 51 with clients, 51 peak, 51 after close requests
- CPU: 21.4% average, 69.3% peak; 0 idle ticks/s after close requests

Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.

## After the load process exits

- fds: 6, RSS: 524 MiB, idle: 0 ticks/s
