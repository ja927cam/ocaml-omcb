let cross_origin_isolation inner request =
  let%lwt response = inner request in
  Dream.set_header response "Cross-Origin-Opener-Policy" "same-origin";
  Dream.set_header response "Cross-Origin-Embedder-Policy" "require-corp";
  Lwt.return response

let now_ns () = Int64.of_float (Unix.gettimeofday () *. 1_000_000_000.)

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
  Lwt_unix.with_timeout 2.0 (fun () ->
      Dream.send ~text_or_binary:`Binary socket (Bytes.to_string bytes))

let snapshot_failure ?(request_id = 0l) ?(board_x = 0) ?(board_y = 0) () =
  Protocol.Types.
    {
      request_id;
      board_x;
      board_y;
      status = Snapshot_failed;
      revision = 0l;
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
  | `Snapshot of Protocol.Types.snapshot_response ]

let handle_socket manager worker socket =
  let conn =
    Connection_manager.register manager ~send_raw:(send_bytes socket)
  in
  let rec loop () =
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
                  (State_worker.submit worker request)))
        | 9 ->
          (match Protocol.Types.snapshot_request_of_bytes bytes with
           | None -> Lwt.return_some (`Snapshot (snapshot_failure ()))
           | Some request ->
             Lwt.map
               (fun result ->
                 match result with
                 | Ok snapshot ->
                   Some (`Snapshot (snapshot_success request snapshot))
                 | Error _ ->
                   Some
                     (`Snapshot
                        (snapshot_failure ~request_id:request.request_id
                           ~board_x:request.board_x
                           ~board_y:request.board_y ())))
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
         let wire_response =
           match response with
           | `Move response -> Protocol.Types.Wire_move response
           | `Snapshot response -> Protocol.Types.Wire_snapshot response
         in
         let bytes = Protocol.Types.wire_response_to_bytes wire_response in
         let%lwt () = Connection_manager.send conn bytes in
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
  let init_started = now_ns () in
  Game_state.initialise state;
  log_phase "world initialisation" init_started;
  let verify_started = now_ns () in
  let occupied = Game_state.occupied_count state in
  Printf.printf "initialisation verification: %d occupied squares\n%!" occupied;
  if occupied <> 32_000_000 then
    failwith "initial world does not contain 32,000,000 pieces";
  log_phase "initialisation verification" verify_started;
  let worker_started = now_ns () in
  let manager = Connection_manager.create () in
  let worker =
    State_worker.start
      ~on_commit:(Connection_manager.enqueue_move manager)
      ~config:State_worker.default_config state
  in
  log_phase "state worker startup" worker_started;
  log_phase "total startup" total_started;

  Dream.run ~port:8080
  @@ Dream.logger
  @@ cross_origin_isolation
  @@ Dream.router [
       Dream.get "/" (fun req ->
          Dream.from_filesystem "server/static" "index.html" req);
       Dream.scope "/static" [] [
         Dream.get "/**" (Dream.static "_build/default/client");
       ];
       Dream.get "/ws" (fun _req ->
         (* Dream 1.0.0~alpha8's WebSocket close path can busy-loop when the
            peer disconnects abruptly. Let the HTTP connection close when the
            handler returns instead of scheduling Dream's close frame. *)
         Dream.websocket ~close:false (fun socket ->
           handle_socket manager worker socket));
     ]
