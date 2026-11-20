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

val sequence : t -> int64
(** Last committed event sequence (zero before any move). *)

val occupied_count : t -> int
(** Number of occupied squares, for startup verification and tests. *)

val snapshot_board : t -> board_x:int -> board_y:int -> Piece.t array
(** Return a 64-element copy of one board in row-major order. Empty squares are
    {!Piece.empty}. The board, ledger and sequence are unchanged.
    @raise Invalid_argument if either coordinate is outside [0; 999]. *)

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
