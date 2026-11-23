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
      ("requests_processed", `Intlit (Int64.to_string m.requests_processed));
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
      ("outbox_capacity", `Int m.outbox_capacity);
      ("event_batching", `Bool m.event_batching);
    ]

let metrics_body manager worker persistence =
  let worker_metrics = State_worker.metrics worker in
  let connection_metrics = Connection_manager.metrics manager in
  Yojson.Safe.to_string
    (Metrics.json
       ~extra:
         [
           ("worker", worker_metrics_json worker_metrics);
           ("connections", connection_metrics_json connection_metrics);
           ("persistence", Persistence.metrics_json persistence);
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
  | `Snapshot of Protocol.Types.snapshot_response * Protocol.Types.move_event list ]

let handle_socket manager worker socket =
  let conn =
    Connection_manager.register manager ~send_raw:(send_bytes socket)
      ~close_raw:(fun () -> Dream.close_websocket socket)
  in
  let rec loop () =
    match%lwt
      Lwt.pick
        [
          (Dream.receive socket >|= fun data -> `Data data);
          (Connection_manager.wait_closed conn >|= fun () -> `Closed);
        ]
    with
    | `Closed -> Lwt.return_unit
    | `Data None -> Lwt.return_unit
    | `Data (Some data) ->
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
           | `Snapshot (_, released) -> released
           | `Move _ -> []
         in
         let wire_response =
           match response with
           | `Move response -> Protocol.Types.Wire_move response
           | `Snapshot (response, _) -> Protocol.Types.Wire_snapshot response
         in
         let bytes = Protocol.Types.wire_response_to_bytes wire_response in
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
  let persistence_config : Persistence.config =
    {
      data_dir;
      sync = int_env "SIM_MAP_WAL_SYNC" 1 <> 0;
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
      ~config:State_worker.default_config state
  in
  worker_ref := Some worker;
  Lwt.async (fun () ->
      let rec timer () =
        Lwt_unix.sleep 1.0 >>= fun () ->
        if Persistence.time_snapshot_due persistence then request_snapshot ();
        timer ()
      in
      timer ());
  log_phase "state worker startup" worker_started;
  log_phase "total startup" total_started;

  Dream.run ~port:8080
  @@ Dream.logger
  @@ cross_origin_isolation
  @@ Dream.router [
       Dream.get "/" (fun req ->
          Dream.from_filesystem "server/static" "index.html" req);
       Dream.get "/metrics" (fun _req ->
         Dream.respond
           ~headers:[ ("Content-Type", "application/json") ]
           (metrics_body manager worker persistence));
       Dream.get "/state-hash" (fun _req ->
         let digest = Persistence.state_digest state in
         Dream.respond
           ~headers:[ ("Content-Type", "application/json") ]
           (Printf.sprintf "{\"sequence\":\"%Ld\",\"digest\":\"%s\"}"
              (Game_state.sequence state) digest));
       Dream.scope "/static" [] [
         Dream.get "/**" (Dream.static "_build/default/client");
       ];
       Dream.get "/ws" (fun _req ->
         (* The pinned httpun-ws patch makes a failed write discard its pending
            frame and close the read loop, so Dream's normal close path is safe. *)
         Dream.websocket (fun socket ->
           handle_socket manager worker socket));
     ]
