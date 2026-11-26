(** Decaying recent-move heat map for choosing a starting view. *)

type t

type hotspot = { x : int; y : int; weight : float }

val create : unit -> t

val note : t -> bx:int -> by:int -> now:float -> unit
(** Record one move destination at time [now] (Unix seconds). *)

val suggest : t -> now:float -> hotspot option
(** The strongest region still above the activity threshold, or [None]. *)
