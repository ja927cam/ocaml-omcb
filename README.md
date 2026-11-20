# One Million Chessboards — OCaml

Server-authoritative world of 1,000 × 1,000 chessboards (64,000,000 squares,
32,000,000 starting pieces), with a pannable WASM/Brr grid client, a 25 × 25
board snapshot cache and a binary WebSocket protocol.

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

It checks that nine boards are visible, that dragging empty space pans by one
board, that the client stays within a 25 × 25 cache window, and that moves
persist across board switches and reloads. It picks a random central board on
each run because moves are authoritative and remain on the running server.

The server initialises the complete world at startup and listens on
`http://localhost:8080`.

## Controls

- Drag empty space (or use a non-left button) to pan.
- Drag a piece to move it; the move must stay on the same board.
- Enter a board in the `centre x` / `centre y` inputs to jump there.
- About nine boards are fully visible at the default 168 px per board.

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

## Repository map

| Path | Contents |
|---|---|
| `lib/` | Piece, Board, Move, validation/application, ledger, state, engine, worker |
| `protocol/` | Binary move/request/response codecs |
| `client/` | Canvas client in OCaml/WASM (Brr) |
| `server/` | Dream server and WebSocket endpoint |
| `test/` | Unit and integration tests |
| `bench/` | Speed benchmarks and static dashboard |
| `docs/` | Engineering/algorithm notes |
