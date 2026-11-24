# Adaptive-mode soak test

Generated: 2026-11-24T20:52:26.153Z
Phase length: 300s; samples: 766

## Phase summary

| Phase | Accepted | Rejected | Errors | Moves/s | Move p50 | Move p95 | Queue max | Outbox max | Fsync p95 max | Lag p95 max | Batch end | Class | Batch changes | Direction flips |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| quiet | 25329 | 0 | 0 | 84 | 5.6 ms | 97.6 ms | 4 | 0 | 180.2 ms | 96.3 ms | 16 | moderate | 28 | 27 |
| heavy-writes | 537738 | 0 | 0 | 1792 | 34.1 ms | 169.1 ms | 59 | 0 | 179.0 ms | 79.5 ms | 16 | broadcast_bound | 3 | 1 |
| fanout | 55920 | 0 | 0 | 186 | 53.4 ms | 228.6 ms | 17 | 0 | 219.3 ms | 169.4 ms | 16 | broadcast_bound | 4 | 3 |
| mixed | 82613 | 0 | 0 | 275 | 153.8 ms | 473.5 ms | 3 | 0 | 271.3 ms | 263.8 ms | 16 | broadcast_bound | 0 | 0 |
| snapshot-writes | 111251 | 0 | 0 | 371 | 147.1 ms | 480.0 ms | 8 | 0 | 177.2 ms | 256.6 ms | 16 | broadcast_bound | 0 | 0 |
| quiet-again | 19420 | 0 | 0 | 65 | 4.2 ms | 138.0 ms | 4 | 0 | 154.8 ms | 175.7 ms | 16 | broadcast_bound | 26 | 24 |

## Stability

- RSS: first median 560.6 MiB, last median 1255.3 MiB, max 1707.6 MiB, growth 694.6 MiB.
- File descriptors: first 369, last 369, max 370.
- Maximum worker queue depth: 59.
- Maximum outbox depth: 0.
- Maximum fsync p95: 271.3 ms.
- Maximum event lag p95: 263.8 ms.
- Outbox drops: 0; send failures: 0.
- Sentinel: 12840 moves, 0 errors, 0 parities resynced; missing=0, duplicates=0 across 8 subscribers.
- Recovery: sequence 845111 -> 845111; digest match=true.
