(** Server-side board snapshot load metrics grouped by 100 x 100 world regions. *)

type t

type summary = {
  samples : int;
  requests : int64;
  boards : int64;
  failures : int64;
  p50_ms : float;
  p95_ms : float;
  max_ms : float;
  mean_ms : float;
  last_ms : float;
  last_boards : int;
}

val create : unit -> t

val record :
  t ->
  region_x:int ->
  region_y:int ->
  boards:int ->
  elapsed_ms:float ->
  success:bool ->
  unit

val summary_json : summary -> Yojson.Safe.t
val json : t -> Yojson.Safe.t

val overall : t -> summary
val region : t -> x:int -> y:int -> summary
val region_count : int
val region_size : int
val iter_regions : t -> (int -> int -> summary -> unit) -> unit
