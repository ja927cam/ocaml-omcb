(** A dense 1000 x 1000 grid of 8 x 8 chessboards.

    The whole world is one flat Bigarray of 64,000,000 packed {!Piece.t}
    values (512,000,000 bytes). The array is private; all access goes through
    this interface. *)

type t

type board_pos = {
  board_x : int;  (** 0..999 *)
  board_y : int;  (** 0..999, increasing from top to bottom *)
}

type square_pos = {
  x : int;  (** 0..7, left to right *)
  y : int;  (** 0..7, top to bottom; y = 0 is rank 8 *)
}

type position = {
  board : board_pos;
  square : square_pos;
}

val create : unit -> t
(** Allocate the world with every square empty. *)

val dimensions : int * int
(** [dimensions] is [(1000, 1000)]. *)

val board_id : board_pos -> int
(** [board_id p] is [p.board_y * 1000 + p.board_x].
    @raise Invalid_argument if the coordinates are out of range. *)

val index : position -> int
(** [index p] is the world index in [0; 63_999_999].
    @raise Invalid_argument if any coordinate is out of range. *)

val in_bounds : position -> bool
(** [in_bounds p] is [true] iff [p] is a valid world position. *)

val world_x : position -> int
(** [world_x p] is the absolute x coordinate in [0; 7999]. *)

val world_y : position -> int
(** [world_y p] is the absolute y coordinate in [0; 7999]. *)

val position_of_world : x:int -> y:int -> position
(** Convert absolute world coordinates back to a board/square position.
    @raise Invalid_argument if [x] or [y] is outside [0; 7999]. *)

val get_world : t -> x:int -> y:int -> Piece.t
(** [get_world t ~x ~y] reads an absolute world square without constructing a
    position record. @raise Invalid_argument outside [0; 7999]. *)

val get : t -> position -> Piece.t
(** [get t p] is the packed piece at [p], or {!Piece.empty}.
    @raise Invalid_argument if [p] is out of range. *)

val set : t -> position -> Piece.t -> unit
(** [set t p piece] replaces the contents of [p].
    @raise Invalid_argument if [p] is out of range. *)

val clear : t -> position -> unit
(** [clear t p] empties [p].
    @raise Invalid_argument if [p] is out of range. *)

val get_board : t -> board_pos -> Piece.t array
(** [get_board t p] is a copy of the 64 squares of board [p].
    @raise Invalid_argument if [p] is out of range. *)

val set_board : t -> board_pos -> Piece.t array -> unit
(** [set_board t p pieces] replaces the 64 squares of board [p].
    @raise Invalid_argument if [p] is out of range or [pieces] does not have
    exactly 64 elements. *)

val clear_board : t -> board_pos -> unit
(** [clear_board t p] empties all 64 squares of board [p].
    @raise Invalid_argument if [p] is out of range. *)

val clear_all : t -> unit
(** Empty the entire world. *)

val raw_words :
  t -> (int64, Bigarray.int64_elt, Bigarray.c_layout) Bigarray.Array1.t
(** [raw_words t] is the backing array of 64-bit pieces.

    This is an escape hatch for persistence: callers must only read it, or
    overwrite it while reconstructing a recovered world. Mutating it behind
    {!Board}'s back otherwise breaks the abstraction and the occupied-count
    guarantees. *)

val iter_board : t -> board_pos -> (square_pos -> Piece.t -> unit) -> unit
(** [iter_board t p f] visits all 64 squares of board [p] in row-major order.
    Empty squares are included. @raise Invalid_argument if [p] is out of
    range. *)

val iter : t -> (position -> Piece.t -> unit) -> unit
(** [iter t f] visits every occupied square in the world. Empty squares are
    not passed to [f]. *)

val occupied_count : t -> int
(** [occupied_count t] is the number of non-empty squares in the world. *)

val copy : t -> t
(** [copy t] is an independent copy of the world. *)

val initialise_standard_position : ?clear:bool -> t -> board_pos -> unit
(** Put the standard starting position on one board. [clear] defaults to
    [true]; pass [~clear:false] only when the board is known to be empty.
    Piece IDs are assigned as [board_id * 32 + slot], with slot [1..32], so
    they are unique across the whole world.
    @raise Invalid_argument if [p] is out of range. *)

val print_board : t -> board_pos -> unit
(** Print the board as 8 lines. White pieces are uppercase, black pieces
    lowercase, and empty squares are ['.']. @raise Invalid_argument if [p] is
    out of range. *)
