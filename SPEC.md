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
  state_worker.ml / state_worker.mli

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
  client_snapshot_test.js

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
  mutable sequence : int64;
  mutable initialised : bool;
}
```

The representation is private in the `.mli`.

- `create`:
  - allocates the board (512 MB, zero-filled);
  - allocates a 1,048,576-event ledger with next sequence 1;
  - sequence = 0.
- `initialise`:
  - iterates all 1,000,000 board coordinates;
  - on the first call (fresh zero-filled board) uses
    `Board.initialise_standard_position ~clear:false`;
  - later calls clear each board first;
  - leaves sequence at 0 and ledger empty.
- Public accessors: `sequence` (read-only) and `occupied_count`.
- Controlled internal interface: `with_state`, which passes the board, ledger
  and current sequence to a callback and commits the returned sequence. The
  move engine is the sole production user; direct board/ledger accessors and a
  public `set_sequence` do not exist.
- `snapshot_board t ~board_x ~board_y`: returns a 64-element copy of one board
  in row-major order. Empty squares are `Piece.empty`; every packed piece field
  is preserved. Invalid coordinates raise. It does not modify the board,
  ledger or sequence.

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

### 13.6 Snapshot response — 73 bytes

| Bytes | Field | Encoding |
|---|---|---|
| 0 | Status | 1 success, 0 failure |
| 1–4 | Request ID | int32 little-endian |
| 5–6 | Board X | uint16 little-endian |
| 7–8 | Board Y | uint16 little-endian |
| 9–72 | Board contents | 64 one-byte client pieces, row-major |

A failed response has status 0 and zero-filled board contents.

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

### 13.7 Wire response framing — 4096 bytes

Dream 1.0.0~alpha8 buffers WebSocket writes until 4096 bytes have accumulated.
A 26-byte move acknowledgement can therefore wait indefinitely when the client
has stopped sending requests until it arrives. Every server response is carried
in a fixed 4096-byte binary frame:

| Bytes | Field |
|---|---|
| 0 | Kind: `1` move response, `2` snapshot response |
| 1..26 or 1..73 | The encoded response |
| Rest | Zero padding |

`wire_response_to_bytes` and `wire_response_of_bytes` in `Protocol.Types` build
and validate these frames. Each send crosses the 4096-byte threshold, so Dream
flushes it immediately. The 73-byte snapshot payload and 26-byte move payload
remain unchanged for codec tests and benchmarks.

The client keeps at most **one** snapshot request in flight. Dream's stream
pipe can lose a write acknowledgement when many responses are queued, which
stalls a connection; strictly sequential snapshots avoid that path while still
loading a 25 x 25 cache quickly over a loopback connection.

The legacy JSON `client_msg` type has been removed; the protocol library no
longer depends on `ppx_deriving_yojson`.

---

## 14. Server

### Startup sequence

1. `Game_state.create`.
2. `Game_state.initialise`.
3. Verify `occupied_count = 32,000,000`.
4. `State_worker.start`.
5. Build the Dream router.
6. `Dream.run` on port 8080.

Startup timings are logged for allocation, world initialisation, verification,
worker startup, and total startup.

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
| `/static/**` | Static files from `_build/default/client` (prefix stripped by `Dream.scope`) |
| `/ws` | Binary WebSocket move endpoint |

### WebSocket handler

1. Receive a binary frame.
2. Dispatch on length:
   - 14 bytes → move request;
   - 9 bytes → snapshot request;
   - anything else → rejection / invalid request.
3. For a move: decode, convert positions, create `Move_request`, submit to the
   worker, await the result, encode a move response.
4. For a snapshot: decode, call `State_worker.submit_snapshot`, await the
   64-piece board, encode a snapshot response.
5. Wrap the response in the fixed 4096-byte wire frame (kind + payload) and
   send it, so Dream flushes immediately.
6. Snapshot decode failures produce a status-0 snapshot response.
6. Worker errors produce the corresponding move rejection or snapshot failure.
7. Continue reading on the same connection after the send resolves.
8. Never read the board directly in the handler.

Worker errors become rejection codes 9–11 with the originating request ID.

If sending fails because the client disconnected, the error is logged and the
handler returns. A move that has already committed is never rolled back.

### Dream buffering and close workarounds

- Every response is a 4096-byte wire frame so Dream’s 4096-byte WebSocket
  buffer flushes on each send.
- The client sends snapshots strictly sequentially (one outstanding) to avoid
  a lost write-acknowledgement path in Dream’s stream pipe.
- The client closes the WebSocket on `beforeunload`, so a reload sends a close
  frame before the old page disappears. Dream’s default close handling is used;
  `~close:false` is no longer needed.

---

## 15. Client

### Rendering

- The canvas fills the viewport (`100vw x 100vh`), and its backing size tracks
  `window.innerWidth x window.innerHeight`.
- The world contains 1000 x 1000 boards. Each board is 168 x 168 backing
  pixels (21 px per square), so a 512 px span shows about 3.05 boards. On a
  typical desktop viewport the nine centre boards are fully visible (except at
  world edges), with additional boards at the edges.
- An 8 x 8 board tile is rendered once to a 168 x 168 offscreen canvas. Each
  visible board is one `drawImage` blit, not 64 rectangle fills. Pieces are
  drawn only for loaded boards, so an unloaded board shows an empty grid
  rather than invented pieces.
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
  64 one-byte client pieces, a loaded flag and an optional pending request ID.
- Only boards within 25 x 25 of the view centre are retained. Boards outside
  that window are evicted, and their pending requests are forgotten.
- On every camera change the client requests the visible boards plus a
  one-board margin, then the rest of the retained window lazily. The request
  queue is rebuilt from the current camera, so stale queued boards are not
  requested.
- At most one snapshot request is outstanding at a time. Responses are matched
  by request ID and board key; stale or evicted responses are ignored.
- A failed snapshot leaves the board unloaded and does not install an empty
  board. It will be retried after the next camera change.
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
- Request ID counter is a client-side `int32` counter shared by snapshot and
  move requests.
- Snapshot requests are 9 bytes; move requests are 14 bytes.
- Server responses are fixed 4096-byte wire frames with a kind byte (`1` move,
  `2` snapshot). The client dispatches on the kind and parses the first 26 or
  73 bytes.
- Movement/rollback dispatch reads the status byte: 1 accepted, 0 rejected.
- Calls `Metrics.received` for every move response.
- Closes the WebSocket on `beforeunload` so page reloads shut down cleanly.
- No reconnect, subscriptions or event replay is implemented.

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
  squares, 73-byte length and maximum coordinates.
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

### `test_worker`

- Snapshot before/after move, snapshot followed by move, FIFO ordering and queue capacity.
- Shutdown processes a queued snapshot.
- Two concurrent submissions processed FIFO with sequences 1 and 2.
- Stale request rejected without sequence advancement.
- Metrics counters and queue depth.
- Two concurrent requests for the same piece: exactly one accepted, one
  rejected, sequence advances once.
- Queue-full rejection with capacity one.
- Shutdown processes an already accepted pending request.

---

## 19. Known limitations / explicitly out of scope

- No spatial subscriptions, broadcasting, or event replay.
- No reconnect/resume.
- Normal moves are applied optimistically and rolled back on rejection.
  Castling and en passant are not applied optimistically: the client waits for
  acceptance and then applies the local king+rook or pawn+captured-pawn move.
- The client keeps a 25 x 25 snapshot cache and pans a 3 x 3-board viewport.
  There are no spatial subscriptions or live updates, so a cached board can
  become stale after another client moves.
- The client snapshot carries no 25-bit piece IDs, so stale-move detection uses
  the source square plus the one-byte piece signature. A different piece of the
  same type and status on the same square is indistinguishable to the client.
- Server responses are padded to 4096 bytes to work around Dream 1.0.0~alpha8
  WebSocket buffering, so small acknowledgements use more bandwidth than their
  logical 26-byte payload.
- Client promotion rendering uses the server snapshot type; an optimistic local
  promotion is not re-glyphed until a snapshot/reload.
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
- `bench/dashboard.html` is a dependency-free static dashboard reading
  `bench/results.js`.
- The suite covers board indexing/reads, packed pieces, protocol codecs,
  validation path variants, processing prepare/apply, ledger operations,
  snapshots, the full engine, the worker and startup phases.
- `docs/ALGORITHMS.md` explains the algorithm choices, complexity, benchmark
  methodology, test evidence and formal-verification opportunities.

Example relative results on the benchmark machine: raw board indexing ~2.6 ns,
checked indexing ~6.2 ns; checked board read ~14.4 ns vs direct world read
~11.5 ns; a 127-square sliding path ~1,797 ns with record construction vs
~887 ns with direct world reads; ledger append ~15 ns; full engine process
~180 ns; Lwt worker round trip ~1.8 µs. See `bench/results.json` for the
current run.

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
```

The server listens on `http://localhost:8080`.

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
