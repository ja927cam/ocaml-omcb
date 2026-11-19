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

val board : t -> Board.t
(** The board. Internal: only the state worker should use this after startup. *)

val ledger : t -> Ledger.t
(** The ledger. Internal: only the state worker should use this. *)

val sequence : t -> int64
(** Last committed event sequence (zero before any move). *)

val set_sequence : t -> int64 -> unit
(** Internal: advance the committed sequence. *)

val occupied_count : t -> int
(** Number of occupied squares, for startup verification and tests. *)
