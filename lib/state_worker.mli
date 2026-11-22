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
  | Invalid_request

type snapshot = {
  board : Piece.t array;
  revision : int32;
}

type event_board = {
  board_x : int;
  board_y : int;
  revision : int32;
  changes : (int * Piece.t) list;
}

type committed = {
  sequence : int64;
  request_id : int32;
  boards : event_board list;
  timing : Metrics.move_timing option;
}

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

val start :
  ?on_commit:(committed -> unit) -> config:config -> Game_state.t -> t
(** Transfer ownership of [state] to the worker and start the processing
    task. [on_commit] runs synchronously after a successful move commit and
    must only enqueue work (no I/O or yielding). It receives the committed
    sequence, request ID, affected boards, their new revisions and changed
    squares. @raise Invalid_argument if [queue_capacity] is not positive. *)

val submit :
  ?timing:Metrics.move_timing ->
  t ->
  Move_request.t ->
  (Move_engine.result, submit_error) result Lwt.t
(** Resolves after the move has been processed, not merely queued. [timing]
    is the optional per-move pipeline context; when supplied, the worker
    records queue-wait and processing stages into {!Metrics}. *)

val submit_snapshot :
  ?timing:Metrics.move_timing ->
  t ->
  board_x:int ->
  board_y:int ->
  (snapshot, submit_error) result Lwt.t
(** Snapshot a board through the same FIFO queue. Returns a 64-element copy in
    row-major order plus the board revision. Invalid coordinates return
    [Invalid_request]. *)

val stop : t -> unit Lwt.t
(** Stop accepting new requests, finish queued requests, then resolve. *)

val metrics : t -> metrics
