(** Single-owner serialised execution around {!Game_state}.

    This implementation uses one Lwt task as the owner. All transactions run
    synchronously without yielding, and no network work happens inside the
    transaction. After {!start}, callers must not touch the original
    [Game_state.t]. *)

type config = { queue_capacity : int }

type submit_error =
  | Queue_full
  | Worker_stopped
  | Worker_failed

type metrics = {
  queue_depth : int;
  queue_capacity : int;
  requests_processed : int64;
  requests_rejected : int64;
  total_processing_time_ns : int64;
  max_processing_time_ns : int64;
  total_queue_wait_ns : int64;
  max_queue_wait_ns : int64;
}

type t

val default_config : config
(** [queue_capacity = 4096]. *)

val start : config:config -> Game_state.t -> t
(** Transfer ownership of [state] to the worker and start the processing
    task. @raise Invalid_argument if [queue_capacity] is not positive. *)

val submit :
  t -> Move_request.t -> (Move_engine.result, submit_error) result Lwt.t
(** Resolves after the request has been processed, not merely queued. *)

val stop : t -> unit Lwt.t
(** Stop accepting new requests, finish queued requests, then resolve. *)

val metrics : t -> metrics
