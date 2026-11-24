# Adaptive group-commit transition experiment

Generated: 2026-11-24T17:35:14.373Z

Modes: fixed-16, fixed-64, adaptive (5 repetitions each).

## Adaptive policy by phase

| Phase | Batch start | Batch end | Delay end (µs) | Classification | Avg group | Syncs |
|---|---:|---:|---:|---|---:|---:|
| quiet | 16 | 32 | 0 | storage_bound | 1.1 | 40 |
| heavy | 32 | 128 | 0 | heavy | 71.1 | 245 |
| quiet-again | 128 | 16 | 0 | quiet | 1.9 | 14 |
| fanout | 16 | 16 | 0 | broadcast_bound | 6.2 | 138 |
| mixed | 16 | 16 | 0 | broadcast_bound | 11.6 | 131 |
| snapshot | 16 | 16 | 0 | broadcast_bound | 12.7 | 93 |

## Move p50 by phase (ms)

| Phase | fixed-16 | fixed-64 | adaptive |
|---|---:|---:|---:|
| quiet | 51.4 | 62.5 | 47.5 |
| heavy | 32.6 | 18.6 | 17.2 |
| quiet-again | 61.9 | 71.0 | 82.7 |
| fanout | 11.7 | 9.2 | 10.6 |
| mixed | 18.3 | 13.2 | 12.7 |
| snapshot | 15.4 | 17.1 | 18.9 |

## Correctness

| Mode | Runs | Moves | Errors | Missing | Duplicates | Unexpected | Drops | Event lag p50 | Event lag p95 | Last snapshot seq | Snapshot samples | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| fixed-16 | 5 | 70623 | 0 | 0 | 0 | 0 | 0 | 22.5 ms | 144.0 ms | 15674 | 210 | pass |
| fixed-64 | 5 | 102271 | 0 | 0 | 0 | 0 | 0 | 20.0 ms | 140.6 ms | 20615 | 264 | pass |
| adaptive | 5 | 101310 | 0 | 0 | 0 | 0 | 0 | 20.0 ms | 140.1 ms | 23165 | 253 | pass |
