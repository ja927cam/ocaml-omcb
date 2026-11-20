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
| Maximum move distance per axis | 128 |
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
| 37–38 | 2 | Reserved, preserved |
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

- `expected_piece_id` is in `1..Piece.max_id`;
- both move positions are inside the world.

It performs no board access and no chess validation.

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
  | Cross_board_capture
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
7. `|dx| > 128` or `|dy| > 128` → `Invalid_geometry`.
8. Dispatch:
   - king with `|dx| = 2` and `dy = 0` → castling validation;
   - pawn with `|dx| = 1` and empty destination → en-passant validation;
   - otherwise normal validation.

### Normal move validation

Before piece-specific geometry:

- If destination is occupied, the two positions are on different boards, and
  the captured piece has `move_count = 0` → `Cross_board_capture`.

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
- Cross-board capture restrictions are not applied (matching the original).

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
4. Clear the source square.
5. Write the final moving piece to the destination.

### En passant

- Clear source.
- Clear the captured pawn at `(dst_world_x, src_world_y)`.
- Increment move and capture counts.
- Clear `just_double_moved`.
- Write the moving pawn to the destination.
- No killer/adopted/different-type flags are set, matching the original.

### Castling

- Recompute the rook source and destination from the king’s move.
- Increment king and rook move counts from 0 to 1.
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
3. If `Piece.id source <> expected_piece_id` → `Rejected Stale_piece`.
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
| 6–9 | Expected piece ID, int32 little-endian |
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
| 6 | Cross-board capture forbidden |
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

### 13.6 Snapshot response — 521 bytes

| Bytes | Field | Encoding |
|---|---|---|
| 0 | Status | 1 success, 0 failure |
| 1–4 | Request ID | int32 little-endian |
| 5–6 | Board X | uint16 little-endian |
| 7–8 | Board Y | uint16 little-endian |
| 9–520 | Board contents | 64 packed int64 pieces, row-major |

A failed response has status 0 and zero-filled board contents. The response
length is distinct from the 26-byte move response, so the client can dispatch
on length.

Codec functions: `snapshot_request_to_bytes`, `snapshot_request_of_bytes`,
`snapshot_response_to_bytes`, `snapshot_response_of_bytes`. They depend only on
`Protocol.Types`, not `Game_state` or `Board`.

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
   worker, await the result, encode a 26-byte response.
4. For a snapshot: decode, call `State_worker.submit_snapshot`, await the
   64-piece board, encode a 521-byte response.
5. Snapshot decode failures produce a status-0 521-byte response.
6. Worker errors produce the corresponding move rejection or snapshot failure.
7. Send the response as a binary frame and continue on the same connection.
8. Never read the board directly in the handler.

Worker errors become rejection codes 9–11 with the originating request ID.

If sending fails because the client disconnected, the error is swallowed.
A move that has already committed is never rolled back.

### Dream close workaround

The route uses `Dream.websocket ~close:false`. Dream 1.0.0~alpha8 busy-loops
when it closes a socket whose peer has already disconnected. The peer’s close
frame is sufficient; the handler returns on `Dream.receive = None`.

---

## 15. Client

### Rendering

- Canvas backing size: 512 x 512, 64 px squares.
- CSS scales the canvas to fit the viewport with a square aspect ratio.
- Board background is rendered once into an offscreen canvas.
- Piece glyphs are rendered once into a 6 x 2 offscreen atlas:
  pawn, knight, bishop, rook, queen, king; white and black rows.
- Redraws use the atlas and one background blit.
- Rendering is dirty-flag driven: at most one `requestAnimationFrame` is
  pending. No continuous render loop.

### Board and piece IDs

The client does not generate a standard starting position. On startup and on
every board selection it clears the local board, increments a selection
generation, and requests a 9-byte snapshot from the server.

The 521-byte response carries 64 packed pieces. The client decodes each
piece's ID, type and colour, uses the server type for the glyph (promoted
pawns use the queen glyph), and stores the decoded IDs for subsequent move
requests. Responses are matched by request ID and generation; stale or failed
snapshots do not overwrite the selected board.

On a local move:

- `expected_piece_id` is the source square’s tracked ID;
- the destination ID is overwritten with it;
- the source ID becomes 0;
- the board bytes move as before.

### Board selector

- Two number inputs: `board-x`, `board-y`, each `0..999`.
- Input changes clear the local board, increment the generation, and request a
  fresh authoritative snapshot.
- `change` clamps and rewrites invalid values.

### Drag and drop

- `pointerdown`: find a square; if occupied, begin a drag with the piece and
  cursor position.
- `pointermove` on `window`: update the cursor and redraw.
- `pointerup` on `window`: if the current board snapshot is loaded and the
  destination is valid, handle the move according to its classification and
  send a move request.
- `pointercancel`: cancel the drag.
- Highlight source in yellow and the hovered target in green.
- Pointer coordinates are converted from client coordinates using a bounding
  rect snapshot taken at drag start.

### Optimistic updates and rejection handling

- At most one move is in flight; new drags are ignored until the response.
- A normal move is applied locally immediately. Its previous source and
  destination bytes and piece IDs are saved.
- If the server rejects a normal move, those bytes and IDs are restored.
- Castling and en passant are detected geometrically and are not applied
  optimistically. If accepted, the client applies the king+rook or
  pawn+captured-pawn update; if rejected, the board is untouched.
- Loading a different board discards any pending request.

### Networking

- Connect to `ws://` or `wss://` + host + `/ws`.
- Binary type: `arraybuffer`.
- Request ID counter is a client-side `int32` counter.
- Builds a 14-byte request:
  - 6-byte source+delta move;
  - expected piece ID;
  - request ID.
- Sends an `ArrayBuffer`.
- Receives 26-byte responses.
- Reads the status byte:
  - 1 → “move accepted”;
  - 0 → “move rejected”.
- Calls `Metrics.received` for every response.

No reconnect or event replay is implemented. Snapshot loading is one-shot per
board selection; local handling is limited to per-request rollback and accepted
special-move application.

### Metrics

`client/metrics.ml`:

- `enabled = true` switch.
- `sent` records `performance.now() * 1e6` onto a FIFO queue.
- `received` pops the oldest timestamp and computes RTT in nanoseconds.
- Tracks last, average, min, max, count, and measured timer resolution.
- Resolution measurement takes the minimum of 20 clock ticks.
- Writes `#rtt` and logs to the console:
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
- The project uses a maximum displacement of 128 world squares per axis
  (the original implementation used 36).
- Capturing a piece on a different board is only allowed if the captured
  piece’s move count is greater than zero.
- Normal king moves may not cross board boundaries; castling uses the absolute offsets above.
- Castling uses the original absolute rook offsets (king ±3 / ±4) and does not
  require king and rook to be on the same board.
- There is no check, checkmate, turn, or attack validation.
- Pawns may double-move whenever their move count is zero; there is no
  starting-rank restriction.
- En passant captures the pawn at `(source_x + dx, source_y)` if it has
  `just_double_moved`. The flag expires when that pawn next moves; moves by
  other pieces do not clear it, matching the original implementation.
- En passant has no cross-board capture restriction.
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
- Cross-board capture with moved/unmoved targets.
- Same-board and cross-board en passant.
- Move classification (`Normal`, `Castle` with rook positions, `En_passant`
  with captured square).
- En-passant flag expiry: a double-move flag cleared by the pawn's next move
  cannot permit en passant; the same geometry with the flag set is legal.
- `Move_processor.prepare` leaves the board untouched; `apply_plan` writes.
- White/black promotion, including capture metadata.
- Killer/adopted/captured-different-type flags.
- Illegal moves leaving the board unchanged.

### `test_protocol`

- Snapshot request/response round trips, all 64 pieces, empty squares, 521-byte length and maximum coordinates.
- Invalid snapshot coordinates and frame lengths.
- Source+delta move round trips.
- ±128 boundary and rejection of 129.
- Out-of-world positions.
- Request round trip and invalid piece IDs.
- Response round trip for accepted and rejected.
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
- Snapshot loading is one-board-at-a-time; there are no spatial subscriptions
  or live updates, so a board can become stale after another client moves.
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
