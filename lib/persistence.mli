(** Durable write-ahead log and full-world snapshots.

    The state worker appends one record per accepted move *before* applying it
    to memory. A record contains the complete transition (final square values,
    resulting board revisions and ledger metadata), so recovery never depends
    on the move rules. Periodic snapshots bound WAL size; snapshots are written
    to a temporary file, fsynced, renamed into place and the directory fsynced
    before any WAL segment they cover is removed.

    Recovery starts from the newest valid snapshot (or the deterministic initial
    world) and replays WAL records in sequence order. A torn trailing record is
    ignored and truncated; anything else that fails validation is an error. *)

type config = {
  data_dir : string;
  sync : bool;
  (** [sync] fsyncs the WAL after every accepted transition. *)
  snapshot_every_moves : int;
  (** Request a snapshot after this many commits. [0] disables the move
      trigger. *)
  snapshot_every_seconds : float;
  (** Request a snapshot after this many seconds. [0] disables the timer
      trigger. *)
}

val default_config : data_dir:string -> config

type recovery = {
  snapshot_sequence : int64 option;
  replayed_transitions : int;
  truncated_wal : bool;
  initialised_world : bool;
  duration_ms : float;
}

type t

val recover : config -> Game_state.t -> (t * recovery, string) result
(** Reconstruct [state] and prepare a fresh WAL segment for the next commit.
    On failure the caller must not serve the state. *)

val before_commit : t -> Game_state.t -> Move_engine.commit -> unit
(** Append and make the transition durable. Must be called from the worker
    before applying the move. A raised exception means the move was not
    applied and the worker must stop. *)

val note_commit : t -> unit
(** Record one committed move for the snapshot policy. *)

val move_snapshot_due : t -> bool
(** [true] if the move-count trigger has elapsed and no snapshot is pending. *)

val time_snapshot_due : t -> bool
(** [true] if the time trigger has elapsed and no snapshot is pending. *)

val request_started : t -> unit
(** Mark a snapshot request as in flight before enqueueing it on the worker. *)

val request_failed : t -> unit
(** Clear the in-flight marker if the worker refused the request. *)

val capture : t -> Game_state.t -> unit
(** Called by the worker at a snapshot boundary. This rotates the WAL and
    copies the world, then starts the atomic snapshot write on a preemptive
    thread. It does not block on the snapshot's disk I/O. *)

val wait_for_snapshot : t -> unit Lwt.t
(** Resolve when no snapshot write is in progress. *)

val last_sequence : t -> int64

val state_digest : Game_state.t -> string
(** Stable hexadecimal FNV-1a 64 digest over the board, revisions, sequence
    and bounded ledger. Intended for recovery tests and diagnostics. *)

val metrics_json : t -> Yojson.Safe.t

val close : t -> unit
(** Close the active WAL descriptor. *)
