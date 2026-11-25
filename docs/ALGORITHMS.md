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
(5 subscribe/unsubscribe, 6 cache window, 14 move, 9 snapshot). Every server
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
  subscribe/unsubscribe messages adjust one board.
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

`SIM_MAP_FAULT` and `SIM_MAP_FAULT_AFTER` are test-only one-shot I/O fault
hooks in `lib/persistence.ml`. They cover WAL append/partial append, WAL fsync,
WAL rotation, snapshot write, snapshot fsync, snapshot rename and snapshot
directory fsync. They raise ordinary exceptions so the worker follows its
normal failure path; `SIM_MAP_CRASH_POINT` remains the separate hard-kill path.
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

- **Strict** (`SIM_MAP_ADAPTIVE=0`, `SIM_MAP_WAL_GROUP=1`): append → fsync →
  apply → publish.
- **Adaptive** (default): a bounded controller chooses the batch ceiling and
  formation delay; every group still fsyncs before publishing.
- **Group** (fallback, `SIM_MAP_ADAPTIVE=0`, 64): take up to 64 consecutive
  moves, validate, append and apply them in order, fsync once, then publish
  the whole group. The in-memory apply is tentative until the fsync; a failure
  fail-stops without publishing. Snapshot requests are non-move items and
  force a flush first, so no client read can observe an uncommitted group.
- **No fsync** (`SIM_MAP_WAL_SYNC=0`): append and publish without fsync;
  process crashes survive in the page cache, power loss can lose recent acks.

The group experiment (`bench/group_commit_experiment.js`,
`bench/group_commit_report.html`) sweeps 1/8/16/32/64/128/256/no-sync across
write-only and fan-out stress and verifies every move response, event and final
board state.

### Adaptive group commit

`SIM_MAP_ADAPTIVE=1` (the default) replaces the fixed batch ceiling with a
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
run (`SIM_MAP_SNAPSHOT_MOVES=3000`), so snapshot writes also overlap the heavy
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
the fixed fallback (`SIM_MAP_ADAPTIVE=0`) and remains a good latency/throughput
balance when a predictable policy is preferable to the controller.

### Fault injection and tests

`SIM_MAP_CRASH_POINT` injects a SIGKILL at a named point: `wal-before-write`,
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
- All 12 piece sprites are rendered once into a 6 x 2 atlas at 256 x 256 per
  cell. Glyphs are centred from their measured bounding boxes, filled with
  high-contrast outlines and drawn with high-quality image smoothing, so they
  stay crisp at the maximum zoom. A redraw is one tile blit per visible board
  plus at most 64 sprite blits per loaded board.

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
  responses are ignored. A failed snapshot leaves the board unloaded, marks it
  stale and retries. The response carries the `int64` revision at copy time.
- The client sends one subscription-window message whenever its rounded cache
  centre changes. The server window is exactly the retained 25 x 25 set.
- Snapshot loading is single-flight. The centre board is queued first during a
  window rebuild. A 250 ms watchdog reconciles `pending_snapshots` against the
  board table, drops orphan request IDs, and retries a pending board after a
  per-board backoff: 500 ms for the first retry, doubling to 4 s. A successful
  snapshot resets the backoff.
- A retry does not discard a delayed response. A snapshot response is applied
  when it matches the current request, or when it is an older request for a
  board that is still unloaded and not resyncing. Revisions are ordered per
  board, so the older snapshot cannot roll back newer data; the
  current-request rule still protects loaded boards and resyncs.
- Why the older-response rule matters: in headless Chromium a WebSocket
  message is occasionally not dispatched to the page for two to three seconds,
  until the page sends another frame. Raw Node clients and the server do not
  show this delay, and the page's timers and animation frames keep running.
  Without the rule, the watchdog retry supersedes the stalled response, the
  stalled response is then ignored, and the board stays unloaded forever.
  This was the intermittent cache-eviction failure.
- Moves use the same liveness idea. Receiving the client's own broadcast event
  is authoritative (the server broadcasts only accepted moves), so it clears
  the optimistic lock immediately, even if the direct move response is
  delayed. While a move is pending, a probe snapshot request for the centre
  board is sent every 250 ms; this releases a deferred message. If neither the
  response nor the event arrives within 2 s, the optimistic move is rolled
  back so the board does not stay locked.
- The browser integration test selects a pristine 5 x 5 block by querying
  snapshots directly. Every board must have revision 0, a white pawn on e2 and
  an empty e4, so persisted moves from earlier test runs cannot invalidate the
  assumptions. An overall deadline turns a stalled CDP/browser session into a
  failure instead of a hang.
- The client tracks an `int64` revision per cached board. An event at the next
  revision applies; an equal or older revision is ignored as duplicate/stale;
  a skipped revision marks the board stale and unavailable for local moves, and
  queues a fresh snapshot. The server has already buffered events for a pending
  snapshot, so events newer than the snapshot arrive after it in revision
  order. The event matching a pending move sets an `event_applied` flag, so the
  move response does not repeat castling/en-passant/promotion.
- Each loaded board stores 64 one-byte pieces plus a small record, so a full
  625-board cache is roughly 50 KiB. Decoding a byte to a glyph at draw time is
  a handful of bit operations.

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
