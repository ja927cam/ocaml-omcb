(** Cumulative captured-king tally derived from the bounded move ledger. *)

type t

val create : unit -> t

val note_capture : t -> int32 -> unit
(** [note_capture t id] counts the captured piece ID when it was a king.
    Empty IDs ([0l]) are ignored. *)

val scan_ledger : t -> Ledger.t -> unit
(** Add every king capture still retained in [ledger]. *)

val white : t -> int
(** Number of white kings captured. *)

val black : t -> int
(** Number of black kings captured. *)

val json : t -> Yojson.Safe.t
