# Algorithms and Engineering Notes

This document explains the main data structures and algorithms in the
implementation, why they were chosen, how they are measured, and what is
already established by tests versus what could be established by formal
verification.

It is intentionally implementation-facing. The API specification lives in
`SPEC.md`; benchmark mechanics and the dashboard live in `bench/`.

---

## 1. Performance goals

The system is designed around four constraints:

1. A fixed, large world: 1,000,000 boards of 64 squares.
2. A dense starting population: 32,000,000 pieces.
3. A move-processing path that should not allocate per-square or per-piece
   objects.
4. A single authoritative writer so that transactional invariants do not need
   locks around individual board operations.

The implementation therefore prefers flat arrays, packed 64-bit values,
circular buffers and a serialised state owner over object graphs and
fine-grained locking.

The expected resident working set is approximately:

| Allocation | Bytes |
|---|---:|
| Board: 64,000,000 × `int64` | 512,000,000 |
| Ledger: 1,048,576 × 16 | 16,777,216 |
| Total core state | 528,777,216 (~504 MiB) |

Measured process RSS after startup and benchmarks is around 520–525 MiB,
including the OCaml runtime and benchmark allocations.

---

## 2. Packed pieces

### Representation

`Piece.t` is one `int64`. Zero means empty. A non-empty piece stores:

| Bits | Field |
|---:|---|
| 0–24 | Piece ID |
| 25–28 | Piece type (1–7) |
| 29 | White |
| 30 | Just double moved |
| 31 | King killer |
| 32 | King pawner |
| 33 | Queen killer |
| 34 | Queen pawner |
| 35 | Adopted killer |
| 36 | Captured a different type |
| 37–38 | Reserved |
| 39 | Adopted |
| 40–51 | Move count |
| 52–63 | Capture count |

### Why this is effective

- One piece is one machine word, not a heap object with an ID field, type,
  colour, nine booleans and two counters.
- The board is therefore a flat array of values with no pointer chasing.
- Metadata travels with the piece automatically. Moving a piece is copying
  one `int64`; it does not require updating parallel arrays.
- Equality and emptiness tests are single-word comparisons.
- The representation is compact enough that 32,000,000 pieces fit in the same
  512 MB board allocation.

### Correctness argument

The fields occupy disjoint bit ranges. `create` writes only the ID, type and
colour fields and rejects invalid IDs. All metadata updates use masks that
clear exactly one field before writing it. Therefore:

- updates cannot corrupt neighbouring fields;
- ID, type and colour are preserved by metadata updates;
- `promote` changes only the type field;
- counters saturate at `0xFFF` rather than wrapping;
- the all-zero value is reserved for empty and cannot be produced by `create`.

The implementation is exercised by tests for every exposed bit field,
counter saturation at the high end (including capture-count bits 52–63), and
promotion metadata preservation. This is not yet a machine-checked proof; the
bit-level lemmas are simple enough to formalise directly (Section 13).

---

## 3. Dense world and indexing

### Representation

The world is one `Bigarray.Array1` of 64,000,000 `int64` values with C layout.
`Board.t` is abstract; callers never receive the raw Bigarray.

Coordinates:

- board coordinates: `board_x`, `board_y` in `0..999`;
- square coordinates: `x`, `y` in `0..7`;
- `y = 0` is the top row.

The authoritative index formula is:

```
board_id = board_y * 1000 + board_x
index    = board_id * 64 + y * 8 + x
```

Equivalently:

```
index = ((board_y * 1000 + board_x) * 64) + (y * 8 + x)
```

Absolute world coordinates are:

```
world_x = board_x * 8 + x
world_y = board_y * 8 + y
```

Both lie in `0..7999`.

### Why this is effective

- One allocation, fixed address, predictable memory layout.
- O(1) square access with one integer calculation.
- No per-board arrays, no per-piece objects, no pointer indirection.
- Board traversal is sequential memory access, which is cache-friendly.
- The same geometry gives every piece an absolute position for movement and
  cross-board rules without a separate board lookup.

### Index bijection

`board_y * 1000 + board_x` maps `(0..999, 0..999)` bijectively onto
`0..999,999`. Multiplying by 64 and adding `y * 8 + x` maps each board’s 64
squares bijectively onto its 64-slot block. The ranges are disjoint and cover
`0..63,999,999`. Therefore `index` is a bijection between valid positions and
world slots.

`Board.in_bounds` is the non-raising validation used by the validator and
engine. Internal operations can use `Board.get_world` by absolute
coordinates, avoiding construction of a position record.

### Standard initialisation and ID uniqueness

For one board:

```
piece_id = board_id * 32 + slot + 1
```

where `slot` is 0–31 in the fixed order:

1. black back rank (0–7);
2. black pawns (8–15);
3. white pawns (16–23);
4. white back rank (24–31).

This gives each board the ID interval `[board_id*32 + 1, board_id*32 + 32]`.
Different boards have disjoint intervals, so IDs are globally unique. The
maximum is `999,999*32 + 32 = 32,000,000`, which is below
`2^25 - 1 = 33,554,431`.

The initialiser writes directly into the Board’s Bigarray. On the first call
the board was already zero-filled by `Board.create`, so it uses
`~clear:false`; subsequent calls clear each board first.

Measured initialisation of all 1,000,000 boards is roughly 0.3–0.5 seconds on
the benchmark machine, depending on process state.

---

## 4. Move representation and classification

`Move.t` contains only:

```ocaml
type t = { src : Board.position; dst : Board.position }
```

It contains no piece ID, colour, type or cached metadata. The move validator
looks up the source and destination in the board when it needs those
properties. This keeps the domain move small and avoids stale duplicated
state.

The validator returns a classification as part of `move_info`:

```ocaml
type move_kind =
  | Normal
  | Castle of { rook_src : Board.position; rook_dst : Board.position }
  | En_passant of { captured_pos : Board.position }
```

This eliminates a second, independent classification in the processor. The
processor applies exactly the positions that validation checked. The engine can
also compute ledger flags directly from the classification rather than
re-inferring move type.

`Move_processor.prepare` produces a plan of clears and writes without touching
the board; `apply_plan` commits it. Splitting preparation from commit is what
makes the transaction safety argument in Section 6 possible.

---

## 5. Move validation

### Absolute-coordinate geometry

Validation first converts both endpoints to absolute world coordinates. This
makes all pieces use the same geometry across board boundaries.

- maximum displacement: 36 squares on either axis (the original rule);
- `|dx|`, `|dy|` computed once;
- sliding path checks walk intermediate absolute squares;
- two-square pawn moves check the one intermediate square;
- knights jump;
- normal king moves may not leave their 8×8 board;
- castling and en passant are special-cased from geometry.

### Sliding path optimisation

The original path check constructed a `Board.position` record for every
intermediate square and called `Board.get`, which revalidated the position.

The implementation now walks absolute coordinates and calls
`Board.get_world ~x ~y`, which:

- avoids constructing a record per step;
- avoids board/square validation and index recomputation through position
  fields;
- still validates absolute-world bounds.

Benchmark comparison on a 127-square queen path:

| Variant | ns/path |
|---|---:|
| position record + checked get | ~1,797 |
| absolute `get_world` | ~887 |

The production validator uses the second form. The path is O(number of
intermediate squares); this benchmark deliberately uses a long path to expose
the difference.

### Normal move rules

- **Pawn**: one or two forward squares, one diagonal capture; direction
  depends on colour; double move requires `move_count = 0`; forward destination
  must be empty; diagonal destination must be an enemy; intermediate square of
  a double move must be empty.
- **Knight**: `(1,2)` or `(2,1)`.
- **Bishop**: equal absolute axes, non-zero; intermediate squares empty.
- **Rook**: exactly one axis changes; intermediate squares empty.
- **Queen / promoted pawn**: bishop or rook geometry; intermediates empty.
- **King**: at most one square on each axis and same board.

### Cross-board moves and captures

Quiet moves may cross board boundaries freely. If the destination is occupied
by an enemy on a different board, the captured piece must have
`move_count > 0`. Otherwise validation returns `Cross_board_capture`. This
mirrors the original implementation: an unmoved piece is still on its original
board and cannot be taken from another board.

The client mirrors the same test in O(1) using bit 4 of the destination
snapshot byte. If a cross-board drop targets an on-original piece, it snaps
back without sending a request; the server independently enforces the rule.

### Special moves

**Castling** is inferred from a king moving exactly two squares horizontally.
The validator computes the rook source and destination from the original
offsets, requires an unmoved same-colour rook and an empty path, and returns
`Castle { rook_src; rook_dst }`.

**En passant** is inferred from a pawn moving one square diagonally into an
empty square. The captured pawn must be an enemy pawn at
`(src_world_x + dx, src_world_y)` with `just_double_moved = true`. The
validator returns that exact captured position.

There is no check/checkmate/turn validation, matching the original game.

### En-passant flag lifetime

The original implementation clears `just_double_moved` when that pawn next
moves; other pieces’ moves do not expire it, because the game has no turns in
the conventional sense. The implementation preserves that semantics and tests
both:

- a double move sets the flag;
- a subsequent move by the same pawn clears it;
- the same en-passant geometry is rejected when the flag is clear and accepted
  when set.

---

## 6. Transactional move application

### Preparation and commit

`Move_processor.prepare`:

1. reads the moving and captured pieces from the board;
2. computes the final moving metadata;
3. computes any rook/king or en-passant positions from `move_kind`;
4. returns a plan of square clears and square writes.

It performs no writes.

`Move_processor.apply_plan` writes the plan.

### Engine pipeline

`Move_engine.process` performs:

1. empty-source check;
2. expected-piece-ID check (`Stale_piece` on mismatch);
3. validator call;
4. event construction;
5. `Ledger.validate_event` before any board write;
6. sequence-limit check;
7. `Move_processor.prepare` before any board write;
8. `apply_plan`;
9. ledger append;
10. sequence update through `Game_state.with_state`;
11. read the updated moving piece for the response.

The order is deliberate. All operations that can fail as ordinary validation
happen before the first board write. Ledger append is prevalidated. If an
unexpected exception occurs after a write, the state worker treats the process
as failed rather than reporting an ordinary rejection. There is no attempt to
continue with a partially committed board.

### Why one writer

A single owner removes the need for:

- per-square locks;
- lock ordering rules;
- atomic board/ledger/sequence updates across independent locks;
- concurrent-mutation races in piece metadata.

Validation and application are synchronous inside the worker. This is a
deliberate trade-off: one core processes moves, but the invariants are simple
and the measured engine path is about 180 ns per accepted move (including
validation, application, event append and sequence update on the benchmark
machine).

### Ownership

`Game_state` no longer exposes direct board/ledger getters or a public sequence
setter. The engine uses the internal `with_state` callback, which commits the
returned sequence after the callback succeeds. The server only reads
`sequence` and `occupied_count`.

This is an OCaml module-boundary convention rather than a kernel-enforced
capability. A future version can split the trusted transaction code into a
private library or use a capability token/abstract writer if stronger
enforcement is desired.

---

## 7. Ledger

### Layout

Two `int64` Bigarrays, each with a power-of-two capacity:

- `moves`: source position (26 bits) + destination position (26 bits);
- `metadata`: moved piece ID (25) + captured piece ID (25) + flags (14).

A position is:

- bits 0–19: board ID (`board_y * 1000 + board_x`);
- bits 20–25: square ID (`y * 8 + x`).

Event size is exactly 16 bytes.

### Circular addressing

```
index = seq land (capacity - 1)
```

`head_seq` is the next sequence to assign. `oldest_seq` is the oldest retained
sequence. On append, after writing:

```
head_seq = head_seq + 1
if head_seq - oldest_seq > capacity then oldest_seq = oldest_seq + 1
```

The readable interval is `[oldest_seq, head_seq)`.

### Why this is effective

- Fixed memory: a million events cost 16 MiB.
- O(1) append, no per-event heap allocation, no linked-list traversal.
- Sequential writes until wrap, then predictable reuse.
- Sequence numbers are implicit in the array position, so they cost no storage
  in each event.
- Two adjacent Bigarray writes are cache-friendly.

### Sequence semantics

`latest_seq` is the most recently committed sequence (`head_seq - 1`);
`next_seq` is the next sequence to assign (`head_seq`). `Game_state` starts
the ledger at `next_seq = 1`, so the first accepted move has sequence 1 while
the game sequence starts at 0.

`Ledger.clear` is not exposed. A running game’s sequence cannot be reset
through the public ledger API.

### Correctness sketch

For every retained sequence `s`:

- `oldest_seq ≤ s < head_seq`;
- `s land mask` was written by the append that assigned `s`;
- it cannot have been overwritten by a later append before `s + capacity`,
  because the oldest pointer advances only when the head oldest distance
  exceeds capacity.

The engine additionally checks that the ledger’s returned sequence equals the
game’s expected next sequence. Tests verify:
- first sequence 1;
- rejected moves do not append;
- accepted moves append exactly one event;
- castling/en-passant/promotion flags and captured IDs;
- sequence continuity.

The engine tests include a capacity-4 wraparound case that checks
latest/next/oldest and overwritten/retained events. A QCheck model would add
broader coverage of interleaved appends and reads.

---

## 8. State worker and concurrency

### Model

One Lwt task owns `Game_state`. All WebSocket handlers call:

```ocaml
State_worker.submit worker request
```

which:

1. checks stopped/failed state;
2. checks bounded queue capacity;
3. enqueues an item with enqueue timestamp;
4. schedules a deferred notification;
5. returns a promise resolved only after processing.

The worker loop:

- waits on an `Lwt_condition` when the queue is empty;
- takes the oldest item when work exists;
- runs `Move_engine.process` synchronously;
- wakes the item’s promise;
- processes up to 64 queued requests before yielding with `Lwt.pause`;
- waits on the condition as soon as the queue is empty.

Notification is coalesced through a `notification_pending` flag. A burst of
submissions produces one deferred wakeup rather than one Lwt task per
submission. This is both cheaper and makes the queue-full behaviour
observable: a burst can fill the bound before the worker is scheduled.

The worker drains a bounded batch (64) before yielding. This keeps the
scheduler responsive while avoiding a scheduler round trip per request when
the queue is already populated.

### Why this model

The current phase deliberately uses the simpler Lwt single-owner model rather
than a separate OCaml Domain:

- no cross-domain promise manipulation;
- no unsafe access to the mutable world across domains;
- no synchronization bugs while the game engine is still evolving;
- all transactions stay synchronous and short.

The cost is that the worker shares the networking domain. The design leaves a
clean transition: a future worker can use a thread-safe mailbox and a safe
handoff back to Lwt, changing only `State_worker`, not `Move_engine` or
`Game_state`.

### FIFO and backpressure

The queue is a bounded FIFO. `submit` returns `Queue_full` immediately when
capacity is reached. Accepted requests are processed in order. The worker does
not perform network I/O, file I/O or client waits inside a transaction.

The same queue also accepts snapshot requests. `submit_snapshot` enqueues a
board coordinate pair; the worker calls `Game_state.snapshot_board`, which
copies 64 packed pieces from the Bigarray. Because both request types share
the FIFO and the worker never yields inside a transaction, a snapshot observes
either the state before a move or the state after it, never a partially applied
move. Snapshots count towards queue capacity and are covered by shutdown tests.

Tests cover concurrent submissions, same-piece races (one accepted, one
rejected), full-queue rejection, snapshot ordering and shutdown with pending
moves or snapshots.

---

## 9. Wire protocol efficiency

### Move encoding

Instead of source and destination positions (26 + 26 = 52 bits, 8 bytes), the
move wire stores:

- source position: 26 bits;
- signed `dx`: 9 bits;
- signed `dy`: 9 bits.

That is 44 used bits in 6 bytes.

The destination is reconstructed in absolute coordinates:

```
dst_world_x = src_world_x + dx
dst_world_y = src_world_y + dy
```

Because the wire format allows deltas up to ±128, nine signed bits are
sufficient. Nine-bit two’s-complement represents `-256..255`; the codec rejects
values outside `-128..128` and rejects destinations outside the world. The
validator separately enforces the original 36-square move limit.

This reduces the move portion from 8 bytes to 6. The request is 14 bytes:

| Bytes | Field |
|---|---|
| 0–5 | move |
| 6–9 | expected piece identity: 25-bit ID or `(square lsl 8) lor client_byte` |
| 10–13 | request ID |

Responses are fixed 26-byte records, including status, request ID, sequence,
updated moving piece, captured piece ID and rejection code. Packed `int64`
values are transmitted as little-endian bytes and never converted to
JavaScript `Number`.

Snapshot messages are intentionally distinct. The request is 9 bytes: one
message-type byte (0x02), request ID, board X and board Y as uint16. The
response payload is 73 bytes: status, request ID, board coordinates, then 64
one-byte client pieces in row-major order. A failed snapshot has status 0 and
zero board contents. Requests dispatch by length (14 move, 9 snapshot). Every
server response is carried in a fixed 4096-byte wire frame with a kind byte
(`1` move, `2` snapshot) and zero padding. The padding is a workaround for
Dream 1.0.0~alpha8, which buffers WebSocket writes until 4096 bytes accumulate:
a 26-byte acknowledgement can otherwise wait forever while the client waits for
it before sending more requests. The snapshot and move codecs live in
`Protocol.Types` and do not depend on the board implementation.

### One-byte client pieces

`Piece.client_byte` projects the 64-bit server piece to one byte:

| Bit | Meaning |
|---|---|
| 0 | white |
| 1–3 | 0 empty, 1 pawn, 2 bishop, 3 knight, 4 rook, 5 queen, 6 king |
| 4 | on its original board (never moved) |
| 5 | en passantable (pawn) or castling-eligible (king/rook) |
| 6–7 | zero |

Promoted pawns project as queens. The snapshot drops from 521 to 73 bytes and
the client cache from roughly 320 to 64 bytes per board. Bit 4 is exactly
`move_count = 0`, so the client can apply the cross-board capture rule without
the 12-bit counter.

Move requests identify the source with a 16-bit signature
`(source_square lsl 8) lor client_byte`. The server accepts the signature, the
full 25-bit ID, or zero (protocol-layer 0 is normally rejected). This preserves
stale-piece detection without sending IDs to the renderer.
`Protocol.Types.client_byte_of_packed` projects the `moved_piece` int64 in an
accepted move response back to this byte, so the client refreshes its local
original/en-passant/castling bits without another snapshot.

### Why fixed widths

- Predictable decoding: no varints, no length prefixes per field.
- Easy to validate length before exposing anything to the state worker.
- Compact payloads: 26-byte move responses and 73-byte snapshot payloads.
- No JSON parsing or allocation on the server move path.
- No dependence on JavaScript numeric precision for 64-bit values.
- The fixed 4096-byte wire frame makes the pinned Dream version flush each
  response; the padding is transport-only and ignored by the codecs.

Protocol tests cover ±128 wire boundaries, 129 rejection, round trips, request
IDs, responses, malformed lengths and the 36-square validator limit. The client and server share the same
`Protocol.Types` module, so the layouts cannot drift independently.

---

## 10. Client grid, rendering and local state

The client is a WASM/Brr canvas application. It renders a 1000 x 1000 world of
boards, not a single board:

- The canvas fills the viewport (`100vw x 100vh`) and its backing store tracks
  the viewport size. Each board occupies 168 x 168 backing pixels (21 px per
  square), so a 512 px span shows roughly 3.05 boards. On a typical desktop
  the nine centre boards are fully visible (except at world edges), with more
  boards at the edges.
- `view_left` and `view_top` hold floating-point board coordinates at the
  canvas origin, clamped independently to the world. Dragging empty space
  pans; a drag that starts on a piece moves that piece instead.
- A fixed top-right overlay shows the rounded camera centre as `(x, y)`.
  `?x=<board_x>&y=<board_y>` sets the initial centre and survives reloads.
- A single 8 x 8 board tile is rendered once to a 168 x 168 offscreen canvas.
  Every visible board is one `drawImage` blit instead of 64 rectangle fills.
  Pieces are drawn only for loaded boards. A dirty flag coalesces redraws into
  one `requestAnimationFrame`; there is no continuous render loop.
- All 12 piece sprites are rendered once into a 6 x 2 atlas. A redraw is one
  tile blit per visible board plus at most 64 sprite blits per loaded board.

### Snapshot cache

- Boards are stored in a hash table keyed by `board_y * 1000 + board_x`.
- The retained window is 25 x 25 boards around the camera centre. Boards
  outside it are evicted and their pending requests forgotten.
- On each camera change the client queues the visible boards plus a one-board
  margin, then the rest of the window lazily. The queue is rebuilt from the
  current camera so stale queued boards are not requested.
- At most one snapshot request is in flight. Sequential requests avoid a lost
  write-acknowledgement path in Dream's stream pipe when many responses are
  queued. A 25-board window is still cheap over loopback.
- Responses are matched by request ID and board key; stale or evicted
  responses are ignored. A failed snapshot leaves the board unloaded and does
  not install an empty board.
- Each loaded board stores 64 one-byte pieces plus a small record, so a full
  625-board cache is roughly 50 KiB. Decoding a byte to a glyph at draw time is
  a handful of bit operations.

### Moves

- A drag may start and end on any loaded board. Quiet moves cross boundaries.
- A cross-board capture is allowed only if the destination byte has bit 4
  clear. The client checks this in O(1) and cancels otherwise; the server
  enforces the same rule.
- Normal moves are optimistic. The undo record holds the source and
  destination board states, so a cross-board move restores both on rejection.
  Castling and en passant are applied only after acceptance; an en-passant
  capture can belong to the source board or the destination board.
- On acceptance the 26-byte response's packed `moved_piece` is projected back
  to a client byte, updating the moved piece's original/en-passant/castling
  bits immediately. No extra snapshot is needed.
- At most one move is in flight. Navigation and new drags are blocked while it
  is pending; `data-move-pending` on `<body>` exposes the state.
- The drag and render path never allocates a board copy.

### Networking

- Requests: 9-byte snapshot, 14-byte move.
- Responses: 4096-byte wire frames with a kind byte. The client dispatches on
  the kind and parses the first 26 or 73 bytes.
- The WebSocket is closed on `beforeunload` so reloads shut down cleanly.
- No reconnect or event replay is implemented.

Client RTT metrics use `performance.now()` and a FIFO of send timestamps. With
cross-origin isolation (COOP/COEP headers) Chrome exposes a finer clock
(5 µs in the measured environment); without it the browser quantises the
clock. The display reports the measured resolution.

## 11. Benchmarks

The benchmark suite is `bench/bench.ml`; the dashboard is
`bench/dashboard.html`.

Run:

```bash
dune exec bench/bench.exe
```

This writes:

- `bench/results.json` — machine-readable results;
- `bench/results.js` — the same data for the static dashboard.

Open `bench/dashboard.html` directly in a browser. Each benchmark groups
variants, scales bars so the fastest variant is full width, and shows ns/op and
operations per second.

### Methodology

- Timing uses `Mtime_clock.now_ns`, a monotonic clock.
- Microbenchmarks warm up, then take the median of three timed repetitions.
- Inputs and arrays are precomputed outside the timed loop where possible.
- Single-shot startup measurements are labelled and shown in milliseconds.
- Results include commit, OCaml version, CPU model and process RSS.
- Core allocations are kept alive during measurement; the benchmark process
  RSS is included in the report.

### Current results (example run, AMD Ryzen 7 250)

Machine-specific numbers, useful for relative comparisons:

| Benchmark | Variant | ns/op |
|---|---:|---:|
| Board index | checked | ~6.1 |
| Board index | raw arithmetic | ~2.6 |
| Board read | checked position | ~13.7 |
| Board read | `get_world` | ~11.1 |
| Piece create | packed int64 | ~7.4 |
| Piece inspect | id/type/flags | ~9.3 |
| Piece metadata | immutable flags | ~19.0 |
| Protocol move | encode/decode | ~24 / ~19 |
| Protocol request | encode/decode | ~59 / ~39 |
| Protocol wire response | encode/decode | ~535 / ~49 |
| Protocol snapshot response | encode/decode | ~33 / ~21 |
| Validation path | record + checked get | ~556 |
| Validation path | `get_world` | ~249 |
| Validation long queen | 36 squares | ~300 |
| Processing prepare | queen long move | ~15 |
| Processing `apply_plan` | queen long move | ~27 |
| Ledger append | 1M circular | ~16 |
| Ledger event read | decoded | ~14 |
| Snapshot board | 64-piece copy | ~314 |
| Engine process | full move | ~183 |
| Worker submit/process | sequential awaiter | ~2,046 |
| Worker submit/process | pipelined 4,000 | ~1,658 |
| Worker snapshot | pipelined 4,000 | ~3,409 |

Startup single-shot on the same run:

- allocation: ~49 ms (512 MB board + 16 MB ledger);
- full world initialisation: ~327 ms;
- occupied scan verification: ~172 ms.

The wire-response encode figure includes allocating and zero-filling the
4,096-byte frame that forces Dream to flush each WebSocket response. That is
transport overhead, not part of the 26-byte move or 73-byte snapshot codecs.

The path and read comparisons demonstrate why the `get_world` fast path was
introduced: it removes per-square record allocation and repeated position
validation from sliding movement.

### Extending the suite

Add a `run_bench` call with a new group/name. To compare two algorithms, use
the same group and name with different `variant` labels; the dashboard renders
them as bars and scales them against the fastest result.

Useful future comparisons:

- `Piece.create` versus a precomputed template path for initialisation;
- list-based processor plans versus fixed-record plans;
- checked versus unchecked board indexing in engine hot paths;
- Lwt worker versus a dedicated-domain worker;
- JSON versus binary protocol (the current binary path is already the
  production path);
- different ledger capacities and wrap policies;
- startup initialisation with and without clearing.

---

## 12. Testing and evidence

The current test suite is in `test/` and runs with `dune runtest`.

It covers:

- all exposed Piece bit fields and saturation;
- Board boundaries, copies, iteration and standard initialisation;
- exhaustive 32,000,000-piece ID uniqueness over a fully initialised world;
- move geometry, path blocking, castling, en passant and promotion;
- classification consistency between validator and processor;
- en-passant flag expiry;
- rejected transactions leaving board, ledger and sequence unchanged;
- accepted transactions appending exactly one event and advancing sequence;
- ledger event metadata and flags;
- small-capacity ledger wraparound and sequence retention;
- protocol round trips and invalid lengths/IDs/deltas;
- worker FIFO, same-piece races, queue-full and shutdown with pending work;
- snapshots before/after moves, queue capacity and shutdown;
- snapshot protocol round trips, 64 one-byte pieces, empty squares, 73-byte
  length and invalid coordinates;
- client piece-byte colour/type/original/castle/en-passant encoding and the
  square-plus-byte signature;
- a browser grid integration test: nine visible boards, one-board pans, the
  25 x 25 cache bound, move persistence, a cross-board quiet rook move, a
  blocked cross-board capture of an unmoved pawn, and a cache eviction/re-fetch;
- client rollback behaviour was also exercised manually in headless Chromium.

What is tested is not the same as a formal proof. The strongest evidence today
is structural invariants enforced by construction plus targeted tests and
benchmarks.

---

## 13. Formal verification opportunities

The pure data-structure core is small enough for machine-checked proofs. Good
targets, in increasing cost:

### 13.1 Bit-field lemmas (Coq, Lean or Why3)

Prove for `Piece`:

- field ranges are disjoint;
- `create` produces a nonzero value for every valid input;
- all setters preserve fields other than the target;
- counters saturate without carry into adjacent fields;
- `promote` preserves ID and all metadata.

This is mostly bit-vector arithmetic and is well suited to SMT-backed tools
or Coq’s `Z`/`N` bitvector libraries.

### 13.2 Index and ID bijections

Prove:

- `index` is a bijection from valid positions to `0..63,999,999`;
- `board_id * 32 + slot + 1` is injective over all valid boards and slots;
- the maximum ID is below `2^25`;
- world-coordinate conversion round-trips.

These are short arithmetic proofs.

### 13.3 Ledger invariant (TLA+ or Coq)

Model the state as `(moves, metadata, head, oldest, capacity)` and prove:

- retained sequence intervals are contiguous;
- every readable sequence’s slot contains the event written for it;
- append never makes the readable interval exceed capacity;
- sequence advances exactly once per accepted event;
- a rejected request transitions the abstract state identically.

TLA+ is a natural fit for the queue/ownership model; Coq or Lean is a better
fit for the array-index arithmetic.

### 13.4 Transaction atomicity (TLA+)

Model board, ledger and sequence as one abstract state with a single writer.
Prove the atomic transaction either leaves all three unchanged (rejection) or
updates all three exactly once (acceptance). The current implementation
achieves this by construction: prepare first, then write board, append ledger,
then set sequence. A TLA+ model would document and check the intended
interleavings, especially around worker failure.

### 13.5 Protocol exactness

Prove the source+delta encoding is a bijection on moves with
`|dx|,|dy| ≤ 36`:

- encode/decode round-trips source and destination;
- signed 9-bit representation covers the allowed range;
- out-of-range deltas are rejected.

This is another small bit-vector proof; QCheck property tests are a useful
lighter-weight complement.

### 13.6 Property-based testing and fuzzing

Before formal proofs, QCheck or Crowbar can provide high-value coverage:

- random piece fields: setter/accessor round trips and field isolation;
- random valid positions: index/world conversion round trips;
- random board states: validator/processor never leave a partially updated
  board when validation is used in the correct order;
- random wire bytes: decoder never raises, rejects malformed lengths safely;
- random concurrent request sequences: exactly one response per request, FIFO
  order, sequence continuity, no duplicate accepted moves;
- ledger wraparound with small capacities: sequence/event invariants.

These are cheaper to implement than full proofs and would strengthen the
existing suite immediately.

### 13.7 What is not claimed

The current code has no machine-checked formal proof. The document describes
proof obligations and test evidence. The single-owner Lwt worker is also not
yet a multi-domain concurrent system; any proof of a future domain handoff
must include that handoff and the response mailbox.

---

### 13.8 Proof obligation matrix

| Obligation | Current evidence | Cheapest next step |
|---|---|---|
| Piece fields are disjoint and setters preserve them | By construction; field tests | QCheck exhaustive bit tests |
| Counters saturate without carry | Unit tests at 4095 | Bit-vector proof |
| `create` never returns zero | Validation + tests | Simple exhaustive proof |
| Position/index is a bijection | Arithmetic argument; boundary tests | Coq/Lean arithmetic proof |
| Board world conversion round-trips | Tests at boundaries | Property test |
| Initial piece IDs are unique | Exhaustive test over 32M IDs | Arithmetic injectivity proof |
| Ledger wrap retains exactly the recent window | Small-capacity wrap test; runtime checks | TLA+ / Coq array invariant |
| Sequence and ledger agree | Engine tests and runtime assertion | TLA+ transaction model |
| Rejected move changes nothing | Engine tests | Model-based property test |
| Accepted move changes all three exactly once | Engine tests; prepare/commit order | TLA+ transaction model |
| Wire move round-trips exactly for ±128 | Protocol tests | SMT/bit-vector proof |
| Client byte preserves colour/type/original/castle/en-passant | Piece tests | Case analysis per bit |
| Signature matches source without a 25-bit ID | Engine tests | Equivalence with `client_byte` |
| Queue is FIFO and bounded | Worker tests | TLA+ queue model |
| Snapshot returns an exact 64-piece copy | Tests for all special moves; row-major checks | Array-copy proof |
| Only the worker mutates state | Module-boundary convention | Capability token or private library |

The code currently has no machine-checked proof. The table distinguishes what
is established by construction, by tests, and what remains a proof
opportunity.

---

## 14. Efficiency audit by module

| Module | Cost | Notes |
|---|---|---|
| `Piece` | O(1), word-sized | No per-piece heap object; masking updates are branch-light |
| `Board` | O(1) square access; O(64M) scans | Dense Bigarray; `get_world` avoids record construction on hot paths |
| `Move` | O(1) | Two positions; no cached metadata |
| `Move_validator` | O(path length) for sliders; O(1) otherwise | No allocation in path traversal after `get_world`; `move_info` allocates one record |
| `Move_processor` | O(1) plus small plan allocation | Computes all writes before mutating; plan lists are the main avoidable allocation |
| `Ledger` | O(1) append/read; O(k) range | Two adjacent `int64` writes; range decoding allocates an event array |
| `Game_state` | O(1) access; O(64M) initialisation/scan | Single ownership; no per-move locking |
| `Move_engine` | O(1) plus validation/path/ledger | Measured ~190 ns per accepted move on the benchmark machine |
| `State_worker` | O(1) enqueue; O(batch) drain; snapshot O(64) | Bounded queue; one Lwt task; coalesced notification; batch of 64 before yielding |
| `Snapshot` | O(64) copy | 64 packed int64 values; no view escapes; processed inside the worker |
| `Protocol.Types` | O(1) | 6-byte moves, 14-byte requests, binary; no JSON on the move path |
| Client renderer | O(visible pieces) per dirty frame | Offscreen board and piece atlas; no continuous loop |
| Client network | O(1) per request | One in-flight move; rollback or deferred special application |

The largest remaining performance costs are architectural, not arithmetic:

1. the Lwt worker shares the network scheduler; a dedicated Domain would
   reduce response latency/overhead under load but requires a safe handoff;
2. the protocol and worker allocate small request/plan/promise structures per
   move; batching or pooling could reduce allocator pressure;
3. `get_range` and snapshot-style reads allocate decoded arrays;
4. startup writes 32M pieces and scans 64M slots for verification (verification
   is optional outside tests).

These are deliberately not changed in this phase; each is measurable with the
benchmark suite.

---

## 15. Design trade-offs and what would change next

- **Dense board vs piece list**: dense wins for O(1) square lookup and fixed
  memory, at the cost of initialising 64M slots. Sparse worlds would favour a
  piece index/map, but the game is intentionally fully populated at startup.
- **Packed piece vs record**: packed wins memory, allocation and copying;
  debugging is harder and bit-level changes require care.
- **Single writer vs locks**: single writer wins simplicity and removes
  contention from every square; it caps move throughput to one core. The
  measured engine path is fast enough that networking dominates at current
  scale.
- **Lwt worker vs Domain**: Lwt is simpler and safe today; a dedicated domain
  is a later performance experiment and must solve handoff correctly.
- **Binary protocol vs JSON**: binary wins size and parsing on the move path;
  it requires explicit versioning and shared codecs.
- **Circular ledger vs append-only history**: circular wins bounded memory;
  replay beyond the retained window is impossible by design.
