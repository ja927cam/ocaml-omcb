type t = int64

type piece_type =
  | Pawn
  | Knight
  | Bishop
  | Rook
  | Queen
  | King
  | Promoted_pawn

val empty : t
(** [empty] is the zero value used for an empty square. *)

val is_empty : t -> bool
(** [is_empty p] is [true] iff [p] is {!empty}. *)

val max_id : int32
(** [max_id] is the largest valid piece ID (2^25 - 1). *)

val create : id:int32 -> piece_type:piece_type -> is_white:bool -> t
(** [create ~id ~piece_type ~is_white] packs a piece.
    @raise Invalid_argument if [id] is zero, negative, or greater than
    {!max_id}. *)

val id : t -> int32
(** [id p] is the piece's ID ([0] for {!empty}). *)

val piece_type : t -> piece_type
(** [piece_type p] is the piece's type.
    @raise Invalid_argument if [p] is empty or has an invalid type field. *)

val is_white : t -> bool

val just_double_moved : t -> bool
val king_killer : t -> bool
val king_pawner : t -> bool
val queen_killer : t -> bool
val queen_pawner : t -> bool
val adopted_killer : t -> bool
val has_captured_other_type : t -> bool
val adopted : t -> bool

val move_count : t -> int
val capture_count : t -> int

val with_just_double_moved : t -> bool -> t
val with_king_killer : t -> bool -> t
val with_king_pawner : t -> bool -> t
val with_queen_killer : t -> bool -> t
val with_queen_pawner : t -> bool -> t
val with_adopted_killer : t -> bool -> t
val with_has_captured_other_type : t -> bool -> t
val with_adopted : t -> bool -> t
(** All update functions require a non-empty piece and preserve every other
    field. @raise Invalid_argument if the piece is empty. *)

val increment_move_count : t -> t
val increment_capture_count : t -> t
(** Increment the counter, saturating at 4095.
    @raise Invalid_argument if the piece is empty. *)

val promote : t -> piece_type -> t
(** Change the piece type, preserving ID, colour and all metadata.
    @raise Invalid_argument if the piece is empty. *)

val to_string : t -> string
val pp : Format.formatter -> t -> unit
