# One Million Chessboards — OCaml

Server-authoritative world of 1,000 × 1,000 chessboards (64,000,000 squares,
32,000,000 starting pieces), with a pannable WASM/Brr grid client, a 25 × 25
board snapshot cache, one-byte snapshot pieces, live move broadcasts over a
binary WebSocket protocol.

## Build and run

```bash
dune build
dune runtest
_build/default/server/server.exe
```

With the server running, the browser grid integration test can be run with:

```bash
node test/client_snapshot_test.js
```

Live update tests:

```bash
node test/live_update_test.js   # real two-client fan-out and subscriptions
node test/live_client_test.js   # browser cache apply, duplicate and gap handling
```

The WebSocket teardown regression test (Linux) repeatedly kills a headless
browser and verifies the server returns to idle:

```bash
node test/ws_teardown_test.js
```

It checks that the nine centre boards are visible, that dragging empty space
pans by one board, that the client stays within a 25 × 25 cache window, that
cross-board quiet moves work, that off-board and off-home captures are
blocked, and that moves persist across board switches and a
cache eviction/re-fetch. It
picks a random central board on each run because moves are authoritative and
remain on the running server.

The server initialises the complete world at startup and listens on
`http://localhost:8080`.

## Controls

The board grid fills the whole window.

- Drag empty space (or use a non-left button) to pan.
- Drag a piece to move it. Quiet moves may cross board boundaries. A piece
  can only capture while it is on its own original board; leaving clears the
  capturable bit and returning restores it.
- The current centre is shown in the top-right corner.
- `?x=<board_x>&y=<board_y>` opens the client centred on that board.
- At 216 px per board, roughly three boards fit vertically in a 700 px
  window; larger windows show more of the world.

## Documentation

- `SPEC.md` — complete implementation specification and invariants.
- `docs/ALGORITHMS.md` — algorithm design, complexity, benchmarks, testing and
  formal-verification opportunities.
- `bench/README.md` — benchmark runner and dashboard.

## Benchmarks

```bash
dune exec bench/bench.exe
```

Then open `bench/dashboard.html`. The suite measures board indexing and reads,
packed pieces, protocol codecs, move validation/application, ledger operations,
the full move engine, the Lwt worker, board snapshots, and startup phases.

## Live load test

With a freshly started server, run the representative end-user flood:

```bash
LOAD_PROFILE=default node bench/load_test.js
```

Restart the server, then run the larger profile:

```bash
LOAD_PROFILE=stress node bench/load_test.js
```

Each run opens 40–80 active WebSocket clients plus four silent clients,
subscribes them to 25 × 25 windows, issues hundreds of snapshots and 100–200
moves, and checks every event frame. Results are written to
`bench/load_default_results.*` and `bench/load_stress_results.*`; the dashboard
shows both profiles. See `bench/README.md` for the methodology and recorded
numbers.

## Repository map

| Path | Contents |
|---|---|
| `lib/` | Piece, Board, Move, validation/application, ledger, state, engine, worker, connection manager |
| `protocol/` | Binary move/request/response codecs |
| `client/` | Canvas client in OCaml/WASM (Brr) |
| `server/` | Dream server and WebSocket endpoint |
| `test/` | Unit, browser, live-update and teardown integration tests |
| `bench/` | Speed benchmarks and static dashboard |
| `docs/` | Engineering/algorithm notes |
