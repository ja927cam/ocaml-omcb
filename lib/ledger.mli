(** Bounded, append-only circular buffer of accepted moves. *)

type position = int32
type packed_move = int64
type int16 = Int16.t

type move_event = {
  move : packed_move;
  moved_piece_id : int32;
  captured_piece_id : int32;
  flags : int16;
}

type t

val create_ledger : ?next_seq:int64 -> int -> t
(** [create_ledger ~next_seq capacity] allocates a ledger whose first event
    will have sequence [next_seq] (default [0L]). [capacity] must be a
    positive power of two. *)

val create : int -> t
val capacity : t -> int
val latest_seq : t -> int64
(** The sequence number that the next append will return. *)

val oldest_seq : t -> int64
(** The oldest retained sequence number, or the next sequence when empty. *)

val contains : t -> int64 -> bool

val pack_position : int -> int -> position
(** Pack a 20-bit board ID and 6-bit square ID. *)

val unpack_position : position -> int * int
val pack_move : position -> position -> packed_move
val unpack_move : packed_move -> position * position
val pack_metadata : int32 -> int32 -> int -> int64
val unpack_metadata : int64 -> int32 * int32 * int

val append : t -> packed_move -> int32 -> int32 -> int -> int64
(** [append ledger move moved_id captured_id flags] returns the event's
    sequence number. @raise Invalid_argument if a field does not fit its bit
    width. *)

val get_event : t -> int64 -> move_event option
val get_range : t -> int64 -> int64 -> move_event array option
val clear : t -> unit
