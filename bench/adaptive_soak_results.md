# Adaptive-mode soak test

Generated: 2026-11-24T21:00:19.102Z
Phase length: 60s; samples: 170

## Phase summary

| Phase | Accepted | Rejected | Errors | Moves/s | Move p50 | Move p95 | Queue max | Outbox max | Fsync p95 max | Lag p95 max | Batch end | Class | Batch changes | Direction flips |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| quiet | 6991 | 0 | 0 | 116 | 5.0 ms | 23.1 ms | 2 | 0 | 21.0 ms | 30.6 ms | 16 | moderate | 0 | 0 |
| heavy-writes | 529347 | 0 | 0 | 8821 | 8.9 ms | 20.3 ms | 32 | 0 | 22.4 ms | 23.5 ms | 128 | heavy | 1 | 0 |
| fanout | 71031 | 0 | 0 | 1184 | 11.0 ms | 23.7 ms | 16 | 0 | 36.4 ms | 22.3 ms | 64 | heavy | 4 | 3 |
| mixed | 94433 | 0 | 0 | 1568 | 20.8 ms | 90.0 ms | 1 | 0 | 57.7 ms | 84.0 ms | 32 | broadcast_bound | 16 | 12 |
| snapshot-writes | 50236 | 0 | 0 | 837 | 28.6 ms | 215.9 ms | 2 | 0 | 161.9 ms | 207.0 ms | 16 | broadcast_bound | 0 | 0 |
| quiet-again | 3819 | 0 | 0 | 64 | 18.4 ms | 109.2 ms | 3 | 0 | 135.0 ms | 175.1 ms | 16 | moderate | 4 | 3 |

## Stability

- RSS: first median 564.5 MiB, last median 1111.5 MiB, max 1665.8 MiB, growth 547.0 MiB.
- File descriptors: first 369, last 369, max 370.
- Maximum worker queue depth: 32.
- Maximum outbox depth: 0.
- Maximum fsync p95: 161.9 ms.
- Maximum event lag p95: 207.0 ms.
- Outbox drops: 0; send failures: 0.
- Sentinel: 4355 moves, 0 errors, 0 parities resynced; missing=0, duplicates=0 across 8 subscribers.
- Recovery: sequence 760212 -> 760212; digest match=true.
