# One Million Chessboards — Implementation Specification

Status: describes the code currently in this repository. It is not a roadmap.
Last implementation phase covered: authoritative game state, serialised move
engine, request/response protocol, client integration, benchmarks and
algorithm documentation.

---

## 1. Purpose and architecture

The project is an OCaml implementation of a server-authoritative variant of
One Million Chessboards:

- 1,000 x 1,000 chessboards (1,000,000 boards).
- 8 x 8 squares per board (64,000,000 squares).
- 32 starting pieces per board (32,000,000 pieces).
- A disciplined piece model with per-piece identity and lifetime metadata.
- A single serialised owner for all authoritative mutations.
- Binary WebSocket requests and responses.
- A bounded circular ledger of accepted events.
- A browser client rendered with `js_of_ocaml`/WASM and Brr.

The rules follow the original Go implementation
(`nolenroyalty/one-million-chessboards`), including its unusual cross-board
movement and capture rules.

### Architectural invariant

Only the state worker may mutate the authoritative board, ledger, or sequence.
WebSocket handlers communicate with it through `State_worker.submit`; they
never read or write the board directly.

The current worker is an Lwt task in the same domain as the server. It never
yields inside a move transaction. A future dedicated OCaml Domain may replace
it without changing `Move_engine` or `Game_state`.

---

## 2. Repository layout

```
dune-project
.gitignore

lib/
  dune
  piece.ml / piece.mli
  board.ml / board.mli
  int16.ml / int16.mli
  ledger.ml / ledger.mli
  move.ml / move.mli
  move_validator.ml / move_validator.mli
  move_processor.ml / move_processor.mli
  game_state.ml / game_state.mli
  move_request.ml / move_request.mli
  move_engine.ml / move_engine.mli
  metrics.ml
  state_worker.ml / state_worker.mli
  connection_manager.ml

protocol/
  dune
  types.ml

client/
  dune
  main.ml
  metrics.ml

server/
  dune
  server.ml
  static/index.html

test/
  dune
  test_piece_board.ml
  test_move.ml
  test_protocol.ml
  test_game_state.ml
  test_engine.ml
  test_worker.ml
  test_connection_manager.ml
  client_snapshot_test.js
  live_update_test.js
  live_client_test.js
  ws_teardown_test.js

bench/
  bench.ml
  dashboard.html
  results.json / results.js
  README.md

docs/
  ALGORITHMS.md

README.md
```

### Build graph

- `sim_map_lib` (`lib/`) is unwrapped and depends on `lwt.unix` and `mtime.clock.os`.
  Modules: `Piece`, `Board`, `Int16`, `Ledger`, `Move`, `Move_validator`,
  `Move_processor`, `Game_state`, `Move_request`, `Move_engine`,
  `State_worker`.
- `protocol` is a separate dependency-free library.
  It remains independent of `sim_map_lib`, so the WASM client does not link
  the server-side world representation.
- `client` is a WASM executable using `brr` and `protocol`.
- `server` uses `dream`, `protocol`, and `sim_map_lib`.
- The server's default alias also builds the client.

---

## 3. Constants and coordinate systems

| Constant | Value |
|---|---:|
| Boards horizontally | 1,000 |
| Boards vertically | 1,000 |
| Squares per row/column | 8 |
| Squares per board | 64 |
| Total boards | 1,000,000 |
| Total squares | 64,000,000 |
| Board coordinates | `board_x`, `board_y` in `0..999` |
| Square coordinates | `x`, `y` in `0..7`, `y = 0` is the top row / rank 8 |
| Absolute world size | 8,000 x 8,000 |
| Maximum move distance per axis | 36 |
| Piece ID width | 25 bits |
| Piece ID maximum | 33,554,431 |
| Ledger capacity | 1,048,576 events |
| Ledger bytes per event | 16 |
| Board memory | 512,000,000 bytes |
| Ledger memory | 16,777,216 bytes |

### Board ID

```
board_id = board_y * 1000 + board_x
```

### World coordinates

```
world_x(position) = board_x * 8 + x
world_y(position) = board_y * 8 + y
```

Both are in `0..7999`.

### World index

```
index(position) =
  ((board_y * 1000 + board_x) * 64) + (y * 8 + x)
```

The result is `0..63,999,999`.

All coordinate validation raises `Invalid_argument` through the public API;
callers may use `Board.in_bounds`.

---

## 4. `Piece`

`Piece.t = int64`; `Piece.empty = 0L`.

### Bit layout

| Bits | Width | Field |
|---:|---:|---|
| 0–24 | 25 | Piece ID (nonzero for a piece) |
| 25–28 | 4 | Piece type (1–7) |
| 29 | 1 | Is white |
| 30 | 1 | Just double moved |
| 31 | 1 | King killer |
| 32 | 1 | King pawner |
| 33 | 1 | Queen killer |
| 34 | 1 | Queen pawner |
| 35 | 1 | Adopted killer |
| 36 | 1 | Has captured a different piece type |
| 37 | 1 | Reserved, preserved |
| 38 | 1 | On original board (cached; updated by moves) |
| 39 | 1 | Adopted |
| 40–51 | 12 | Move count |
| 52–63 | 12 | Capture count |

### Piece types

| Code | Type |
|---:|---|
| 0 | Invalid / no type |
| 1 | Pawn |
| 2 | Knight |
| 3 | Bishop |
| 4 | Rook |
| 5 | Queen |
| 6 | King |
| 7 | Promoted pawn |

### Construction and inspection

- `empty`, `is_empty`, `max_id`.
- `create ~id ~piece_type ~is_white`:
  - rejects IDs ≤ 0 or > `max_id`;
  - writes only ID, type, and colour;
  - never produces zero.
- `id` returns the 25-bit ID (`0` for empty).
- `piece_type` raises on empty or invalid type.
- `is_white` is false for empty.

### Metadata

Accessors: `just_double_moved`, `king_killer`, `king_pawner`,
`queen_killer`, `queen_pawner`, `adopted_killer`,
`has_captured_other_type`, `adopted`, `move_count`, `capture_count`.

Immutable setters preserve every other field. They require a non-empty piece
and raise `Invalid_argument` otherwise.

`increment_move_count` and `increment_capture_count` saturate at 4095
(`0xFFF`), so the 12-bit fields never wrap.

`promote p type` replaces the type bits while preserving ID, colour, reserved
bits, flags, and counters. It requires a non-empty piece.

`to_string`/`pp` include ID, type, colour, all flags, move count, and capture
count.

### Int16

`Int16.t` is an abstract unsigned 16-bit integer stored in an OCaml `int`.

- `of_int` accepts `0..65535`, otherwise raises.
- `to_int`, `zero`, `max_value`, `compare`, `equal`.

Ledger event flags use `Int16.t`, while the ledger only permits 14-bit flag
values.

---

## 5. `Board`

`Board.t` is abstract. It owns one flat Bigarray:

```ocaml
(int64, int64_elt, c_layout) Bigarray.Array1.t
```

of 64,000,000 entries. The array is zero-filled at creation.

### Coordinate types

```ocaml
type board_pos = { board_x : int; board_y : int }
type square_pos = { x : int; y : int }
type position = { board : board_pos; square : square_pos }
```

### API

- `create`: allocate and zero the whole world.
- `dimensions = (1000, 1000)`.
- `board_id`, `index`: checked conversions.
- `in_bounds`: non-raising validation.
- `world_x`, `world_y`, `position_of_world`: checked absolute conversion.
- `get`, `set`, `clear`: O(1), no record or array allocation beyond the
  supplied position.
- `get_world ~x ~y`: direct absolute-world read for hot paths such as sliding
  path checks; does not construct a position record.
- `get_board`: returns a fresh 64-element array copy.
- `set_board`: requires exactly 64 elements.
- `clear_board`: zeroes 64 squares.
- `iter_board`: visits all 64 squares, row-major, including empty squares.
- `iter`: visits only occupied squares across the world, in board-major order
  (`board_id` increasing, then row-major squares).
- `occupied_count`: scans all 64M squares.
- `copy`: independent 512 MB copy.
- `print_board`: 8 lines, uppercase white, lowercase black, `.` empty.

### Standard initial position

`initialise_standard_position board board_pos`:

1. Clear the 64 squares.
2. Assign IDs from:
   ```
   piece_id = board_id * 32 + slot + 1
   ```
   where `slot` is 0–31 in this order:
   - black back rank, x = 0..7;
   - black pawns, x = 0..7;
   - white pawns, x = 0..7;
   - white back rank, x = 0..7.
3. Place:
   - black `r n b q k b n r` on y = 0;
   - black pawns on y = 1;
   - white pawns on y = 6;
   - white `R N B Q K B N R` on y = 7.

IDs are globally unique across the world. The maximum is
`999999 * 32 + 31 + 1 = 32,000,000`.

Initial metadata is all zero/false and counters are zero.

---

## 6. `Move` and `Move_request`

### Domain move

```ocaml
type Move.t = {
  src : Board.position;
  dst : Board.position;
}
```

`Move.create` only constructs. `to_string` is for debugging. The domain move
never contains a piece ID, colour, type, flag, or serialised representation.

### Request

```ocaml
type Move_request.t = {
  request_id : int32;
  move : Move.t;
  expected_piece_id : int32;
}
```

`Move_request.create` validates:

- `expected_piece_id` is in `1..Piece.max_id`; it carries either the 25-bit
  server ID or the compact client signature `(square lsl 8) lor client_byte`;
- both move positions are inside the world.

It performs no board access and no chess validation. The signature lets the
web client identify a source piece without receiving 25-bit IDs in snapshots.

`request_id` is a client correlation identifier. It is not a sequence number.

---

## 7. `Move_validator`

### Result types

```ocaml
type rejection =
  | Empty_source
  | Invalid_geometry
  | Blocked_path
  | Invalid_destination
  | Capture_off_original_board
  | Invalid_special_move

type move_kind =
  | Normal
  | Castle of { rook_src : Board.position; rook_dst : Board.position }
  | En_passant of { captured_pos : Board.position }

type move_info = {
  moving_piece : Piece.t;
  captured_piece : Piece.t;
  src : Board.position;
  dst : Board.position;
  kind : move_kind;
}

type result = Legal of move_info | Illegal of rejection
```

`validate board move` is pure with respect to the board.

### Validation algorithm

1. If source is out of bounds → `Empty_source`.
2. If destination is out of bounds → `Invalid_destination`.
3. Read the source piece. Empty → `Empty_source`.
4. `src = dst` → `Invalid_geometry`.
5. Read the destination piece. Same colour → `Invalid_destination`.
6. Compute absolute `dx`, `dy`.
7. `|dx| > 36` or `|dy| > 36` → `Invalid_geometry`.
8. Dispatch:
   - king with `|dx| = 2` and `dy = 0` → castling validation;
   - pawn with `|dx| = 1` and empty destination → en-passant validation;
   - otherwise normal validation.

### Normal move validation

Before piece-specific geometry, a capture is only legal when the moving piece
is currently on its original board and the destination is on that same board.
Otherwise validation returns `Capture_off_original_board`. Quiet moves may
still leave the original board freely.

Then:

| Piece | Geometry | Path |
|---|---|---|
| Pawn | see below | see below |
| Knight | `(1,2)` or `(2,1)` | none |
| Bishop | `|dx| = |dy| > 0` | all intermediate squares empty |
| Rook | exactly one axis changes | all intermediate squares empty |
| Queen | bishop or rook geometry | all intermediate squares empty |
| Promoted pawn | queen geometry | all intermediate squares empty |
| King | `|dx| ≤ 1`, `|dy| ≤ 1`, same board | none |

Path obstruction → `Blocked_path`. Other invalid geometry →
`Invalid_geometry`.

#### Pawn rules

- Direction: white `dy < 0`, black `dy > 0`.
- `|dy|` is 1 or 2.
- `|dx|` is 0 or 1.
- Diagonal move requires an enemy piece at the destination.
- Straight move requires an empty destination.
- A two-square move requires:
  - `|dx| = 0`;
  - `move_count = 0`;
  - the intermediate square empty.
- There is deliberately no starting-rank restriction (matching the original).
- A diagonal move to an empty square is routed to en-passant validation; if
  it is not a valid en passant it becomes `Invalid_special_move`.

### Castling validation

Triggered by: king, `|dx| = 2`, `dy = 0`.

- King must have `move_count = 0`.
- Rook source is:
  - kingside: `src_world_x + 3`;
  - queenside: `src_world_x - 4`;
  - same absolute `world_y`.
- That square must contain a rook of the same colour with `move_count = 0`.
- Every square between king and rook (which includes the king’s destination)
  must be empty.
- Rook destination:
  - kingside: `dst_world_x - 1`;
  - queenside: `dst_world_x + 1`.
- Rook destination must be inside the world.

A blocked path yields `Blocked_path`; other failures yield
`Invalid_special_move`.

No attack/check/checkmate validation is performed.

### En-passant validation

Triggered by: pawn, `|dx| = 1`, empty destination.

- The pawn must move one square forward for its colour.
- The captured pawn is at:
  ```
  (src_world_x + dx, src_world_y)
  ```
  i.e. the destination file, source rank.
- It must exist, be an enemy pawn, and have `just_double_moved = true`.
- En passant is a capture, so the moving pawn must start and finish on its
  original board.

`move_info.captured_piece` is the off-destination pawn.

---

## 8. `Move_processor`

`prepare board move_info` computes every updated piece and affected position
without writing. `apply_plan` performs the writes; `apply` is their
composition. The engine calls `prepare`, builds/validates the ledger event, then
calls `apply_plan`, so no ordinary validation can fail after the first board
write. `move_info.kind` supplies the castling rook positions or en-passant
captured square; the processor never reclassifies the move.

### Normal move

1. If the moving piece is a pawn:
   - set `just_double_moved` to `|dy| = 2`;
   - promote to `Promoted_pawn` when:
     - white and `world_y(dst) = 0`, or
     - black and `world_y(dst) = 7999`.
2. Increment move count.
3. If captured:
   - increment capture count;
   - captured queen → `QueenKiller`;
   - captured king → `KingKiller`;
   - if the moving piece is still a pawn after promotion:
     - captured queen → `QueenPawner`;
     - captured king → `KingPawner`;
   - captured piece adopted → `AdoptedKiller`;
   - captured type differs from final moving type →
     `HasCapturedPieceTypeOtherThanOwn`.
4. Set `on_original_board` to whether the destination board equals the board
   encoded by the piece ID.
5. Clear the source square.
6. Write the final moving piece to the destination.

### En passant

- Clear source.
- Clear the captured pawn at `(dst_world_x, src_world_y)`.
- Increment move and capture counts.
- Clear `just_double_moved`.
- Set `on_original_board` from the destination board.
- Write the moving pawn to the destination.
- No killer/adopted/different-type flags are set, matching the original.

### Castling

- Recompute the rook source and destination from the king’s move.
- Increment king and rook move counts from 0 to 1.
- Set each piece's `on_original_board` from its destination board.
- Clear both original squares.
- Write king and rook to their new squares.

All updated `Piece.t` values are prepared before writes.

---

## 9. `Ledger`

Bounded append-only circular buffer.

### Storage

Two Bigarrays of `int64`, each of `capacity` entries:

- `moves`
- `metadata`

16 bytes per event. Capacity must be a positive power of two. Index mapping
uses `seq land (capacity - 1)`.

### Positions and events

Position, 26 bits:

| Bits | Field |
|---:|---|
| 0–19 | Board ID |
| 20–25 | Square ID |

Move, 64 bits:

| Bits | Field |
|---:|---|
| 0–25 | Source position |
| 26–51 | Destination position |
| 52–63 | Unused |

Metadata, 64 bits:

| Bits | Field |
|---:|---|
| 0–24 | Moved piece ID (0 = none) |
| 25–49 | Captured piece ID (0 = none) |
| 50–63 | Flags (14 bits) |

Ledger-level engine flags:

| Bit value | Meaning |
|---:|---|
| 1 | Castling |
| 2 | En passant |
| 4 | Promotion |

### Sequence semantics

- `head_seq` is the next sequence to assign.
- `oldest_seq` is the oldest retained sequence.
- `create_ledger ?next_seq capacity` defaults `next_seq = 0`.
- `Game_state` uses `next_seq = 1`, so its first accepted event is sequence 1.
- `latest_seq` is the most recently committed sequence (`head_seq - 1`).
- `next_seq` is `head_seq`, the sequence the next append will return.
- `oldest_seq` returns the oldest retained sequence, or `head_seq` when empty.
- `contains seq` is `oldest_seq <= seq < head_seq`.

### Append algorithm

1. Validate:
   - packed move fits in 52 bits;
   - moved and captured IDs fit in 25 bits;
   - flags fit in 14 bits.
2. Compute index = `seq land mask`.
3. Write move.
4. Write metadata.
5. Increment `head_seq`.
6. If `head_seq - oldest_seq > capacity`, increment `oldest_seq`.
7. Return the assigned sequence.

Append is single-writer and does not allocate.

### Reads

- `get_event seq`: `None` outside `[oldest_seq, head_seq)`; otherwise decodes
  the event.
- `get_range start end`: start inclusive, end exclusive. Returns `None` if
  start is older than the retained window, end is beyond the head, or
  start > end. It returns an allocated array of decoded events.
`Ledger.clear` is not exposed: a running ledger sequence cannot be reset.

`move_event.flags` is `Int16.t`; the underlying value is the 14-bit field.

---

## 10. `Game_state`

```ocaml
type t = {
  board : Board.t;
  ledger : Ledger.t;
  revisions : int64 array; (* one per board, 8 MB *)
  mutable sequence : int64;
  mutable initialised : bool;
}
```

The representation is private in the `.mli`.

- `create`:
  - allocates the board (512 MB, zero-filled);
  - allocates a 1,048,576-event ledger with next sequence 1;
  - allocates one int64 revision per board (8 MB);
  - sequence = 0.
- `initialise`:
  - iterates all 1,000,000 board coordinates;
  - on the first call (fresh zero-filled board) uses
    `Board.initialise_standard_position ~clear:false`;
  - later calls clear each board first;
  - resets all board revisions to 0;
  - leaves sequence at 0 and ledger empty.
- Public accessors: `sequence` (read-only), `occupied_count`, `board_revision`
  and `bump_board_revision`. The worker bumps each affected board once after a
  committed move.
- Controlled internal interface: `with_state`, which passes the board, ledger
  and current sequence to a callback and commits the returned sequence. The
  move engine is the sole production user; direct board/ledger accessors and a
  public `set_sequence` do not exist.
- `snapshot_board t ~board_x ~board_y`: returns a 64-element copy of one board
  in row-major order. Empty squares are `Piece.empty`; every packed piece field
  is preserved. Invalid coordinates raise. It does not modify the board,
  ledger or sequence.
- `snapshot_board_with_revision` returns the board and its revision at the
  same instant.
- Board revisions increase by one for every committed move touching the board.
  Snapshots and live events carry both the global sequence and the per-board
  revision, so clients can detect missed events without treating unrelated
  board moves as gaps.

### Startup verification

The server checks `occupied_count = 32,000,000` before starting the worker.
Tests additionally verify all IDs and representative/corner boards.

---

## 11. `Move_engine`

### Types

```ocaml
type rejection =
  | Stale_piece
  | Invalid_move of Move_validator.rejection

type accepted = {
  request_id : int32;
  sequence : int64;
  moved_piece : Piece.t;
  captured_piece : Piece.t;
}

type result =
  | Accepted of accepted
  | Rejected of { request_id : int32; reason : rejection }
```

### Transaction algorithm

1. Read source piece from the authoritative board.
2. If empty → `Rejected (Invalid_move Empty_source)`.
3. If `expected_piece_id` is neither the source ID nor
   `Piece.client_signature ~square source` (and is not the protocol-layer
   invalid zero) → `Rejected Stale_piece`.
4. Validate with `Move_validator.validate`.
5. Illegal → `Rejected (Invalid_move rejection)`.
6. Prepare ledger data:
   - source/destination ledger positions:
     ```
     board_id = board_y * 1000 + board_x
     square_id = y * 8 + x
     ```
   - packed move;
   - moved piece ID;
   - captured piece ID or 0;
   - flags: castling, en passant, promotion, or 0.
7. Obtain `previous = Game_state.sequence`.
8. If `previous = Int64.max_int`, fail fatally.
9. `next = previous + 1`.
10. Apply with `Move_processor`.
11. Append to the ledger.
12. Assert the returned ledger sequence equals `next`; otherwise fail fatally.
13. Set `Game_state.sequence = next`.
14. Read the updated moving piece from the destination.
15. Return `Accepted`.

Rejected moves do not change the board, ledger, or sequence.

The board update, ledger append, and sequence advance form one synchronous
transaction. There is no rollback path; an unexpected commit failure is treated
as a fatal state-worker failure.

---

## 12. `State_worker`

Single-owner concurrency boundary.

### Configuration

```ocaml
type config = { queue_capacity : int }
val default_config : config  (* queue_capacity = 4096 *)
```

### Submission errors

```ocaml
type submit_error =
  | Queue_full
  | Worker_stopped
  | Worker_failed
  | Invalid_request
```

Internally the queue carries two request kinds:

```ocaml
type request =
  | Move of Move_request.t
  | Snapshot of { board_x : int; board_y : int }
```

Move results are `Move_engine.result`; snapshot results are `Piece.t array`.
Both use the same FIFO and the same `submit_error` type.

### Lifecycle

- `start ~config state`:
  - validates positive capacity;
  - takes ownership of `state` by convention;
  - creates a bounded `Queue`, an `Lwt_condition`, counters, and a finished
    promise;
  - schedules the worker loop with `Lwt.async`.
- `submit worker request`:
  - `Worker_failed` if already failed;
  - `Worker_stopped` if no longer accepting;
  - `Queue_full` if depth ≥ capacity;
  - otherwise creates a pending Lwt promise, enqueues an item with an enqueue
    timestamp, increments depth, schedules a coalesced deferred notification,
    and returns the promise.
- `submit_snapshot worker ~board_x ~board_y` enqueues a snapshot request into
  the same FIFO queue and resolves with a 64-element copy. Invalid coordinates
  return `Invalid_request`. Snapshots count towards queue capacity.
- The same worker also processes moves and snapshots without yielding inside
  either operation; a snapshot observes a complete move or a complete
  pre-move state, never a partial board.
- The promise resolves only after processing.
- `stop` stops accepting, lets queued work finish, and returns the finished
  promise.
- Processing exceptions mark the worker failed, drain queued promises with
  `Worker_failed`, and finish the worker.

### Loop

```
while not finished:
  if queue empty:
    if stopping: finish
    else wait for condition
  else if batch budget exhausted:
    Lwt.pause (yield to the scheduler)
  else:
    take oldest item
    decrement depth
    start timer
    result = Move_engine.process state request   (synchronous)
    update metrics
    resolve item promise
    process up to 64 items before yielding
```

No network, filesystem, or client waiting occurs inside a transaction.

### Metrics

```ocaml
type metrics = {
  queue_depth : int;
  queue_capacity : int;
  requests_processed : int64;
  requests_rejected : int64;
  total_processing_time_ns : int64;
  max_processing_time_ns : int64;
  total_queue_wait_ns : int64;
  max_queue_wait_ns : int64;
}
```

Timing uses the monotonic `Mtime_clock.now_ns` clock from `mtime.clock.os`.

---

## 13. Binary protocol (`Protocol.Types`)

`Protocol.Types` is independent of `Move`/`Board`. It has its own wire
`position`, `move`, request, and response types.

### 13.1 Position codec

26 bits:

| Bits | Field |
|---:|---|
| 0–9 | `board_x` (10 bits) |
| 10–19 | `board_y` (10 bits) |
| 20–22 | `x` (3 bits) |
| 23–25 | `y` (3 bits) |

`position_to_int`/`position_of_int`, and a 4-byte little-endian
`position_to_bytes`/`position_of_bytes`.

### 13.2 Move codec — 6 bytes

The wire does not send a destination position. It sends source plus signed
displacements.

| Bits | Field |
|---:|---|
| 0–25 | Source position |
| 26–34 | `dx`, signed 9-bit two’s complement |
| 35–43 | `dy`, signed 9-bit two’s complement |
| 44–47 | Unused |

Little-endian across 6 bytes.

- Deltas are in absolute world squares.
- `move_to_bytes`:
  - rejects positions outside the 8,000 x 8,000 world;
  - rejects `|dx| > 128` or `|dy| > 128`.
- `move_of_bytes`:
  - requires exactly 6 bytes;
  - reconstructs destination from absolute source + delta;
  - rejects invalid source, deltas outside ±128, and destinations outside the
    world;
  - returns `move option`.

### 13.3 Move request — 14 bytes

| Bytes | Field |
|---|---|
| 0–5 | 6-byte move |
| 6–9 | Expected piece identity: 25-bit server ID or `(square lsl 8) lor client_byte`, int32 little-endian |
| 10–13 | Request ID, int32 little-endian |

Decoder requires exactly 14 bytes, a valid move, and an expected piece ID in
`1..33,554,431`. Otherwise returns `None`.

### 13.4 Response — 26 bytes

| Bytes | Field |
|---|---|
| 0 | Status: 1 accepted, 0 rejected |
| 1–4 | Request ID, int32 LE |
| 5–12 | Committed sequence, int64 LE (0 when rejected) |
| 13–20 | Updated moving piece, packed int64 LE (0 when rejected) |
| 21–24 | Captured piece ID, int32 LE (0 if none/rejected) |
| 25 | Rejection code |

Rejection codes:

| Code | Meaning |
|---:|---|
| 0 | None / accepted |
| 1 | Stale piece |
| 2 | Empty source |
| 3 | Invalid geometry |
| 4 | Blocked path |
| 5 | Invalid destination |
| 6 | Capture off the original board |
| 7 | Invalid special move |
| 8 | Invalid request |
| 9 | Queue full |
| 10 | Worker stopped |
| 11 | Worker failed |

All multi-byte fields are little-endian. Packed `int64` values are transmitted
as bytes, never as JavaScript `Number`.

### 13.5 Snapshot request — 9 bytes

| Bytes | Field | Encoding |
|---|---|---|
| 0 | Message type | `0x02` |
| 1–4 | Request ID | int32 little-endian |
| 5–6 | Board X | uint16 little-endian |
| 7–8 | Board Y | uint16 little-endian |

The decoder requires exactly 9 bytes, message type `0x02`, and coordinates in
`0..999`. Otherwise it returns `None`.

### 13.6 Snapshot response — 81 bytes

| Bytes | Field | Encoding |
|---|---|---|
| 0 | Status | 1 success, 0 failure |
| 1–4 | Request ID | int32 little-endian |
| 5–6 | Board X | uint16 little-endian |
| 7–8 | Board Y | uint16 little-endian |
| 9–16 | Board revision | int64 little-endian |
| 17–80 | Board contents | 64 one-byte client pieces, row-major |

A failed response has status 0, revision 0 and zero-filled board contents.

### 13.6.1 Client piece byte

Each snapshot square is one byte:

| Bit | Meaning |
|---|---|
| 0 | 1 = white, 0 = black |
| 1–3 | 0 empty, 1 pawn, 2 bishop, 3 knight, 4 rook, 5 queen, 6 king |
| 4 | 1 = currently on the original board encoded by its piece ID |
| 5 | 1 = en passantable (pawn) or castling-eligible (king/rook) |
| 6–7 | 0 |

Promoted pawns encode as queens (type 5). This is 64 bytes per board instead of
512, and it removes the need to send 25-bit IDs to the renderer. The server
still keeps the full `Piece.t`; `Piece.client_byte` projects it to the wire
format. A move request recovers stale-piece protection by combining the source
square with this byte into a 16-bit signature. `Protocol.Types.client_byte_of_packed`
performs the reverse projection for the `moved_piece` int64 in a move response,
so the client can refresh its local byte after an accepted move.

Codec functions: `snapshot_request_to_bytes`, `snapshot_request_of_bytes`,
`snapshot_response_to_bytes`, `snapshot_response_of_bytes`. They depend only on
`Protocol.Types`, not `Game_state` or `Board`.

### 13.6.2 Subscription messages

| Bytes | Message | Layout |
|---|---|---|
| 5 | Subscribe board | `0x03`, uint16 board X, uint16 board Y |
| 5 | Unsubscribe board | `0x04`, uint16 board X, uint16 board Y |
| 6 | Set cache window | `0x05`, uint16 centre X, uint16 centre Y, uint8 radius |

The client sends one window message when its rounded cache centre changes; the
server replaces that connection's subscription set with the square window.
Individual subscribe/unsubscribe messages are also supported for tests and
future clients. All coordinates are validated and clamped server-side.

### 13.6.3 Live move event — kind 3, 4096-byte wire frame

| Bytes | Field |
|---|---|
| 0 | Wire kind `3` |
| 1–8 | Global move sequence, int64 little-endian |
| 9–12 | Originating request ID, int32 little-endian |
| 13 | Board count, 1 or 2 |
| 14+ | Board records |

Each board record is:

| Bytes | Field |
|---|---|
| 0–1 | Board X, uint16 |
| 2–3 | Board Y, uint16 |
| 4–11 | Board revision, int64 |
| 12 | Change count |
| 13+ | `(square uint8, piece byte uint8)` pairs |

A normal move carries two changes (source cleared, destination written).
Castling carries four, en passant three, and promotion two. A cross-board move
carries two board records. The frame is zero-padded to 4096 bytes.

### 13.6.4 Batched live events — kind 4, 4096-byte wire frame

Batching is the default transport for live events. The frame contains a count
and one or more compact event records:

| Bytes | Field |
|---|---|
| 0 | Wire kind `4` |
| 1 | Event count, 1–255 |
| 2+ | Event payloads |

Each event payload is the kind-3 payload without the kind byte: sequence int64,
request ID int32, board count, board records. The rest of the frame is
zero-padded to 4096 bytes. The server appends event payloads to a per-client
buffer and flushes a batch when it approaches 4 KiB, after a 1 ms timer, or
before a response to that client. The originating client's buffer is flushed
before its move acknowledgement, preserving the client's event-before-response
ordering. `EVENT_BATCHING=0` disables batching; `EVENT_BATCH_WINDOW_MS` sets the
non-origin batch window (default 1 ms).

### 13.7 Wire response framing — 4096 bytes

Dream 1.0.0~alpha8 buffers WebSocket writes until 4096 bytes have accumulated.
A 26-byte move acknowledgement can therefore wait indefinitely when the client
has stopped sending requests until it arrives. Every server response is carried
in a fixed 4096-byte binary frame:

| Bytes | Field |
|---|---|
| 0 | Kind: `1` move response, `2` snapshot response, `3` live event, `4` event batch |
| 1..26, 1..77, or 1.. | The encoded response/event/batch |
| Rest | Zero padding |

`wire_response_to_bytes` and `wire_response_of_bytes` in `Protocol.Types` build
and validate these frames. Each send crosses the 4096-byte threshold, so Dream
flushes it immediately. The 81-byte snapshot payload and 26-byte move payload
remain unchanged for codec tests and benchmarks.

The client keeps at most **one** snapshot request in flight. This bounds
memory and makes retry/backoff simple while still loading a 25 x 25 cache
quickly over a loopback connection.

The legacy JSON `client_msg` type has been removed; the protocol library no
longer depends on `ppx_deriving_yojson`.

---

## 13.8 Persistence and crash recovery

### Persistent and transient state

Persistent state is exactly what recovery needs to reconstruct the
authoritative world:

- all 64,000,000 board squares (packed `Piece.t` values, including IDs and
  metadata);
- all 1,000,000 per-board `int64` revisions;
- the global committed event sequence;
- the bounded ledger's two backing arrays and its sequence window
  (`head`, `oldest`).

WebSocket connections, subscriptions, outboxes, snapshot request tokens and
client caches are transient and are rebuilt after a restart.

The deterministic initial world is also a recovery point: if no snapshot is
usable, the server initialises the standard position and replays every WAL
record from sequence 1.

### WAL ordering invariant

For every accepted move the state worker performs:

1. validate the request and construct the complete state transition;
2. serialise the transition into a WAL record;
3. append the record and `fsync` the WAL;
4. apply the transition to the in-memory board, revisions, ledger and
   sequence;
5. publish the move response and broadcast the event.

A move is never acknowledged before it is recoverable. If the durability step
raises, the transition is not applied, the worker stops accepting moves and the
connection receives an error. The process fail-stops rather than continuing
with state it cannot recover.

A crash after the fsync but before the response is delivered can leave a
recovered world that includes a transition whose acknowledgement was lost.
This is the standard durable-before-publish trade-off: the server cannot know
whether the last packet reached the client. Clients treat a missing response as
unknown and resynchronise from the event stream or a fresh snapshot.

### WAL format

Segments are named `wal-<first-sequence>.log` (20 decimal digits). Every
segment begins with a 16-byte header: magic `SMWG`, one-byte format version,
three reserved bytes, and the first sequence as a big-endian `int64`.

Each record is a complete committed transition, not a move command:

```
magic "SMWL"        4 bytes
version             1 byte
reserved            3 bytes
payload length      4 bytes (big-endian)
payload             ...
checksum            8 bytes (FNV-1a 64 over header + payload)
```

Payload fields:

- sequence (`int64`), request ID (`int32`);
- board count (`uint16`), then for each board: `board_x`, `board_y`
  (`uint16`), resulting revision (`int64`), change count (`uint16`), and each
  change as square (`uint8`) plus final piece value (`int64`, zero for a
  cleared square);
- the ledger event: packed move (`int64`), moved piece ID (`int32`), captured
  piece ID (`int32`), flags (`uint16`).

Recording final square values means recovery never depends on the chess rules
or on future changes to validation or move generation. Revisions are recorded
explicitly, so recovery restores them exactly rather than inferring them.

A segment grows until the next snapshot boundary. A segment is rotated as part
of taking a snapshot, so a segment's records are exactly the transitions after
the previous snapshot up to the snapshot sequence. Older segments are removed
only after their records are covered by two durable snapshot generations (see
below).

### Snapshot format

A snapshot is a single 536,777,268-byte file for the standard world:

```
magic "SMSN"        4 bytes
version             1 byte
reserved            3 bytes
sequence            int64
ledger head         int64
ledger oldest       int64
board count         uint32  (1,000,000)
ledger capacity     uint32  (1,048,576)
board revisions     1,000,000 * 8 bytes
ledger moves        1,048,576 * 8 bytes
ledger metadata     1,048,576 * 8 bytes
board squares       64,000,000 * 8 bytes
magic "SMND"        4 bytes
checksum            int64 (FNV-1a 64 over everything before the footer)
```

All array values are big-endian 64-bit words. The header's ledger head must be
`sequence + 1`; the loader rejects a header that violates this or whose counts
or file length do not match the running server. Writing the file takes about
1.3 s on tmpfs and 2.6 s on the reference btrfs home filesystem; loading it
takes about 1.2 s.

### Consistent snapshot boundary

A `Snapshot_world` request is a normal item in the state worker's FIFO. When it
reaches the front, no move is in progress. The worker:

1. records the current sequence `S`;
2. rotates the WAL so records after `S` go to a new segment;
3. copies the board, revisions and ledger arrays;
4. hands the immutable copy to a preemptive thread that writes the snapshot.

Copying the 512 MiB board pauses the worker for roughly 0.1-0.3 s on the
reference machine, but the worker never waits for the snapshot's disk I/O.
Moves continue against the new WAL segment while the copy is written.

The file is written to `snapshot-<S>.snap.tmp.<pid>`, fsynced, renamed to
`snapshot-<S>.snap`, and the containing directory is fsynced. A crash at any
point before the rename leaves the previous snapshot and WAL untouched. A
crash after the rename but before cleanup leaves both the new snapshot and the
old WAL; recovery skips records at or below `S`, so no transition is applied
twice.

### Snapshot and WAL cleanup

Two snapshot generations are retained. After a new snapshot `S_new` is durable
and its rename is complete, the previous retained snapshot is `S_prev`.
Segments whose last sequence is at most `S_prev` are removed. Snapshots older
than `S_prev` are removed. This leaves:

- `S_new` and `S_prev`;
- WAL records after `S_prev`.

Recovery from `S_new` needs only records after `S_new`; recovery from `S_prev`
needs records after `S_prev`, which are still present. A single corrupt newest
snapshot therefore falls back to `S_prev` plus the retained WAL. At startup,
only the snapshot that actually loads is retained; corrupt newer files and
unvalidated older files are removed before they can influence cleanup.

### Recovery algorithm

Startup runs before Dream starts listening:

1. create and reset the world;
2. list snapshots newest-first, validating header, length and checksum;
3. load the first valid snapshot, or initialise the deterministic world and
   reset the ledger to sequence 1;
4. list WAL segments ascending and validate their headers;
5. replay records in order, skipping records at or below the snapshot
   sequence, and require each subsequent record to be exactly the next
   sequence;
6. apply each record's final square values, revisions and ledger event;
7. verify that the ledger's head is `sequence + 1`;
8. start a fresh WAL segment at `sequence + 1` and begin serving.

A short WAL record at the end of the last segment is a torn write: it is
ignored, and the segment is truncated to the last complete record. A complete
record with a bad checksum, a malformed record, a sequence gap, or a truncated
record before the last segment is a fatal recovery error; the server exits
instead of serving a state that might be missing acknowledged moves.

Corrupt snapshots are skipped. If a snapshot is rejected, the next older one is
tried; if none loads, the deterministic world plus WAL from sequence 1 is the
fallback. A WAL that begins after sequence 1 without a usable snapshot is a
fatal gap.

### Diagnostics

`GET /state-hash` returns the global sequence and an FNV-1a 64 digest over the
sequence, revisions, ledger bounds and arrays, and all board squares. The
digest is used by recovery tests to compare a pre-shutdown world with the
recovered world without enumerating individual boards. It reads the whole
world and is not intended for frequent polling.

`GET /metrics` includes a `persistence` object with the data directory, WAL
segment count and bytes, snapshot count, last snapshot sequence, whether a
snapshot is pending, and the last snapshot write duration.

---

## 14. Server

### Startup sequence

1. `Game_state.create`.
2. `Persistence.recover`: load the newest valid snapshot and replay WAL records,
   or initialise the deterministic world when no snapshot is usable.
3. Verify `occupied_count = 32,000,000` only when the recovered sequence is
   zero; a recovered world may contain captures.
4. `Connection_manager.create`.
5. `State_worker.start` with `on_commit = Connection_manager.enqueue_move`,
   `precommit = Persistence.before_commit` and
   `on_snapshot = Persistence.capture`.
6. Start the one-second snapshot timer and the first WAL segment.
7. Build the Dream router (`/`, `/metrics`, `/state-hash`, `/static`, `/ws`).
8. `Dream.run` on port 8080.

Startup timings are logged for allocation, persistence recovery, verification,
worker startup, and total startup. Recovery logs the restored sequence, the
snapshot sequence (if any), the number of replayed transitions, whether a torn
WAL tail was truncated, and whether the world was initialised from scratch.

Measured on the implementation machine:

```
allocation: 0.065 s
initialisation: 0.439 s
verification: 0.157 s
total: 0.660 s
RSS: ~520 MB
```

### Middleware

- Dream request logger.
- Cross-origin isolation middleware:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`

This enables a higher-resolution browser timer for RTT metrics.

### Routes

| Route | Handler |
|---|---|
| `/` | `server/static/index.html` |
| `/metrics` | Aggregate pipeline, worker, connection and outbox metrics as JSON |
| `/static/**` | Static files from `_build/default/client` (prefix stripped by `Dream.scope`) |
| `/ws` | Binary WebSocket move endpoint |

### WebSocket handler

1. Register a connection with the `Connection_manager`, receiving a unique
   ID and a per-client ordered send queue.
2. Receive a binary frame.
3. Dispatch on length:
   - 5 bytes → subscribe or unsubscribe one board;
   - 6 bytes → replace the 25 x 25 cache-window subscription;
   - 14 bytes → move request;
   - 9 bytes → snapshot request;
   - anything else → rejection / invalid request.
4. For a move: decode, convert positions, create `Move_request`, submit to the
   worker, await the result, encode a move response.
5. For a snapshot: register the requested board subscription first, mark the
   board as snapshot-pending for this connection, then call
   `State_worker.submit_snapshot`, await the 64-piece board and revision.
   Before the response is enqueued, atomically clear the pending marker and
   collect buffered events with revisions greater than the snapshot revision;
   enqueue the snapshot, then release those events in revision order. Buffered
   events at or below the snapshot revision are discarded.
6. Wrap the response in the fixed 4096-byte wire frame (kind + payload) and
   enqueue it on the connection's ordered send queue; flush any buffered event
   batch for that connection first.
7. Snapshot decode failures produce a status-0, revision-0 snapshot response.
8. Worker errors produce the corresponding move rejection or snapshot failure.
9. Continue reading on the same connection after the send completes.
10. On EOF, error or send failure, unregister the connection and remove all of
    its subscriptions.
11. Never read the board directly in the handler.

### Connection manager

- One record per connection: unique ID, ordered outbox, raw send function,
  subscription set, closed/sending flags.
- `board_subscribers : board key -> set of connection IDs` gives O(1) lookup
  of clients interested in a board.
- Subscription windows replace the old set; individual subscribe/unsubscribe
  messages add or remove one board.
- Every outbound frame, response or live event, goes through the same FIFO
  outbox, preserving order per client.
- A per-client sender fiber drains the outbox. A failed send unregisters only
  that connection; other clients are unaffected.
- Snapshot registration and creation are ordered by registering the board
  subscription before submitting the snapshot to the state worker. While a
  board snapshot is pending, events for that board are buffered per connection
  rather than enqueued. When the snapshot revision arrives, buffered events at
  or below it are discarded and newer events are released in revision order
  after the snapshot frame. A cross-board event with one pending board is split
  into a single-board immediate part and a buffered part; the client tracks
  revisions per board, so both boards advance correctly.
- The outbox is capped. At capacity, the manager drops the oldest event frames
  while preserving response frames and their promises, so a slow client cannot
  grow memory without bound and cannot block the broadcaster. A client that
  resumes sees a revision gap and repairs it with a snapshot; a client blocked
  past the two-second send timeout is unregistered.
- `CONNECTION_OUTBOX_CAPACITY` sets the per-client capacity (default 256). The
  slow-client test uses 8 to force the overflow path.
- Aggregate counters for enqueues, drops, send failures, full-outbox
  unregisters and maximum depth are exposed through `/metrics`.
- `State_worker.on_commit` runs after the commit but only appends the event to
  a pending queue. No encoding, fan-out or network I/O happens on the worker.
- The move handler calls `flush_through sequence` before enqueueing its own
  response; this broadcasts all committed events up to that sequence. A
  background flush is scheduled as a fallback. Because the event is enqueued
  before the move response, the originating client always sees it first.

### Live event pipeline

1. Worker commits a move and knows the exact changed squares.
2. Worker groups changes by board and bumps each board revision once.
3. Worker calls `on_commit` with sequence, request ID, boards, revisions and
   final pieces; this only appends to the manager's pending-event queue.
4. The move handler flushes events through its committed sequence before
   enqueueing the response. A scheduled background flush handles cases where a
   handler disappears.
5. Flushing collects subscribers to any affected board, deduplicating connection
   IDs, and encodes one compact event payload. If a recipient has a pending
   snapshot for any affected board, that board's record is buffered for the
   recipient; non-pending boards are delivered immediately. Buffered records
   are filtered by snapshot revision and released in revision order after the
   snapshot response.
6. The payload is appended to each subscriber's batch buffer; the origin
   connection is flushed before its response, and other clients flush on a
   1 ms timer or a 4 KiB threshold.
7. Each client's sender fiber writes its batch independently. Slow or failed
   clients do not delay others.
8. The pipeline records aggregate timings for request receive → submit, worker
   queue wait, engine processing, commit → broadcaster, broadcast wait,
   recipient lookup, encoding, outbox enqueue, per-recipient write and
   end-to-end broadcast. It does not log individual events.

Worker errors become rejection codes 9–11 with the originating request ID.

If sending fails because the client disconnected, the error is logged and the
handler returns. Sends are bounded by a two-second timeout so a vanished peer
cannot leave the handler waiting forever. A move that has already committed is
never rolled back.

### Dream buffering and close workarounds

- Every response is a 4096-byte wire frame so Dream’s 4096-byte WebSocket
  buffer flushes on each send. Live events are batched into kind-4 frames, so
  one 4 KiB frame can carry many compact event records.
- The client sends snapshots strictly sequentially (one outstanding) to avoid
  a lost write-acknowledgement path in Dream’s stream pipe.
- The server uses Dream’s normal WebSocket close path with a pinned
  `httpun-ws` patch (`vendor/httpun-ws-wsd.patch`). A failed write marks the
  writer failed, discards pending bytes, makes the write loop report `Close`,
  and makes the read loop close when the writer is closed. A dead client can
  therefore never leave a frame retrying forever.
- The receive loop races `Dream.receive` against the connection-manager close
  signal, so a send failure unblocks the handler and allows the HTTP connection
  and its file descriptor to be reclaimed.
- The receive loop is wrapped in `Lwt.catch`, so EOF/connection errors and
  send timeouts end only that handler. Pending worker items are bounded by the
  normal worker queue capacity.
- `test/ws_teardown_test.js` kills Chromium repeatedly and checks idle CPU,
  stable file descriptors and a working snapshot request afterwards.
- `test/ws_write_failure_test.js` deliberately pauses a raw client, generates
  a large event burst, resets its socket, and verifies the server remains
  responsive with idle CPU, no write-failure spin, unregister cleanup and a
  surviving client.

---

## 15. Client

### Rendering

- The canvas fills the viewport (`100vw x 100vh`), and its backing size tracks
  `window.innerWidth x window.innerHeight`.
- The world contains 1000 x 1000 boards. Each board is 216 x 216 backing
  pixels (27 px per square), so three boards span 648 px. On a typical desktop
  viewport the nine centre boards are fully visible (except at world edges),
  with additional boards at the edges.
- An 8 x 8 board tile is rendered once to a 216 x 216 offscreen canvas with a
  one-pixel dark inner border. Each visible board is one `drawImage` blit, not
  64 rectangle fills, and adjacent borders make the board boundaries clear.
  Pieces are drawn only for loaded boards, so an unloaded board shows an empty
  grid rather than invented pieces.
- Piece glyphs are rendered once into a 6 x 2 offscreen atlas: pawn, knight,
  bishop, rook, queen, king; white and black rows.
- Rendering is dirty-flag driven: at most one `requestAnimationFrame` is
  pending. No continuous render loop.
- The exact camera position is published as `data-view-left` and
  `data-view-top` on `<body>` for diagnostics and tests.

### Camera and panning

- `view_left` and `view_top` are floating-point board coordinates at the
  canvas origin, clamped independently to `0 .. 1000 - visible_w` and
  `0 .. 1000 - visible_h`.
- Dragging empty space with the left button pans; any drag that does not start
  on a piece pans. A middle/right button always pans.
- Panning updates the camera immediately, requests snapshots for the new
  visible margin, and updates the top-right `(x, y)` overlay.
- `select_center bx by` clamps the camera so the requested board is centred
  and requests the surrounding cache.
- Resizing the window preserves the rounded centre, resizes the backing store,
  and reloads the visible margin.

### Snapshot cache

- A `Hashtbl` keyed by `board_y * 1000 + board_x` stores loaded boards:
  64 one-byte client pieces, the board revision, a loaded flag and an optional
  pending request ID.
- Only boards within 25 x 25 of the view centre are retained. Boards outside
  that window are evicted, and their pending requests are forgotten.
- On every camera change the client requests the visible boards plus a
  one-board margin, then the rest of the retained window lazily. The request
  queue is rebuilt from the current camera, so stale queued boards are not
  requested.
- At most one snapshot request is outstanding at a time. A response is applied
  when it matches the current request, or when it belongs to an older request
  for a board that is still unloaded and not resyncing. Revisions are ordered,
  so an older response cannot overwrite newer data; loaded and resyncing
  boards still require the current request.
- A failed snapshot leaves the board unloaded and does not install an empty
  board. An older snapshot that arrives after a newer event is ignored; a
  resync snapshot is requested instead.
- A 250 ms watchdog drops orphan request IDs and retries a pending board after
  a per-board backoff: 500 ms for the first retry, doubling to 4 s. A
  successful snapshot resets the backoff. The retry is also a liveness probe:
  headless Chromium can defer WebSocket message dispatch until the page sends
  again, so a stalled response is released by the retry and then applied by
  the older-response rule.
- The client sends a single subscription-window message (centre, radius 12)
  whenever the rounded cache centre changes. This exactly matches its retained
  25 x 25 window, so the server never broadcasts boards the client has
  evicted.
- Each loaded board holds 64 bytes plus a small record, so a full 625-board
  cache is roughly 50 KiB instead of 200 KiB.

### Moves

- `pointerdown` on a loaded board's occupied square starts a piece drag.
- `pointerup` on any loaded board sends a move if the destination differs.
  Quiet moves may cross board boundaries.
- A capture is sent only if the source and destination are on the same board
  and the moving piece's on-original-board bit is set. Otherwise the drag
  snaps back locally, matching the server rule.
- The move wire format is unchanged: a 14-byte request containing the world
  source position, signed 9-bit deltas, the source signature and request ID.
- Normal moves are optimistic: source and destination bytes are saved and
  restored on rejection. Cross-board normal moves update both board states.
- Castling and en passant are applied only after acceptance. En passant is
  same-board, so its captured pawn is on the source/destination board.
- The accepted response carries the moved piece's packed int64; the client
  projects it back to the one-byte form and updates the destination byte, so
  the on-original-board / en-passant / castling bits stay accurate without a
  new snapshot.
- Live move events are applied by square and revision. A revision equal to or
  below the cached revision is a duplicate/stale event and is ignored. The next
  revision applies the changed squares. A revision gap invalidates that board
  and queues a fresh snapshot.
- The event matching the pending request marks it as already applied and
  clears the optimistic lock immediately. The response then finds no pending
  move, so castling, en passant and promotion are not applied twice. The
  server broadcasts events only for accepted moves, which makes the event
  authoritative.
- While a move is pending, the client sends a probe snapshot request for the
  centre board every 250 ms. This is a no-op for board state when the board is
  already loaded, but it gives deferred WebSocket message dispatch a chance to
  run. If neither the response nor the event arrives within 2 s, the
  optimistic move is rolled back and the input lock is released.
- At most one move is in flight. While it is pending, panning and new drags
  are ignored; `data-move-pending` on `<body>` reflects the state.

### Coordinates and deep links

- The rounded camera centre is shown in a fixed top-right overlay as
  `(x, y)`.
- `?x=<board_x>&y=<board_y>` sets the initial centre. Values outside
  `0..999` are clamped; omitted or invalid values default to the corner.
- The query string is preserved across reloads, so a reload returns to the
  same centre.

### Networking

- Connect to `ws://` or `wss://` + host + `/ws`.
- Binary type: `arraybuffer`.
- Request IDs are a per-page random `int32` seed incremented per request,
  shared by snapshot and move requests. Randomising the seed keeps one client's
  pending request ID from colliding with another client's broadcast event.
- Snapshot requests are 9 bytes; move requests are 14 bytes; cache window
  updates are 6 bytes.
- Server messages are fixed 4096-byte wire frames with a kind byte (`1` move,
  `2` snapshot, `3` live event, `4` event batch).
- Movement/rollback dispatch reads the status byte: 1 accepted, 0 rejected.
- Calls `Metrics.received` for every move response.
- Closes the WebSocket on `beforeunload` so page reloads shut down cleanly.
- Live subscriptions are implemented, but there is no event replay or
  reconnect/resume. After a missed event the client re-snapshots the affected
  board; after a disconnect a new page/cache starts from snapshots.

### Metrics

`client/metrics.ml`:

- `enabled = true` switch.
- `sent` records `performance.now() * 1e6` onto a FIFO queue.
- `received` pops the oldest timestamp and computes RTT in nanoseconds.
- Tracks last, average, min, max, count, and measured timer resolution.
- Resolution measurement takes the minimum of 20 clock ticks.
- Logs to the console (there is no on-screen RTT element):
  ```
  rtt … ns   avg … ns   min … ns   max … ns   n=…   res … ns
  ```
- With cross-origin isolation, Chrome exposes a 5 µs clock; without it the
  clock is coarser. Nanosecond figures are conversions of the browser clock,
  not true nanosecond measurements.

---

## 16. Rules inherited from the original implementation

These are deliberate and are not conventional chess:

- Pieces move in absolute world coordinates and may cross board boundaries
  freely.
- The validator uses the original maximum displacement of 36 world squares per
  axis. The wire codec still supports signed 9-bit deltas (±128) so the
  transport remains general; the server enforces 36.
- A piece can capture only while it is on its original board, and the capture
  must land on that same board. Moving off the board clears the capturable
  bit; moving back sets it again.
- Normal king moves may not cross board boundaries; castling uses the absolute offsets above.
- Castling uses the original absolute rook offsets (king ±3 / ±4) and does not
  require king and rook to be on the same board.
- There is no check, checkmate, turn, or attack validation.
- Pawns may double-move whenever their move count is zero; there is no
  starting-rank restriction.
- En passant captures the pawn at `(source_x + dx, source_y)` if it has
  `just_double_moved`. The flag expires when that pawn next moves; moves by
  other pieces do not clear it, matching the original implementation.
- En passant is a capture and therefore requires the moving pawn to start and
  finish on its original board. Cross-board en passant is rejected.
- Promotion occurs only at the absolute top/bottom world edges (white row 0,
  black row 7999), not at individual board edges.
- A promoted pawn moves like a queen.
- An en passant move does not promote, matching the original branch.
- Capture metadata during a promotion is evaluated after promotion; therefore
  a promoting pawn does not receive `QueenPawner`/`KingPawner`.

---

## 17. Invariants

1. `Game_state.sequence` only increases, only for accepted moves, and never
   wraps silently.
2. Ledger sequence numbers are contiguous and agree with the game sequence.
3. A rejected request changes neither board, ledger, nor sequence.
4. A committed request changes all three exactly once.
5. Piece IDs are nonzero, unique across the world, and preserved across moves
   and promotion.
6. `Piece.empty` is the only empty representation.
7. Only the state worker mutates the authoritative board after startup.
8. A move transaction never yields or performs network I/O.
9. The wire move is source + signed deltas; the destination is reconstructed
   exactly under the ±128 rule.
10. Client and server use the same piece-ID allocation formula.

---

## 18. Testing

`dune runtest` runs:

### `test_piece_board`

- Piece type round trips, ID validation, max ID.
- All flag setters/getters and independence.
- Counter saturation at 4095, including the high capture-count bits.
- Promotion metadata preservation.
- One-byte client encoding: colour, type order (pawn, bishop, knight, rook,
  queen, king), original-board bit, en-passant/castling bit, promoted-queen
  projection, the current on-original flag, and the square-plus-byte signature.
- Empty-piece errors.
- Board first/last world indices.
- First/last square reads/writes/clears.
- `get_world` and checked `get` agree.
- Bounds errors, board copies, set_board length checks.
- Row-major `iter_board`, occupied-only `iter`.
- Standard board contents, unique IDs across boards, copies.
- Printed standard board.

### `test_move`

- Empty/invalid/friendly-destination/no-op moves.
- Pawn pushes, double moves, blocks, direction, captures.
- Diagonal-to-empty routing to en passant.
- Knight jumps, sliding paths, blockers.
- King movement and same-board restriction.
- Kingside/queenside castling; moved pieces and blocked paths.
- Captures are rejected off the original board and while a piece is away from
  home (including a same-board capture); returning to the original board
  restores capturing.
- Same-board and cross-board quiet moves.
- Same-board en passant; cross-board en passant rejected.
- 36-square acceptance and 37-square rejection.
- Move classification (`Normal`, `Castle` with rook positions, `En_passant`
  with captured square).
- En-passant flag expiry: a double-move flag cleared by the pawn's next move
  cannot permit en passant; the same geometry with the flag set is legal.
- `Move_processor.prepare` leaves the board untouched; `apply_plan` writes.
- White/black promotion, including capture metadata.
- Killer/adopted/captured-different-type flags.
- Illegal moves leaving the board unchanged.

### `test_protocol`

- Snapshot request/response round trips, all 64 one-byte pieces, empty
  squares, 81-byte length, board revision and maximum coordinates.
- Board subscribe/unsubscribe and cache-window codecs.
- Live event framing: kind 3, kind-4 batches, global sequence, request ID,
  two boards, revisions and changed squares.
- Invalid snapshot coordinates and frame lengths.
- Source+delta move round trips.
- ±128 wire boundary and rejection of 129.
- Out-of-world positions.
- Request round trip and invalid piece IDs.
- Response round trip for accepted and rejected.
- Packed-to-client-byte projection for move acknowledgements (colour, knight /
  bishop order, original board, en passant/castling, promotion).
- Wire response framing: 4096-byte length, kind byte, move/snapshot round trip,
  wrong length and wrong kind.
- Wrong frame lengths.

### `test_game_state`

- Snapshot of untouched and modified boards, row-major ordering and empty squares.
- Snapshot after capture, castling, en passant and promotion (engine tests).
- Snapshot does not modify board, ledger or sequence.
- Invalid snapshot coordinates.
- Full 1,000,000-board initialisation.
- 32,000,000 occupied squares.
- 32 pieces on all four corner boards.
- Correct corner piece types/colours.
- Exhaustive enumeration and uniqueness check of all 32,000,000 IDs.
- Minimum ID 1 and maximum ID 32,000,000.
- Sequence and ledger remain empty after initialisation.

### `test_engine`

- Accepted pawn move, sequence, ledger event.
- Stale expected piece ID rejection.
- Signature-based acceptance and stale-signature rejection.
- Invalid move rejection with unchanged sequence/ledger/board.
- Capture and ledger captured ID.
- En passant flag and captured pawn.
- Castling flag and both pieces moved.
- Promotion flag and preserved ID.
- Consecutive sequence values.
- Small-capacity ledger wraparound: latest/next/oldest and retained events.

### `test_connection_manager`

- Two clients subscribed to one board both receive an event.
- An unrelated board subscriber receives nothing.
- A client subscribed to both affected boards receives one deduplicated event.
- A failing client send is isolated and removes only that client.
- Unregister removes subscriptions.
- Explicit unsubscribe and window replacement stop matching events.
- Outbox/event parsing via the real wire codec.
- Snapshot pending buffers drafted events until the snapshot revision is known;
  represented events are discarded and newer events release in revision order.
- A cross-board move with one pending board delivers the other immediately and
  buffers the pending board.
- A superseded snapshot token cannot release the newer snapshot buffer.
- A full outbox drops event frames while retaining responses and bounding depth.

### `test_worker`

- Snapshot before/after move, snapshot followed by move, FIFO ordering and queue capacity.
- Committed events for normal, capture, castling, en passant and promotion:
  affected board, revision, cleared squares and final pieces.
- Shutdown processes a queued snapshot.
- Two concurrent submissions processed FIFO with sequences 1 and 2.
- Stale request rejected without sequence advancement.
- Metrics counters and queue depth.
- Two concurrent requests for the same piece: exactly one accepted, one
  rejected, sequence advances once.
- Queue-full rejection with capacity one.
- Shutdown processes an already accepted pending request.

### `test_persistence`

- WAL and snapshot format round trips, checksums, segment headers and
  malformed/torn frames.
- Empty-world recovery reproduces the deterministic initial digest.
- Several moves, a cross-board rook move, castling, en passant and promotion
  survive a restart; a snapshot boundary is used for directly prepared special
  positions.
- Torn trailing WAL records are ignored and the segment is truncated while all
  complete records remain.
- A snapshot restores the same digest as WAL replay.
- A corrupt newest snapshot falls back to the previous snapshot plus the
  retained WAL.
- Two hundred synchronously durable moves replay to the exact pre-shutdown
  digest.

### `live_update_test.js`

- Real two-client WebSocket fan-out for a shared board.
- Unrelated-board subscriber receives nothing.
- A cross-board move reaches subscribers of both boards and includes both
  board records.
- A disconnected client stops receiving while other clients continue.

### `live_client_test.js`

- A browser watching a remote client applies live events to its cache.
- A late duplicate event is ignored by revision.
- An older event is ignored without changing the board.
- An injected revision gap marks the board stale, disables local moves and
  triggers a fresh snapshot; the recovered board has the current revision and
  position.
- Per-board int64 revisions mean an unrelated board's move does not create a
  false gap.

### `snapshot_consistency_test.js` (Linux, server running)

- Races a snapshot request from client A against a move from client B on the
  same board, 20 times on fresh boards.
- Accepts either a snapshot that contains the move, or a snapshot at revision 0
  followed by a revision-1 event; applies frames in arrival order and requires
  the moved pawn to be present.
- Races five snapshot clients against one move on a fresh board and requires
  every cached board to converge.
- Complements `test_connection_manager`'s deterministic buffer/release and
  superseded-token tests.

### `crash_recovery_test.js` (Linux, server binary)

Spawns real servers against isolated data directories, kills them with
SIGKILL (including deliberate fault-injection points) and restarts them:

- Empty-world restart and several-move restart preserve the exact digest.
- Cross-board rook state and castling/en-passant state survive a restart.
- `wal-partial-write` leaves a torn trailing record; recovery restores the
  pre-move digest and sequence.
- `snapshot-partial-temp` crashes during the temporary snapshot write; the
  acknowledged move is recovered from the WAL.
- `snapshot-renamed` crashes after the snapshot rename but before WAL cleanup;
  recovery applies no transition twice.
- Corrupting the newest snapshot falls back to the previous snapshot plus WAL.
- A 200-move WAL replays to the exact digest and sequence.

### `ws_teardown_test.js` (Linux)

- Repeatedly launches Chromium, loads the client, and SIGKILLs it without a
  close handshake.
- Asserts server CPU returns to idle, file descriptors do not grow, and a
  fresh WebSocket snapshot request still gets a valid response.

### `ws_write_failure_test.js` (Linux, server running)

- Pauses a raw WebSocket client and generates 37,500 moves so its outbox and
  send path are backpressured.
- Resets the raw TCP socket, forcing a failed server write.
- Asserts the server stays responsive, records failed sends, returns to 0 idle
  ticks/s, discards the connection from subscriptions, and still serves a
  surviving client.
- Exercises the pinned `httpun-ws` Wsd cleanup; `test/test_wsd.ml` checks the
  same failed-write transition directly.

### `load_test.js` (Linux, server running)

- Runs the `default` profile (40 active + 4 silent clients, 400 snapshots,
  100 moves) or `stress` profile (80 + 4, 800 snapshots, 200 moves).
- Gives every active client a 25 × 25 subscription window and checks that
  every client receives exactly one event per move, with the expected board,
  revision, request ID and changed squares.
- Checks silent clients on an unrelated window receive no events.
- Measures snapshot/move RTT, event delivery lag, throughput, move acceptance,
  server CPU/RSS/fds, post-exit fds and idle CPU.
- Writes `bench/load_default_results.*` and `bench/load_stress_results.*`;
  `bench/load_after.js` appends the after-exit measurements.

### `run_scaling.js` (Linux, owns its server children)

- Runs the progressive matrix `0,20,40,80,160,200,320,400,600,640,800,1020`
  by default, with a fresh server per level.
- Each level records snapshot/move/event-lag percentiles, CPU, RSS, fds,
  outbox depth, drops, failures and full event accuracy.
- Stops at the first failed level unless `SCALE_STOP_ON_FAIL=0`.
- `SCALE_DISTRIBUTIONS=high,low,partial` runs the subscription-distribution
  matrix at the configured client count and writes `dist_results.*`.
- Writes `scale_results.*` and `dist_results.*`; the dashboard loads both.

### `slow_client_test.js` (Linux, owns its server child)

- Starts a server with `CONNECTION_OUTBOX_CAPACITY=8`.
- Runs 20 normal clients and 37,500 moves against a baseline and three slow
  raw-WebSocket clients: paused-short, paused-long and slow-read.
- Verifies normal clients receive every event, normal lag matches the baseline,
  the slow outbox never exceeds capacity, events are dropped rather than
  growing unbounded, a client past the send timeout is unregistered, and the
  affected client recovers by snapshot (same connection or reconnect).
- Writes `slow_results.*`; the dashboard loads it.

---

## 19. Known limitations / explicitly out of scope

- Live subscriptions and broadcasts are implemented, but events are not
  persisted or replayed. A missed event is recovered by re-snapshotting the
  affected board; a new connection starts from snapshots.
- No reconnect/resume.
- Normal moves are applied optimistically and rolled back on rejection.
  Castling and en passant are not applied optimistically: the client waits for
  acceptance and then applies the local king+rook or pawn+captured-pawn move.
- The client keeps a 25 x 25 snapshot cache and subscribes to that window.
  Broadcasts keep loaded boards current; a revision gap triggers a full board
  resync.
- The client snapshot carries no 25-bit piece IDs, so stale-move detection uses
  the source square plus the one-byte piece signature. A different piece of the
  same type and status on the same square is indistinguishable to the client.
- Server responses are padded to 4096 bytes to work around Dream 1.0.0~alpha8
  WebSocket buffering, so small acknowledgements use more bandwidth than their
  logical 26-byte payload. Live events are batched into kind-4 frames, which
  amortises the padding over many events; `EVENT_BATCHING=0` disables it.
- Client promotion is not re-glyphed locally before commit; the live event or
  response supplies the promoted byte immediately after acceptance.
- No persistence.
- No authentication or authorisation.
- No turn validation; either colour can move any piece from the client’s
  perspective.
- No check/checkmate/win detection.
- The worker is an Lwt task in the networking domain, not a dedicated Domain.
- `Protocol.Types` has no `.mli`; its implementation is the interface.

---

## 20. Benchmarks and engineering notes

- `bench/bench.ml` runs the speed suite; `dune exec bench/bench.exe`.
- `bench/load_test.js` runs the end-to-end live load test against a running
  server; see `bench/README.md`.
- `bench/run_scaling.js` owns fresh server children for the client-count and
  subscription-distribution matrices.
- `bench/slow_client_test.js` owns a server with a small outbox and tests
  non-reading, delayed and low-throughput clients, including recovery.
- `bench/dashboard.html` is a dependency-free static dashboard reading
  `bench/results.js`, the load result `.js` files, `scale_results.js`,
  `dist_results.js` and `slow_results.js`.
- The suite covers board indexing/reads, packed pieces, protocol codecs,
  validation path variants, processing prepare/apply, ledger operations,
  snapshots, the full engine, the worker and startup phases.
- `docs/ALGORITHMS.md` explains the algorithm choices, complexity, benchmark
  methodology, test evidence and formal-verification opportunities.

Example relative results on the benchmark machine: raw board indexing ~2.7 ns,
checked indexing ~6.1 ns; checked board read ~14.1 ns vs direct world read
~11.5 ns; a 36-square sliding path ~556 ns with record construction vs
~250 ns with direct world reads; ledger append ~16 ns; full engine process
~215 ns; Lwt worker round trip ~2.5 µs. See `bench/results.json` for the
current run.

End-to-end load on the same machine: the `default` profile sends 596 requests
from 44 concurrent clients and completes in ~319 ms (~1,870 requests/s) with
move RTT p50 1.8 ms and client event lag p50 3.9 ms; the `stress` profile sends
1,176 requests from 84 clients in ~354 ms (~3,318 requests/s) with move RTT p50
7.8 ms and event lag p50 8.5 ms. Both runs accepted every move, delivered every
event exactly once, leaked no events to unrelated windows, and returned to 6
fds and idle CPU after the client process exited.

The scaling matrix reached 1,020 clients and 6,236 requests in ~0.9 s
(~6,976 requests/s), with 102,000 event deliveries, zero drops/failures and
666 MiB peak RSS / 1,032 peak fds. Batching reduced the 1,020-client move p50
from 809 ms to 62 ms and WebSocket writes from 102,000 to 3,157. Above roughly
400 clients the single Node load process is also a bottleneck; server CPU
remained below 61%.

Distribution at 80 clients: high overlap 80 recipients/move and 7.6 ms move
p50; low overlap 1 recipient and 1.6 ms; partial overlap 20 recipients and
3.6 ms. All three had zero missing/extra events.

Snapshot consistency: snapshot requests register the board subscription before
the worker captures the board; pending events are buffered per board, events
represented by the snapshot are discarded, and newer events release in
revision order after the snapshot. The consistency race test passed 20
snapshot/move races (20 buffered-after-snapshot) and 25 concurrent snapshot
clients. The connection-manager tests cover move-before-snapshot,
move-after-snapshot, multiple buffered moves, cross-board splitting and
superseded snapshot tokens. Slow-client test with an 8-frame outbox and 37,500
moves kept normal-client lag at 0.79–0.81 ms p50 while dropping
11,099–12,430 events per slow scenario, never exceeding outbox depth 8; the
paused-long client was unregistered after the send timeout and recovered via a
new connection. See `bench/load_default_results.json`,
`bench/load_stress_results.json`, `bench/scale_results.json`,
`bench/dist_results.json` and `bench/slow_results.json`.

---

## 21. Operational commands

```bash
cd /home/james/Work/sim-map

dune build
dune runtest

# Run the server (initialises the full world first)
_build/default/server/server.exe

# Development watcher
dune exec --watch server/server.exe

# Optional tuning
EVENT_BATCHING=0 _build/default/server/server.exe        # one event per frame
EVENT_BATCH_WINDOW_MS=2 _build/default/server/server.exe # wider batch window
CONNECTION_OUTBOX_CAPACITY=8 _build/default/server/server.exe
```

The server listens on `http://localhost:8080`; `GET /metrics` returns the
aggregate pipeline and outbox snapshot.

---

## 22. Git history (implementation milestones)

```
ae25f8a Add authoritative state, serialised move engine, and request/response protocol
b8a414c Encode moves as source plus 7-bit deltas
0f7d4ba Add move validation and move application
12591c3 Add packed Piece and dense Board world modules
ba8d7c6 Add chessboard UI, WebSocket move acks, RTT metrics, and move ledger
93a2bdf Stop tracking dune build output
5c6eebe Initial Work
2b3bf6a Apply review fixes for moves, transactions, worker timing, and client rollback
564a5bc Add benchmark suite, dashboard, algorithm notes, and performance cleanups
250ec44 Update benchmark baseline
68d85d7 Expand algorithm notes with proof obligations and efficiency audit
26559d2 Update notes to reflect ledger wraparound tests
```
