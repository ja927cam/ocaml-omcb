(** Single-owner serialised execution around {!Game_state}.

    This implementation uses one Lwt task as the owner. All transactions run
    synchronously without yielding, and no network work happens inside the
    transaction. After {!start}, callers must not touch the original
    [Game_state.t]. *)

type config = { queue_capacity : int }

type commit_policy = {
  max_batch : int;
  max_delay_s : float;
}

type submit_error =
  | Queue_full
  | Worker_stopped
  | Worker_failed
  | Invalid_request

type snapshot = {
  board : Piece.t array;
  revision : int64;
}

type piece_info = {
  board_x : int;
  board_y : int;
  square : int;
  revision : int64;
  piece : Piece.t;
}

type snapshot_batch = {
  x0 : int;
  y0 : int;
  width : int;
  height : int;
  boards : (int64 * Bytes.t) array;
}

type event_board = {
  board_x : int;
  board_y : int;
  revision : int64;
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
  move_queue_depth : int;
  requests_processed : int64;
  moves_processed : int64;
  moves_submitted : int64;
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
  ?on_commit:(committed -> unit) ->
  ?precommit:(Game_state.t -> Move_engine.commit -> unit) ->
  ?on_snapshot:(Game_state.t -> unit) ->
  ?commit_policy:(unit -> commit_policy) ->
  ?commit_group:(int -> unit) ->
  ?on_fatal:(exn -> unit) ->
  config:config ->
  Game_state.t ->
  t
(** Transfer ownership of [state] to the worker and start the processing
    task. [on_commit] runs synchronously after a successful move commit and
    must only enqueue work (no I/O or yielding). It receives the committed
    sequence, request ID, affected boards, their new revisions and changed
    squares.

    [precommit] runs synchronously inside a move after validation and before
    the first board write. It appends the transition to the WAL; raising
    aborts the move and stops the worker. [commit_policy] is queried for each
    group; it returns the maximum batch and an optional formation delay.
    [commit_group] runs after the batch has been applied; it must make those
    transitions durable before returning. The worker publishes the responses
    and broadcasts only after it returns. [on_snapshot] runs synchronously
    when a world-snapshot request reaches the front of the queue. It may copy
    the world but must not perform lengthy disk I/O.

    @raise Invalid_argument if [queue_capacity] is not positive. *)

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

val submit_snapshot_batch :
  ?timing:Metrics.move_timing ->
  t ->
  x0:int ->
  y0:int ->
  x1:int ->
  y1:int ->
  (snapshot_batch, submit_error) result Lwt.t
(** Snapshot every board in an inclusive rectangle in one worker turn. Each
    board is returned as its revision and 64 client piece bytes. The area is
    capped by {!Protocol.Types.snapshot_batch_area_limit}; invalid or
    oversized regions return [Invalid_request]. *)

val submit_piece_info :
  ?timing:Metrics.move_timing ->
  t ->
  board_x:int ->
  board_y:int ->
  square:int ->
  (piece_info, submit_error) result Lwt.t
(** Read one square through the worker queue. The reply carries the board
    revision and the full packed piece, or [Piece.empty] for an empty square.
    Invalid coordinates or a square outside [0; 63] return [Invalid_request]. *)

val request_snapshot : t -> (unit, submit_error) result Lwt.t
(** Queue a consistent world-snapshot boundary. Resolves after [on_snapshot]
    has run (or after the request is refused). *)

val stop : t -> unit Lwt.t
(** Stop accepting new requests, finish queued requests, then resolve. *)

val metrics : t -> metrics
