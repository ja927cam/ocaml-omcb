# Changelog

## Unreleased — production hardening

### Docker

- Added a multi-stage `Dockerfile` that builds the OCaml server, the WASM
  client and the piece atlas, then runs them from a slim Debian image as UID
  10001 with a named data volume.
- Added a `test` Docker target that runs the OCaml test suite in CI.
- Added `docker-compose.yml` for local development, with a healthcheck,
  `init`, a 45-second stop grace period and persistent WAL/snapshot storage.
- Added `SIM_MAP_INTERFACE` (default `localhost`; the image uses `0.0.0.0`) so
  the container's published port can reach the server.
- Added `sim_map.opam` dependency metadata for reproducible image builds.
- The Docker builder now provides binaryen 119 for `wasm_of_ocaml-compiler`
  6.4 (Debian 12 only ships binaryen 108). The distro binaryen package
  satisfies opam's depext check; a pinned, checksummed static release is the
  `wasm-opt` used by the build.

### Client panning and cache

- Replaced the fixed 25 × 25 client board table with a bounded 900-board
  LRU cache. Visible boards and the prefetch window are tracked separately;
  old boards stay cached until capacity pressure, and visible boards are
  never evicted.
- Snapshot loading now requests only missing rectangles, prioritises visible
  boards, deduplicates in-flight boards, bounds the number of in-flight
  batches and treats partial/empty/stale responses explicitly.
- The loading indicator is derived from the visible boards that are actually
  missing. It reaches completion independently of optional prefetch work and
  cannot get stuck on a superseded request.
- Small pans no longer send per-board subscription churn. Batch requests now
  carry an atomic window reset (message type `0x07`): the server replaces the
  connection's subscription set with the current useful window and then
  processes the batch. This keeps subscriptions bounded without sending small
  subscription messages before a batch response, which could stall the
  WebSocket writer.
- If a new client reaches an older server that does not understand the
  window-batch message, the rejection or repeated timeout switches it back to
  the compatible `0x06` batch for the rest of the connection. This prevents a
  cached new client from leaving the viewport permanently blank after a
  rollback. The old server then falls back to add-only subscriptions.
- The subscription stress test visits up to 50,000 boards: add-only
  subscriptions grew to 49,081 and server RSS rose by about 26 MB, while the
  bounded reset keeps subscriptions at 841 and RSS growth to about 8 MB.
- Added unit tests for the cache, viewport math, missing-rectangle planner and
  request tracker, plus a headless-browser panning stress test with recorded
  before/after request and cache measurements.

### Client experience

- Added tap-to-select and tap-to-move for phones, tablets and touch screens.
  Tapping one of your pieces highlights possible destinations; tapping a
  highlighted square sends the move. Dragging remains supported. Move hints
  cover pieces, blocking, same-board captures, cross-board quiet moves,
  pawn double steps, en passant and basic castling; the server remains the
  authority for check, pins and final legality.

- Rebuilt the piece-information panel as readable parchment cards: a large
  colour glyph, clear name and location, move/capture counts, origin, rules
  and special powers, with the raw packed value kept as a footer for
  debugging.

- New visitors now join near current activity. The server exposes the densest
  cluster of connected viewers at `/active.json`, falling back to a decaying
  map of recent move destinations when nobody else is watching. Explicit
  `?x=`/`?y=` links still open exactly where requested.

- Added a corner tally of captured black and white kings. The counts are
  derived from the bounded ledger at startup and updated on every commit, and
  are available at `/tally.json` and in `/metrics`.

- Fixed iPhone playability. Touch input now uses native Touch Events with
  non-passive `preventDefault`, so iOS Safari no longer cancels the gesture
  into a page scroll. Pointer capture keeps mouse drags flowing, panning stays
  available while a move is awaiting its response, and the tap slop is
  measured in CSS pixels instead of physical canvas pixels (the old 12-pixel
  limit was only 4 CSS pixels at iPhone DPR 3, rejecting ordinary fingertip
  jitter).

- Added a first-visit introduction and help dialog explaining the shared
  world, panning, zooming, moves and piece inspection.
- Added a branded top bar, player colour, coordinate and zoom controls, a
  world minimap, responsive mobile layout and pinch-to-zoom.
- Added Open Graph/Twitter metadata and a social preview image.
- Added a public `/status` dashboard with uptime, players, committed
  transitions, RSS, board-load percentiles, busiest regions and move-pipeline
  stages.
- Static HTML and the stable client entrypoint are revalidated on deploy;
  content-hashed WASM chunks are cached immutably.
- The client automatically reconnects with bounded exponential backoff after a
  WebSocket drop, then reloads its visible window.

### Monitoring

- Added per-region board-load metrics. Snapshot batches are grouped into
  10 x 10 world regions (100 x 100 boards each), with request/board/failure
  counters and p50/p95/max/last server batch latency in `/metrics` under
  `board_load` and in `/metrics.prom` as `sim_map_board_load_*` and
  `sim_map_board_region_*`.

- Added a public Prometheus text endpoint at `/metrics.prom` (in addition to
  the existing JSON `/metrics`) covering pipeline stage latency, worker,
  connection, persistence and adaptive-commit metrics. `/state-hash` and
  `/debug/*` remain internal to the Docker network.

### Production CI/CD

- Added `.github/workflows/deploy.yml`: on every push to `main`, validate the
  production Compose/Caddyfile, run the OCaml tests, build and smoke-test the
  image, and publish an immutable full-SHA tag plus `latest` (main pushes
  only). GitHub Actions has no VPS credentials and never connects to the VPS.
- Added a root systemd pull agent (`deploy/pull_agent.py` plus
  `sim-map-pull.service`/`.timer`) that checks the GHCR `latest` manifest
  digest every five minutes, verifies manifest/config digests, the exact
  `ghcr.io/ja927cam/sim-map` repository and OCI source label, reads the
  embedded commit-SHA label, and invokes the existing deploy script. Registry
  failures are retried safely and failed image digests are backed off.
- `latest` is published only when the run is still the current `main` head;
  re-runs of older commits cannot move it backwards.
- Added `deploy/validate_compose.py` and its tests: the deploy path rejects
  changed app images/data mounts/ports, extra services or volumes, privileged
  services, added capabilities, host networking and Docker-socket mounts.
- Automatic rollback now also restores the previous compose/Caddyfile
  backups, not just the previous image.
- Added `deploy/docker-compose.prod.yml`: one non-root app container, Caddy
  terminating HTTPS and obtaining/renewing Let's Encrypt certificates, the app
  data bind-mounted at `/srv/chess/data`, no published app port, restart
  policies, health checks and a 45-second graceful stop.
- Added `deploy/Caddyfile` with WebSocket-capable reverse proxying and
  internal-only metrics/state-hash/debug endpoints.
- Added `deploy/deploy.sh`: idempotent immutable-SHA deploy, config extraction
  from the image, data-mount and exposure guards, readiness checks, automatic
  rollback and explicit rollback to a recorded/previous tag. It is invoked by
  the root pull agent.
- Added container, Caddy and WebSocket smoke tests and a comprehensive
  production runbook in `deploy/README.md`.

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
- Added scroll-wheel zoom around the pointer, with a high-resolution board
  tile and 256 px piece atlas rendered from a symbol font.
- Replaced the font-glyph pieces with a high-resolution Cburnett vector piece
  atlas (512 px cells, attribution in `client/assets/README.md`), rendered
  from SVGs and loaded with a fallback.
- Disabled per-move browser RTT logging by default.
- Fixed scroll-wheel zoom-out: the zoom factor clamp was receiving its bounds
  in the wrong order, so every wheel event selected the zoom-in factor.
- The maximum zoom-out is now viewport-aware: it never shows more than 10
  boards along the longer viewport axis (10 x 10 on a square viewport). The
  initial zoom is raised on very large screens so the same bound holds before
  any wheel input.
- Each device is assigned an immutable white or black colour on first load.
  The assignment is kept in `localStorage` and mirrored to a ten-year cookie,
  so reloads and clearing either store alone do not change it. A status pill
  shows the device colour.
- The client only starts a drag on pieces of the device colour. Dragging an
  opponent piece pans instead and sends no move request. This is a client-side
  guard; the shared world server still accepts moves from any client.
- Double-clicking a piece requests its full record; a third click opens a
  panel with its position, original board, colour, type, ID, move/capture
  counts, flags, revision and raw packed value.

### Snapshot loading

- Added an additive batched snapshot protocol (message `0x06`): wire kind `5`
  carries a rectangle of boards with per-board revisions and an occupancy
  bitmap, and wire kind `6` tags empty and standard starting boards so they
  need no piece payload.
- The client now loads the full 25 x 25 cache with one batch request instead of
  625 sequential single-board requests. A 625-board load fell from 625 padded
  4096-byte frames (2.56 MiB, about a second) to one 1,263-byte compact frame
  in roughly 4 ms in a headless browser; nearby panning needs no further
  requests because the whole window is already resident.
- The status pill reports the number of boards still loading instead of
  claiming `Live` while the cache is incomplete.
- Added `test/client_load_perf_test.js`, which spawns an isolated server and
  fails if a full cache exceeds four frames, 16 KiB, 500 ms, or an 8 KiB wire
  frame. Protocol codec, compact-size and worker batch-snapshot unit tests were
  added.
