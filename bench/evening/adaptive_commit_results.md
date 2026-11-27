# Adaptive group-commit transition experiment

Generated: 2026-11-27T00:09:52.484Z

Modes: fixed-16, fixed-64, adaptive (1 repetitions each).

## Adaptive policy by phase

| Phase | Batch start | Batch end | Delay end (µs) | Classification | Avg group | Syncs |
|---|---:|---:|---:|---|---:|---:|
| quiet | 16 | 64 | 0 | storage_bound | 1.1 | 44 |
| heavy | 64 | 128 | 0 | heavy | 86.2 | 328 |
| quiet-again | 128 | 8 | 250 | quiet | 1.7 | 27 |
| fanout | 16 | 16 | 0 | broadcast_bound | 6.1 | 315 |
| mixed | 16 | 16 | 0 | broadcast_bound | 12.9 | 169 |
| snapshot | 16 | 16 | 0 | broadcast_bound | 12.9 | 107 |

## Move p50 by phase (ms)

| Phase | fixed-16 | fixed-64 | adaptive |
|---|---:|---:|---:|
| quiet | 47.1 | 27.3 | 35.2 |
| heavy | 28.3 | 15.7 | 12.8 |
| quiet-again | 7.3 | 20.5 | 16.7 |
| fanout | 6.9 | 7.0 | 7.0 |
| mixed | 15.0 | 15.4 | 11.8 |
| snapshot | 14.8 | 13.7 | 15.4 |

## Correctness

| Mode | Runs | Moves | Errors | Missing | Duplicates | Unexpected | Drops | Event lag p50 | Event lag p95 | Last snapshot seq | Snapshot samples | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| fixed-16 | 1 | 18230 | 0 | 0 | 0 | 0 | 0 | 17.3 ms | 102.1 ms | 15678 | 53 | pass |
| fixed-64 | 1 | 30805 | 0 | 0 | 0 | 0 | 0 | 16.6 ms | 127.6 ms | 29199 | 49 | pass |
| adaptive | 1 | 33868 | 0 | 0 | 0 | 0 | 0 | 16.7 ms | 102.9 ms | 31375 | 57 | pass |
