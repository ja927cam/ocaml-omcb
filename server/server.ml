open Lwt.Infix
let cross_origin_isolation inner request =
  let%lwt response = inner request in
  Dream.set_header response "Cross-Origin-Opener-Policy" "same-origin";
  Dream.set_header response "Cross-Origin-Embedder-Policy" "require-corp";
  Lwt.return response

let now_ns () = Int64.of_float (Unix.gettimeofday () *. 1_000_000_000.)

let int_env name default =
  match Sys.getenv_opt name with
  | None -> default
  | Some value -> (try int_of_string value with _ -> default)

let float_env name default =
  match Sys.getenv_opt name with
  | None -> default
  | Some value -> (try float_of_string value with _ -> default)

let ms_of_ns value = Int64.to_float value /. 1_000_000.

let worker_metrics_json (m : State_worker.metrics) =
  let processed = m.requests_processed in
  let avg total =
    if Int64.equal processed 0L then 0.
    else Int64.to_float total /. Int64.to_float processed
  in
  `Assoc
    [
      ("queue_depth", `Int m.queue_depth);
      ("queue_capacity", `Int m.queue_capacity);
      ("move_queue_depth", `Int m.move_queue_depth);
      ("requests_processed", `Intlit (Int64.to_string m.requests_processed));
      ("moves_processed", `Intlit (Int64.to_string m.moves_processed));
      ("moves_submitted", `Intlit (Int64.to_string m.moves_submitted));
      ("requests_rejected", `Intlit (Int64.to_string m.requests_rejected));
      ("avg_queue_wait_ms", `Float (ms_of_ns (Int64.of_float (avg m.total_queue_wait_ns))));
      ("max_queue_wait_ms", `Float (ms_of_ns m.max_queue_wait_ns));
      ( "avg_processing_ms",
        `Float (ms_of_ns (Int64.of_float (avg m.total_processing_time_ns))) );
      ("max_processing_ms", `Float (ms_of_ns m.max_processing_time_ns));
    ]

let connection_metrics_json (m : Connection_manager.metrics) =
  `Assoc
    [
      ("clients", `Int m.client_count);
      ("subscriptions", `Int m.subscription_count);
      ("max_outbox_depth", `Int m.max_outbox_depth);
      ("total_outbox_depth", `Int m.total_outbox_depth);
      ("pending_event_count", `Int m.pending_event_count);
      ("outbox_capacity", `Int m.outbox_capacity);
      ("event_batching", `Bool m.event_batching);
    ]

let adaptive_json controller ~fixed_group ~fixed_delay_us =
  match controller with
  | None ->
    `Assoc
      [
        ("enabled", `Bool false);
        ("fixed_group_size", `Int fixed_group);
        ("fixed_delay_us", `Int fixed_delay_us);
      ]
  | Some controller ->
    let state = Adaptive_commit.state controller in
    `Assoc
      [
        ("enabled", `Bool true);
        ("max_batch_size", `Int state.policy.max_batch_size);
        ("max_batch_delay_us", `Int state.policy.max_batch_delay_us);
        ("classification", `String (Adaptive_commit.classification_name state.classification));
        ("samples", `Int state.samples);
        ("changes", `Int state.changes);
        ("move_rate", `Float state.move_rate);
        ("pending_moves", `Int state.pending_moves);
        ("fsync_p50_us", `Float state.fsync_p50_us);
        ("fsync_p95_us", `Float state.fsync_p95_us);
        ("broadcast_backlog", `Float state.broadcast_backlog);
        ("event_lag_p95_ms", `Float state.event_lag_p95_ms);
        ("recipients_per_event", `Float state.recipients_per_event);
        ("snapshot_active", `Bool state.snapshot_active);
      ]

let file_contents path =
  try
    let channel = open_in_bin path in
    Fun.protect
      ~finally:(fun () -> close_in_noerr channel)
      (fun () ->
        let buffer = Buffer.create 4096 in
        (try
           while true do
             Buffer.add_string buffer (input_line channel);
             Buffer.add_char buffer '\n'
           done
         with End_of_file -> ());
        Buffer.contents buffer)
  with _ -> ""

let trim = String.trim

let proc_status_rss_kb () =
  let lines = String.split_on_char '\n' (file_contents "/proc/self/status") in
  let rec find = function
    | [] -> None
    | line :: rest -> (
      match String.split_on_char ':' line with
      | [ key; value ] when trim key = "VmRSS" ->
        let value = trim value in
        let value =
          if String.length value > 2
             && String.sub value (String.length value - 2) 2 = "kB"
          then String.sub value 0 (String.length value - 2)
          else value
        in
        (try Some (int_of_string (trim value)) with _ -> None)
      | _ -> find rest)
  in
  find lines

let smaps_rollup () =
  let wanted =
    [
      "Rss";
      "Pss";
      "Shared_Clean";
      "Shared_Dirty";
      "Private_Clean";
      "Private_Dirty";
      "Anonymous";
      "Swap";
      "Locked";
    ]
  in
  let values = Hashtbl.create 16 in
  String.split_on_char '\n' (file_contents "/proc/self/smaps_rollup")
  |> List.iter (fun line ->
         match String.split_on_char ':' line with
         | [ key; value ] ->
           let key = trim key in
           if List.mem key wanted then begin
             let value = trim value in
             let value =
               if String.length value > 2
                  && String.sub value (String.length value - 2) 2 = "kB"
               then String.sub value 0 (String.length value - 2)
               else value
             in
             match int_of_string_opt (trim value) with
             | Some value -> Hashtbl.replace values key value
             | None -> ()
           end
         | _ -> ());
  `Assoc
    (List.map
       (fun key ->
         let value =
           match Hashtbl.find_opt values key with Some value -> value | None -> 0
         in
         (key, `Int value))
       wanted)

let memory_json () =
  let gc = Gc.quick_stat () in
  let copies, copy_bytes = Persistence.snapshot_copy_memory () in
  let field name value = (name, `Int value) in
  `Assoc
    [
      ( "rss_kb",
        match proc_status_rss_kb () with Some value -> `Int value | None -> `Null );
      ("smaps_rollup_kb", smaps_rollup ());
      ( "gc",
        `Assoc
          [
            field "heap_words" gc.Gc.heap_words;
            field "live_words" gc.Gc.live_words;
            field "free_words" gc.Gc.free_words;
            field "top_heap_words" gc.Gc.top_heap_words;
            field "major_words" (int_of_float gc.Gc.major_words);
            field "minor_words" (int_of_float gc.Gc.minor_words);
            field "promoted_words" (int_of_float gc.Gc.promoted_words);
            field "compactions" gc.Gc.compactions;
            field "major_collections" gc.Gc.major_collections;
            field "minor_collections" gc.Gc.minor_collections;
          ] );
      field "snapshot_copy_live" copies;
      field "snapshot_copy_live_bytes" copy_bytes;
    ]

type memprof_site = { mutable count : int; mutable bytes : int }

let memprof_sites : (string, memprof_site) Hashtbl.t = Hashtbl.create 256
let memprof_lock = Mutex.create ()
let memprof_profile : Gc.Memprof.t option ref = ref None

let memprof_update key bytes delta =
  Mutex.lock memprof_lock;
  let site =
    match Hashtbl.find_opt memprof_sites key with
    | Some site -> site
    | None ->
      let site = { count = 0; bytes = 0 } in
      Hashtbl.add memprof_sites key site;
      site
  in
  site.count <- max 0 (site.count + delta);
  site.bytes <- max 0 (site.bytes + (delta * bytes));
  Mutex.unlock memprof_lock

let memprof_key allocation =
  Printexc.raw_backtrace_to_string allocation.Gc.Memprof.callstack

let start_memprof () =
  if int_env "SIM_MAP_MEMPROF" 0 <> 0 then begin
    let rate = float_env "SIM_MAP_MEMPROF_RATE" 1e-4 in
    let rate = max 1e-6 (min 1. rate) in
    let tracker : (string * int, string * int) Gc.Memprof.tracker =
      {
        alloc_minor =
          (fun allocation ->
            let key = memprof_key allocation in
            memprof_update key allocation.size 1;
            Some (key, allocation.size));
        alloc_major =
          (fun allocation ->
            let key = memprof_key allocation in
            memprof_update key allocation.size 1;
            Some (key, allocation.size));
        promote = (fun (key, bytes) -> Some (key, bytes));
        dealloc_minor =
          (fun (key, bytes) -> memprof_update key bytes (-1));
        dealloc_major =
          (fun (key, bytes) -> memprof_update key bytes (-1));
      }
    in
    memprof_profile :=
      Some (Gc.Memprof.start ~sampling_rate:rate ~callstack_size:8 tracker)
  end

let memprof_site_json (key, site) =
  `Assoc
    [
      ("bytes", `Int site.bytes);
      ("count", `Int site.count);
      ("stack", `String key);
    ]

let memprof_json () =
  Gc.full_major ();
  let all =
    Hashtbl.fold (fun key site acc -> (key, site) :: acc) memprof_sites []
  in
  let by_bytes =
    List.sort (fun (_, a) (_, b) -> compare b.bytes a.bytes) all
    |> List.filteri (fun index _ -> index < 100)
  in
  let by_count =
    List.sort (fun (_, a) (_, b) -> compare b.count a.count) all
    |> List.filteri (fun index _ -> index < 100)
  in
  `Assoc
    [
      ( "sampling",
        `Bool (match !memprof_profile with Some _ -> true | None -> false) );
      ("sites", `List (List.map memprof_site_json by_bytes));
      ("sites_by_count", `List (List.map memprof_site_json by_count));
    ]

let metrics_body manager worker persistence adaptive ~fixed_group ~fixed_delay_us =
  let worker_metrics = State_worker.metrics worker in
  let connection_metrics = Connection_manager.metrics manager in
  Yojson.Safe.to_string
    (Metrics.json
       ~extra:
         [
           ("worker", worker_metrics_json worker_metrics);
           ("connections", connection_metrics_json connection_metrics);
           ("persistence", Persistence.metrics_json persistence);
           ("memory", memory_json ());
           ("adaptive", adaptive_json adaptive ~fixed_group ~fixed_delay_us);
         ]
       ())

let log_phase name started =
  let elapsed = Int64.sub (now_ns ()) started in
  Printf.printf "%s: %Ld ns (%.3f s)\n%!" name elapsed
    (Int64.to_float elapsed /. 1e9)

let rejection_code = function
  | Move_engine.Stale_piece -> Protocol.Types.rejection_stale_piece
  | Move_engine.Invalid_move rejection ->
    (match rejection with
     | Move_validator.Empty_source -> Protocol.Types.rejection_empty_source
     | Move_validator.Invalid_geometry ->
       Protocol.Types.rejection_invalid_geometry
     | Move_validator.Blocked_path -> Protocol.Types.rejection_blocked_path
     | Move_validator.Invalid_destination ->
       Protocol.Types.rejection_invalid_destination
     | Move_validator.Capture_off_original_board ->
       Protocol.Types.rejection_capture_off_original_board
     | Move_validator.Invalid_special_move ->
       Protocol.Types.rejection_invalid_special_move)

let board_position (p : Protocol.Types.position) : Board.position =
  {
    board = { board_x = p.board_x; board_y = p.board_y };
    square = { x = p.x; y = p.y };
  }

let to_move (m : Protocol.Types.move) =
  Move.create ~src:(board_position m.src) ~dst:(board_position m.dst)

let to_request (r : Protocol.Types.move_request) =
  Move_request.create ~request_id:r.request_id ~move:(to_move r.move)
    ~expected_piece_id:r.expected_piece_id

let rejected_response ?(request_id = 0l) rejection =
  Protocol.Types.
    {
      request_id;
      status = Rejected;
      sequence = 0L;
      moved_piece = 0L;
      captured_piece_id = 0l;
      rejection;
    }

let response_of_result request_id
    (result : (Move_engine.result, State_worker.submit_error) result) =
  match result with
  | Ok (Move_engine.Accepted accepted) ->
    Protocol.Types.
      {
        request_id = accepted.request_id;
        status = Accepted;
        sequence = accepted.sequence;
        moved_piece = accepted.moved_piece;
        captured_piece_id =
          (if Piece.is_empty accepted.captured_piece then 0l
           else Piece.id accepted.captured_piece);
        rejection = 0;
      }
  | Ok (Move_engine.Rejected rejection) ->
    Protocol.Types.
      {
        request_id = rejection.request_id;
        status = Rejected;
        sequence = 0L;
        moved_piece = 0L;
        captured_piece_id = 0l;
        rejection = rejection_code rejection.reason;
      }
  | Error State_worker.Queue_full ->
    rejected_response ~request_id Protocol.Types.rejection_queue_full
  | Error State_worker.Worker_stopped ->
    rejected_response ~request_id Protocol.Types.rejection_worker_stopped
  | Error State_worker.Worker_failed ->
    rejected_response ~request_id Protocol.Types.rejection_worker_failed
  | Error State_worker.Invalid_request ->
    rejected_response ~request_id Protocol.Types.rejection_invalid_request

let send_bytes socket bytes =
  (* A peer can disappear in the middle of a write. Do not let the handler wait
     forever on a promise that will never resolve. *)
  (* Frames are immutable after they are encoded, so avoid a 4 KiB copy per
     recipient with [Bytes.unsafe_to_string]. *)
  Lwt_unix.with_timeout 2.0 (fun () ->
      Dream.send ~text_or_binary:`Binary socket (Bytes.unsafe_to_string bytes))

let snapshot_failure ?(request_id = 0l) ?(board_x = 0) ?(board_y = 0) () =
  Protocol.Types.
    {
      request_id;
      board_x;
      board_y;
      status = Snapshot_failed;
      revision = 0L;
      board = Bytes.make 64 '\000';
    }

let snapshot_success (request : Protocol.Types.snapshot_request)
    (snapshot : State_worker.snapshot) =
  let encoded =
    Bytes.init 64 (fun i ->
        Char.chr
          (Piece.client_byte_at ~board_x:request.board_x
             ~board_y:request.board_y snapshot.board.(i)))
  in
  Protocol.Types.
    {
      request_id = request.Protocol.Types.request_id;
      board_x = request.board_x;
      board_y = request.board_y;
      status = Snapshot_ok;
      revision = snapshot.revision;
      board = encoded;
    }

type socket_response =
  [ `Move of Protocol.Types.response
  | `Snapshot of Protocol.Types.snapshot_response * Protocol.Types.move_event list
  | `Snapshot_batch of Protocol.Types.snapshot_batch
                      * Protocol.Types.move_event list
  | `Piece_info of Protocol.Types.piece_info ]

let piece_type_code = function
  | Piece.Pawn -> 1
  | Piece.Knight -> 2
  | Piece.Bishop -> 3
  | Piece.Rook -> 4
  | Piece.Queen -> 5
  | Piece.King -> 6
  | Piece.Promoted_pawn -> 7

let piece_info_response (request : Protocol.Types.piece_info_request)
    (info : State_worker.piece_info) : Protocol.Types.piece_info =
  let piece = info.piece in
  let found = not (Piece.is_empty piece) in
  let flags = ref 0 in
  let set bit value = if value then flags := !flags lor (1 lsl bit) in
  if found then begin
    set 0 (Piece.just_double_moved piece);
    set 1 (Piece.king_killer piece);
    set 2 (Piece.king_pawner piece);
    set 3 (Piece.queen_killer piece);
    set 4 (Piece.queen_pawner piece);
    set 5 (Piece.adopted_killer piece);
    set 6 (Piece.has_captured_other_type piece);
    set 7 (Piece.on_original_board piece)
  end;
  Protocol.Types.
    {
      request_id = request.request_id;
      board_x = info.board_x;
      board_y = info.board_y;
      square = info.square;
      status = (if found then Piece_found else Piece_absent);
      revision = info.revision;
      id = (if found then Piece.id piece else 0l);
      type_code = (if found then piece_type_code (Piece.piece_type piece) else 0);
      is_white = found && Piece.is_white piece;
      flags = !flags;
      adopted = found && Piece.adopted piece;
      move_count = (if found then Piece.move_count piece else 0);
      capture_count = (if found then Piece.capture_count piece else 0);
      raw = piece;
    }

let snapshot_batch_response
    (request : Protocol.Types.snapshot_batch_request)
    (batch : State_worker.snapshot_batch) : Protocol.Types.snapshot_batch =
  {
    Protocol.Types.request_id = request.request_id;
    x0 = batch.x0;
    y0 = batch.y0;
    width = batch.width;
    height = batch.height;
    boards =
      Array.map
        (fun (revision, pieces) ->
          Protocol.Types.{ revision; pieces })
        batch.boards;
  }

let handle_socket manager worker socket =
  let conn =
    Connection_manager.register manager ~send_raw:(send_bytes socket)
      ~close_raw:(fun () -> Dream.close_websocket socket)
  in
  let rec loop () =
    (* A per-request race against the connection's close signal was removed:
       Lwt.pick on a never-resolving waiter leaked callback nodes under high
       request rates. Dream.receive returns None when the pinned httpun-ws
       writer close path closes the socket, so the handler still unblocks. *)
    match%lwt Dream.receive socket with
    | None -> Lwt.return_unit
    | Some data ->
      let bytes = Bytes.of_string data in
      let response_lwt : socket_response option Lwt.t =
        match String.length data with
        | 5 ->
          (match Protocol.Types.board_subscription_of_bytes bytes with
           | Some (Protocol.Types.Subscribe, board_x, board_y) ->
             Connection_manager.subscribe conn board_x board_y
           | Some (Protocol.Types.Unsubscribe, board_x, board_y) ->
             Connection_manager.unsubscribe conn board_x board_y
           | None -> ());
          Lwt.return_none
        | 6 ->
          (match Protocol.Types.subscription_window_of_bytes bytes with
           | Some window ->
             Connection_manager.set_window conn
               ~center_x:window.center_x ~center_y:window.center_y
               ~radius:window.radius
           | None -> ());
          Lwt.return_none
        | 14 ->
          let received_ns = Metrics.now () in
          (match Protocol.Types.move_request_of_bytes bytes with
           | None ->
             Lwt.return_some
               (`Move
                  (rejected_response Protocol.Types.rejection_invalid_request))
           | Some wire ->
             (match to_request wire with
              | exception Invalid_argument _ ->
                Lwt.return_some
                  (`Move
                     (rejected_response ~request_id:wire.request_id
                        Protocol.Types.rejection_invalid_request))
              | request ->
                let timing =
                  Metrics.start_move ~origin_conn_id:conn.id received_ns
                in
                Lwt.map
                  (fun result ->
                    (match result with
                     | Ok (Move_engine.Accepted accepted) ->
                       Connection_manager.flush_through manager
                         accepted.sequence
                     | _ -> ());
                    match result with
                    | Ok result ->
                      Some
                        (`Move
                           (response_of_result request.request_id (Ok result)))
                    | Error error ->
                      Some
                        (`Move
                           (response_of_result request.request_id
                              (Error error))))
                  (State_worker.submit ~timing worker request)))
        | 9 ->
          (match Protocol.Types.snapshot_request_of_bytes bytes with
           | None -> Lwt.return_some (`Snapshot (snapshot_failure (), []))
           | Some request ->
             let token =
               Connection_manager.begin_snapshot conn
                 ~board_x:request.board_x ~board_y:request.board_y
             in
             Lwt.map
               (fun result ->
                 match result with
                 | Ok (snapshot : State_worker.snapshot) ->
                   let released =
                     match
                       Connection_manager.complete_snapshot conn
                         ~board_x:request.board_x ~board_y:request.board_y
                         ~token ~revision:snapshot.revision
                     with
                     | Some events -> events
                     | None -> []
                   in
                   Some (`Snapshot (snapshot_success request snapshot, released))
                 | Error _ ->
                   Connection_manager.abort_snapshot conn
                     ~board_x:request.board_x ~board_y:request.board_y token;
                   Some
                     (`Snapshot
                        ( snapshot_failure ~request_id:request.request_id
                            ~board_x:request.board_x ~board_y:request.board_y (),
                          [] )))
               (State_worker.submit_snapshot worker
                  ~board_x:request.board_x ~board_y:request.board_y))
        | 10 ->
          (match Protocol.Types.piece_info_request_of_bytes bytes with
           | None -> Lwt.return_none
           | Some request ->
             Lwt.map
               (fun result ->
                 match result with
                 | Ok info ->
                   Some (`Piece_info (piece_info_response request info))
                 | Error _ -> None)
               (State_worker.submit_piece_info worker
                  ~board_x:request.board_x ~board_y:request.board_y
                  ~square:request.square))
        | 13 ->
          (match Protocol.Types.snapshot_batch_request_of_bytes bytes with
           | None -> Lwt.return_none
           | Some request ->
             let width = request.x1 - request.x0 + 1 in
             let height = request.y1 - request.y0 + 1 in
             let tokens =
               Array.init (width * height) (fun index ->
                   let board_x = request.x0 + (index mod width) in
                   let board_y = request.y0 + (index / width) in
                   ( board_x,
                     board_y,
                     Connection_manager.begin_snapshot conn ~board_x ~board_y ))
             in
             Lwt.map
               (fun result ->
                 match result with
                 | Ok (batch : State_worker.snapshot_batch) ->
                   let released = ref [] in
                   Array.iter
                     (fun (board_x, board_y, token) ->
                       let revision =
                         let index =
                           ((board_y - request.y0) * width)
                           + (board_x - request.x0)
                         in
                         fst batch.boards.(index)
                       in
                       match
                         Connection_manager.complete_snapshot conn ~board_x
                           ~board_y ~token ~revision
                       with
                       | Some events -> released := events @ !released
                       | None -> ())
                     tokens;
                   Some
                     (`Snapshot_batch
                        ( snapshot_batch_response request batch,
                          !released ))
                 | Error _ ->
                   Array.iter
                     (fun (board_x, board_y, token) ->
                       Connection_manager.abort_snapshot conn ~board_x
                         ~board_y token)
                     tokens;
                   None)
               (State_worker.submit_snapshot_batch worker ~x0:request.x0
                  ~y0:request.y0 ~x1:request.x1 ~y1:request.y1))
        | _ ->
          Lwt.return_some
            (`Move
               (rejected_response Protocol.Types.rejection_invalid_request))
      in
      (match%lwt response_lwt with
       | None -> loop ()
       | Some response ->
         let released =
           match response with
           | `Snapshot (_, released) | `Snapshot_batch (_, released) ->
             released
           | `Move _ | `Piece_info _ -> []
         in
         let bytes =
           match response with
           | `Move response ->
             Protocol.Types.wire_response_to_bytes
               (Protocol.Types.Wire_move response)
           | `Snapshot (response, _) ->
             Protocol.Types.wire_response_to_bytes
               (Protocol.Types.Wire_snapshot response)
           | `Snapshot_batch (batch, _) ->
             Protocol.Types.compact_snapshot_batch_to_bytes batch
           | `Piece_info info ->
             Protocol.Types.wire_response_to_bytes
               (Protocol.Types.Wire_piece_info info)
         in
         Connection_manager.flush_conn_events conn;
         let send = Connection_manager.send conn bytes in
         Connection_manager.release_snapshot_events conn released;
         let%lwt () = send in
         loop ())
  in
  Lwt.finalize
    (fun () ->
      Lwt.catch loop (fun exn ->
          Printf.eprintf "ws handler ended: %s\n%!" (Printexc.to_string exn);
          Lwt.return_unit))
    (fun () ->
      Connection_manager.unregister manager conn;
      Lwt.return_unit)

let () =
  let total_started = now_ns () in
  let allocation_started = now_ns () in
  let state = Game_state.create () in
  log_phase "game state allocation" allocation_started;
  let data_dir =
    match Sys.getenv_opt "SIM_MAP_DATA_DIR" with
    | Some dir -> dir
    | None -> "data"
  in
  let adaptive_enabled = int_env "SIM_MAP_ADAPTIVE" 1 <> 0 in
  let debug_gc_enabled = int_env "SIM_MAP_DEBUG_GC" 0 <> 0 in
  let port = max 1 (int_env "SIM_MAP_PORT" 8080) in
  let fixed_group = max 1 (int_env "SIM_MAP_WAL_GROUP" 64) in
  let fixed_delay_us = max 0 (int_env "SIM_MAP_WAL_GROUP_DELAY_US" 0) in
  let wal_sync = int_env "SIM_MAP_WAL_SYNC" 1 <> 0 in
  let adaptive_controller =
    if not adaptive_enabled then None
    else
      let config : Adaptive_commit.config =
        {
          Adaptive_commit.default_config with
          min_batch_size = max 1 (int_env "SIM_MAP_ADAPTIVE_MIN" 1);
          max_batch_size =
            max 1 (int_env "SIM_MAP_ADAPTIVE_MAX" 256);
          min_delay_us =
            max 0 (int_env "SIM_MAP_ADAPTIVE_MIN_DELAY_US" 0);
          max_delay_us =
            max 0 (int_env "SIM_MAP_ADAPTIVE_MAX_DELAY_US" 2_000);
          hysteresis_samples =
            max 1 (int_env "SIM_MAP_ADAPTIVE_HYSTERESIS" 3);
        }
      in
      Some (Adaptive_commit.create ~config ())
  in
  let persistence_config : Persistence.config =
    {
      data_dir;
      sync = wal_sync;
      group_size = fixed_group;
      strict_commit = (not adaptive_enabled) && fixed_group <= 1 && wal_sync;
      snapshot_every_moves = int_env "SIM_MAP_SNAPSHOT_MOVES" 100_000;
      snapshot_every_seconds = float_env "SIM_MAP_SNAPSHOT_SECONDS" 600.;
    }
  in
  let recovery_started = now_ns () in
  let persistence, recovery =
    match Persistence.recover persistence_config state with
    | Ok result -> result
    | Error message -> failwith ("persistence recovery failed: " ^ message)
  in
  log_phase "persistence recovery" recovery_started;
  at_exit (fun () -> Persistence.close persistence);
  let verify_started = now_ns () in
  let occupied = Game_state.occupied_count state in
  Printf.printf
    "recovery: sequence=%Ld snapshot=%s replayed=%d torn_tail=%b initialised=%b occupied=%d data_dir=%s\n%!"
    (Game_state.sequence state)
    (match recovery.snapshot_sequence with
     | None -> "none"
     | Some sequence -> Printf.sprintf "%Ld" sequence)
    recovery.replayed_transitions recovery.truncated_wal
    recovery.initialised_world occupied data_dir;
  if Int64.equal (Game_state.sequence state) 0L && occupied <> 32_000_000 then
    failwith "initial world does not contain 32,000,000 pieces";
  log_phase "recovery verification" verify_started;
  let worker_started = now_ns () in
  let outbox_capacity = max 1 (int_env "CONNECTION_OUTBOX_CAPACITY" 256) in
  let event_batching = int_env "EVENT_BATCHING" 1 <> 0 in
  let batch_window_s =
    max 0.0001 (float_env "EVENT_BATCH_WINDOW_MS" 1.0 /. 1000.)
  in
  let manager =
    Connection_manager.create ~max_outbox:outbox_capacity ~event_batching
      ~batch_window_s ()
  in
  let worker_ref = ref None in
  let request_snapshot () =
    match !worker_ref with
    | None -> ()
    | Some worker ->
      Persistence.request_started persistence;
      Lwt.async (fun () ->
          State_worker.request_snapshot worker >|= function
          | Ok () -> ()
          | Error _ -> Persistence.request_failed persistence)
  in
  let snapshot_due () =
    Persistence.move_snapshot_due persistence
    || Persistence.time_snapshot_due persistence
  in
  let on_commit committed =
    Connection_manager.enqueue_move manager committed;
    Persistence.note_commit persistence;
    if snapshot_due () then request_snapshot ()
  in
  let worker =
    State_worker.start ~on_commit
      ~precommit:(Persistence.before_commit persistence)
      ~on_snapshot:(Persistence.capture persistence)
      ~commit_policy:(fun () ->
        match adaptive_controller with
        | None ->
          {
            State_worker.max_batch = fixed_group;
            max_delay_s = float fixed_delay_us /. 1_000_000.;
          }
        | Some controller ->
          let policy = Adaptive_commit.policy controller in
          {
            State_worker.max_batch = policy.max_batch_size;
            max_delay_s = float policy.max_batch_delay_us /. 1_000_000.;
          })
      ~commit_group:(fun moves -> Persistence.sync persistence ~moves)
      ~on_fatal:(fun exn ->
        Printf.eprintf "fatal state worker failure: %s\n%!"
          (Printexc.to_string exn);
        flush stderr;
        flush stdout;
        (* There is no safe way to keep serving: the batch has been applied
           tentatively but its fsync failed. Restart recovers whatever reached
           the WAL; a crash here must not publish the failed group. *)
        Unix._exit 70)
      ~config:State_worker.default_config state
  in
  worker_ref := Some worker;
  (match adaptive_controller with
   | None -> ()
   | Some controller ->
     let last_moves = ref (State_worker.metrics worker).moves_submitted in
     let last_time = ref (Unix.gettimeofday ()) in
     let last_recipients, last_events = Metrics.recipients_and_events () in
     let last_recipients = ref last_recipients in
     let last_events = ref last_events in
     Lwt.async (fun () ->
         let rec loop () =
           Lwt_unix.sleep 0.1 >>= fun () ->
           let metrics = State_worker.metrics worker in
           let now = Unix.gettimeofday () in
           let dt = max 0.001 (now -. !last_time) in
           let moves =
             Int64.to_float (Int64.sub metrics.moves_submitted !last_moves)
           in
           last_moves := metrics.moves_submitted;
           last_time := now;
           let connection_metrics = Connection_manager.metrics manager in
           let p50, p95 = Persistence.sync_percentiles persistence in
           let event_lag =
             Metrics.recent_p95_ms Metrics.End_to_end_broadcast ~window:256
           in
           let recipients, events = Metrics.recipients_and_events () in
           let new_recipients = Int64.sub recipients !last_recipients in
           let new_events = Int64.sub events !last_events in
           last_recipients := recipients;
           last_events := events;
           let recipients_per_event =
             if Int64.compare new_events 0L <= 0 then 0.
             else
               Int64.to_float new_recipients
               /. Int64.to_float new_events
           in
           ignore
             (Adaptive_commit.sample controller
                {
                  Adaptive_commit.move_rate = moves /. dt;
                  pending_moves = metrics.move_queue_depth;
                  fsync_p50_us = p50;
                  fsync_p95_us = p95;
                  broadcast_backlog =
                    connection_metrics.total_outbox_depth;
                  event_lag_p95_ms = event_lag;
                  recipients_per_event;
                  snapshot_active = Persistence.snapshot_active persistence;
                });
           loop ()
         in
         loop ()));
  Lwt.async (fun () ->
      let rec timer () =
        Lwt_unix.sleep 1.0 >>= fun () ->
        if Persistence.time_snapshot_due persistence then request_snapshot ();
        timer ()
      in
      timer ());
  let stopping = ref false in
  let shutdown signal =
    if not !stopping then begin
      stopping := true;
      Printf.eprintf "received signal %d: draining worker and snapshot\n%!" signal;
      flush stderr;
      Lwt.async (fun () ->
          Lwt.pick
            [
              (State_worker.stop worker >>= fun () ->
               Persistence.wait_for_snapshot persistence >>= fun () ->
               Persistence.close persistence;
               Lwt.return_unit);
              (Lwt_unix.sleep 30. >>= fun () ->
               Printf.eprintf "shutdown drain timed out; exiting anyway\n%!";
               flush stderr;
               Lwt.return_unit);
            ]
          >|= fun () -> exit 0)
    end
  in
  Sys.set_signal Sys.sigterm (Sys.Signal_handle (fun _ -> shutdown Sys.sigterm));
  Sys.set_signal Sys.sigint (Sys.Signal_handle (fun _ -> shutdown Sys.sigint));
  log_phase "state worker startup" worker_started;
  log_phase "total startup" total_started;
  start_memprof ();

  Dream.run ~port
  @@ Dream.logger
  @@ cross_origin_isolation
  @@ Dream.router [
       Dream.get "/" (fun req ->
          Dream.from_filesystem "server/static" "index.html" req);
       Dream.get "/metrics" (fun _req ->
         Dream.respond
           ~headers:[ ("Content-Type", "application/json") ]
           (metrics_body manager worker persistence adaptive_controller ~fixed_group ~fixed_delay_us));
       Dream.get "/debug/memprof" (fun _req ->
         if int_env "SIM_MAP_MEMPROF" 0 = 0 then Dream.respond ~status:`Not_Found ""
         else
           Dream.respond
             ~headers:[ ("Content-Type", "application/json") ]
             (Yojson.Safe.to_string (memprof_json ())));
       Dream.get "/debug/gc" (fun _req ->
         if not debug_gc_enabled then Dream.respond ~status:`Not_Found ""
         else begin
           Gc.full_major ();
           Gc.compact ();
           Dream.respond
             ~headers:[ ("Content-Type", "application/json") ]
             (Yojson.Safe.to_string (memory_json ()))
         end);
       Dream.get "/state-hash" (fun _req ->
         let digest = Persistence.state_digest state in
         Dream.respond
           ~headers:[ ("Content-Type", "application/json") ]
           (Printf.sprintf "{\"sequence\":\"%Ld\",\"digest\":\"%s\"}"
              (Game_state.sequence state) digest));
       Dream.get "/healthz" (fun _req ->
         Dream.respond
           ~headers:[ ("Content-Type", "application/json") ]
           (Printf.sprintf "{\"status\":\"ok\",\"sequence\":\"%Ld\"}"
              (Game_state.sequence state)));
       Dream.get "/readyz" (fun _req ->
         Dream.respond
           ~headers:[ ("Content-Type", "application/json") ]
           (Printf.sprintf "{\"status\":\"ready\",\"sequence\":\"%Ld\"}"
              (Game_state.sequence state)));
       Dream.scope "/static" [] [
         Dream.get "/**" (Dream.static "_build/default/client");
       ];
       Dream.get "/ws" (fun _req ->
         (* The pinned httpun-ws patch makes a failed write discard its pending
            frame and close the read loop, so Dream's normal close path is safe. *)
         Dream.websocket (fun socket ->
           handle_socket manager worker socket));
     ]
