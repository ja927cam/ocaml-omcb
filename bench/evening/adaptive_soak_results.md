# Adaptive-mode soak test

Generated: 2026-11-27T00:58:27.924Z
Phase length: 300s; samples: 840

## Phase summary

| Phase | Accepted | Rejected | Errors | Moves/s | Move p50 | Move p95 | Queue max | Outbox max | Fsync p95 max | Lag p95 max | Batch end | Class | Batch changes | Direction flips |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| quiet | 36364 | 0 | 0 | 121 | 7.3 ms | 11.6 ms | 4 | 0 | 42.5 ms | 16.9 ms | 16 | moderate | 2 | 1 |
| heavy-writes | 3718280 | 0 | 0 | 12392 | 6.4 ms | 14.7 ms | 93 | 0 | 30.8 ms | 13.6 ms | 128 | heavy | 0 | 0 |
| fanout | 475869 | 0 | 0 | 1586 | 7.6 ms | 18.0 ms | 16 | 0 | 32.9 ms | 16.4 ms | 64 | heavy | 106 | 88 |
| mixed | 669665 | 0 | 0 | 2232 | 15.5 ms | 28.5 ms | 47 | 0 | 33.2 ms | 28.0 ms | 32 | moderate | 119 | 116 |
| snapshot-writes | 573095 | 0 | 0 | 1907 | 21.1 ms | 84.2 ms | 63 | 0 | 84.8 ms | 75.7 ms | 64 | heavy | 129 | 117 |
| quiet-again | 19500 | 0 | 0 | 65 | 11.2 ms | 123.6 ms | 3 | 0 | 216.7 ms | 60.9 ms | 8 | moderate | 66 | 59 |

## Stability

- RSS: first median 564.0 MiB, last median 1184.7 MiB, max 1187.4 MiB, growth 620.8 MiB.
- File descriptors: first 369, last 369, max 370.
- Maximum worker queue depth: 93.
- Maximum outbox depth: 0.
- Maximum fsync p95: 216.7 ms.
- Maximum event lag p95: 75.7 ms.
- Outbox drops: 0; send failures: 0.
- Sentinel: 23655 moves, 0 errors, 0 parities resynced; missing=0, duplicates=0 across 8 subscribers.
- Recovery: sequence 5516428 -> 5516428; digest match=true.
