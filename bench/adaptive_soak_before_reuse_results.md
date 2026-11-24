# Adaptive-mode soak test

Generated: 2026-11-24T22:01:45.242Z
Phase length: 300s; samples: 838

## Phase summary

| Phase | Accepted | Rejected | Errors | Moves/s | Move p50 | Move p95 | Queue max | Outbox max | Fsync p95 max | Lag p95 max | Batch end | Class | Batch changes | Direction flips |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| quiet | 35920 | 0 | 0 | 120 | 5.9 ms | 13.0 ms | 4 | 0 | 113.3 ms | 39.5 ms | 8 | moderate | 11 | 10 |
| heavy-writes | 2933841 | 0 | 0 | 9779 | 7.6 ms | 17.6 ms | 78 | 0 | 36.7 ms | 14.2 ms | 128 | heavy | 0 | 0 |
| fanout | 414193 | 0 | 0 | 1381 | 8.3 ms | 19.6 ms | 16 | 0 | 33.1 ms | 17.1 ms | 32 | heavy | 77 | 59 |
| mixed | 434902 | 0 | 0 | 1449 | 18.8 ms | 136.8 ms | 36 | 0 | 227.1 ms | 202.7 ms | 16 | broadcast_bound | 94 | 68 |
| snapshot-writes | 395099 | 0 | 0 | 1316 | 22.8 ms | 160.1 ms | 64 | 0 | 186.9 ms | 172.1 ms | 16 | broadcast_bound | 75 | 53 |
| quiet-again | 13750 | 0 | 0 | 46 | 52.9 ms | 177.8 ms | 4 | 0 | 203.2 ms | 109.8 ms | 8 | moderate | 67 | 58 |

## Stability

- RSS: first median 563.8 MiB, last median 3758.4 MiB, max 3770.2 MiB, growth 3194.6 MiB.
- File descriptors: first 369, last 369, max 370.
- Maximum worker queue depth: 78.
- Maximum outbox depth: 0.
- Maximum fsync p95: 227.1 ms.
- Maximum event lag p95: 202.7 ms.
- Outbox drops: 0; send failures: 0.
- Sentinel: 20838 moves, 0 errors, 0 parities resynced; missing=0, duplicates=0 across 8 subscribers.
- Recovery: sequence 4248543 -> 4248543; digest match=true.
