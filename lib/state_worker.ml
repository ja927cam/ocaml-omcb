open Lwt.Infix

type config = { queue_capacity : int }

type commit_policy = { max_batch : int; max_delay_s : float }

type submit_error =
  | Queue_full
  | Worker_stopped
  | Worker_failed
  | Invalid_request

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

type request =
  | Move of Move_request.t
  | Simulate of { board_x : int; board_y : int; request_id : int32 }
  | Snapshot of { board_x : int; board_y : int }
  | Snapshot_batch of { x0 : int; y0 : int; x1 : int; y1 : int }
  | Piece_info of { board_x : int; board_y : int; square : int }
  | Snapshot_world

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

(* A rectangular batch is copied in a single worker turn. Encoding each board
   to its 64 client bytes here avoids handing the server 625 separate piece
   arrays and keeps the whole load to one protocol frame. *)
type snapshot_batch = {
  x0 : int;
  y0 : int;
  width : int;
  height : int;
  boards : (int64 * Bytes.t) array;
}
[@@warning "-69"]

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
  captured_piece_id : int32;
  timing : Metrics.move_timing option;
}

type response =
  | Move_result of Move_engine.result
  | Simulated_result of bool
  | Snapshot_result of snapshot
  | Snapshot_batch_result of snapshot_batch
  | Piece_info_result of piece_info
  | World_snapshot_result

type item = {
  request : request;
  promise : (response, submit_error) result Lwt.u;
  enqueued_ns : int64;
  timing : Metrics.move_timing option;
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
  mutable move_depth : int;
  mutable requests_processed : int64;
  mutable moves_processed : int64;
  mutable moves_submitted : int64;
  mutable requests_rejected : int64;
  mutable total_processing_time_ns : int64;
  mutable max_processing_time_ns : int64;
  mutable total_queue_wait_ns : int64;
  mutable max_queue_wait_ns : int64;
  finished : unit Lwt.t;
  finished_u : unit Lwt.u;
  mutable finished_done : bool;
  on_commit : committed -> unit;
  precommit : Game_state.t -> Move_engine.commit -> unit;
  on_snapshot : Game_state.t -> unit;
  commit_policy : unit -> commit_policy;
  commit_group : int -> unit;
  on_fatal : exn -> unit;
  sim_random : Random.State.t;
}

let default_config = { queue_capacity = 4096 }

let now_ns () = Mtime_clock.now_ns ()

let finish t =
  if not t.finished_done then begin
    t.finished_done <- true;
    Lwt.wakeup_later t.finished_u ()
  end

let fail_queue t ?(fatal = true) exn =
  t.failed <- true;
  t.accepting <- false;
  Printf.eprintf "state worker failed: %s\n%!" (Printexc.to_string exn);
  Queue.iter
    (fun item -> Lwt.wakeup_later item.promise (Error Worker_failed))
    t.queue;
  Queue.clear t.queue;
  t.depth <- 0;
  t.move_depth <- 0;
  finish t;
  if fatal then t.on_fatal exn

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

let committed_of_accepted t (accepted : Move_engine.accepted) timing =
  let groups : (int, int * int * (int * Piece.t) list ref) Hashtbl.t =
    Hashtbl.create 2
  in
  List.iter
    (fun ((pos : Board.position), piece) ->
      let board_x = pos.board.board_x and board_y = pos.board.board_y in
      let key = (board_y * 1000) + board_x in
      let square = (pos.square.y * 8) + pos.square.x in
      match Hashtbl.find_opt groups key with
      | Some (_, _, changes) -> changes := (square, piece) :: !changes
      | None -> Hashtbl.add groups key (board_x, board_y, ref [ (square, piece) ]))
    accepted.Move_engine.changes;
  let boards =
    Hashtbl.fold
      (fun _ (board_x, board_y, changes) acc ->
        let revision =
          Game_state.bump_board_revision t.state ~board_x ~board_y
        in
        {
          board_x;
          board_y;
          revision;
          changes = List.rev !changes;
        }
        :: acc)
      groups []
  in
  {
    sequence = accepted.sequence;
    request_id = accepted.request_id;
    boards;
    captured_piece_id =
      (if Piece.is_empty accepted.captured_piece then 0l
       else Piece.id accepted.captured_piece);
    timing;
  }

let process_move t item request =
  let started_ns = now_ns () in
  (match item.timing with
   | Some timing -> Metrics.mark_worker_start timing started_ns
   | None -> ());
  let result =
    Move_engine.process
      ~precommit:(fun commit -> t.precommit t.state commit)
      t.state request
  in
  let finished_ns = now_ns () in
  (match item.timing with
   | Some timing -> Metrics.mark_committed timing finished_ns
   | None -> ());
  update_metrics t ~started_ns ~finished_ns item;
  t.moves_processed <- Int64.succ t.moves_processed;
  match result with
  | Move_engine.Accepted accepted ->
    (result, Some (committed_of_accepted t accepted item.timing))
  | Move_engine.Rejected _ ->
    t.requests_rejected <- Int64.succ t.requests_rejected;
    (result, None)

let publish_move t item result committed =
  (match committed with
   | Some committed ->
     (try t.on_commit committed with
      | exn ->
        Printf.eprintf "state worker on_commit failed: %s\n%!"
          (Printexc.to_string exn))
   | None -> ());
  Lwt.wakeup_later item.promise (Ok (Move_result result))

let process_move_group t =
  let policy = t.commit_policy () in
  let max_batch = max 1 policy.max_batch in
  let max_delay = max 0. policy.max_delay_s in
  let rec take acc remaining =
    if remaining = 0 || Queue.is_empty t.queue then List.rev acc
    else
      match (Queue.peek t.queue).request with
      | Move _ | Simulate _ ->
        let item = Queue.take t.queue in
        t.depth <- t.depth - 1;
        t.move_depth <- max 0 (t.move_depth - 1);
        take (item :: acc) (remaining - 1)
      | Snapshot _ | Snapshot_batch _ | Piece_info _ | Snapshot_world ->
        List.rev acc
  in
  let initial = take [] max_batch in
  let next_is_snapshot =
    not (Queue.is_empty t.queue)
    &&
    match (Queue.peek t.queue).request with
    | Move _ | Simulate _ -> false
    | Snapshot _ | Snapshot_batch _ | Piece_info _ | Snapshot_world -> true
  in
  let should_wait =
    List.length initial < max_batch && max_delay > 0. && t.accepting
    && not next_is_snapshot
  in
  let finish items =
    let processed = ref [] in
    try
      List.iter
        (fun item ->
          match item.request with
          | Move request ->
            let result, committed = process_move t item request in
            processed := (item, result, committed) :: !processed
          | Simulate { board_x; board_y; request_id } ->
            let picked =
              Game_state.with_board t.state (fun board ->
                  Simulated_move.pick ~random:t.sim_random board ~board_x
                    ~board_y ~request_id)
            in
            (match picked with
             | None ->
               Lwt.wakeup_later item.promise (Ok (Simulated_result false))
             | Some request ->
               let result, committed = process_move t item request in
               processed := (item, result, committed) :: !processed)
          | Snapshot _ | Snapshot_batch _ | Piece_info _ | Snapshot_world ->
            assert false)
        items;
      t.commit_group (List.length !processed);
      List.iter
        (fun (item, result, committed) -> publish_move t item result committed)
        (List.rev !processed);
      (true, List.length items)
    with exn ->
      Printf.eprintf "state worker commit group failed: %s\n%!"
        (Printexc.to_string exn);
      List.iter
        (fun item -> Lwt.wakeup_later item.promise (Error Worker_failed))
        items;
      fail_queue t exn;
      (false, List.length items)
  in
  if should_wait then
    Lwt_unix.sleep max_delay >>= fun () ->
    let more = take [] (max_batch - List.length initial) in
    Lwt.return (finish (initial @ more))
  else Lwt.return (finish initial)

let process_one t item =
  let started_ns = now_ns () in
  (match item.timing with
   | Some timing -> Metrics.mark_worker_start timing started_ns
   | None -> ());
  match item.request with
  | Move _ | Simulate _ -> assert false
  | Snapshot_batch { x0; y0; x1; y1 } ->
    let width = x1 - x0 + 1 and height = y1 - y0 + 1 in
    let boards =
      Array.init (width * height) (fun index ->
          let board_x = x0 + (index mod width) in
          let board_y = y0 + (index / width) in
          let pieces, revision =
            Game_state.snapshot_board_with_revision t.state ~board_x ~board_y
          in
          let encoded =
            Bytes.init 64 (fun square ->
                Char.chr
                  (Piece.client_byte_at ~board_x ~board_y pieces.(square)))
          in
          (revision, encoded))
    in
    let finished_ns = now_ns () in
    update_metrics t ~started_ns ~finished_ns item;
    Lwt.wakeup_later item.promise
      (Ok (Snapshot_batch_result { x0; y0; width; height; boards }));
    true
  | Piece_info { board_x; board_y; square } ->
    let board, revision =
      Game_state.snapshot_board_with_revision t.state ~board_x ~board_y
    in
    let piece = board.(square) in
    let finished_ns = now_ns () in
    update_metrics t ~started_ns ~finished_ns item;
    Lwt.wakeup_later item.promise
      (Ok (Piece_info_result { board_x; board_y; square; revision; piece }));
    true
  | Snapshot_world ->
    (try t.on_snapshot t.state with
     | exn ->
       Printf.eprintf "state worker on_snapshot failed: %s\n%!"
         (Printexc.to_string exn));
    let finished_ns = now_ns () in
    update_metrics t ~started_ns ~finished_ns item;
    Lwt.wakeup_later item.promise (Ok World_snapshot_result);
    true
  | Snapshot { board_x; board_y } ->
    let snapshot =
      Game_state.snapshot_board_with_revision t.state ~board_x ~board_y
    in
    let finished_ns = now_ns () in
    update_metrics t ~started_ns ~finished_ns item;
    let snapshot = { board = fst snapshot; revision = snd snapshot } in
    Lwt.wakeup_later item.promise (Ok (Snapshot_result snapshot));
    true
  | exception exn ->
    fail_queue t ~fatal:false exn;
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
  else
    match (Queue.peek t.queue).request with
    | Move _ | Simulate _ ->
      process_move_group t >>= fun (ok, count) ->
      if ok then loop t (max 0 (budget - count)) else Lwt.return_unit
    | Snapshot _ | Snapshot_batch _ | Piece_info _ | Snapshot_world ->
      let item = Queue.take t.queue in
      t.depth <- t.depth - 1;
      if process_one t item then loop t (budget - 1) else Lwt.return_unit

let start ?(on_commit = fun _ -> ())
    ?(precommit = fun _ _ -> ())
    ?(on_snapshot = fun _ -> ())
    ?(commit_policy = fun () -> { max_batch = 1; max_delay_s = 0. })
    ?(commit_group = fun _ -> ())
    ?(on_fatal = fun _ -> ())
    ~(config : config) state =
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
      move_depth = 0;
      requests_processed = 0L;
      moves_processed = 0L;
      moves_submitted = 0L;
      requests_rejected = 0L;
      total_processing_time_ns = 0L;
      max_processing_time_ns = 0L;
      total_queue_wait_ns = 0L;
      max_queue_wait_ns = 0L;
      finished;
      finished_u;
      finished_done = false;
      on_commit;
      precommit;
      on_snapshot;
      commit_policy;
      commit_group;
      on_fatal;
      sim_random = Random.State.make_self_init ();
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

let enqueue t ?timing request =
  if t.failed then Lwt.return (Error Worker_failed)
  else if not t.accepting then Lwt.return (Error Worker_stopped)
  else if t.depth >= t.settings.queue_capacity then
    Lwt.return (Error Queue_full)
  else begin
    let promise, resolver = Lwt.wait () in
    Queue.add
      { request; promise = resolver; enqueued_ns = now_ns (); timing }
      t.queue;
    t.depth <- t.depth + 1;
    (match request with
     | Move _ | Simulate _ ->
       t.move_depth <- t.move_depth + 1;
       t.moves_submitted <- Int64.succ t.moves_submitted
     | _ -> ());
    (match timing with
     | Some timing -> Metrics.mark_submitted timing
     | None -> ());
    schedule_notification t;
    promise
  end

let submit ?timing t request =
  Lwt.map
    (function
      | Ok (Move_result result) -> Ok result
      | Ok (Simulated_result _) | Ok (Snapshot_result _)
      | Ok (Snapshot_batch_result _) | Ok (Piece_info_result _)
      | Ok World_snapshot_result -> assert false
      | Error error -> Error error)
    (enqueue t ?timing (Move request))

let submit_simulated t ~board_x ~board_y ~request_id =
  if
    board_x < 0 || board_x >= 1000 || board_y < 0 || board_y >= 1000
  then Lwt.return (Error Invalid_request)
  else
    Lwt.map
      (function
        | Ok (Simulated_result value) -> Ok value
        | Ok (Move_result (Move_engine.Accepted _)) -> Ok true
        | Ok (Move_result (Move_engine.Rejected _)) -> Ok false
        | Ok (Snapshot_result _) | Ok (Snapshot_batch_result _)
        | Ok (Piece_info_result _) | Ok World_snapshot_result ->
          assert false
        | Error error -> Error error)
      (enqueue t (Simulate { board_x; board_y; request_id }))

let submit_snapshot ?timing t ~board_x ~board_y =
  if
    board_x < 0 || board_x >= 1000 || board_y < 0 || board_y >= 1000
  then Lwt.return (Error Invalid_request)
  else
    Lwt.map
      (function
        | Ok (Snapshot_result snapshot) -> Ok snapshot
        | Ok (Move_result _) | Ok (Simulated_result _)
        | Ok (Snapshot_batch_result _) | Ok (Piece_info_result _)
        | Ok World_snapshot_result -> assert false
        | Error error -> Error error)
      (enqueue t ?timing (Snapshot { board_x; board_y }))

let submit_snapshot_batch ?timing t ~x0 ~y0 ~x1 ~y1 =
  if
    x0 < 0 || y0 < 0 || x1 >= 1000 || y1 >= 1000 || x0 > x1 || y0 > y1
    || (x1 - x0 + 1) * (y1 - y0 + 1)
       > Protocol.Types.snapshot_batch_area_limit
  then Lwt.return (Error Invalid_request)
  else
    Lwt.map
      (function
        | Ok (Snapshot_batch_result batch) -> Ok batch
        | Ok (Move_result _) | Ok (Simulated_result _)
        | Ok (Snapshot_result _) | Ok (Piece_info_result _)
        | Ok World_snapshot_result -> assert false
        | Error error -> Error error)
      (enqueue t ?timing (Snapshot_batch { x0; y0; x1; y1 }))
[@@warning "-32"]

let submit_piece_info ?timing t ~board_x ~board_y ~square =
  if
    board_x < 0 || board_x >= 1000 || board_y < 0 || board_y >= 1000
    || square < 0 || square >= 64
  then Lwt.return (Error Invalid_request)
  else
    Lwt.map
      (function
        | Ok (Piece_info_result info) -> Ok info
        | Ok (Move_result _) | Ok (Simulated_result _)
        | Ok (Snapshot_result _) | Ok (Snapshot_batch_result _)
        | Ok World_snapshot_result -> assert false
        | Error error -> Error error)
      (enqueue t ?timing (Piece_info { board_x; board_y; square }))
[@@warning "-32"]

let request_snapshot t =
  Lwt.map
    (function
      | Ok World_snapshot_result -> Ok ()
      | Ok (Move_result _) | Ok (Simulated_result _)
      | Ok (Snapshot_result _) | Ok (Snapshot_batch_result _)
      | Ok (Piece_info_result _) -> assert false
      | Error error -> Error error)
    (enqueue t Snapshot_world)

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
    move_queue_depth = t.move_depth;
    requests_processed = t.requests_processed;
    moves_processed = t.moves_processed;
    moves_submitted = t.moves_submitted;
    requests_rejected = t.requests_rejected;
    total_processing_time_ns = t.total_processing_time_ns;
    max_processing_time_ns = t.max_processing_time_ns;
    total_queue_wait_ns = t.total_queue_wait_ns;
    max_queue_wait_ns = t.max_queue_wait_ns;
  }
