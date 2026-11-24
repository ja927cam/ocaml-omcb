(** Bounded adaptive group-commit controller.

    The controller observes workload signals and chooses a maximum WAL commit
    batch and a maximum group-formation delay. It never participates in move
    validation, ordering, application or durability: the state worker still
    fsyncs every committed group before publishing any response or event. *)

type metrics = {
  move_rate : float;
  (** Move arrivals per second, measured at queue admission. *)
  pending_moves : int;
  (** Move items currently waiting in the worker queue. *)
  fsync_p50_us : float;
  fsync_p95_us : float;
  broadcast_backlog : int;
  (** Total queued client outbox frames. Committed events still waiting for
      their fan-out are excluded on purpose: a write-only workload can fill
      that queue briefly without any client delivery falling behind. *)
  event_lag_p95_ms : float;
  recipients_per_event : float;
  (** Recent average number of clients receiving each broadcast event. A
      high lag with only a few recipients is load, not fan-out pressure. *)
  snapshot_active : bool;
}

type policy = {
  max_batch_size : int;
  max_batch_delay_us : int;
}

type classification =
  | Quiet
  | Moderate
  | Heavy
  | Storage_bound
  | Broadcast_bound
  | Snapshot_active

type config = {
  min_batch_size : int;
  max_batch_size : int;
  min_delay_us : int;
  max_delay_us : int;
  hysteresis_samples : int;
  (** Consecutive samples required before increasing the batch. Decreases use
      at most two samples. *)
  smoothing : float;
  (** Exponential moving-average weight for the observed signals. *)
}

val default_config : config

type t

val create : ?config:config -> unit -> t
(** Initial policy: batch 16, delay 1 ms, clamped to the configured limits. *)

val sample : t -> metrics -> policy
(** Fold one 100-250 ms observation into the controller and return the current
    policy. *)

val policy : t -> policy

type state = {
  policy : policy;
  classification : classification;
  samples : int;
  changes : int;
  move_rate : float;
  pending_moves : int;
  fsync_p50_us : float;
  fsync_p95_us : float;
  broadcast_backlog : float;
  event_lag_p95_ms : float;
  recipients_per_event : float;
  snapshot_active : bool;
}

val state : t -> state

val classification_name : classification -> string
