(** Decaying recent-move heat map for choosing a starting view and for the
    live world minimap. *)

type t

type hotspot = { x : int; y : int; weight : float }

type move = { x : int; y : int; at : float }

val create : unit -> t

val note : t -> bx:int -> by:int -> now:float -> unit
(** Record one move destination at time [now] (Unix seconds). *)

val suggest : t -> now:float -> hotspot option
(** The strongest region still above the activity threshold, or [None]. *)

val recent : t -> now:float -> move list
(** Moves from the last five minutes, newest first, capped at 200. *)
