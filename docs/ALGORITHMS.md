# Algorithms and Engineering Notes

This document explains the main data structures and algorithms in the
implementation, why they were chosen, how they are measured, and what is
already established by tests versus what could be established by formal
verification.

It is intentionally implementation-facing. The API specification lives in
`SPEC.md`; benchmark mechanics and the dashboard live in `bench/`.

The document has two parts. **Part I** (Sections 1–15) explains the core
algorithms and data structures. **Part II** (Chapters 2–9, starting after
Section 15) is a systems handbook covering the OCaml project layout, on-device
and on-server code, protocols, packed storage, serialisation, the move
transaction, conflicting moves and dependency trees, testing at scale,
improvements, and deployment. The measured evidence for Part II is in
`bench/evening/REPORT.md`.

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
| 37 | Reserved |
| 38 | On original board (cached) |
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

Quiet moves may cross board boundaries freely. A capture is allowed only while
the moving piece is on its original board, and the destination must be on that
same board. Otherwise validation returns `Capture_off_original_board`.

The original board comes from the piece ID: `(id - 1) / 32`. `Move_processor`
sets the cached `on_original_board` bit after every move from
`destination_board = original_board`. The bit therefore flips off when a piece
leaves home and flips back on when it returns.

The client mirrors the rule in O(1): a capture (including en passant) is sent
only when the source and destination boards match and the moving piece's bit 4
is set. Otherwise the drag snaps back; the server independently enforces the
same condition.

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
response payload is 81 bytes: status, request ID, board coordinates, an
int64 board revision, then 64 one-byte client pieces in row-major order. A failed snapshot
has status 0, revision 0 and zero board contents. Requests dispatch by length
(5 subscribe/unsubscribe, 6 cache window, 9 snapshot, 13 batch, 18 batch with
atomic window reset, 14 move). Every server
message is carried in a fixed 4096-byte wire frame with a kind byte (`1` move,
`2` snapshot, `3` live event) and zero padding. The padding is a workaround for
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
| 4 | currently on the original board encoded by its piece ID |
| 5 | en passantable (pawn) or castling-eligible (king/rook) |
| 6–7 | zero |

Promoted pawns project as queens. The snapshot drops from 521 to 81 bytes and
the client cache from roughly 320 to 64 bytes per board. Bit 4 is the cached
capturable bit; snapshots compute it from the board being sent
(`client_byte_at`), so it remains correct even if a piece was placed manually.

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
- Compact payloads: 26-byte move responses and 81-byte snapshot payloads.
- No JSON parsing or allocation on the server move path.
- No dependence on JavaScript numeric precision for 64-bit values.
- The fixed 4096-byte wire frame makes the pinned Dream version flush each
  response; the padding is transport-only and ignored by the codecs.

Protocol tests cover ±128 wire boundaries, 129 rejection, round trips, request
IDs, responses, malformed lengths and the 36-square validator limit. The client and server share the same
`Protocol.Types` module, so the layouts cannot drift independently.

---

## 9.5 Live move broadcasting

A committed move is pushed to every client whose 25 x 25 cache window contains
an affected board.

### Commit boundary

`Move_engine.process` applies the prepared plan and appends the ledger entry.
Only after that does `State_worker` call its `on_commit` callback. The callback
receives the global sequence, originating request ID, affected boards, their
new revisions, and exact changed squares/final pieces. It only appends the
event to a queue: no encoding, fan-out or network I/O runs on the worker.
The move handler flushes events through its committed sequence before
enqueueing the response; a paused background flush is the fallback.

### Board revisions

Each board has a monotonic `int64` revision in `Game_state` (8 MB total). A
board increments once per committed move touching it. Snapshots include the
revision at copy time; events include the new revision. Clients use per-board
revisions, not the global sequence, for gap detection because moves on other
boards legitimately advance the global sequence.

### Consistent snapshot handoff

Snapshot loading and live moves overlap, so the handoff is explicit:

1. On a snapshot request, the network handler registers the board subscription
   **before** submitting the snapshot to the state worker.
2. The connection records a snapshot token and starts buffering event records
   for that board.
3. The worker serialises the snapshot with moves and returns the copied board
   plus its `int64` revision.
4. Before the snapshot response is enqueued, the connection clears the pending
   token and filters buffered records: revisions at or below the snapshot are
   discarded; newer records are sorted and released after the snapshot frame.
5. Events that arrive after the snapshot is enqueued use the normal path and
   follow it in the outbox.

The circular race is therefore broken by ordering on the worker plus a
per-connection buffer. Registration before submission guarantees that a move
committed after the snapshot is queued; if a move slipped in before the
snapshot copy, the snapshot already contains it and the buffered event is
discarded. The network write never happens inside the worker.

A cross-board event with one pending board is split: the non-pending board's
record is delivered immediately, the pending board's record is buffered and
released after its snapshot. The client tracks revisions per board, so both
boards advance correctly. A superseded snapshot token cannot release a newer
buffer.

### Subscription and fan-out

- `board_subscribers : board key -> set of connection IDs` gives O(1) lookup.
- A 6-byte window message replaces a client's 25 x 25 set in O(625); 5-byte
  subscribe/unsubscribe messages adjust one board. The browser client instead
  uses an 18-byte batch-with-window message (`0x07`) that replaces the set and
  requests the missing rectangle in one server turn, avoiding a small
  subscription message before a batch request.
- A broadcast collects subscribers from up to two affected boards into a
  temporary set, so a client subscribed to both receives one event.
- The event is encoded once per move as a compact payload; each recipient
  appends it to its batch buffer. A 4 KiB frame carries many events, and the
  origin connection is flushed before its move response.

### Ordering and isolation

Every connection has one FIFO outbox used by both responses and live events,
drained by a per-client sender fiber. The worker enqueues the broadcast before
it resolves the move promise; batching flushes the origin connection before the
response, so the origin client normally sees the event before the response.
The event marks its pending move as already applied, preventing a second
castling/en-passant/promotion update. If the origin board itself has a pending
snapshot, its event is buffered until the snapshot and the response may arrive
first; the client's optimistic move and revision check still converge to the
snapshot state. A failed send or full outbox unregisters only that client;
other outboxes continue.

### Event wire format

Kind `3`, global sequence, request ID, board count (1–2), then per board:
coordinates, `int64` revision, change count, and `(square, piece byte)` pairs.
Normal moves have 2 changes, en passant 3, castling 4, promotion 2. Cross-board
moves carry two board records. Kind `4` batches multiple compact event payloads
in one 4 KiB frame.

---

## 9.6 Persistence and crash recovery

### What must survive a restart

The authoritative state is the dense board (64,000,000 packed pieces), the
1,000,000 per-board revisions, the global sequence and the bounded ledger's
two arrays plus its sequence window. Connections, subscriptions, outboxes and
snapshot request tokens are transient. The deterministic initial world is also
a valid recovery point, so the server can always rebuild from sequence zero if
no snapshot is usable.

### Write-ahead log

Every accepted move records its **committed transition**, not the move command:

- global sequence and request ID;
- for each affected board: coordinates, resulting revision, and the final
  value of every changed square (including cleared squares);
- the ledger event: packed move, moved/captured piece IDs and flags.

The worker calls `Move_engine.process ~precommit` after validation and plan
construction but before the first board write. The precommit serialises the
transition and appends the frame. In strict mode it also fsyncs here; group and
adaptive modes defer the fsync to the group commit after all moves in the batch
have been applied. Only then does `Move_processor.apply_plan` run, followed by
the ledger append, sequence update, move response and broadcast. A precommit or
group-commit failure publishes nothing and fail-stops the process: the server
never acknowledges a move it cannot recover, and never keeps serving tentative
in-memory state after a durability failure.

Replaying final square values and recorded revisions means recovery is
independent of chess-rule code. A future validator change, a promotion rule
fix or a new special move cannot reinterpret the log.

A crash after the fsync but before the response leaves a durable transition
whose acknowledgement was lost. Recovery therefore guarantees that every
acknowledged move is present, but may include the last durable move as well.
This is the standard durable-before-publish boundary; clients treat a missing
response as unknown and rely on events or a fresh snapshot.

A record is framed with a fixed magic/version/length header and an FNV-1a 64
checksum. Segments start with a 16-byte header naming their first sequence.
A torn record at the tail is truncated; a malformed complete record, checksum
failure, sequence gap or torn non-tail segment is fatal because serving such a
state could silently drop an acknowledged move.

### Snapshot capture without blocking on disk

A snapshot request is a normal FIFO item in the state worker. At the boundary
sequence `S` no move is in progress. The worker:

1. rotates the WAL so future records go to `wal-<S+1>.log`;
2. copies the board, revisions and both ledger arrays into one reusable
   `world_copy` buffer;
3. starts a preemptive thread that writes the copy.

The copy is a 512 MiB `memcpy`-style `Bigarray` blit (roughly 0.1-0.3 s), but
the worker never waits for the 536 MiB file write. Moves continue against the
new WAL segment. Only one snapshot can be in progress, so the buffer is reused;
otherwise each snapshot would allocate another 512 MiB Bigarray and RSS could
inflate while major GC lagged behind the write rate. The writer computes the checksum while encoding, so the file
is not reread.

The file is written as `snapshot-<S>.snap.tmp.<pid>`, fsynced, renamed into
place, and the directory is fsynced. A crash before the rename leaves the
previous snapshot and WAL valid. A crash after the rename but before cleanup
leaves both the new snapshot and the old WAL; recovery skips records at or
below `S`, so no transition is applied twice.

Snapshot failure is non-fatal. A write, fsync or rename failure removes the
temporary file. A directory-fsync failure removes the renamed but untrusted
file, because the rename may not survive a power loss; the old snapshot and
WAL remain authoritative. Recovery also removes stale
`snapshot-*.snap.tmp.*` files before listing snapshots.

WAL rotation opens the replacement segment before closing the old descriptor.
If creation, header write, fsync or directory fsync of the new segment fails,
the partial file is removed and the old segment remains appendable. A failed
snapshot rotation therefore cannot take the write path down with `EBADF`.

### Retention and cleanup

Two snapshot generations are kept. After `S_new` is durable, the previous
retained snapshot is `S_prev`; WAL segments whose last record is at most
`S_prev` are deleted, as are snapshots older than `S_prev`. The retained WAL
therefore starts at `S_prev+1`, which is enough to recover from either
`S_prev` or `S_new`. Startup keeps only the snapshot that actually loaded, so
a corrupt newer file cannot influence WAL cleanup.

The default snapshot policy is 100,000 commits or 600 seconds, whichever comes
first. With the measured fsync cost this bounds the WAL and keeps snapshot I/O
in the low megabytes per second for normal play.

### Recovery

Recovery runs before the HTTP listener starts:

1. list snapshots newest-first, validate header, exact length and checksum;
2. load the first valid one, or initialise the deterministic world and reset
   the ledger to sequence 1;
3. list WAL segments ascending and validate their headers;
4. decode every record, skip sequences at or below the snapshot, and require
   each subsequent record to be exactly the next sequence;
5. apply final square values, recorded revisions and the ledger event;
6. verify that the ledger head is `sequence + 1`;
7. open a fresh WAL segment at `sequence + 1`.

A short trailing record is ignored and its segment truncated to the last
complete record. A corrupt snapshot is skipped and the next older one is
tried; if none loads, the deterministic world plus WAL from sequence 1 is
used. If the WAL starts above the required sequence, recovery refuses to run.

### Failure injection

`OCAML_OMCB_FAULT` and `OCAML_OMCB_FAULT_AFTER` are test-only one-shot I/O fault
hooks in `lib/persistence.ml`. They cover WAL append/partial append, WAL fsync,
WAL rotation, snapshot write, snapshot fsync, snapshot rename and snapshot
directory fsync. They raise ordinary exceptions so the worker follows its
normal failure path; `OCAML_OMCB_CRASH_POINT` remains the separate hard-kill path.
The hooks are inert unless configured and the environment is cached at first
use.

`test/failure_injection_test.js` runs these cases against real servers and
checks acknowledgement, event visibility, fail-stop behaviour, stale-file
cleanup and restart digests. The findings and fixes are recorded in
`docs/FAILURE_AUDIT.md`. A 30-minute adaptive soak
(`test/adaptive_soak_test.js`) records RSS, fds, queue/outbox depth, group
sizes, fsync latency, event lag and policy changes.

### Integrity and verification

FNV-1a 64 is used for WAL records and the snapshot footer. The state digest
covers the sequence, revisions, ledger bounds and arrays, and every board
square. The end-to-end crash suite compares this digest before and after a
kill, rather than checking a few representative squares, and also checks
specific cross-board and special-move squares.

Commit policies:

- **Strict** (`OCAML_OMCB_ADAPTIVE=0`, `OCAML_OMCB_WAL_GROUP=1`): append → fsync →
  apply → publish.
- **Adaptive** (default): a bounded controller chooses the batch ceiling and
  formation delay; every group still fsyncs before publishing.
- **Group** (fallback, `OCAML_OMCB_ADAPTIVE=0`, 64): take up to 64 consecutive
  moves, validate, append and apply them in order, fsync once, then publish
  the whole group. The in-memory apply is tentative until the fsync; a failure
  fail-stops without publishing. Snapshot requests are non-move items and
  force a flush first, so no client read can observe an uncommitted group.
- **No fsync** (`OCAML_OMCB_WAL_SYNC=0`): append and publish without fsync;
  process crashes survive in the page cache, power loss can lose recent acks.

The group experiment (`bench/group_commit_experiment.js`,
`bench/group_commit_report.html`) sweeps 1/8/16/32/64/128/256/no-sync across
write-only and fan-out stress and verifies every move response, event and final
board state.

### Adaptive group commit

`OCAML_OMCB_ADAPTIVE=1` (the default) replaces the fixed batch ceiling with a
bounded, rule-based controller (`lib/adaptive_commit.ml`). Set it to `0` to use
the fixed group-commit fallback. It runs entirely outside
move validation, ordering, application and durability: the state worker still
fsyncs each group before publishing responses or events, and a failed fsync
still fail-stops without publishing the group.

Every 100 ms the server feeds the controller:

- move arrivals per second, counted at queue admission;
- move items currently queued in the worker;
- recent WAL fsync p50/p95 (a five-second window, so a cold-start stall is not
  remembered for the whole run);
- total queued client outbox frames;
- recent server end-to-end broadcast p95;
- recent recipients per broadcast event;
- whether a snapshot capture is in progress.

Committed events that have not yet been fanned out are deliberately excluded
from the backlog signal. A write-only workload can briefly enqueue many
events without any client delivery falling behind, so including them made the
controller see false broadcast pressure.

The controller emits a maximum batch size and a maximum group-formation delay.
Signals are exponentially smoothed (weight 0.35) and the policy changes by at
most a factor of two per sample. Increases need three consecutive samples;
decreases need two. Absolute bounds come from the environment.

| Classification | Trigger (smoothed) | Batch | Delay |
|---|---|---:|---:|
| Snapshot active | snapshot capture in progress | ≤32 | 0 |
| Broadcast-bound | lag ≥50 ms with ≥16 recipients, or outbox ≥32 | 16 | 0 |
| Broadcast-bound, outbox filling | outbox ≥512 | 8 | 0 |
| Broadcast-bound, severe lag | lag ≥250 ms regardless of recipients | 8–16 | 0 |
| Storage-bound | fsync p50 ≥8 ms | 32 or 64 | 0 |
| Heavy | ≥8 queued moves, or ≥1,000/s | 64–256 | 0 |
| Moderate | 30–1,000 moves/s | 8–32 | 250 µs |
| Quiet | below 30/s and no backlog | 16 | 0 |

The quiet ceiling deliberately stays at 16. With no group-formation delay, an
idle server still commits each move on its own, so shrinking the ceiling buys
nothing and only makes the next burst start at a tiny batch. Keeping 16 also
means a short interactive burst batches immediately instead of waiting for
several ramp samples; the default 100-move load improved from 1.9 to 7.7 moves
per fsync and from 18.7 ms to 6.5 ms move p50 after this change.

For heavy arrivals the target can be raised to twice the smoothed queue depth,
but only after two consecutive samples. A lagging event stream with real
fan-out (at least 16 recipients per event) holds batching at the 16 floor; it
does not shrink further unless client outboxes are actually filling, because
extra fsyncs do not fix a delivery bottleneck. With only a handful of
recipients, high lag is treated as general load rather than fan-out pressure,
so a small observer does not pin a heavy write workload at 16. The initial
policy is batch 16 with a 1 ms delay, clamped to the configured bounds.

The transition experiment (`bench/adaptive_commit_test.js`,
`bench/adaptive_commit_report.html`) runs the same sequence against fixed 16,
fixed 64 and adaptive: quiet → 128-writer heavy writes → quiet → 8 hot writers
with 256 subscribers → 16 hot writers → continued writes, with five
repetitions per mode. Full-world snapshot pressure is enabled for the whole
run (`OCAML_OMCB_SNAPSHOT_MOVES=3000`), so snapshot writes also overlap the heavy
and fan-out phases; the final phase measures writes while a snapshot is likely
in flight. The values below are medians across the repetitions.

| Mode | Heavy moves/s | Heavy p50 | Heavy p95 | Heavy avg group | Mixed p50 | Snapshot p50 | Event lag p50 |
|---|---:|---:|---:|---:|---:|---:|---:|
| fixed-16 | 2,034 | 32.6 ms | 190.5 ms | 16.3 | 18.3 ms | 15.4 ms | 22.5 ms |
| fixed-64 | 2,791 | 18.6 ms | 170.9 ms | 63.9 | 13.2 ms | 17.1 ms | 20.0 ms |
| adaptive | 3,493 | 17.2 ms | 146.2 ms | 71.1 | 12.7 ms | 18.9 ms | 20.0 ms |

All fifteen runs were clean: zero rejected moves, missing, duplicate or
unexpected events, outbox drops or send failures. The adaptive runs delivered
101,310 acknowledged moves while 256 fan-out subscribers received every
expected event exactly once, and every run completed at least one snapshot
under concurrent writes.

The controller walked from the quiet ceiling of 16 to 128 during the heavy
phase, held 16 while fan-out delivery was behind, and returned to 16 in the
following quiet phase. Its heavy throughput reached 3,493 moves/s: 72% above
fixed-16 and 25% above fixed-64, with the lowest heavy p50 and p95 of the
three. Holding the quiet ceiling at 16 removed most of the earlier ramp
penalty, because short bursts now batch immediately instead of starting from a
two-move ceiling. Once fan-out began, delivery was the bottleneck, so all
policies sat at 9–12 ms move p50, and adaptive throughput was within the
spread of the two fixed policies. In the mixed phase it matched
fixed-64 (490 versus 497 moves/s) with the lowest p50 (12.7 ms), and it
sustained more snapshot-phase throughput (404 versus 339 moves/s) at a 1.8 ms
higher p50. The quiet-after-heavy p50 is dominated by draining the tail of the
previous group queue, so it varies with the machine and is not a steady-state
regression.

A 30-minute changing-workload soak (`test/adaptive_soak_test.js`) found that
treating *any* event lag as broadcast pressure pinned the heavy phase at batch
16: eight sentinel subscribers with 50–200 ms lag were enough, even though the
client outbox was empty. Adding recipients-per-event fixed the classification;
the full post-fix soak then sustained 11,901 moves/s in the heavy phase,
1,473/s in fan-out, 2,146/s in mixed and 1,650/s with snapshot pressure, with
exact recovery and zero missing/duplicate sentinel events. The same soak exposed
snapshot-copy RSS growth and a per-request Lwt close-race leak; a reusable copy
buffer and removal of the close race hold RSS at roughly 1.18 GiB. See
`docs/FAILURE_AUDIT.md` for the full record.

Measured on the reference machine (16 cores, btrfs home with
`compress=zstd:3`; tmpfs noted for comparison):

- 536,777,268-byte snapshot write: ~2.6 s on btrfs, ~1.3 s on tmpfs;
- snapshot load and recovery: ~1.2 s on btrfs, ~0.9-1.9 s in the unit tests;
- 37,538-record WAL replay: ~0.4 s;
- 37,500 acknowledged moves with 5 drivers: 73.6 s strict (~510/s), 37.3 s
  with group-64 (~1,006/s); tmpfs strict ~11.6 s;
- write-only 256 writers: strict 553 moves/s and p50 312 ms; group-8 3,004/53;
  group-16 4,313/36; group-32 5,650/27; group-64 6,254/24; group-128
  6,835/21; group-256 7,499/20; no-sync 8,959/16. Zero errors at every point;
- default load (40 clients): group-64 1,327 requests/s, move p50 9.3 ms,
  lag p50 11.6 ms; strict 1,065/s, 35.0 ms, 38.9 ms;
- stress load (80 clients): group-64 2,285/s, move p50 21.0 ms, lag 23.6 ms;
  strict 1,546/s, 57.2 ms, 63.9 ms;
- 1,020-client scaling: group-64 3,986 requests/s, move p50 109.9 ms, lag p50
  177.9 ms, CPU 69.7% average; strict 4,540/s, 202.3 ms, 236.3 ms, CPU 41.5%.
  The top-end throughput is client-harness limited; group commit halves move
  latency;
- fan-out 1,020 clients: move p50 577.8 ms strict, 259.7 ms group-256;
- group-64 crash recovery: 64 concurrently acknowledged moves survived
  SIGKILL and recovered to the exact digest.

Group commit closes most of the strict-to-no-sync gap while preserving
durable-before-ack. The actual average group at a configured maximum of 256 is
about 85 because the worker starts before every concurrent writer arrives; a
small group-formation window would raise that further. Group-64 is retained as
the fixed fallback (`OCAML_OMCB_ADAPTIVE=0`) and remains a good latency/throughput
balance when a predictable policy is preferable to the controller.

### Fault injection and tests

`OCAML_OMCB_CRASH_POINT` injects a SIGKILL at a named point: `wal-before-write`,
`wal-partial-write`, `wal-after-fsync`, `snapshot-partial-temp`,
`snapshot-temp-fsynced`, `snapshot-renamed` or `snapshot-cleaned`. The crash
suite spawns real servers against isolated directories and covers empty and
non-empty restarts, cross-board moves, castling/en passant, torn WAL tails,
partial snapshots, crash-after-rename, corrupt snapshots and a 200-move WAL.
Promotion is covered by the in-process persistence test, which snapshots a
directly prepared promotion position. `bench/group_commit_experiment.js`
additionally runs the batch-size sweep, verifies every client-visible result
and includes a group-64 crash/restart case.

---

## 10. Client grid, rendering and local state

The client is a WASM/Brr canvas application. It renders a 1000 x 1000 world of
boards, not a single board:

- The canvas fills the viewport (`100vw x 100vh`) and its backing store tracks
  the viewport size. At zoom 1 each board occupies 216 x 216 backing pixels
  (27 px per square), so three boards span 648 px. Scroll-wheel zoom scales
  around the pointer from 0.35x to 3.5x; the camera is clamped so the world
  cannot scroll past its edges.
- `view_left` and `view_top` hold floating-point board coordinates at the
  canvas origin, clamped independently to the world. Dragging empty space
  pans; a drag that starts on a piece moves that piece instead.
- A fixed top-right overlay shows the rounded camera centre as `(x, y)`.
  `?x=<board_x>&y=<board_y>` sets the initial centre and survives reloads.
- A single 8 x 8 board tile is rendered once to a 648 x 648 offscreen canvas
  with a three-pixel dark inner border, then scaled to the current board size.
  Every visible board is one `drawImage` blit instead of 64 rectangle fills,
  and adjacent borders separate boards. Pieces are drawn only for loaded
  boards. A dirty flag coalesces redraws into one `requestAnimationFrame`; there
  is no continuous render loop.
- All 12 piece sprites come from a 6 x 2 atlas at 512 x 512 per cell, rendered
  from the Cburnett SVG set on a transparent background and loaded as a
  static asset. A font-glyph atlas is kept as a fallback until the image
  loads. Pieces are drawn with high-quality image smoothing, so they stay
  crisp at the maximum zoom. A redraw is one tile blit per visible board plus
  at most 64 sprite blits per loaded board.

### Snapshot cache

- Boards are stored in a single bounded LRU cache keyed by
  `board_y * 1000 + board_x`. The hard limit is 900 boards; visible boards are
  protected, and old/prefetch boards are evicted in least-recently-used order.
- The useful window is 25 x 25 boards around the camera centre plus a
  two-board prefetch margin (29 x 29, 841 boards). The actual visible set is
  computed from the canvas and is always inside that window.
- Loading requests only rectangles that contain missing or stale boards. The
  planner builds maximal runs per row and merges them vertically, so a
  one-board pan requests one strip rather than the whole window. Cached boards
  at an adequate revision are never re-requested.
- At most one batch request is in flight. Board keys are tracked per request,
  deduplicated while in flight, and released when the response arrives or the
  request times out. A stale completion cannot clear a newer request. Failed,
  empty and partial responses are recorded and retried with a bounded backoff.
- Snapshot revisions are monotonic. A response is applied only when its
  revision is at least the cached revision; an older response cannot overwrite
  a newer live update. Responses may populate boards that are no longer in the
  exact requested strip as long as they remain useful or there is cache room.
- The loading indicator is derived from the visible rectangle:
  `visibleMissing = visible area - loaded visible boards`. Prefetch work is
  reported separately and cannot keep the indicator stuck. A missed or
  superseded request therefore has no counter to leak.
- Subscriptions are replaced atomically by the batch request itself: message
  type `0x07` carries the batch rectangle plus the current window centre and
  radius. The server applies `set_window` before registering the batch, so
  there is no separate subscription message that could stall the WebSocket
  writer between a subscription change and a snapshot request. Subscriptions
  therefore stay bounded to the current useful window instead of growing with
  every board ever visited.
- Cached boards outside the new window are marked stale when the window is
  replaced. They remain in the LRU cache (and can be evicted) but are fetched
  again, and subscribed again, if the camera returns to them. Boards inside
  the window stay loaded and subscribed.
- If the server rejects `0x07` (an older image) or three window batches time
  out before any success, the client switches to the compatible `0x06` batch
  for that connection. The viewport still loads; subscriptions then fall back
  to the legacy add-only behaviour until reconnect.
- On disconnect, all in-flight bookkeeping is cleared and the server's
  per-connection subscriptions are removed by `unregister`. On reconnect the
  cache is marked stale and the useful window is requested again.

### Moves

- A drag may start and end on any loaded board. Quiet moves cross boundaries.
- A capture (including en passant) is allowed only when source and destination
  are on the same board and the moving piece's bit 4 is set. The client checks
  this in O(1) and cancels otherwise; the server enforces the same rule.
- Normal moves are optimistic. The undo record holds the source and
  destination board states, so a cross-board move restores both on rejection.
  Castling and en passant are applied only after acceptance; en passant is
  same-board.
- On acceptance the 26-byte response's packed `moved_piece` is projected back
  to a client byte, updating the moved piece's original/en-passant/castling
  bits immediately. No extra snapshot is needed.
- At most one move is in flight. Navigation and new drags are blocked while it
  is pending; `data-move-pending` on `<body>` exposes the state.
- The drag and render path never allocates a board copy.

### Networking

- Requests: 9-byte snapshot, 14-byte move, 6-byte subscription window.
- Messages: 4096-byte wire frames with a kind byte. Kind 3 is a single move
  event; kind 4 is a batch of 1–255 compact event records. The client
  dispatches on the kind and parses move responses, snapshots, single events or
  batches.
- The server uses Dream’s normal WebSocket close path with a pinned
  `httpun-ws` patch. Dream 1.0.0~alpha8 previously spun when a close frame or
  data write failed: the failed frame stayed pending in Faraday and the Gluten
  write loop retried it forever. The patch marks the writer failed, discards
  pending bytes, makes `next` report `Close`, and makes the read loop return
  `Close` when the writer is closed. A failed socket therefore tears down
  cleanly instead of monopolising a CPU; see `vendor/httpun-ws-wsd.patch`.
- Sends have a two-second timeout, the receive loop catches connection errors,
  and pending worker work remains bounded by the queue.
- Each connection has a FIFO outbox and its own sender fiber. If the outbox
  reaches capacity, the oldest event frames are dropped while response frames
  and their promises are preserved. The queue is therefore bounded, the
  broadcaster never waits for a slow client, and the affected client can
  recover from a revision gap with a fresh snapshot. A client that stays
  blocked past the send timeout is unregistered.
- `/metrics` exposes aggregate pipeline stage samples, worker queue state,
  recipient counts, outbox depth, dropped events and send failures. It does
  not log individual events.
- The client still closes the WebSocket on `beforeunload`.
- Live events are not replayed; a missed revision gap is repaired by a
  snapshot. No reconnect/resume is implemented.

Optional client RTT diagnostics use `performance.now()` and a FIFO of send
timestamps. They are disabled in production builds; set `Metrics.enabled` to
true when profiling a browser session. With cross-origin isolation (COOP/COEP
headers) Chrome exposes a finer clock (5 µs in the measured environment);
without it the browser quantises the clock.

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
| Board index | checked | ~6.7 |
| Board index | raw arithmetic | ~2.7 |
| Board read | checked position | ~15.1 |
| Board read | `get_world` | ~12.6 |
| Piece create | packed int64 | ~8.1 |
| Piece inspect | id/type/flags | ~9.7 |
| Piece metadata | immutable flags | ~17.1 |
| Protocol move | encode/decode | ~24 / ~20 |
| Protocol request | encode/decode | ~60 / ~41 |
| Protocol wire response | encode/decode | ~555 / ~50 |
| Protocol move event | encode/decode | ~608 / ~64 |
| Protocol snapshot response | encode/decode | ~45 / ~26 |
| Validation path | record + checked get | ~556 |
| Validation path | `get_world` | ~250 |
| Validation long queen | 36 squares | ~304 |
| Processing prepare | queen long move | ~26 |
| Processing `apply_plan` | queen long move | ~26 |
| Ledger append | 1M circular | ~15 |
| Ledger event read | decoded | ~15 |
| Snapshot board | 64-piece copy | ~335 |
| Engine process | full move | ~215 |
| Worker submit/process | sequential awaiter | ~2,462 |
| Worker submit/process | pipelined 4,000 | ~2,986 |
| Worker snapshot | pipelined 4,000 | ~4,212 |

Startup single-shot on the same run:

- allocation: ~45 ms (512 MB board + 16 MB ledger);
- full world initialisation: ~323 ms;
- occupied scan verification: ~149 ms.

The wire-response encode figure includes allocating and zero-filling the
4,096-byte frame that forces Dream to flush each WebSocket response. That is
transport overhead, not part of the 26-byte move or 81-byte snapshot codecs.

The path and read comparisons demonstrate why the `get_world` fast path was
introduced: it removes per-square record allocation and repeated position
validation from sliding movement.

### Live load test

The microbenchmarks isolate code paths. `bench/load_test.js` complements them
with an end-to-end flood that exercises the HTTP/WebSocket stack, the state
worker, the connection manager, event fan-out and the client protocol together.

It opens 40–80 active WebSocket clients plus four silent clients, gives every
client a 25 × 25 subscription window, issues 400–800 snapshots, drives 100–200
moves from 20–40 clients, and checks every event frame received by every
client. Clients issue one request at a time, matching the browser client; the
load comes from connection concurrency.

Checks include:

- every move accepted exactly once with a unique sequence and matching request
  ID;
- every active client sees every sequence exactly once, for the right board,
  revision, request ID and changed squares;
- silent clients on an unrelated window receive no events;
- no unexpected closes;
- snapshot contents agree across clients and match the starting position.

Recorded on the benchmark machine (loopback, one server process):

| Profile | Clients | Requests | Throughput | Snapshot p50 | Move p50 | Event lag p50 | CPU avg/peak | RSS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `default` | 40 + 4 | 596 | ~1,870/s | 1.6 ms | 1.8 ms | 3.9 ms | 9.4% / 19.5% | 526 MiB peak |
| `stress` | 80 + 4 | 1,176 | ~3,318/s | 3.5 ms | 7.8 ms | 8.5 ms | 22.6% / 69.1% | 538 MiB peak |

Both runs had 100% move acceptance, 100% valid snapshots, no missing,
duplicate or extra events, no cross-window leakage and no unexpected closes.
Server fds peaked at 7 + one per connection (51 and 91) and returned to 6 after
the load process exited.

### Pipeline breakdown

`lib/metrics.ml` records ten aggregate stages per move and per-recipient write:

1. `receive_to_submit` — request bytes received → queued for the worker.
2. `worker_queue_wait` — queued → worker starts processing.
3. `move_processing` — actual `Move_engine.process`.
4. `commit_to_broadcast` — commit → `on_commit` hands the event to the manager.
5. `broadcast_wait` — handed over → `flush_through` actually starts. This is
   scheduler/batching wait, not lookup.
6. `broadcast_dispatch` — recipient set lookup.
7. `encoding` — event serialisation.
8. `outbox_enqueue` — appending to every recipient outbox.
9. `websocket_write` — per-recipient send completion.
10. `end_to_end_broadcast` — request received → last recipient write.

Each stage keeps a fixed ring buffer (no per-event logging) plus count, total,
min and max. `/metrics` materialises percentiles on demand. The default run:

| Stage | p50 | p95 |
|---|---:|---:|
| receive → submit | 0.0002 ms | 0.0006 ms |
| worker queue wait | 0.019 ms | 0.12 ms |
| move processing | 0.0006 ms | 0.002 ms |
| commit → broadcaster | 0.0003 ms | 0.0007 ms |
| broadcast wait | 0.069 ms | 0.45 ms |
| recipient lookup | 0.003 ms | 0.005 ms |
| encoding | 0.0003 ms | 0.0007 ms |
| outbox enqueue | 0.002 ms | 0.005 ms |
| WebSocket write | 0.010 ms | 0.021 ms |
| end-to-end broadcast | 1.98 ms | 3.2 ms |

Recipient lookup and encoding are negligible. Batching changed the shape of
the pipeline: `broadcast_wait` fell from ~4.3 ms to ~0.07 ms and outbox enqueue
from ~0.45 ms to ~0.002 ms. The remaining end-to-end time is mostly the 1 ms
batch window plus the final recipient write. The server end-to-end figure
(2.1 ms) is lower than client event lag (3.4 ms) because the latter includes
network delivery and client scheduling.

### Scaling

`bench/run_scaling.js` starts a fresh server per level and records the full
matrix. Selected results:

| Clients | Requests | Req/s | Snapshot p50 | Move p50 | Event lag p50 | CPU | RSS | fds |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | 236 | 791 | 1.6 ms | 3.1 ms | 2.6 ms | 6.7% | 522 MiB | 32 |
| 80 | 596 | 1,777 | 4.3 ms | 10.1 ms | 9.1 ms | 11.9% | 531 MiB | 92 |
| 160 | 1,076 | 2,859 | 8.5 ms | 10.7 ms | 16.3 ms | 18.6% | 542 MiB | 172 |
| 320 | 2,036 | 4,224 | 20.1 ms | 25.2 ms | 29.3 ms | 37.3% | 568 MiB | 332 |
| 640 | 3,956 | 5,629 | 34.3 ms | 28.8 ms | 55.1 ms | 52.6% | 620 MiB | 652 |
| 1,020 | 6,236 | 6,976 | 55.4 ms | 62.2 ms | 85.5 ms | 60.4% | 666 MiB | 1,032 |

Every level delivered every event exactly once with zero drops or failures.
Outbox depth stayed at 1 because the clients read continuously. Above roughly
400 clients the single Node load process is also a bottleneck: it parses and
applies up to 102,000 events. Server CPU stays below 62%, so the top-end RTT is
not pure server saturation. Batching keeps the server stage costs low: at
1,020 clients, recipient lookup p50 is ~0.13 ms and outbox enqueue p50 is
~0.11 ms; the end-to-end time is dominated by the batch window and client
processing.

### Subscription distributions

At 80 clients and the same 625 subscriptions per client:

| Overlap | Recipients/move | Move p50 | Move p95 | Event lag p50 | Missing | Extra |
|---|---:|---:|---:|---:|---:|---:|
| High | 80.0 | 7.6 ms | 17.4 ms | 9.0 ms | 0 | 0 |
| Low | 1.0 | 1.6 ms | 2.7 ms | 1.8 ms | 0 | 0 |
| Partial | 20.0 | 3.6 ms | 7.4 ms | 3.4 ms | 0 | 0 |

Low overlap keeps the same total subscription work but only one client's
window contains the move block; unrelated clients are not involved. Partial
overlap is the representative middle.

### Slow and non-reading clients

`bench/slow_client_test.js` runs 20 normal clients, 37,500 moves, and one raw
slow client with an 8-frame outbox:

| Scenario | Normal lag p50/p95 | Max outbox | Drops | Send failures | Recovery |
|---|---:|---:|---:|---:|---|
| baseline | 0.81 / 2.18 ms | 1 / 8 | 0 | 0 | n/a |
| paused-short | 0.79 / 2.05 ms | 8 / 8 | 11,746 | 0 | same connection, rev 1500 |
| paused-long | 0.79 / 2.05 ms | 8 / 8 | 11,099 | 27 | reconnected, rev 1500 |
| slow-read | 0.79 / 2.08 ms | 8 / 8 | 12,430 | 0 | same connection, rev 1500 |

A slow client cannot block the broadcaster: the normal-client lag is
statistically identical to the baseline. At capacity, the server drops the
oldest queued event frames while keeping response promises intact, so the
outbox is bounded. A client that resumes sees a revision gap and repairs it
with a fresh snapshot. A client blocked past the two-second send timeout is
unregistered; a new connection recovers with a snapshot.

### Transport and allocation review

The largest transport inefficiency was the **4,096-byte wire frame**. Dream
1.0.0~alpha8 buffers WebSocket writes until 4 KiB, so a one-event frame is
mostly padding. Event batching is now the default: a kind-4 frame carries up to
~150 compact event records. A client receiving 100 events in a burst gets one
or a few frames instead of 100.

The ordering constraint is the mover's response: the client applies its own
event before the move acknowledgement, so the origin connection's buffer is
flushed before its response. Other clients batch until a 1 ms timer or the
4 KiB threshold. `EVENT_BATCHING=0` restores one-event-per-frame behaviour for
comparison; `EVENT_BATCH_WINDOW_MS` tunes the timer.

Measured effect:

| Profile | Recipient events | WebSocket writes before | WebSocket writes batched |
|---|---:|---:|---:|
| default | 4,000 | 4,000 | 295 |
| stress | 16,000 | 16,000 | 1,306 |
| 1,020 clients | 102,000 | 102,000 | 3,157 |

The batched default run moved p50 from 11.2 ms to 1.8 ms, client event lag
from 11.1 ms to 3.9 ms, CPU from 19.1% to 9.4%, and throughput from ~1,622/s
to ~1,870/s. At 1,020 clients, move p50 fell from 809 ms to 62 ms and CPU from
74% to 60%.

A smaller, already-applied win is `Bytes.unsafe_to_string` in `send_bytes`:
frames are immutable after encoding, so the server avoids a 4 KiB copy per
recipient. The event bytes were already shared between recipients; the copy
was pure overhead.

Other observations:

- `broadcast_event` builds a recipient `Hashtbl` per event. At high overlap
  this is small compared with enqueue/write cost, but a reusable bitset or
  array indexed by connection ID would remove an allocation.
- `set_window` inserts 625 subscriptions per client one at a time. At 1,020
  clients that is 637,500 hash operations during setup; a per-client bitset or
  a bulk window table would reduce setup cost.
- Recipient lookup is already cheap (single-digit to sub-millisecond at 1,020
  clients), so further work should target the 1 ms batch window, the
  response-path flush, and per-client client-side processing rather than the
  lookup itself.
- The worker's batch size of 64 is a latency/throughput trade-off. A smaller
  batch may reduce `broadcast_wait` for interactive moves; a larger batch may
  improve flood throughput. This is a good future A/B benchmark.

See `bench/README.md` for exact commands and the generated result files.

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
- off-board capture rejection, off-home same-board capture rejection, and
  capture re-enabled after returning to the original board;
- classification consistency between validator and processor;
- en-passant flag expiry;
- rejected transactions leaving board, ledger and sequence unchanged;
- accepted transactions appending exactly one event and advancing sequence;
- ledger event metadata and flags;
- small-capacity ledger wraparound and sequence retention;
- protocol round trips and invalid lengths/IDs/deltas;
- worker FIFO, same-piece races, queue-full and shutdown with pending work;
- snapshots before/after moves, queue capacity and shutdown;
- snapshot protocol round trips, 64 one-byte pieces, empty squares, 81-byte
  length, board revision and invalid coordinates;
- subscription, cache-window and live-event codecs;
- client piece-byte colour/type/original/castle/en-passant encoding and the
  square-plus-byte signature;
- a browser grid integration test: nine visible boards, one-board pans, the
  25 x 25 cache bound, move persistence, a cross-board quiet rook move,
  blocked off-board and off-home captures, and a cache eviction/re-fetch;
- a connection-manager suite: same-board fan-out, unrelated isolation,
  cross-board deduplication, failed-send isolation, unregister cleanup,
  unsubscribe and window replacement;
- a real two-client live broadcast test including cross-board events and
  disconnects;
- a browser live-client test for applying events, ignoring late duplicates,
  and resynchronising after an injected revision gap;
- connection-manager tests for snapshot-pending event buffering, revision
  filtering, ordered release, cross-board splitting and superseded tokens;
- a raw-client snapshot/move race test with 20 races and 25 concurrent
  snapshot clients;
- a WebSocket teardown regression test that repeatedly SIGKILLs Chromium,
  checks server CPU returns to idle, checks file descriptors do not grow, and
  confirms a fresh snapshot request still works;
- a deliberate write-failure test that pauses a raw client, generates a large
  event burst, resets the socket, and checks idle CPU, failed-send accounting,
  unregister cleanup and a surviving client;
- a live load harness that runs 40–80 concurrent clients, exercises
  subscriptions, snapshots and moves, and checks latency, throughput, every
  event frame, cross-window isolation and server CPU/RSS/fds.
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

---

# Part II — Systems Handbook

Part I explains the data structures and algorithms that make one move cheap.
Part II explains how those pieces become a running system: how the OCaml
project is split, how bytes travel between a browser and the server, how state
is stored and recovered, how conflicting moves are resolved, how the system is
tested at scale, what the measurements say, and how a commit reaches
production.

The chapters follow the requested structure. Each chapter has a **Subpart A**
with the core material. Cross-references to Part I are written as "Section N".
Chapter 1 is Part I's opening performance-goals section; the chapter numbering
continues from there.

The measured numbers in these chapters come from the overnight run recorded in
`bench/evening/REPORT.md`. They are machine-specific; the reasoning and the
relative comparisons are the durable part.

---

## Chapter 2 — Clients, Servers and Protocols

### Subpart A — Project organisation, code placement and data flow

#### 2A.1 The OCaml project

The repository is a single Dune project with four kinds of code:

| Directory | Library / executable | Responsibility |
|---|---|---|
| `lib/` | `ocaml_omcb_lib` | Authority: board, pieces, rules, ledger, state worker, persistence, connection manager, metrics |
| `protocol/` | `protocol` | Shared wire types and byte codecs, compiled into both server and client |
| `client/` | `ocaml_omcb_client_core` + `main` (WASM) | Browser rendering, input, caches, hints, networking |
| `server/` | `server` | Dream HTTP/WebSocket endpoints, startup, metrics, deployment surface |
| `bench/` | `bench` + JavaScript harnesses | Microbenchmarks, load, soak, fault and browser measurements |
| `test/` | OCaml and JavaScript tests | Unit, integration, browser, crash and deployment tests |
| `deploy/` | scripts and Compose | Pull agent, compose validation, Caddy, smoke tests |
| `docs/` | Markdown | Specification, algorithms, failure audit |

The important dependency rule is:

```
protocol  <-  lib  <-  server
    ^                    ^
    |                    |
  client ---------------+
```

`protocol` depends on nothing except the OCaml standard library. `lib` depends
on `protocol` and on Lwt/Mtime for persistence and the worker. `server` depends
on `lib`, Dream and Yojson. `client` depends on `protocol` and Brr (the browser
binding), but **not** on `lib`: the browser must not link the authoritative
board implementation. This is deliberate. If the client could call
`Move_validator` directly it would still be guessing; the server is the only
place that can commit.

`lib/dune` lists modules explicitly, so a new module cannot be linked by
accident. `client/dune` builds two things: a pure `ocaml_omcb_client_core`
library (cache, viewport arithmetic, snapshot planning, request tracking,
hints) that is unit-testable without a browser, and `main.ml`, which is
compiled with `(modes wasm)` and owns the DOM, canvas and WebSocket.

Build and test:

```bash
eval $(opam env)
dune build --profile release
dune runtest --profile release
```

The server binary is `_build/default/server/server.exe`; the browser artifacts
are `_build/default/client/main.bc.wasm.js` plus a content-addressed
`main.bc.wasm.assets/` directory. The server serves the client from
`_build/default/client` under `/static`.

#### 2A.2 On-device code versus on-server code

| Concern | On device (WASM/JS) | On server (native OCaml) |
|---|---|---|
| Board rendering | Canvas tiles, sprite atlas, viewport transform | none |
| Input | pointer/touch, drag, tap, pinch, wheel | none |
| Move hints | local geometry, 36-square slider, castling hints | authoritative validation |
| Cache | 25×25 board window (plus prefetch margin), LRU | canonical 1,000,000-board array |
| Optimism | moves the piece immediately, rolls back on rejection | never optimistic; commits only after validation |
| Ordering | one request in flight per connection | one FIFO state worker |
| Durability | none | WAL, fsync, snapshots |
| Failure | reconnect and resnapshot | restart and WAL replay |
| Trust | untrusted | authority |

The client is a **renderer and predictor**, not a referee. It can draw a move
before the server answers because the answer is almost always yes, and because
it knows how to roll back. The server never trusts the client's board, piece
identity or revision; it re-reads the source square and re-runs the rules.

A useful way to state the split:

- The client owns **presentation state**: what is visible, what is selected,
  what is being dragged, which hints are drawn.
- The server owns **commit state**: which piece is on which square, which
  sequence number is next, which bytes are durable.

The only shared mutable concept is a board revision. The client uses revisions
to detect gaps; the server assigns them.

#### 2A.3 The runtime diagram

```
                         TLS / HTTP/2 / WebSocket
 ┌────────────────────┐        ┌────────────────────┐        ┌────────────────────┐
 │ Browser            │        │ Caddy              │        │ OCaml server       │
 │                    │        │                    │        │                    │
 │ main.ml (WASM)     │◄──────►│ :443               │◄──────►│ Dream + Lwt        │
 │  canvas renderer   │  WSS   │ reverse_proxy      │  HTTP  │  /ws               │
 │  board cache       │        │ gzip/zstd          │        │  /metrics          │
 │  snapshot planner  │        │ security headers   │        │  /healthz          │
 │  request tracker   │        │ cache policy       │        │  /readyz           │
 │  move hints        │        │                    │        │  /static           │
 └────────────────────┘        └────────────────────┘        └─────────┬──────────┘
                                                                        │
                                                              ┌─────────▼──────────┐
                                                              │ Game_state         │
                                                              │  Board  512 MiB    │
                                                              │  revisions 8 MiB   │
                                                              │  Ledger  16 MiB    │
                                                              │  sequence          │
                                                              └─────────┬──────────┘
                                                                        │
                                                              ┌─────────▼──────────┐
                                                              │ Persistence        │
                                                              │  WAL segments      │
                                                              │  snapshots         │
                                                              │  fsync / recovery  │
                                                              └────────────────────┘
```

The browser never talks to the OCaml process directly in production. Caddy
terminates TLS, adds compression and security headers, and proxies WebSocket
upgrades. The app container publishes no host port; only Caddy binds 80/443.

#### 2A.4 Protocols: what a protocol is doing here

A protocol is an agreement about three things:

1. **Framing** — where a message starts and ends.
2. **Encoding** — what each byte means.
3. **State machine** — which messages are legal at which point, and what the
   receiver must do next.

This system uses two protocols at once:

- **HTTP/HTTPS** for the shell, static assets, health, metrics and JSON
  endpoints. These are request/response, stateless, and cacheable.
- **WebSocket over TLS** for the live game. This is a long-lived, bidirectional
  byte stream with message boundaries. It carries binary frames only.

HTTP is used for things that are naturally cacheable or polled. WebSocket is
used for things that must be ordered and pushed: moves, snapshots and events.

The WebSocket handshake is an HTTP `GET /ws` with `Upgrade: websocket`. After
the `101 Switching Protocols` response, both sides exchange frames. Caddy's
`reverse_proxy` handles the upgrade transparently; the app sees a normal
WebSocket.

#### 2A.5 Message catalogue

Requests are dispatched by **length** on the server. This is a deliberate
simplification: every request type has a unique byte length, so the server can
reject malformed input before parsing.

| Length | First byte | Direction | Purpose |
|---:|---:|---|---|
| 5 | `0x03` / `0x04` | client → server | subscribe / unsubscribe one board |
| 6 | `0x05` | client → server | replace the 25×25 subscription window |
| 9 | `0x02` | client → server | snapshot one board |
| 13 | `0x06` | client → server | snapshot a rectangle |
| 14 | packed source | client → server | one move request |
| 18 | `0x07` | client → server | snapshot rectangle + replace window atomically |

Responses and events use a kind byte in a fixed 4,096-byte frame:

| Kind | Meaning |
|---:|---|
| `1` | move response (26 meaningful bytes, zero padded) |
| `2` | single-board snapshot response (81 meaningful bytes) |
| `3` | live move event |
| `4` | batch of live move events |
| `5` | uncompressed snapshot batch |
| `6` | compact snapshot batch |

The 4,096-byte frame is a transport workaround, not a design preference.
Dream 1.0.0~alpha8 buffers WebSocket writes until 4 KiB accumulates. A 26-byte
acknowledgement can therefore wait indefinitely while the client waits for it
before sending the next request. Padding every response to 4,096 bytes forces
the flush. Section 9 of Part I explains the codec; Chapter 4 explains the
trade-off and its measured cost.

#### 2A.6 A move, end to end

```
Client                         Caddy                    Server
  │                              │                        │
  │ 14-byte move (binary)        │                        │
  ├─────────────────────────────►│                        │
  │                              ├───────────────────────►│
  │                              │                        │ validate
  │                              │                        │ prepare
  │                              │                        │ WAL append
  │                              │                        │ fsync (group)
  │                              │                        │ apply board
  │                              │                        │ ledger append
  │                              │                        │ sequence++
  │                              │                        │ broadcast
  │ 4,096-byte move response     │                        │
  │◄─────────────────────────────┤◄───────────────────────┤
  │                              │                        │
  │ 4,096-byte event (kind 3/4)  │                        │
  │◄─────────────────────────────┤◄───────────────────────┤
```

The response and the event are separate. The origin connection is flushed
before its response so the client normally sees its own event first. The event
marks the optimistic move as already applied, preventing a duplicate castling
or en-passant update. If the event is lost, the response still settles the
request; if both are lost, a liveness timeout triggers a snapshot repair.

#### 2A.7 A snapshot, end to end

```
Client                         Server worker
  │                              │
  │ 13-byte batch request        │
  ├─────────────────────────────►│  begin_snapshot for every board
  │                              │  (register subscriptions + tokens)
  │                              │  copy 64 pieces per board
  │                              │  return batch + revisions
  │ 4,096-byte compact batch     │
  │◄─────────────────────────────┤  filter buffered events <= revision
  │                              │  release newer buffered events
```

The critical ordering is:

1. Register the subscription **before** submitting the snapshot to the worker.
2. Copy the board and its revision atomically inside the worker.
3. Buffer events for that board while the snapshot is in flight.
4. Drop buffered events at or below the snapshot revision.
5. Release newer events after the snapshot frame.

This breaks the circular race between "snapshot missed a move" and "event
arrived before the snapshot". A move that commits after the copy is guaranteed
to be in the buffer; a move that committed before the copy is already in the
snapshot.

#### 2A.8 How data is shared

There are four shared representations:

| Representation | Scope | Lifetime | Purpose |
|---|---|---|---|
| Global sequence | one `int64` | forever | total order of accepted moves |
| Board revision | one `int64` per board | forever | per-board gap detection |
| Snapshot | 64 client bytes + revision | request | repair and initial load |
| Event | board, revision, changed squares | broadcast | incremental update |

The global sequence is for the ledger and diagnostics. The client does **not**
use it to detect gaps, because moves on other boards legitimately advance it.
It uses the per-board revision: if it receives revision 7 when it has 5, it
knows it missed revision 6 and requests a snapshot for that board.

The client cache is keyed by `(board_y * 1000 + board_x)` and stores exactly
64 `char` values plus a revision and two flags (`loaded`, `stale`). That is
about 80 bytes per board, not 512. A 25×25 window is about 50 KiB of JS heap.
This is why 841 boards fit comfortably in a few MiB.

#### 2A.9 Why binary rather than JSON

The move path is the hot path. JSON would require:

- parsing numbers into doubles and then converting to integers;
- allocating strings and arrays per request;
- a schema/versioning story for every field;
- more bytes on the wire (a 14-byte move becomes 80–150 bytes).

The binary protocol instead gives:

- fixed offsets, validated by length;
- no per-field allocation;
- exact 64-bit values without JavaScript precision loss;
- a shared codec module, so client and server cannot drift.

JSON is still used for low-frequency, human-facing endpoints: `/metrics`,
`/active.json`, `/tally.json`, `/healthz`. That is the right tool for those.

#### 2A.10 Failure boundaries

Each layer has a different failure mode:

| Layer | Failure | Recovery |
|---|---|---|
| Browser | tab suspended, socket closed, stale cache | reconnect, resnapshot |
| Caddy | process restart, certificate renewal | Docker restart, ACME |
| Server process | crash, OOM, kill -9 | restart, WAL replay |
| WAL device | fsync error, ENOSPC | fail stop, do not acknowledge |
| Snapshot | partial write, checksum mismatch | ignore, fall back to WAL |
| Client request | timeout, duplicate response | request ID dedup, resnapshot |

The server's rule is **fail closed**: if durability cannot be guaranteed, the
process exits rather than acknowledging a move it may lose. The client's rule
is **repair by snapshot**: it never tries to reconstruct missing history from
events alone.

---

## Chapter 3 — Storing Data and Representing Objects

### Subpart A — One piece, one integer

#### 3A.1 Bits, bytes and integers

A byte is 8 bits. An OCaml `int64` is 64 bits, stored as two's-complement on
the machine. The board is a `Bigarray.Array1` of `int64`, so each square is
exactly one machine word and the whole board is 64 × 8 = 512 bytes.

The piece representation deliberately uses the whole word. There is no pointer,
no variant tag, no separate colour array, no separate counter array. Every
property travels with the piece.

| Bits | Field | Width | Meaning |
|---:|---|---:|---|
| 0–24 | Piece ID | 25 | stable identity, 1..33,554,431 |
| 25–28 | Piece type | 4 | 1 pawn, 2 bishop, 3 knight, 4 rook, 5 queen, 6 king, 7 promoted pawn |
| 29 | White | 1 | 1 white, 0 black |
| 30 | Just double moved | 1 | en-passant eligibility |
| 31 | King killer | 1 | legacy metadata |
| 32 | King pawner | 1 | legacy metadata |
| 33 | Queen killer | 1 | legacy metadata |
| 34 | Queen pawner | 1 | legacy metadata |
| 35 | Adopted killer | 1 | legacy metadata |
| 36 | Captured a different type | 1 | promotion/capture history |
| 37 | Reserved | 1 | must be zero |
| 38 | On original board (cached) | 1 | snapshot projection hint |
| 39 | Adopted | 1 | legacy metadata |
| 40–51 | Move count | 12 | saturating at 4,095 |
| 52–63 | Capture count | 12 | saturating at 4,095 |

Zero is reserved for "empty". `Piece.create` rejects an empty or out-of-range
ID, so a non-zero word always has a valid type and colour.

#### 3A.2 Why this is efficient

Consider a white pawn on e2 on its original board, with no moves and no
captures:

```
ID       = 1
type     = 1 (pawn)
white    = 1
original = 1
moves    = 0
captures = 0

word = 1
     | (1 << 25)      type
     | (1 << 29)      white
     | (1 << 38)      on original board
     = 0x0000_0040_2200_0001
```

A black knight on b8:

```
ID       = 2
type     = 3 (knight)
white    = 0
original = 1

word = 2 | (3 << 25) | (1 << 38)
     = 0x0000_0040_0600_0002
```

Moving a piece is one `int64` read and one `int64` write. Capturing is one
write of zero plus one write of the captured value's ID into the ledger
metadata. Promoting is an `Int64.logand`/`logor` pair that changes only bits
25–28. Incrementing a counter is an add with a saturation check.

The alternative — an object with fields — would cost a pointer indirection per
square, a heap object per piece (32 million of them), and a garbage collector
that has to trace them. The packed representation keeps the entire world in
one contiguous allocation that the OS can map, the CPU can prefetch, and the
snapshot writer can stream.

#### 3A.3 Correctness by disjoint masks

Every update uses a mask that clears exactly one field:

```ocaml
let set_move_count t n =
  let n = min n 0xFFF in
  Int64.logor
    (Int64.logand t (Int64.lognot (0xFFF lsl 40)))
    (Int64.shift_left (Int64.of_int n) 40)
```

Because the fields are disjoint:

- an update cannot corrupt a neighbouring field;
- ID, type and colour survive metadata updates;
- `promote` changes only the type;
- counters saturate instead of wrapping;
- equality is a single word comparison.

Tests cover every field, promotion preservation, and saturation at both ends.
The lemmas are simple enough for a proof assistant (Section 13.1), but they are
not machine-checked today.

#### 3A.4 The client projection

The server stores 64 bits per piece. The browser only needs enough to draw and
to cheaply detect en-passant/castling:

| Bit | Meaning |
|---:|---|
| 0 | white |
| 1–3 | type code (0 empty, 1 pawn, 2 bishop, 3 knight, 4 rook, 5 queen, 6 king, 7 promoted pawn) |
| 4 | currently on the board encoded by its ID |
| 5 | en-passantable pawn or castling-eligible king/rook |
| 6–7 | zero |

So a snapshot is 64 bytes, not 512. The client cache stores those 64 bytes.
The server computes bit 4 from the board being sent, so it stays correct even
if a piece was placed manually or captured across boards.

The trade-off is loss of detail: the client cannot see move counts, capture
counts or the legacy killer flags. That is why there is a separate piece-info
request for the inspector panel, which returns the full `int64` and its
metadata.

#### 3A.5 Board indexing

The world is a dense 1,000 × 1,000 grid of 8 × 8 boards. The authoritative
index is:

```
board_id = board_y * 1000 + board_x
index    = board_id * 64 + y * 8 + x
```

`board_x`, `board_y` are 0..999; `x`, `y` are 0..7; `y = 0` is the top row.

Why this layout:

- one multiplication and two shifts in the hot path;
- rows are contiguous, so a rank scan touches one or two cache lines;
- the whole world is one allocation, so there is no per-board pointer;
- the index is a bijection: every square has exactly one index and every index
  maps back to one square.

The checked path validates `board_x`, `board_y` and the square before
computing. The `get_world` fast path takes already-validated absolute
coordinates and skips the record allocation. Measured difference: 14.0 ns vs
11.6 ns per read, and 503 ns vs 247 ns for a full validation path.

#### 3A.6 Ledger packing

The ledger stores one event per accepted move in two `int64` arrays:

```
moves:     source position (26 bits) | destination position (26 bits)
metadata:  moved piece ID (25) | captured piece ID (25) | flags (14)
```

A position is:

```
bits 0–19  board_id   (0..999,999)
bits 20–25 square_id  (0..63)
```

That is 26 bits per position, 52 bits for source+destination, 25+25+14 = 64
bits for metadata. An event is exactly 16 bytes. A capacity of 1,048,576
events is 16 MiB.

The sequence number is not stored in the event. It is implicit in the circular
index:

```
index = seq land (capacity - 1)
```

`head_seq` is the next sequence to assign; `oldest_seq` is the oldest retained.
The readable interval is `[oldest_seq, head_seq)`. When the head passes the
oldest by more than the capacity, the oldest advances. This gives O(1) append,
O(1) lookup by sequence, no per-event allocation and no linked list.

#### 3A.7 Memory arithmetic

| Structure | Count | Bytes each | Total |
|---|---:|---:|---:|
| Board squares | 64,000,000 | 8 | 512,000,000 |
| Board revisions | 1,000,000 | 8 | 8,000,000 |
| Ledger moves | 1,048,576 | 8 | 8,388,608 |
| Ledger metadata | 1,048,576 | 8 | 8,388,608 |
| Core state | | | **536,777,216 (~512 MiB)** |
| Client cache, 625 boards | 625 | ~80 | ~50,000 |
| Snapshot payload, standard board | 1 | 2 | 2 bytes |
| Snapshot payload, full board | 1 | 65 | 65 bytes |

Process RSS after startup is ~540–555 MiB, which matches the core state plus
the OCaml runtime, Lwt buffers and the snapshot buffer. After the first
snapshot the process retains one reusable second world copy (512 MiB), so
steady-state production RSS is ~1.03 GiB. The implementation deliberately
reuses that buffer instead of allocating a new 512 MiB world for every
snapshot. Budget ~1.1 GiB for the process and leave headroom for the page
cache and the WAL.

#### 3A.8 Worked example: a capture

White knight ID 1234 on b1 captures a black pawn ID 5678 on c3.

1. `source = Board.get b1` → the packed knight word.
2. `captured = Board.get c3` → the packed pawn word.
3. Validator returns `Legal { kind = Normal; src = b1; dst = c3; ... }`.
4. `Move_processor.prepare` produces:
   - clear b1;
   - write knight at c3 with `move_count + 1`, `capture_count + 1`;
   - clear the captured pawn from the board (already overwritten by the write).
5. Ledger event:
   - `move = pack(b1) | (pack(c3) << 26)`;
   - `metadata = 1234 | (5678 << 25) | flags`;
6. WAL transition records the final square values and the new revision.
7. Response includes the moved piece `int64` and the captured piece ID.
8. Event sends `(b1, 0)` and `(c3, knight_byte)`.

The client applies the event by setting cache byte 0 at b1 and the knight byte
at c3. It does not need the captured ID to draw the result; it only needs it
for the capture tally and the inspector.

#### 3A.9 What is deliberately not stored

- No history of every board position. The ledger stores transitions, not
  snapshots; replaying from sequence 1 would require the initial state plus
  every event, but recovery uses snapshots plus a bounded WAL instead.
- No per-piece heap object.
- No per-board mutex or version object.
- No JSON in the hot path.
- No full move list per board; the ledger is global and circular.

These omissions are what make the memory and latency numbers possible. They
also define the limits: the ledger is bounded, so very old history is lost by
design; the client cache is bounded, so very old boards are evicted; the board
is dense, so a sparse world would waste memory.

---

## Chapter 4 — Sending Data Efficiently

### Subpart A — Serialisation, framing and transport

#### 4A.1 Principles

The wire format follows five rules:

1. **Fixed width.** No varints in the move path, no length prefixes per field.
2. **Validate length first.** The server dispatches on the total message length
   before reading any field.
3. **Little-endian for protocol messages.** The client and server both run on
   little-endian machines in practice; the codec writes explicit little-endian
   bytes, so the format is defined regardless of host endianness.
4. **Big-endian for persistence.** WAL and snapshot formats use big-endian so a
   hex dump is readable and the format is host-independent.
5. **Checksums at the boundary.** WAL records and snapshots carry FNV-1a 64
   checksums; protocol frames rely on TLS/TCP integrity and length validation.

#### 4A.2 The move request: 14 bytes

| Bytes | Field | Encoding |
|---:|---|---|
| 0–5 | move | source position (26 bits) + signed dx (9) + signed dy (9) |
| 6–9 | expected piece | 25-bit ID or a 16-bit `(source_square << 8) + client_byte` signature |
| 10–13 | request ID | little-endian `int32` |

The source position packs:

```
bits 0–19   board_id = board_y * 1000 + board_x
bits 20–25  square_id = y * 8 + x
```

The destination is reconstructed:

```
dst_world_x = src_world_x + dx
dst_world_y = src_world_y + dy
```

The signed deltas are 9-bit two's-complement, but the codec accepts only
−128..128 and the validator enforces the 36-square limit. This is smaller than
sending two 26-bit positions (52 bits vs 44 bits used), and it makes
cross-board moves natural: a delta can cross a board boundary.

Example: white pawn e2 (square 52) to e4 (square 36) on board (500, 500):

```
source = 500 | (500 << 10) | (52 << 20)
dx = 0, dy = -2
packed = source | (0 << 26) | ((-2 & 0x1ff) << 35)
expected = (52 << 8) | 19
```

#### 4A.3 The move response: 26-byte payload in a 4,096-byte frame

| Bytes | Field |
|---:|---|
| 0 | kind `1` |
| 1 | status (1 accepted, 0 rejected) |
| 2–5 | request ID |
| 6–13 | sequence (`int64`) |
| 14–21 | moved piece (`int64`) |
| 22–25 | captured piece ID (`int32`) |
| 26 | rejection code |
| 27–4095 | zero padding |

The kind byte is transport framing; the response payload itself is the 26
bytes after it. The padding exists because Dream buffers writes until 4 KiB. It
costs 1.15 µs to allocate and zero-fill on the benchmark machine. At 10k
moves/s that is about 1.1% of one core, acceptable but wasteful. A transport
that flushes on message boundaries would remove it.

#### 4A.4 Single-board snapshot

Request: 9 bytes.

| Byte | Field |
|---:|---|
| 0 | kind `0x02` |
| 1–4 | request ID |
| 5–6 | board X (`uint16`) |
| 7–8 | board Y (`uint16`) |

Response: an 81-byte payload plus the kind byte (82 bytes in the frame).

| Bytes | Field |
|---:|---|
| 0 | kind `2` |
| 1 | status (1 ok, 0 failed) |
| 2–5 | request ID |
| 6–7 | board X |
| 8–9 | board Y |
| 10–17 | revision (`int64`) |
| 18–81 | 64 client bytes, row-major |

#### 4A.5 Batch snapshots

A batch request is 13 bytes:

| Byte | Field |
|---:|---|
| 0 | kind `0x06` |
| 1–4 | request ID |
| 5–6 | x0 |
| 7–8 | y0 |
| 9–10 | x1 |
| 11–12 | y1 |

The region is limited to 4,096 boards (64×64), which bounds the worker's copy
work and the response size.

The compact response (kind `6`) is variable-length:

```
header: kind (1), request_id (4), x0 (2), y0 (2), width (2), height (2)
per board:
  tag (1):
    0 = empty
    1 = standard starting position
    2 = bitmap + pieces
    3 = full 64 bytes
  revision (uvarint)
  payload:
    empty/standard: none
    bitmap: 8-byte occupancy bitmap + one byte per occupied square
    full: 64 bytes
```

A standard board is 2 bytes: tag + revision. A 25×25 window of standard boards
is 13 + 625 × 2 = 1,263 bytes. A touched board with 20 pieces is 1 + 1 + 8 +
20 = 30 bytes. This is why the measured 625-board snapshot is 1.3 KiB rather
than 50 KiB.

The client classifies boards the same way the server does (`standard`, `empty`,
`bitmap`, `full`), so the codec is symmetric.

#### 4A.6 Live events

A kind `3` event is:

| Bytes | Field |
|---:|---|
| 0 | kind `3` |
| 1–8 | global sequence |
| 9–12 | originating request ID |
| 13 | board count (1 or 2) |
| per board | x (`u16`), y (`u16`), revision (`i64`), change count (1), then `(square, byte)` pairs |

A normal move has 2 changes; en passant 3; castling 4; promotion 2. A
cross-board move has two board records. A client subscribed to both boards
receives one event, not two.

Kind `4` batches several event payloads into one frame:

```
kind (1), count (1), then each event payload without its kind byte
```

The server flushes the origin connection before its response, so the mover
normally sees its own event first. Other connections batch until the 1 ms
window or the 4 KiB threshold.

#### 4A.7 Serialisation in OCaml

The codecs are pure functions over `Bytes.t`:

```ocaml
let set_i32_le b offset value =
  Bytes.set b offset (Char.chr (value land 0xff));
  ...
```

They do not use `Marshal`, JSON or a generic serialisation library. Reasons:

- `Marshal` is not stable across OCaml versions and is unsafe for untrusted
  input.
- JSON allocates and loses 64-bit exactness in JavaScript.
- A schema compiler adds a build dependency for a format that fits on one
  page.

The codecs validate every field before constructing a record. For example,
`move_request_of_bytes` checks the total length, the message type, the delta
range, the destination bounds and the expected-ID range. A malformed request
becomes a rejection, not an exception that unwinds the worker.

On the server, responses are encoded once per event and shared between
recipients. `Bytes.unsafe_to_string` avoids a 4 KiB copy per recipient because
the frame is immutable after encoding.

#### 4A.8 HTTPS versus WebSockets

| Property | HTTPS request/response | WebSocket |
|---|---|---|
| Connection | short-lived or keep-alive | long-lived |
| Direction | client initiates | both directions |
| Framing | HTTP message | WebSocket frame |
| Compression | gzip/zstd via Caddy | not enabled by default |
| Caching | yes | no |
| Reconnect | trivial | needs snapshot repair |
| Use here | shell, assets, metrics, health | moves, snapshots, events |

The initial page load uses HTTPS and benefits from compression and caching.
The measured production transfer is 8 KiB of JS and 65 KiB of WASM on the wire,
thanks to Caddy's zstd/gzip. The live game uses WSS and pays one TCP+TLS
handshake (~205 ms cold from the test machine) and then ~24 ms RTT per
request.

WebSocket is the right choice because moves are pushed to many clients and the
server must preserve order per connection. A polling HTTP design would either
add latency or waste requests.

#### 4A.9 Measured serialisation cost

From the microbenchmark:

| Operation | ns/op |
|---|---:|
| encode 6-byte move | 27.4 |
| decode 6-byte move | 19.4 |
| encode 14-byte request | 59.0 |
| decode 14-byte request | 39.0 |
| encode 26-byte response in 4 KiB | 1,145.9 |
| decode 4 KiB response | 48.7 |
| encode event in 4 KiB | 1,231.4 |
| decode event | 77.8 |
| encode 81-byte snapshot | 52.5 |
| decode 81-byte snapshot | 33.5 |

The gap between the 14-byte request and the 4 KiB response is the padding.
Event batching amortises the frame cost: 4,000 recipient events became 295
writes in the default load run, and 102,000 became 3,157 at 1,020 clients.

#### 4A.10 What would change

- Replace the 4 KiB padding with an explicit flush primitive or a Dream version
  that flushes small messages. This is a transport fix, not a protocol change.
- Add a `permessage-deflate` extension for event batches if bandwidth becomes
  the limit. The current compact encoding already removes most redundancy.
- Add a version byte to the WebSocket handshake so a client can detect a
  protocol mismatch before sending a move. Today the client version is in the
  script URL and the server rejects malformed lengths.
- Fix pipelined request handling so a client can keep more than one request in
  flight; this is a server-loop issue, not a codec issue.

---

## Chapter 5 — State, Part I: From a Move to Durable State

### Subpart A — Validation, the ledger and the commit pipeline

#### 5A.1 The authoritative state

`Game_state.t` owns:

- `board : Board.t` — 1,000,000 × 64 packed pieces;
- `revisions : int64 Bigarray` — one revision per board;
- `ledger : Ledger.t` — two circular `int64` arrays;
- `sequence : int64` — the next global sequence.

Only the state worker mutates these. The server reads `sequence` and
`occupied_count` for health and metrics; everything else goes through the
worker.

The board is not a cache of the WAL. It is the live authority. The WAL is the
durability record of transitions that have already passed validation. Recovery
replays those transitions into a fresh board, so the chess rules are not needed
during recovery.

#### 5A.2 Validating a move against the board

`Move_validator.validate board move` performs, in order:

1. **Bounds.** Source and destination must be inside the 1,000 × 1,000 world
   and inside a board square.
2. **Source occupancy.** An empty source is `Empty_source`.
3. **Colour and ownership.** The mover must own the piece. The client's colour
   is fixed per device; the server enforces it.
4. **Geometry.** The absolute-coordinate delta must match the piece's movement
   pattern. Sliding pieces use the `get_world` fast path over absolute
   coordinates, so a move can cross board boundaries without special cases.
5. **Path.** Every intermediate square must be empty. The 36-square limit is
   enforced here as well.
6. **Destination.** A friendly destination is illegal; an enemy destination is
   a capture.
7. **Special moves.**
   - castling: king and rook unmoved, path clear, distance 3..36, central
     destination squares, rights not lost;
   - en passant: the captured pawn is beside the destination, not on it;
   - promotion: the destination rank and the promotion choice.
8. **Move kind.** The validator returns a `move_info` record with the moving
   piece, captured piece, and any rook/en-passant coordinates.

The validator never writes. It returns either `Illegal rejection` or
`Legal info`. This separation is what makes `prepare`/`apply_plan` possible.

#### 5A.3 Why absolute coordinates

A board-local validator would need a branch at every edge: "if x = 0 and dx =
−1, switch to the board on the left". With absolute coordinates, the board is
just a dense grid and a sliding path is a sequence of world squares. The only
special case is the world boundary.

This also makes cross-board castling and long-range pieces natural. A rook can
slide across a board boundary if the path is clear; the destination board is
computed from the absolute coordinate. The 36-square limit keeps the path
bounded and prevents a piece from crossing an unreasonable number of boards.

#### 5A.4 Preparing the write set

`Move_processor.prepare board info` computes a plan without touching the
board:

```
type plan = {
  clears : position list;
  writes : (position * Piece.t) list;
}
```

For a normal move:

- clear the source;
- write the moving piece at the destination with updated metadata.

For a capture:

- clear the source;
- write the moving piece at the destination (overwriting the captured piece);
- the captured piece's ID goes into the ledger metadata.

For en passant:

- clear the source;
- clear the captured pawn's square (beside the destination);
- write the moving piece at the destination.

For castling:

- clear the king's source and the rook's source;
- write the king and rook to the two central squares;
- the king takes the square on the rook's side, the rook the other.

For promotion:

- clear the source;
- write the promoted piece at the destination.

`apply_plan` performs the writes. Because the plan is computed before any
write, a validation failure cannot leave a half-applied board.

#### 5A.5 The commit pipeline

`Move_engine.process` is the transaction:

1. Read the source square.
2. Check `expected_piece_id` (full ID or client signature). The engine also
   treats zero as "skip the stale check", but the protocol rejects zero, so a
   normal client always sends a real identity.
3. Validate.
4. Build the ledger event (move, moved ID, captured ID, flags).
5. Validate the ledger event (field ranges).
6. Check sequence exhaustion.
7. `Move_processor.prepare`.
8. `precommit` callback: encode the WAL transition and append it.
9. `Move_processor.apply_plan`.
10. `Ledger.append`.
11. `Game_state.with_state` commits the new sequence.
12. Read the updated moving piece for the response.

The `precommit` callback is where persistence hooks in. In strict mode it
writes and fsyncs before the board changes. In group mode it appends the
record, the worker processes the batch, and `Persistence.sync` fsyncs once
after the batch. Later moves in the batch can validate against earlier moves
because the board is updated in order.

Why this order matters:

- All ordinary failures happen before the first board write.
- The ledger append is prevalidated, so it cannot fail after the board changed.
- If an unexpected exception occurs after a write, the worker treats the
  process as failed rather than returning an ordinary rejection. A partially
  committed board is not a valid state to continue from.
- The response reads the piece after the write, so it reflects promotion and
  metadata updates.

#### 5A.6 The ledger as the ordering record

The ledger is not a queue of pending moves. It is the **committed history** of
accepted transitions. It provides:

- a global sequence for diagnostics and event ordering;
- the moved and captured piece IDs for the inspector and capture tally;
- flags for castling, en passant and promotion;
- a bounded replay window for snapshots and clients.

The circular layout is described in Section 7. The important invariants are:

- the sequence of an event is its append order;
- an event is readable while `oldest_seq <= seq < head_seq`;
- a rejected move never appends;
- a successful append increments `head_seq` exactly once;
- the engine checks that the ledger's returned sequence equals the expected
  next sequence.

Events older than the ledger capacity are intentionally lost. Snapshots carry
the ledger head and oldest sequence so recovery knows what is still valid.

#### 5A.7 Updating piece metadata

The board write is not just a copy. The moving piece's metadata changes:

| Event | Metadata change |
|---|---|
| any move | `move_count + 1` (saturating) |
| capture | `capture_count + 1` (saturating), `has_captured_other_type` if the captured type differs |
| double pawn move | `just_double_moved = true`; cleared on the next move |
| promotion | type becomes queen/rook/bishop/knight; ID and counters preserved |
| castling | king and rook both get `move_count + 1`; rights are lost |
| en passant | captured pawn is removed from its square |

The "just double moved" bit is cleared when the pawn moves again or when
another move makes it no longer the most recent double move. En passant is
therefore valid only on the immediately following move.

Castling rights are derived from `move_count = 0` and the original squares,
not from a separate rights bitmask. A king or rook that has moved can never
castle again, even if it returns to its starting square.

#### 5A.8 Persistence: WAL

A WAL record stores the **transition**, not the move command:

```
segment header (16 bytes):
  magic "SMWG" (4), version (1), reserved (3), first sequence (8)

record frame:
  magic "SMWL" (4), version (1), reserved (3), payload length (4)
  payload:
    sequence, request_id
    board changes: (x, y, revision, [(square, final_piece), ...])
    ledger move, moved ID, captured ID, flags
  checksum (8, FNV-1a 64 over header + payload)
```

A normal move payload is about 63 bytes, so the framed record is about 83
bytes. This matches the measured 41 MiB for 500k moves.

The WAL is append-only. A segment rotates at a snapshot boundary. Recovery:

1. Load the newest valid snapshot, if any.
2. Replay WAL segments with sequence > snapshot sequence, in order.
3. Require contiguous sequences; a gap is a fatal error.
4. Truncate a torn tail in the last segment.
5. Verify the checksum of every record.
6. Rebuild the ledger and revisions from the transition records.

Recovery does **not** re-run chess validation. The transition is trusted
because it was validated before it was written. This is why recovery is fast
and why a validator change does not change the meaning of old records.

#### 5A.9 Persistence: snapshots

A snapshot contains the complete world:

```
header:
  magic "SMSN", version, sequence, ledger head, ledger oldest,
  board count, ledger capacity
arrays:
  board revisions (8 bytes × 1,000,000)
  ledger moves    (8 bytes × capacity)
  ledger metadata (8 bytes × capacity)
  board squares   (8 bytes × 64 × 1,000,000)
footer:
  magic "SMND", checksum (FNV-1a 64)
```

The writer:

1. captures a copy of the world (512 MiB board + revisions + ledger);
2. writes to a temporary file;
3. fsyncs the file;
4. renames it atomically;
5. fsyncs the directory;
6. rotates the WAL and removes old segments.

The capture is done in the worker so it is a consistent point-in-time view. The
write happens asynchronously. The implementation reuses a single snapshot
buffer, so repeated snapshots do not allocate a new 512 MiB world each time.
That buffer is retained after the first snapshot, which is why production RSS
settles at about 1.03 GiB rather than 550 MiB.

Measured: a 512 MiB snapshot takes about 2.2–2.3 s (~230 MiB/s), and restart
from a snapshot plus 89k WAL records takes about 1.4 s.

#### 5A.10 Worked example: e2–e4

1. Client sends source e2 (board 500,500, square 52), dx 0, dy −2, expected
   signature `(52 << 8) | 19`.
2. Server checks source is a white pawn with ID/signature match.
3. Validator: pawn double move, path e3 empty, destination e4 empty.
4. `prepare`: clear e2, write pawn at e4 with `move_count + 1` and
   `just_double_moved = true`.
5. Ledger event: move e2→e4, moved ID, captured 0, flags 0.
6. WAL transition: board (500,500) revision +1, changes [(52, 0), (36, pawn)].
7. Apply, append, sequence++.
8. Response: status 1, sequence, moved piece, captured 0.
9. Event: board (500,500), revision, changes [(52, 0), (36, pawn byte)].

The client's optimistic move already drew the pawn on e4. The event confirms
it and sets the revision. If the server rejected, the client would restore the
source and clear the destination.

#### 5A.11 Invariants

The state layer maintains:

1. **Single writer.** Only the worker mutates `Game_state`.
2. **Atomic transition.** Board writes and ledger append happen in one
   non-yielding callback.
3. **Sequence continuity.** Accepted moves have consecutive sequences.
4. **Revision monotonicity.** Each board's revision increases by one per move
   touching it.
5. **Ledger validity.** Every retained event has valid fields and a sequence in
   `[oldest, head)`.
6. **Durability before acknowledgement.** A response is sent only after the
   commit group's fsync succeeds.
7. **Recovery prefix.** Restart recovers a prefix of the committed sequence; it
   never skips a record.
8. **Snapshot consistency.** A snapshot's sequence, ledger bounds and board
   contents come from one worker point.

These are tested directly and by the crash/fault suites. They are not
machine-checked; Section 13 lists the proof obligations.

---

## Chapter 6 — State, Part II: Conflicting Moves, Dependencies and Cancellation

### Subpart A — What happens when two people move at once

#### 6A.1 The current model

The current model is simple and strong:

- one state worker;
- one FIFO queue;
- one transaction at a time;
- first valid request wins;
- later requests are validated against the new state and either succeed or
  are rejected.

There are no locks around squares, no optimistic concurrency control in the
database sense, and no rollback of a committed move. The worker is the
serialisation point. Every accepted move has a total order (the global
sequence), and every client converges on that order through events and
snapshots.

This is not a limitation for correctness. It is a limitation for **semantics
under contention**: a request that was legal when the user made it may be
illegal by the time it reaches the worker. The client must retry or explain the
rejection.

#### 6A.2 A taxonomy of conflicts

| Conflict | Example | Current result |
|---|---|---|
| Same piece, different destination | two players move the same knight | one accepted, the rest `Empty_source` |
| Same destination, different pieces | two captures of the same enemy piece | one accepted, the rest see an empty/friendly destination |
| Stale piece identity | client moves a piece that has already moved | `Stale_piece` |
| Order-dependent capture | black d7–d5 and white e4xd5 | first order wins; the other is illegal |
| Cross-board capture | a piece moves onto a square another move is vacating | order decides whether it is a capture or an empty move |
| Castling rights | one move moves the king, another tries to castle | first wins; the second loses rights |
| Promotion | two moves promote the same pawn | first wins; the second sees a queen |

The measured experiment in `bench/evening/REPORT.md` shows the same-piece race:
32 simultaneous requests on one knight produced exactly one accepted move in
all 40 trials, with the other 31 rejected as `Empty_source`.

The dependent capture shows the semantic problem:

- black d7–d5 first: both accepted;
- white e4xd5 first: black accepted, white rejected.

Both requests are "legal" from the client's point of view. The difference is
whether the client knew about the other move.

#### 6A.3 Why not just retry?

Retrying is correct but costly:

- the user sees a delay or a rejection;
- the client must decide whether the move is still desirable;
- in a busy position, several retries may fail;
- a retry changes the move's position in the global order, which can change
  whether it is a capture, a check, or a legal castle.

For a single move every few seconds, retrying is fine. For a crowded board,
or for a client that wants to chain "if black plays d5, capture it", retrying
is the wrong abstraction. The client should be able to say **"this move
depends on that move"**.

#### 6A.4 The dependency-tree idea

Model each requested move as a transaction with:

- a **read set**: the squares it reads (source, path, destination, castling
  rook, en-passant pawn);
- a **write set**: the squares it writes (source, destination, captured square,
  rook square);
- an optional **dependency set**: moves that must commit first.

Two moves conflict if one writes a square the other reads or writes. The
server can build a directed graph:

```
A depends on B  =>  edge B -> A
```

A move is **ready** when all its dependencies are committed and its read set is
still valid. A move is **blocked** when a dependency is pending. A move is
**cancelled** when a dependency is rejected or cancelled.

This is a classic optimistic transaction graph. The difference from a database
is that the "transaction" is a chess move and the conflict rules are
geometric, so the read/write sets are small and known before execution.

#### 6A.5 An algorithm

A practical design:

1. **Submit.** The client sends a move plus an optional list of dependency
   request IDs and the board revision it observed.
2. **Parse and validate shape.** Reject malformed requests before the graph.
3. **Build the node.** Compute the read/write sets from the move and the
   current board snapshot. If the source piece is already gone, the node can
   still be admitted as "will fail" so its dependents can be cancelled
   deterministically.
4. **Add edges.**
   - Explicit dependencies: edge from each named request to this node.
   - Implicit conflicts: for each square in the read/write set, find pending
     nodes that write it; add an edge from the earlier node to this one.
5. **Detect cycles.** A cycle means the client asked for mutually impossible
   ordering. Reject the new node with `Dependency_cycle`.
6. **Admit.** If in-degree is zero, validate and commit immediately. Otherwise
   put the node in a blocked set keyed by its remaining dependencies.
7. **Commit.** After a node commits, decrement the in-degree of its dependents.
   For each newly ready node, revalidate against the **current** board. If it
   is still legal, commit it. If not, reject it and cascade: every dependent
   that explicitly required it is cancelled with `Dependency_failed`.
8. **Respond.** Each request gets exactly one response: committed (with
   sequence), rejected (with reason), or cancelled (with the failed dependency).
9. **Bound the graph.** Cap pending nodes per connection and globally. On
   overflow, reject new nodes with `Queue_full` rather than growing without
   bound.

The graph is a DAG by construction (cycles rejected). Committing in topological
order preserves the same single-writer invariant: only one node is applied at a
time, and the board is never partially updated.

#### 6A.6 Data structures

A compact implementation could use:

```
type node = {
  id : request_id;
  move : Move.t;
  reads : square list;
  writes : square list;
  deps : request_id list;
  mutable remaining : int;
  mutable state : Pending | Ready | Committed | Rejected | Cancelled;
}

type graph = {
  nodes : (request_id, node) Hashtbl.t;
  by_square : (square, request_id list) Hashtbl.t;  (* pending writers *)
  ready : request_id Queue.t;
}
```

- `by_square` indexes pending writers, so adding implicit edges is O(read set +
  conflicting writers), not O(all pending moves).
- `remaining` is the in-degree. A node becomes ready at zero.
- `ready` is a FIFO, so independent moves keep arrival order.
- A node is removed from `by_square` when it commits or is rejected.

At the measured scale, a move touches at most a handful of squares, and the
number of pending moves on one board is small. The graph cost is therefore
negligible compared with fsync.

#### 6A.7 Transmitting dependencies

The current move request is 14 bytes. A dependency list does not fit. A new
message type is needed. One design:

```
kind 0x08: move with dependencies
  request_id      4
  move            6
  expected piece  4
  dependency count 1
  dependency IDs  4 * count
```

A second message cancels a request:

```
kind 0x09: cancel
  request_id      4
  target_id       4
```

A response for a cancelled request uses the existing move response with a new
rejection code `cancelled` and the target's request ID in the captured-ID
field (or a dedicated field in a new response type). The exact layout is a
protocol decision; the invariants are:

- every request receives exactly one terminal response;
- a committed move is never cancelled;
- a cancellation is idempotent;
- a cancellation of an unknown request is a no-op with an acknowledgement;
- a cancelled request does not append to the ledger.

#### 6A.8 Cancellation semantics

Cancellation is not the same as rollback. Once a move is committed, it is in
the ledger and on the board. You cannot un-move it without a compensating move
(which would be a new chess move with its own consequences). Therefore:

- cancellation is only allowed while the request is `Pending` or `Ready` and
  not yet committed;
- a cancellation racing with commit is resolved by the worker: whichever
  reaches the worker first wins;
- if the commit wins, the cancel response says `too_late` and the move stands;
- if the cancel wins, the move is removed from the graph and its dependents are
  cancelled with `Dependency_cancelled`.

The ledger does not need a tombstone because a cancelled request was never
appended. A separate in-memory status map is enough. If auditability is
required, append a cancellation record to a diagnostic log, not to the chess
ledger.

#### 6A.9 Safety and liveness

Safety:

- the committed prefix is still totally ordered by sequence;
- no two committed moves write the same square without an order;
- a dependent move is validated against the state produced by its dependencies;
- a rejected dependency cannot leave a dependent committed;
- the board is never partially updated.

Liveness:

- a finite graph with no cycles eventually drains;
- a node whose dependencies commit becomes ready;
- a node whose dependencies fail is cancelled, so it does not block forever;
- a client that never receives a response can cancel or reconnect;
- queue bounds prevent unbounded memory.

Starvation is possible if a continuous stream of higher-priority independent
moves keeps a dependent node blocked. A FIFO ready queue and a per-connection
pending cap make this unlikely; a production design could add aging.

#### 6A.10 What the current client does instead

The browser client:

- sends one move at a time;
- applies the move optimistically;
- waits for the response and the event;
- on rejection, restores the source and clears the destination;
- on a revision gap, requests a snapshot for that board;
- on a timeout, uses a liveness snapshot request.

It does not send dependency lists or cancellations because the server does not
implement them. The conflict experiment shows why a future client might want
to: the "capture if the pawn arrives" case is a natural user intention that
currently requires a wait-and-see loop.

#### 6A.11 Is a dependency tree necessary?

For the current product, no. The single writer already gives a total order,
and most boards are not contested. The measured 32-way race resolves in
microseconds; the user-visible cost is the rejection and retry, not server
throughput.

A dependency tree becomes worthwhile when:

- a board has many simultaneous players;
- clients want to chain moves;
- the server shards boards across writers and needs to coordinate cross-shard
  moves;
- the product wants "queued" moves that execute when a precondition becomes
  true.

Until then, the simpler model is easier to reason about and easier to prove.
Chapter 8 treats dependency trees as a high-risk, high-reward item, not a
default.

---

## Chapter 7 — Testing at Scale

### Subpart A — Simulating load, measuring latency and finding the edge

#### 7A.1 The test pyramid

The system is tested at six levels:

| Level | Examples | What it establishes |
|---|---|---|
| Unit | `test_piece_board`, `test_move`, `test_game_state`, `test_engine` | bit fields, rules, transactions |
| Property/model | `test_move`, `test_protocol`, QCheck-style cases | round trips, boundaries, sequence continuity |
| Integration | `test_worker`, `test_connection_manager`, `test_persistence` | queue, fan-out, WAL, snapshots |
| Browser | `client_*_test.js` | rendering, touch, tap, cache, reconnect, UI |
| Load/soak | `bench/load_test.js`, `bench/evening/soak_probe.js` | latency, throughput, fan-out, drift |
| Fault/deploy | `failure_injection_test.js`, `crash_recovery_test.js`, `deployment_smoke_test.js`, `smoke-test.sh` | crash, torn WAL, rollback, container health |

The levels are deliberately separate. A unit test can prove that a piece packs
correctly; it cannot prove that 1,020 WebSocket clients receive every event.
A load test can prove delivery; it cannot prove that a torn WAL record is
truncated safely. Both are needed.

#### 7A.2 The harnesses

| Harness | Shape | Key assertions |
|---|---|---|
| `bench/bench.exe` | in-process microbenchmarks | ns/op, ops/s, startup time |
| `bench/write_burst.js` | N clients, M moves each, no subscriptions | all accepted, sequences unique, WAL groups |
| `bench/load_test.js` | active + silent clients, snapshots, moves | every event exactly once, no leakage, no closes |
| `bench/run_scaling.js` | fresh server per client count | scaling curve, CPU, RSS, fds |
| `bench/slow_client_test.js` | normal clients + one paused/slow raw client | normal clients unaffected, outbox bounded, recovery |
| `bench/evening/soak_probe.js` | long run + sampler + final snapshots | no drift, no duplicates, final state correct |
| `bench/evening/conflict_probe.js` | simultaneous contradictory moves | one winner, deterministic rejection |
| `bench/evening/crash_probe.js` | SIGKILL during acknowledged moves | recovered >= last ack, restart time |
| `test/failure_injection_test.js` | injected WAL/snapshot faults | committed prefix preserved, torn tail truncated |
| `bench/evening/client_perf.js` | headless Chromium + CDP | load time, FPS, heap, mobile layout |
| `deploy/smoke-test.sh` | real container | HTTP, WS, shutdown, WAL persistence |

Each load run starts a **fresh server and fresh data directory** unless it is
explicitly a warm-cache test. This matters because the move drivers expect
pristine pawns and revision 0. Reusing a data directory after a previous run
produces false rejections.

#### 7A.3 What "at scale" means here

The world has 1,000,000 boards and 32,000,000 pieces, but a single load test
does not touch all of them. The scale dimensions are:

| Dimension | Range tested |
|---|---|
| Concurrent connections | 1 – 1,020 |
| Moves per run | 100 – 2,000,000 |
| Subscription overlap | low, partial, high |
| Snapshot batch | 1 – 4,096 boards |
| Durability | strict fsync, group 16/64/256, adaptive, no sync, tmpfs |
| Failure | SIGKILL, WAL fsync error, short append, snapshot faults |
| Client | desktop, mobile, touch, slow network (emulated) |

The system's cost is not proportional to the world size for a move. A move
reads and writes a handful of squares; the board index is O(1). The world size
matters for startup, snapshots and memory, not for move latency.

#### 7A.4 A worked fsync example

Suppose each fsync costs 1.5 ms and the worker can batch `G` moves per fsync.
Ignoring CPU and network, the durable ceiling is:

```
throughput ≈ G / 1.5 ms
```

| Group | Theoretical moves/s |
|---:|---:|
| 1 | 667 |
| 16 | 10,667 |
| 64 | 42,667 |
| 256 | 170,667 |

The measured write bursts were lower:

| Group | Measured moves/s | Fraction of theoretical |
|---:|---:|---:|
| 1 | 577 | 87% |
| 16 | 5,861 | 55% |
| 64 | 8,682 | 20% |
| adaptive | 9,585 | — |

The gap is the rest of the pipeline: client round trips, response encoding,
event fan-out, scheduler wakeups, and the fact that the group does not always
fill. At group 64 the average group was 51.2, not 64, so the effective ceiling
is lower. At 256 clients and group 64 the average group rose to 56.9 and
throughput to 10,227/s, but p50 latency rose to 26 ms because more requests
queue behind each fsync.

The lesson is not "larger is always better". It is:

- group commit is essential for durability;
- the optimal group depends on arrival rate and latency target;
- an adaptive controller can track the arrival rate better than a fixed group.

#### 7A.5 A worked queueing example

At 1,020 clients and a 145.8 ms p50 move RTT, Little's law says the system is
holding roughly:

```
L = λ × W
  = 5,407 requests/s × 0.1458 s
  ≈ 788 in flight
```

The worker queue capacity is 4,096, so the queue is not full. The latency is
mostly client-side event parsing, socket writes and the Node harness, not
worker saturation (CPU 48.6%). This is why adding clients beyond ~640 did not
increase throughput proportionally.

At 40 clients the p50 is 12.5 ms and CPU is 8.7%; the system is comfortably
interactive. The knee is around 320–640 clients for this workload and harness.

#### 7A.6 Simulating stressful cases

The stress suite covers cases that are easy to miss in normal play:

1. **Same-piece race.** 32 clients move the same knight at once. Exactly one
   wins; the rest get `Empty_source`. This tests the empty-source check and the
   single-writer order.
2. **Stale replay.** A client replays an old source square after a successful
   move. It gets `Empty_source` or `Stale_piece`; no duplicate sequence.
3. **Independent boards.** 32 clients move on 32 boards at once. All 32 are
   accepted with 32 unique sequences. This tests that the worker does not
   serialise unnecessarily at the validation level.
4. **Dependent capture.** Black d7–d5 races white e4xd5. The outcome depends on
   order; the test records both orders. This motivates Chapter 6's dependency
   design.
5. **Snapshot flood.** 40 clients request 64×64 batches. Aggregate throughput
   plateaus at ~500k boards/s; per-request latency rises to 307 ms. This shows
   the worker copy cost.
6. **Slow client.** One client stops reading while 20 normal clients continue.
   Normal lag is unchanged; the slow outbox fills to 8/8, drops events, and
   the connection recovers with a snapshot.
7. **Dead socket.** A write failure unregisters only that client; fds return to
   baseline and idle CPU stays at zero.
8. **Crash during writes.** SIGKILL after 15k acknowledged moves; restart
   recovers at least the last ack. Torn WAL tails are truncated.
9. **Snapshot faults.** Write, fsync, rename and directory-fsync faults leave
   no temporary file and no corrupt snapshot; the old snapshot or WAL is used.
10. **Adaptive transitions.** Quiet → heavy → quiet → fan-out → mixed →
    snapshot. The controller must not oscillate or starve delivery.

#### 7A.7 Identifying weak points

The measurements point to five bottlenecks, in order:

1. **fsync latency.** Strict mode is 577 moves/s. Group commit raises it to
   ~12k, but every group still pays ~1.5 ms.
2. **Single worker / snapshot copy.** Snapshots serialise with moves. A 625-board
   window is 1.25 ms; a 4,096-board batch is 6.6 ms. During a snapshot flood,
   move latency rises.
3. **Event fan-out and the client harness.** At 1,020 clients, 102,000 events
   are parsed by one Node process. Server CPU is below 50%, so the harness is
   part of the limit.
4. **4 KiB padding.** Every response and event frame is 4,096 bytes. Encoding
   is 1.15 µs, but bandwidth is 4,000× the payload for a 1-byte event.
5. **No dependency/cancellation.** Order-dependent moves are rejected and
   retried. This is a semantic limit, not a throughput limit, but it affects
   user experience in contested positions.

#### 7A.8 What the tests do not prove

- They do not prove correctness for every chess position. The validator tests
  cover the rules and special cases, but chess has a large state space. A
  property-based or exhaustive generator for small boards would add confidence.
- They do not prove the absence of a rare race in the snapshot/event handoff.
  The token and revision logic is tested, but a formal model (TLA+) would be
  stronger.
- They do not measure a multi-host deployment. Loopback removes WAN jitter,
  TLS setup per connection, and Caddy's CPU cost. The production spot checks
  cover a single client, not 1,000.
- They do not measure a slower disk or a failing disk controller. Fault
  injection covers errors, not latency distributions.
- They do not measure long-term disk growth with snapshots. The 2M-move soak
  used snapshots disabled; the snapshot test used 300k moves.

These limits are stated so the numbers are not over-claimed. The system is
fast on this machine; the report does not claim it is fast on every machine.

#### 7A.9 Reproducibility

Every result file includes a timestamp and a label. The commands are in
`bench/evening/REPORT.md`. The important conventions:

- fresh data directory per write/load run;
- fixed port 8080 for the harnesses;
- one server process at a time;
- `OCAML_OMCB_SNAPSHOT_MOVES=0` and `..._SECONDS=0` unless testing snapshots;
- record the commit and the storage type with the result.

Without these conventions, a "rejection" may be a stale board, and a
"throughput" number may include a previous run's cache.

---

## Chapter 8 — Improving the Weaknesses

### Subpart A — From measurements to design changes

#### 8A.1 Fsync, continued

The first fix is already in place: group commit. Instead of one fsync per move,
the worker collects a batch and fsyncs once. The WAL append still happens per
move; only the durability barrier is shared.

The second fix is adaptive group commit. A fixed group of 64 is good at high
load and bad at low load: a single move waits for a group that will never fill,
or the server fsyncs every move. The adaptive controller samples:

- move rate;
- pending moves;
- fsync p50/p95;
- broadcast backlog;
- event lag p95;
- recipients per event;
- whether a snapshot is active.

It classifies the regime:

| Classification | Condition | Policy |
|---|---|---|
| `quiet` | low move rate | batch 16, no delay |
| `moderate` | 30–1,000 moves/s | batch 8–32, 250 µs delay |
| `heavy` | >1,000 moves/s or backlog | batch 64–256, no delay |
| `storage_bound` | fsync p50 ≥ 8 ms | batch 32–64, no delay |
| `broadcast_bound` | backlog ≥ 32 or lag ≥ 50 ms with fan-out | batch 8–16, no delay |
| `snapshot` | snapshot active | cap batch at 32 |

It uses an EMA (smoothing 0.35), a candidate policy with hysteresis (3 samples
for increases, 2 for decreases), and a two-sample backlog boost. It refuses to
grow batching while delivery lag is deteriorating. The measured transition
table is in Section 7A and `bench/evening/adaptive_commit_results.md`.

Results:

- heavy phase p50 12.8 ms vs 28.3 ms fixed-16 and 15.7 ms fixed-64;
- total moves 33,868 vs 18,230 and 30,805;
- zero missing/duplicate events in all modes.

The next fsync improvements, in order of risk:

1. **`fdatasync` where the file size is already allocated.** Avoids metadata
   journal writes. Small gain on btrfs, potentially larger on ext4.
2. **Preallocated WAL segments.** Avoids allocation and metadata updates in the
   commit path.
3. **A dedicated WAL device.** An NVMe or battery-backed device with lower
   fsync latency directly raises the ceiling.
4. **`io_uring` with `IORING_OP_FSYNC` and batched writes.** Reduces syscall
   and scheduler overhead, but adds complexity and kernel-version risk.
5. **Group commit across a short delay window.** The current adaptive controller
   uses a delay only in moderate regimes. A small (100–250 µs) delay under
   heavy load can fill groups without hurting interactivity; measure tail
   latency before enabling it broadly.

Do **not** disable fsync in production to chase throughput. The no-sync run is
21k moves/s, but a crash can lose the last group (or more, depending on the
page cache). The 577 → 12k gain from grouping is the safe way to get most of
the benefit.

#### 8A.2 Snapshot cost

A snapshot copy is 64 `int64` reads per board. At 625 boards that is 40,000
reads, ~1.25 ms. At 4,096 boards it is 262,144 reads, ~6.6 ms. During that
time the worker is not processing moves.

Options:

1. **Copy outside the worker from a revisioned shadow.** Maintain a read-only
   shadow updated by the worker, or use a copy-on-write page mapping, so the
   snapshot writer can copy without blocking moves. This is the highest-value
   change but also the most complex.
2. **Copy in chunks between moves.** The worker can copy, say, 64 boards, then
   process a move, then continue. This bounds the stall to ~0.1 ms but lengthens
   the snapshot and complicates the consistency token.
3. **Incremental snapshots.** Store only boards that changed since the last
   snapshot, plus a base. Restart reads the base and applies deltas. This
   reduces I/O but adds a format and retention policy.
4. **Rely on `fork`/reflink.** A forked child gets a copy-on-write view of the
   Bigarray; the child writes the snapshot while the parent continues. OCaml
   and Bigarray make this feasible on Linux, but the child must not share the
   WAL file descriptor or mutate the state.
5. **Reduce snapshot frequency.** The current default is every 100k moves or
   600 s. Increasing it reduces copy cost but lengthens recovery. Measure the
   trade-off against the restart targets.

The measured restart times give a budget: 500k WAL replay is 1.7 s, snapshot +
89k replay is 1.4 s. A snapshot every 250k moves would keep restart under ~2 s
while halving snapshot I/O.

#### 8A.3 Event batching and the 4 KiB frame

Event batching is already enabled by default. It reduced WebSocket writes from
4,000 to 295 in the default load run, and from 102,000 to 3,157 at 1,020
clients. The win is both syscall count and scheduler wakeups.

The remaining waste is the 4 KiB frame. Every recipient frame is padded, so
4,000 events carry 16 MiB instead of a few hundred KiB. The fix is a transport
primitive that flushes a small frame immediately. Options:

- patch the pinned `httpun-ws`/Dream integration to flush on `send`;
- use a different WebSocket library;
- send one large batch frame and accept the latency of waiting for the batch
  window;
- negotiate `permessage-deflate` to compress the padding (it compresses well,
  but still costs CPU).

The measured encode cost is 1.15 µs per response and 1.23 µs per event frame.
At 10k moves/s the response encoding is ~1.1% of one core; at 100k it would be
11%. The bandwidth cost is the bigger issue at scale. A flush primitive is a
medium-risk, high-value change.

#### 8A.4 Fast paths already applied

Several improvements are already in the code and visible in the numbers:

| Change | Before | After |
|---|---|---|
| `get_world` validation path | 503 ns | 247 ns |
| compact snapshot batches | 625 × 4,096 B = 2.56 MiB | 1,263 B |
| event batching | 4,000 writes | 295 writes |
| snapshot buffer reuse | new 512 MiB per snapshot | one reusable buffer |
| `Bytes.unsafe_to_string` | 4 KiB copy per recipient | no copy |
| client byte snapshots | 512 B/board | 64 B/board |
| client snapshot planner | 625 single requests | one batch / rectangles |
| adaptive commit | fixed group | regime-aware |

These are the cheap wins: they remove copies, allocations and round trips
without changing the correctness model.

#### 8A.5 Concurrency improvements

The single worker is simple and correct, but it is the next ceiling after
fsync. Options, in increasing risk:

1. **Move snapshot copying off the worker** (Section 8A.2). Removes the largest
   latency spikes without changing move ordering.
2. **A dedicated domain for the worker.** OCaml 5 domains could run the state
   worker on its own core, with a thread-safe mailbox and a safe handoff back to
   Lwt. The engine and state are not shared with the network domain, so the
   move path stays single-writer. This is a contained change.
3. **Shard by board.** Partition the 1,000 × 1,000 world into N shards, each
   with its own writer and WAL. A cross-shard move becomes a two-phase commit or
   a dependency edge. This scales moves but complicates snapshots, sequence
   numbers and recovery.
4. **Read-only shadows for snapshots.** A shadow can serve snapshots without
   blocking the writer; the writer publishes a revision when it is safe.
5. **Lock-free reads for metrics/health.** Already effectively true; the
   server reads `sequence` and `occupied_count` without the worker.

Sharding is the only option that raises the durable write ceiling beyond one
fsync stream. It should follow the dependency-tree design, because cross-shard
moves need exactly the same ordering machinery.

#### 8A.6 Protocol improvements

1. **Fix pipelined requests.** The server currently processes one
   `Dream.receive` at a time and drops residual frames. A read loop that drains
   all buffered frames before awaiting the response would allow clients to keep
   multiple requests in flight. This is a server-loop fix, not a wire change.
2. **Add a protocol version handshake.** A version byte in the WebSocket
   upgrade or a first message lets the client detect a stale cached client
   before sending a move.
3. **Add dependency and cancellation messages** (Chapter 6). High risk, high
   value for contested boards.
4. **Add a batch move message.** For bots or replays, a single frame with
   multiple moves would reduce framing overhead. The server must still apply
   them in order and stop at the first rejection.
5. **Add a snapshot delta request.** Instead of a full board, send the changes
   since a revision. The ledger already has the events; a bounded delta could
   repair a gap with less bandwidth than a full snapshot.

#### 8A.7 Client improvements

The client is already at 60 fps and a few MiB of heap. Remaining opportunities:

- **Predictive prefetch.** Prefetch in the direction of panning, not just a
  symmetric margin.
- **Larger cache.** 900 boards is enough for a 25×25 window plus prefetch; a
  larger cache would smooth long pans at the cost of memory.
- **Incremental rendering.** The current tile blit is fast; the next limit is
  drawing hundreds of pieces per frame at high zoom. A dirty-rectangle renderer
  would help low-end devices.
- **Move queue.** If the server ever supports dependencies, the client needs a
  visible pending queue and cancellation UI.
- **Offline indicator.** The reconnect logic exists; a clearer status would
  improve the user experience on flaky mobile networks.

#### 8A.8 A prioritised roadmap

| Priority | Change | Expected gain | Risk | Prerequisite |
|---:|---|---|---|---|
| 1 | Keep adaptive group commit | 10–30% over fixed-64; better burst behaviour | low | none |
| 2 | Multi-process load generator | accurate ceiling above 1k clients | low | test-only |
| 3 | Snapshot copy off worker | removes 1–7 ms stalls | medium | consistency model |
| 4 | Fix pipelined requests | enables client batching | medium | server loop |
| 5 | `fdatasync` / preallocated WAL | 5–15% on some filesystems | low | durability tests |
| 6 | Flush primitive for 4 KiB frames | 10–100× event bandwidth | medium | vendor patch |
| 7 | Incremental snapshot | faster restart, less I/O | medium | format/versioning |
| 8 | Domain worker | uses a second core | medium | OCaml 5/Lwt handoff |
| 9 | Dependency + cancellation | removes retry latency | high | protocol/state model |
| 10 | Board sharding | near-linear move scaling | very high | dependency model |

#### 8A.9 What not to do

- **Do not add per-square locks.** They would not remove the fsync bottleneck,
  and they would make the transaction invariants much harder to reason about.
- **Do not use JSON on the move path.** It allocates, loses 64-bit exactness in
  JavaScript, and is larger.
- **Do not spawn a thread per move.** The worker is fast; contention would
  move to the allocator and scheduler.
- **Do not acknowledge before fsync.** The no-sync speed is tempting, but it
  turns a crash into data loss.
- **Do not shard before dependency semantics exist.** Cross-shard moves need a
  coordination model; without it, sharding creates new conflict classes.

---

## Chapter 9 — Deploying a Solution

### Subpart A — From a commit to a live, recoverable service

#### 9A.1 The production shape

Production is one authoritative OCaml process, one Caddy process, one host:

```
                 Internet
                    │
             :80 / :443
                    │
          ┌─────────▼─────────┐
          │ Caddy 2.8         │
          │ TLS / HTTP2 / WS  │
          │ compression       │
          │ security headers  │
          └─────────┬─────────┘
                    │ app:8080 (Docker network)
          ┌─────────▼─────────┐
          │ OCaml app         │
          │ one writer        │
          │ /var/lib/sim-map  │
          └─────────┬─────────┘
                    │ bind mount
          ┌─────────▼─────────┐
          │ /srv/chess/data   │
          │ WAL + snapshots   │
          └───────────────────┘
```

The app container publishes no host port. Caddy is the only process exposed to
the internet. The data directory is a host bind mount, not a Docker volume, so
it survives container replacement and can be backed up directly.

Exactly one app container may write the data directory. Two writers would
corrupt the WAL. The Compose file and deployment policy enforce one replica.

#### 9A.2 CI: test before publish

Every push to `main` runs `.github/workflows/deploy.yml`:

1. Check out the repository.
2. Set the new and legacy image names.
3. Test the pull agent's registry logic.
4. Test the Compose validator.
5. Test deployment policy invariants.
6. Validate the production Compose file with `docker compose config`.
7. Validate the Caddyfile with `caddy validate`.
8. Build the `test` Docker stage and run the OCaml tests.
9. Build the runtime image with OCI labels.
10. Build a byte-for-byte legacy compatibility image for the pre-rename host.
11. Smoke test the image: HTTP, WebSocket, shutdown, WAL persistence.
12. Smoke test WebSocket through Caddy.
13. Log in to GHCR.
14. Publish immutable `:<sha>` tags for both images.
15. Publish `:latest` only if this run is still the head of `main`.
16. Log out.

The CI never connects to the VPS. There are no VPS SSH secrets. This removes a
large class of supply-chain risk: a compromised CI run can publish an image,
but it cannot directly log in to production.

#### 9A.3 Image publication and labels

Images are published to:

- `ghcr.io/ja927cam/ocaml-omcb:<sha>` and `:latest`;
- `ghcr.io/ja927cam/sim-map:<sha>` and `:latest` (legacy compatibility).

The runtime image carries:

```
org.opencontainers.image.revision = <git sha>
org.opencontainers.image.source   = https://github.com/ja927cam/ocaml-omcb
```

The legacy image carries the old source label so an existing pull agent still
accepts it. The server also accepts `SIM_MAP_*` environment variables and the
legacy `/var/lib/sim-map/data` path. These are compatibility measures, not the
long-term design.

#### 9A.4 The pull agent

The VPS runs a systemd timer about every five minutes:

```
ocaml-omcb-pull.timer
  -> ocaml-omcb-pull.service
    -> /opt/ocaml-omcb/pull_agent.py
```

The agent:

1. Reads the GHCR manifest for `latest`.
2. Computes/validates the `Docker-Content-Digest`.
3. Extracts the `org.opencontainers.image.revision` label.
4. Rejects anything that is not a 40-hex commit SHA.
5. Verifies the repository and source labels against an allow-list.
6. Compares the digest with its last successful deploy.
7. If unchanged, exits.
8. If changed, runs `/opt/ocaml-omcb/deploy.sh --tag <sha>` as root.
9. Records the digest and SHA only after success.
10. Backs off on failure so a broken image does not loop.

The agent has no inbound listener and no GitHub token. It only reads the
registry and invokes a root-owned script. This is a pull-based deployment: the
VPS decides when to update, and CI cannot push into it.

#### 9A.5 The deploy script

`deploy.sh` is idempotent and root-owned. Its job:

1. Validate the requested tag is a full SHA.
2. Pull the immutable image.
3. Validate the resolved Compose file (image, one replica, bind mount, no
   privileged mode, no host network, expected ports).
4. Validate the Caddyfile.
5. Write the new Compose/Caddy files atomically.
6. Replace only the app container, preserving the data directory.
7. Wait for `/readyz`.
8. Reload Caddy.
9. If readiness fails, roll back to the previous image and reload Caddy.
10. Leave the previous image available for rollback.

The data directory is never recreated. `docker compose down -v` is forbidden.
The Compose guard rejects a resolved config that would create or remove the
wrong volume.

#### 9A.6 Compose details

The production Compose file:

- names the project `chess`;
- runs the app with `restart: unless-stopped`, `init: true`, a 45 s stop grace
  period;
- sets `OCAML_OMCB_DATA_DIR=/var/lib/sim-map/data` and the legacy `SIM_MAP_*`
  variables;
- sets adaptive commit, WAL group 64, WAL sync on, snapshot every 100k moves or
  600 s;
- sets `CONNECTION_OUTBOX_CAPACITY=256`, event batching on, 1 ms window;
- binds `/srv/chess/data` to the container data path;
- exposes 8080 only on the Docker network;
- health-checks `/readyz` every 30 s with a 60 s start period;
- raises the file descriptor limit to 65,536;
- drops all capabilities and sets `no-new-privileges`;
- caps logs at 20 MiB × 5 files.

Caddy:

- obtains and renews Let's Encrypt certificates;
- compresses with zstd/gzip;
- sets HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy`;
- blocks internal diagnostics (`/state-hash`, `/debug/*`) from the internet;
- sets `no-cache` on the shell, `/status`, `/active.json`, `/tally.json` and the
  stable client entrypoint;
- sets `immutable` one-year caching on content-addressed WASM chunks;
- reverse-proxies to `app:8080`, including WebSocket upgrades.

The cache policy is important for deploys: the HTML shell and the stable
`main.bc.wasm.js` are revalidated, while the hashed WASM chunks can be cached
forever. A deploy therefore switches client and server together instead of
serving an old client against a new server.

#### 9A.7 Data lifecycle

The authoritative data is:

- WAL segments: one record per accepted move, fsynced by group;
- snapshots: complete world images at a sequence;
- no other mutable state.

Backup:

1. Trigger or wait for a snapshot.
2. Copy the snapshot and the WAL segments up to its sequence.
3. Verify the snapshot checksum and the WAL chain.
4. Store off-host.

Recovery:

1. Start the container with the data directory.
2. Load the newest valid snapshot.
3. Replay WAL records after it.
4. If the last record is torn, truncate it.
5. Serve `/readyz` only after recovery and verification.

Disk space:

- 500k moves ≈ 41 MiB WAL;
- 2M moves ≈ 166 MiB WAL;
- one snapshot ≈ 528 MiB;
- a data directory with a snapshot and a few WAL segments is ~600 MiB.

A snapshot every 100k moves bounds the WAL between snapshots. Old snapshots and
rotated WAL segments are removed after a successful snapshot.

#### 9A.8 Observability

| Endpoint | Use |
|---|---|
| `/healthz` | process alive, sequence |
| `/readyz` | recovery complete, ready for traffic |
| `/metrics` | JSON: stages, counters, worker, connections, persistence, memory, adaptive, board load, kings |
| `/metrics.prom` | Prometheus text exposition |
| `/state-hash` | internal only: sequence + checksum |
| `/debug/gc` | internal only, opt-in |
| `/debug/memprof` | internal only, opt-in |

The hourly email report fetches `/metrics`, compares with the previous run, and
flags:

- request/move/event counters not advancing;
- rejected requests;
- outbox drops or send failures;
- board-load failures;
- sequence not advancing;
- WAL/snapshot anomalies;
- RSS/fd changes.

The report state is advanced only after a successful send, so a failed email is
covered by the next one instead of creating a silent gap.

#### 9A.9 Runbook

**Deploy a new commit**

1. Push to `main`.
2. Watch the GitHub Actions run.
3. Wait for the pull timer (up to 5 minutes) or trigger the service manually.
4. Check `/readyz` and the client version in the HTML.
5. Verify a move in the browser.

**Roll back**

1. Run `deploy.sh --tag <previous-sha>`.
2. The script pulls the old image, replaces the app container, waits for
   `/readyz`, and reloads Caddy.
3. The data directory is unchanged; the old image must be able to read the
   current WAL/snapshot format.

**Recovery after a crash**

1. The container restarts automatically (`restart: unless-stopped`).
2. Recovery loads the snapshot and replays the WAL.
3. `/readyz` returns only after verification.
4. If recovery fails, do not delete the data directory. Inspect the logs,
   checksum the snapshot, and restore the last known-good backup.

**Disk full**

1. The WAL append or fsync fails.
2. The server fails closed rather than acknowledging a lost move.
3. Free space, or restore to a larger volume.
4. Restart and verify `/readyz` and the sequence.

**Certificate renewal**

Caddy handles ACME automatically. Ports 80/443 must remain reachable. Monitor
the Caddy logs for renewal failures.

#### 9A.10 Security posture

- No inbound app port; only Caddy is exposed.
- TLS with HSTS.
- Container drops all capabilities and sets `no-new-privileges`.
- The runtime image is a slim Debian image running as a non-root UID. It
  contains only the runtime dependencies, not the OCaml toolchain or build
  artifacts, so a compromised process has less to work with.
- The pull agent runs as root but has no network listener and only invokes a
  fixed root-owned script.
- The image is pinned by SHA; `latest` is only a discovery tag.
- The pull agent verifies the repository and source labels, so a different
  image cannot be substituted by editing the env file.
- The app validates every request length and field; it does not parse untrusted
  JSON on the move path.
- The client cannot mutate the board directly; every move is validated.

#### 9A.11 Why this deployment model fits the system

The system is a single-writer state machine with a durable log. That shape is
easier to run as one authoritative container than as a replicated cluster:

- no distributed consensus;
- no split-brain writes;
- no cross-node sequence coordination;
- one data directory, one WAL, one recovery path;
- a simple rollback: replace the image, keep the data.

The cost is vertical scaling: one host, one writer, one fsync stream. The
measurements show this is enough for the current load (12k durable moves/s,
1,020 connected clients at sub-200 ms p50). When that is no longer enough, the
next step is not "add replicas"; it is the sharding/dependency work in Chapter
8, because replicas would reintroduce the conflict problem this design avoids.

---

## Closing note

The through-line from Part I to Part II is the same: make the common operation
small, make the invariants explicit, and measure the boundary.

A move is one packed word copied between two squares, one 16-byte ledger event,
and one WAL record. That is why the engine is 202 ns. The system is slower than
that because durability, fan-out and the browser are real costs. The useful
engineering is not pretending those costs away; it is measuring them, grouping
what can be grouped, batching what can be batched, and keeping the failure
modes obvious.

The largest remaining wins are not in the chess code. They are in snapshot
isolation, durable-write batching, event bandwidth, and the concurrency model
that will eventually replace the single writer.
