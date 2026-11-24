# Group commit experiment

Generated: 2026-11-24T15:10:39.357Z

Runs: 37; correctness errors: 0.

## Write-only throughput (256 writers)

| Mode | Moves/s | Move p50 | Move p95 | Avg group | Syncs |
|---|---:|---:|---:|---:|---:|
| sync | 553 | 312.1 ms | 470.4 ms | 1.0 | 5120 |
| 8 | 3004 | 52.7 ms | 85.7 ms | 7.7 | 661 |
| 16 | 4313 | 36.2 ms | 61.0 ms | 15.0 | 341 |
| 32 | 5650 | 26.6 ms | 44.1 ms | 28.6 | 179 |
| 64 | 6254 | 23.5 ms | 44.4 ms | 51.7 | 99 |
| 128 | 6835 | 20.8 ms | 41.4 ms | 67.4 | 76 |
| 256 | 7499 | 19.9 ms | 33.2 ms | 85.3 | 60 |
| no-sync | 8959 | 15.6 ms | 26.7 ms | 1.0 | 0 |

## Fan-out move p50 (ms)

| Mode | 80 clients | 256 clients | 1,020 clients |
|---|---:|---:|---:|
| sync | 139.1 | 311.1 | 577.8 |
| 8 | 30.5 | 203.3 | - |
| 16 | 49.3 | 136.4 | 354.4 |
| 32 | 60.3 | 173.1 | - |
| 64 | 45.0 | 118.8 | 439.0 |
| 128 | 52.4 | 59.2 | - |
| 256 | 62.1 | 59.6 | 259.7 |
| no-sync | 34.1 | 97.9 | 284.5 |

Group-64 crash recovery: passed; recovered sequence 64.

