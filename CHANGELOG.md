# Changelog

## Unreleased — production hardening

### Durability and operations

- Commit/fsync failures now fail-stop the process with exit status 70 instead
  of leaving a live worker with tentatively applied state.
- WAL rotation opens the replacement segment before closing the old descriptor;
  a failed rotation no longer causes `EBADF` on the next write.
- Failed snapshots remove temporary files; directory-fsync failures remove the
  untrusted renamed file; recovery removes stale `snapshot-*.snap.tmp.*` files.
- `SIGTERM`/`SIGINT` drain the worker, wait up to 30 seconds for an in-flight
  snapshot, close the WAL and exit 0.
- Added `/healthz`, `/readyz` and optional `SIM_MAP_DEBUG_GC` diagnostics.
- Added `SIM_MAP_PORT`.
- Added systemd, environment-file and nginx examples under `deploy/`.

### Adaptive commit

- Adaptive group commit remains the default; fixed-64 is the fallback.
- Broadcast pressure now requires at least 16 recipients per event (or an
  outbox backlog/severe lag), so a small observer no longer pins a heavy write
  workload at batch 16.
- Stale broadcast lag expires after five seconds without recipient samples.

### Diagnostics and tests

- Added test-only WAL/snapshot fault injection and a real-server audit runner.
- Added a 30-minute adaptive soak test.
- Added a snapshot memory profiler that separates OCaml live objects, heap
  retention and external Bigarray snapshot copies.
- Added a deployment smoke test for alternate port, health probes, graceful
  shutdown and restart.
- Added `/metrics.memory` with RSS, smaps_rollup, GC statistics and live
  snapshot-copy bytes.
- Reuse one snapshot-copy buffer instead of allocating a fresh 512 MiB copy per
  snapshot; this bounds the sustained-write RSS growth identified by the soak.
- Removed a per-request `Lwt.pick` race against the connection close signal
  that leaked Lwt callback nodes under high request rates; the 96-writer
  live-heap growth fell from 199 MiB to 24 MiB per 30 seconds.

### Client UI

- Added a live connection-status pill, panning hint, keyboard focus target and
  a cleaner dark visual style.
- Disabled per-move browser RTT logging by default.
