open Lwt.Infix

type config = { queue_capacity : int }

type submit_error =
  | Queue_full
  | Worker_stopped
  | Worker_failed
  | Invalid_request

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

type request =
  | Move of Move_request.t
  | Snapshot of { board_x : int; board_y : int }

type response =
  | Move_result of Move_engine.result
  | Snapshot_result of Piece.t array

type item = {
  request : request;
  promise : (response, submit_error) result Lwt.u;
  enqueued_ns : int64;
}

type t = {
  state : Game_state.t;
  settings : config;
  queue : item Queue.t;
  condition : unit Lwt_condition.t;
  mutable accepting : bool;
  mutable failed : bool;
  mutable notification_pending : bool;
  mutable depth : int;
  mutable requests_processed : int64;
  mutable requests_rejected : int64;
  mutable total_processing_time_ns : int64;
  mutable max_processing_time_ns : int64;
  mutable total_queue_wait_ns : int64;
  mutable max_queue_wait_ns : int64;
  finished : unit Lwt.t;
  finished_u : unit Lwt.u;
  mutable finished_done : bool;
}

let default_config = { queue_capacity = 4096 }

let now_ns () = Mtime_clock.now_ns ()

let finish t =
  if not t.finished_done then begin
    t.finished_done <- true;
    Lwt.wakeup_later t.finished_u ()
  end

let fail_queue t exn =
  t.failed <- true;
  t.accepting <- false;
  Printf.eprintf "state worker failed: %s\n%!" (Printexc.to_string exn);
  Queue.iter
    (fun item -> Lwt.wakeup_later item.promise (Error Worker_failed))
    t.queue;
  Queue.clear t.queue;
  t.depth <- 0;
  finish t

let update_metrics t ~started_ns ~finished_ns item =
  let processing = Int64.sub finished_ns started_ns in
  let wait = Int64.sub started_ns item.enqueued_ns in
  t.requests_processed <- Int64.succ t.requests_processed;
  t.total_processing_time_ns <-
    Int64.add t.total_processing_time_ns processing;
  if Int64.compare processing t.max_processing_time_ns > 0 then
    t.max_processing_time_ns <- processing;
  t.total_queue_wait_ns <- Int64.add t.total_queue_wait_ns wait;
  if Int64.compare wait t.max_queue_wait_ns > 0 then
    t.max_queue_wait_ns <- wait

let batch_size = 64

let process_one t item =
  let started_ns = now_ns () in
  match item.request with
  | Move request ->
    let result = Move_engine.process t.state request in
    let finished_ns = now_ns () in
    update_metrics t ~started_ns ~finished_ns item;
    (match result with
     | Move_engine.Accepted _ -> ()
     | Move_engine.Rejected _ ->
       t.requests_rejected <- Int64.succ t.requests_rejected);
    Lwt.wakeup_later item.promise (Ok (Move_result result));
    true
  | Snapshot { board_x; board_y } ->
    let board = Game_state.snapshot_board t.state ~board_x ~board_y in
    let finished_ns = now_ns () in
    update_metrics t ~started_ns ~finished_ns item;
    Lwt.wakeup_later item.promise (Ok (Snapshot_result board));
    true
  | exception exn ->
    fail_queue t exn;
    Lwt.wakeup_later item.promise (Error Worker_failed);
    false

let rec loop t budget =
  if t.depth = 0 then
    if not t.accepting then begin
      finish t;
      Lwt.return_unit
    end
    else Lwt_condition.wait t.condition >>= fun () -> loop t batch_size
  else if budget = 0 then
    (* Yield after a bounded batch so a continuously full queue cannot starve
       the Lwt scheduler. *)
    Lwt.pause () >>= fun () -> loop t batch_size
  else begin
    let item = Queue.take t.queue in
    t.depth <- t.depth - 1;
    if process_one t item then loop t (budget - 1) else Lwt.return_unit
  end

let start ~(config : config) state =
  if config.queue_capacity <= 0 then
    invalid_arg "State_worker.start: queue_capacity must be positive";
  let finished, finished_u = Lwt.wait () in
  let worker =
    {
      state;
      settings = config;
      queue = Queue.create ();
      condition = Lwt_condition.create ();
      accepting = true;
      failed = false;
      notification_pending = false;
      depth = 0;
      requests_processed = 0L;
      requests_rejected = 0L;
      total_processing_time_ns = 0L;
      max_processing_time_ns = 0L;
      total_queue_wait_ns = 0L;
      max_queue_wait_ns = 0L;
      finished;
      finished_u;
      finished_done = false;
    }
  in
  Lwt.async (fun () -> loop worker batch_size);
  worker

let schedule_notification t =
  if not t.notification_pending then begin
    t.notification_pending <- true;
    (* Notify after yielding so a burst of submits can fill the queue before
       the worker starts processing. *)
    Lwt.async (fun () ->
        Lwt.pause () >>= fun () ->
        t.notification_pending <- false;
        Lwt_condition.broadcast t.condition ();
        Lwt.return_unit)
  end

let enqueue t request =
  if t.failed then Lwt.return (Error Worker_failed)
  else if not t.accepting then Lwt.return (Error Worker_stopped)
  else if t.depth >= t.settings.queue_capacity then
    Lwt.return (Error Queue_full)
  else begin
    let promise, resolver = Lwt.wait () in
    Queue.add
      { request; promise = resolver; enqueued_ns = now_ns () }
      t.queue;
    t.depth <- t.depth + 1;
    schedule_notification t;
    promise
  end

let submit t request =
  Lwt.map
    (function
      | Ok (Move_result result) -> Ok result
      | Ok (Snapshot_result _) -> assert false
      | Error error -> Error error)
    (enqueue t (Move request))

let submit_snapshot t ~board_x ~board_y =
  if
    board_x < 0 || board_x >= 1000 || board_y < 0 || board_y >= 1000
  then Lwt.return (Error Invalid_request)
  else
    Lwt.map
      (function
        | Ok (Snapshot_result board) -> Ok board
        | Ok (Move_result _) -> assert false
        | Error error -> Error error)
      (enqueue t (Snapshot { board_x; board_y }))

let stop t =
  if t.accepting then begin
    t.accepting <- false;
    Lwt_condition.broadcast t.condition ()
  end;
  t.finished

let metrics t =
  {
    queue_depth = t.depth;
    queue_capacity = t.settings.queue_capacity;
    requests_processed = t.requests_processed;
    requests_rejected = t.requests_rejected;
    total_processing_time_ns = t.total_processing_time_ns;
    max_processing_time_ns = t.max_processing_time_ns;
    total_queue_wait_ns = t.total_queue_wait_ns;
    max_queue_wait_ns = t.max_queue_wait_ns;
  }
