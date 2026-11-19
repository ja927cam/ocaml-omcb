(** A chess move inside the application, independent of its wire encoding.

    Serialisation remains in {!Protocol.Types}; this type only carries the
    source and destination squares. *)

type t = {
  src : Board.position;
  dst : Board.position;
}

val create : src:Board.position -> dst:Board.position -> t
(** [create ~src ~dst] is a move from [src] to [dst]. *)

val to_string : t -> string
(** Human-readable representation, primarily for debugging. *)
