(** Authoritative game state.

    Owns the dense board, the bounded event ledger and the global sequence.
    Only the state worker may mutate it after startup. *)

type t

val create : unit -> t
(** Allocate the complete board and ledger. The world is empty and the
    sequence is zero. *)

val initialise : t -> unit
(** Populate all one million boards with the standard starting position.
    Piece IDs are [board_id * 32 + slot + 1]. The sequence stays zero and the
    ledger remains empty. *)

val board_count : int
(** [board_count] is [1_000_000]. *)

val ledger_capacity : int
(** [ledger_capacity] is the fixed size of the bounded move ledger. *)

val reset : t -> unit
(** Empty the world, clear every board revision, empty the ledger and reset
    the sequence to zero. Used before reconstructing a recovered world. *)

val copy_board : t -> Board.t
(** An independent copy of the full board. Persistence uses this to take a
    consistent snapshot without sharing mutable state with the worker. *)

val raw_board :
  t -> (int64, Bigarray.int64_elt, Bigarray.c_layout) Bigarray.Array1.t
(** Backing array of 64,000,000 packed pieces. Persistence-only escape hatch:
    callers must not mutate it except while loading a snapshot. *)

val raw_revisions :
  t -> (int64, Bigarray.int64_elt, Bigarray.c_layout) Bigarray.Array1.t
(** Backing array of per-board revisions. Persistence-only escape hatch. *)

val raw_ledger_moves :
  t -> (int64, Bigarray.int64_elt, Bigarray.c_layout) Bigarray.Array1.t
(** Backing array of packed ledger moves. Persistence-only escape hatch. *)

val raw_ledger_metadata :
  t -> (int64, Bigarray.int64_elt, Bigarray.c_layout) Bigarray.Array1.t
(** Backing array of packed ledger metadata. Persistence-only escape hatch. *)

val ledger_head : t -> int64
(** Sequence number that the next ledger append will use. *)

val ledger_oldest : t -> int64
(** Oldest retained ledger sequence. *)

val restore_sequence : t -> int64 -> unit
(** Set the global sequence directly. Only snapshot recovery should use this;
    normal commits go through {!with_state}. *)

val restore_ledger_bounds : t -> head:int64 -> oldest:int64 -> unit
(** Restore the bounded ledger window from a snapshot. *)

val mark_initialised : t -> unit
(** Mark the world as containing the standard initial position. *)

val next_board_revision : t -> board_x:int -> board_y:int -> int64
(** The revision a commit touching this board would install. Saturates at
    [Int64.max_int]. *)

type recovered_board = {
  board_x : int;
  board_y : int;
  revision : int64;
  changes : (int * Piece.t) list;
  (** Final square values; cleared squares are {!Piece.empty}. *)
}

val replay_transition :
  t ->
  sequence:int64 ->
  boards:recovered_board list ->
  ledger_move:int64 ->
  ledger_moved_id:int32 ->
  ledger_captured_id:int32 ->
  ledger_flags:int ->
  unit
(** Apply one committed transition from the WAL without consulting the move
    rules. Validates that [sequence] is exactly the next sequence, that board
    revisions only move forward, and that the ledger append returns the same
    sequence.
    @raise Invalid_argument or [Failure] if the record is inconsistent. *)

val sequence : t -> int64
(** Last committed event sequence (zero before any move). *)

val occupied_count : t -> int
(** Number of occupied squares, for startup verification and tests. *)

val board_revision : t -> board_x:int -> board_y:int -> int64
(** Monotonic per-board revision. It increases once for every committed move
    that touches the board. *)

val bump_board_revision : t -> board_x:int -> board_y:int -> int64
(** Increment and return the board revision. Only the state worker should call
    this after a committed move. *)

val snapshot_board : t -> board_x:int -> board_y:int -> Piece.t array
(** Return a 64-element copy of one board in row-major order. Empty squares are
    {!Piece.empty}. The board, ledger and sequence are unchanged.
    @raise Invalid_argument if either coordinate is outside [0; 999]. *)

val snapshot_board_with_revision :
  t -> board_x:int -> board_y:int -> Piece.t array * int64
(** Snapshot plus the board revision at the same instant. *)

val with_state :
  t ->
  (board:Board.t ->
   ledger:Ledger.t ->
   sequence:int64 ->
   int64 * 'a) ->
  'a
(** Internal transaction interface: provides the board/ledger and the current
    sequence, and commits the returned sequence afterwards. Only the move
    engine and test setup should use this. *)

val with_board : t -> (Board.t -> 'a) -> 'a
(** Internal read-only view of the authoritative board. The callback must not
    yield or mutate the board. Used by the state worker to choose a simulated
    move atomically with the move that follows it. *)
