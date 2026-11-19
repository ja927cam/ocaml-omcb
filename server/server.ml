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
     | Move_validator.Cross_board_capture ->
       Protocol.Types.rejection_cross_board_capture
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

let send_response socket response =
  let bytes = Protocol.Types.response_to_bytes response in
  Dream.send ~text_or_binary:`Binary socket (Bytes.to_string bytes)

let handle_socket worker socket =
  let rec loop () =
    match%lwt Dream.receive socket with
    | None -> Lwt.return_unit
    | Some data ->
      let response_lwt =
        match Protocol.Types.move_request_of_bytes (Bytes.of_string data) with
        | None ->
          Lwt.return
            (rejected_response Protocol.Types.rejection_invalid_request)
        | Some wire ->
          (match to_request wire with
           | exception Invalid_argument _ ->
             Lwt.return
               (rejected_response ~request_id:wire.request_id
                  Protocol.Types.rejection_invalid_request)
           | request ->
             Lwt.map
               (fun result ->
                 match result with
                 | Ok result ->
                   response_of_result request.request_id (Ok result)
                 | Error error ->
                   response_of_result request.request_id (Error error))
               (State_worker.submit worker request))
      in
      let%lwt response = response_lwt in
      Lwt.catch
        (fun () ->
          let%lwt () = send_response socket response in
          loop ())
        (fun _ -> Lwt.return_unit)
  in
  loop ()

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
  let worker =
    State_worker.start ~config:State_worker.default_config state
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
         Dream.websocket ~close:false (fun socket ->
           handle_socket worker socket));
     ]
