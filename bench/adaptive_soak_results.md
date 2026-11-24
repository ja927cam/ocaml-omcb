# Adaptive-mode soak test

Generated: 2026-11-24T23:02:29.891Z
Phase length: 300s; samples: 835

## Phase summary

| Phase | Accepted | Rejected | Errors | Moves/s | Move p50 | Move p95 | Queue max | Outbox max | Fsync p95 max | Lag p95 max | Batch end | Class | Batch changes | Direction flips |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| quiet | 36524 | 0 | 0 | 122 | 6.4 ms | 11.2 ms | 4 | 0 | 86.0 ms | 17.7 ms | 8 | moderate | 9 | 8 |
| heavy-writes | 3570674 | 0 | 0 | 11901 | 6.6 ms | 15.9 ms | 42 | 0 | 32.5 ms | 13.2 ms | 128 | heavy | 0 | 0 |
| fanout | 442018 | 0 | 0 | 1473 | 8.0 ms | 18.8 ms | 16 | 0 | 32.8 ms | 17.0 ms | 64 | heavy | 77 | 66 |
| mixed | 644456 | 0 | 0 | 2146 | 16.2 ms | 30.5 ms | 48 | 0 | 32.9 ms | 31.5 ms | 16 | broadcast_bound | 126 | 119 |
| snapshot-writes | 495176 | 0 | 0 | 1650 | 22.1 ms | 157.1 ms | 64 | 0 | 146.7 ms | 138.2 ms | 8 | broadcast_bound | 110 | 94 |
| quiet-again | 12825 | 0 | 0 | 43 | 67.0 ms | 200.0 ms | 4 | 0 | 221.8 ms | 131.4 ms | 32 | storage_bound | 61 | 53 |

## Stability

- RSS: first median 564.2 MiB, last median 1182.2 MiB, max 1185.2 MiB, growth 618.0 MiB.
- File descriptors: first 369, last 369, max 370.
- Maximum worker queue depth: 64.
- Maximum outbox depth: 0.
- Maximum fsync p95: 221.8 ms.
- Maximum event lag p95: 138.2 ms.
- Outbox drops: 0; send failures: 0.
- Sentinel: 22245 moves, 0 errors, 0 parities resynced; missing=0, duplicates=0 across 8 subscribers.
- Recovery: sequence 5223918 -> 5223918; digest match=true.
