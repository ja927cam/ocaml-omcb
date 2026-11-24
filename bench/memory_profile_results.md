# Snapshot memory-retention profile

Generated: 2026-11-24T22:31:17.193Z
Writers: 96; duration cap: 30s; snapshot interval: 50000 commits.

| Run | Accepted | Snapshots | Peak RSS | Peak copy | Idle RSS | Live growth | Heap growth | Heap after GC | External idle | RSS drop after GC |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| control | 382950 | 0 | 579728 kB | 0.0 MiB | 579728 kB | 23.9 MiB | 26.4 MiB | 10.3 MiB | 0.0 MiB | 14148 kB |
| snapshots | 298593 | 4 | 1115324 kB | 511.9 MiB | 1107296 kB | 22.8 MiB | 25.4 MiB | 10.3 MiB | 511.9 MiB | 15840 kB |

## Diagnosis

### control

- reusable snapshot buffer retained at idle: false
- transient external snapshot copies retained at idle: false
- live OCaml objects growing: false
- OCaml heap retention: false
- full GC/compaction reclaims heap: false
- full GC/compaction reclaims RSS: false
### snapshots

- reusable snapshot buffer retained at idle: true
- transient external snapshot copies retained at idle: false
- live OCaml objects growing: false
- OCaml heap retention: false
- full GC/compaction reclaims heap: false
- full GC/compaction reclaims RSS: false
