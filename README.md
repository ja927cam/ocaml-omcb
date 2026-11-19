# One Million Chessboards — OCaml

Server-authoritative world of 1,000 × 1,000 chessboards (64,000,000 squares,
32,000,000 starting pieces), with a WASM/Brr client and binary WebSocket
protocol.

## Build and run

```bash
dune build
dune runtest
_build/default/server/server.exe
```

The server initialises the complete world at startup and listens on
`http://localhost:8080`.

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
the full move engine, the Lwt worker, and startup phases.

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
