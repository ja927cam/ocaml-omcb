let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let pos bx by x y =
  { Board.board = { board_x = bx; board_y = by }; square = { x; y } }

let next_id = ref 1

let piece piece_type is_white =
  let id = !next_id in
  incr next_id;
  Piece.create ~id:(Int32.of_int id) ~piece_type ~is_white

let place board bx by x y p = Board.set board (pos bx by x y) p

let request request_id src dst id =
  Move_request.create ~request_id
    ~move:(Move.create ~src ~dst)
    ~expected_piece_id:id

let snapshot_board = function
  | Ok snapshot -> snapshot.State_worker.board
  | Error _ -> failwith "expected snapshot"

let accepted_sequence = function
  | Ok (Move_engine.Accepted accepted) -> accepted.sequence
  | Ok (Move_engine.Rejected _) -> failwith "expected accepted"
  | Error _ -> failwith "expected worker result"

let () =
  let state = Game_state.create () in
  let board = Game_state.with_state state (fun ~board ~ledger:_ ~sequence -> (sequence, board)) in
  let p0 = piece Piece.Pawn true in
  let p1 = piece Piece.Pawn true in
  place board 0 0 0 6 p0;
  place board 1 0 0 6 p1;

  let worker = State_worker.start ~config:{ queue_capacity = 8 } state in
  let before = State_worker.submit_snapshot worker ~board_x:0 ~board_y:0 in
  let r1 =
    State_worker.submit worker
      (request 1l (pos 0 0 0 6) (pos 0 0 0 5) (Piece.id p0))
  in
  let r2 =
    State_worker.submit worker
      (request 2l (pos 1 0 0 6) (pos 1 0 0 5) (Piece.id p1))
  in
  let before, results = Lwt_main.run (Lwt.both before (Lwt.all [ r1; r2 ])) in
  let before = snapshot_board before in
  check "snapshot before move source" (Piece.id before.(48) = Piece.id p0);
  check "snapshot before move destination" (Piece.is_empty before.(40));
  check "two accepted" (List.for_all (fun r -> Result.is_ok r) results);
  check "fifo sequence 1"
    (accepted_sequence (List.nth results 0) = 1L);
  check "fifo sequence 2"
    (accepted_sequence (List.nth results 1) = 2L);
  check "sequence after two" (Game_state.sequence state = 2L);

  let after0 = snapshot_board
      (Lwt_main.run (State_worker.submit_snapshot worker ~board_x:0 ~board_y:0)) in
  let after1 = snapshot_board
      (Lwt_main.run (State_worker.submit_snapshot worker ~board_x:1 ~board_y:0)) in
  check "snapshot after move source" (Piece.is_empty after0.(48));
  check "snapshot after move destination" (Piece.id after0.(40) = Piece.id p0);
  check "snapshot other board" (Piece.id after1.(40) = Piece.id p1);

  (* Stale piece ID is rejected without advancing sequence. *)
  let p2 = piece Piece.Pawn true in
  place board 0 0 2 6 p2;
  let stale =
    Lwt_main.run
      (State_worker.submit worker
         (request 3l (pos 0 0 2 6) (pos 0 0 2 5)
            (Int32.succ (Piece.id p2))))
  in
  (match stale with
   | Ok (Move_engine.Rejected { reason = Move_engine.Stale_piece; _ }) -> ()
   | _ -> failwith "expected Stale_piece");
  check "stale sequence unchanged" (Game_state.sequence state = 2L);

  (* Two concurrent requests for the same piece: only the first can win. *)
  let p3 = piece Piece.Rook true in
  place board 0 0 4 4 p3;
  let same_a =
    State_worker.submit worker
      (request 4l (pos 0 0 4 4) (pos 0 0 4 5) (Piece.id p3))
  in
  let same_b =
    State_worker.submit worker
      (request 5l (pos 0 0 4 4) (pos 0 0 4 5) (Piece.id p3))
  in
  let same_results = Lwt_main.run (Lwt.all [ same_a; same_b ]) in
  check "same piece one accepted"
    (match List.nth same_results 0 with
     | Ok (Move_engine.Accepted accepted) -> accepted.sequence = 3L
     | _ -> false);
  check "same piece one rejected"
    (match List.nth same_results 1 with
     | Ok (Move_engine.Rejected _) -> true
     | _ -> false);
  check "same piece sequence once" (Game_state.sequence state = 3L);

  let metrics = State_worker.metrics worker in
  check "metrics processed" (metrics.requests_processed = 8L);
  check "metrics rejected" (metrics.requests_rejected = 2L);
  check "metrics queue depth" (metrics.queue_depth = 0);
  check "metrics capacity" (metrics.queue_capacity = 8);
  Lwt_main.run (State_worker.stop worker);

  (* Bounded queue rejects the second request when capacity is one. *)
  let p4 = piece Piece.Knight true in
  place board 0 0 6 6 p4;
  let limited = State_worker.start ~config:{ queue_capacity = 1 } state in
  let first =
    State_worker.submit limited
      (request 6l (pos 0 0 6 6) (pos 0 0 7 4) (Piece.id p4))
  in
  let second =
    State_worker.submit_snapshot limited ~board_x:0 ~board_y:0
  in
  check "queue full"
    (match Lwt_main.run second with
     | Error State_worker.Queue_full -> true
     | _ -> false);
  ignore (Lwt_main.run first);
  Lwt_main.run (State_worker.stop limited);

  (* Stopping with an accepted request pending still processes it. *)
  let p5 = piece Piece.Knight true in
  place board 0 0 6 2 p5;
  let worker = State_worker.start ~config:{ queue_capacity = 8 } state in
  let pending =
    State_worker.submit worker
      (request 8l (pos 0 0 6 2) (pos 0 0 5 4) (Piece.id p5))
  in
  let stopped = State_worker.stop worker in
  let result, () = Lwt_main.run (Lwt.both pending stopped) in
  check "pending processed on stop"
    (match result with
     | Ok (Move_engine.Accepted accepted) -> accepted.request_id = 8l
     | _ -> false);

  (* Snapshot queued before shutdown is still processed. *)
  let worker = State_worker.start ~config:{ queue_capacity = 8 } state in
  let pending =
    State_worker.submit_snapshot worker ~board_x:0 ~board_y:0
  in
  let stopped = State_worker.stop worker in
  let snapshot, () = Lwt_main.run (Lwt.both pending stopped) in
  check "pending snapshot processed on stop"
    (Array.length (snapshot_board snapshot) = 64);

  (* Committed events carry exact changed squares and board revisions. *)
  let state = Game_state.create () in
  let board =
    Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
        (sequence, board))
  in
  let events = ref [] in
  let worker =
    State_worker.start
      ~on_commit:(fun event -> events := event :: !events)
      ~config:{ queue_capacity = 16 } state
  in
  let submit_move request_id src dst moving =
    match
      Lwt_main.run
        (State_worker.submit worker
           (request request_id src dst (Piece.id moving)))
    with
    | Ok (Move_engine.Accepted _) -> ()
    | _ -> failwith "expected accepted move"
  in
  let pawn = piece Piece.Pawn true in
  place board 0 0 4 6 pawn;
  submit_move 21l (pos 0 0 4 6) (pos 0 0 4 4) pawn;

  let rook = piece Piece.Rook true in
  let captured = piece Piece.Pawn false in
  place board 1 0 0 4 rook;
  place board 1 0 1 4 captured;
  submit_move 22l (pos 1 0 0 4) (pos 1 0 1 4) rook;

  let king = piece Piece.King true in
  let castle_rook = piece Piece.Rook true in
  place board 2 0 4 7 king;
  place board 2 0 7 7 castle_rook;
  submit_move 23l (pos 2 0 4 7) (pos 2 0 6 7) king;

  let ep = piece Piece.Pawn true in
  let ep_captured =
    piece Piece.Pawn false |> fun p -> Piece.with_just_double_moved p true
  in
  place board 3 0 4 4 ep;
  place board 3 0 3 4 ep_captured;
  submit_move 24l (pos 3 0 4 4) (pos 3 0 3 3) ep;

  let promo = piece Piece.Pawn true in
  place board 4 0 4 1 promo;
  submit_move 25l (pos 4 0 4 1) (pos 4 0 4 0) promo;

  Lwt_main.run (State_worker.stop worker);
  let events = List.rev !events in
  check "committed event count" (List.length events = 5);
  let event_for bx by =
    match
      List.find_opt
        (fun (event : State_worker.committed) ->
          List.exists
            (fun (board : State_worker.event_board) ->
              board.board_x = bx && board.board_y = by)
            event.boards)
        events
    with
    | Some event -> event
    | None -> failwith "missing committed event"
  in
  let board_of (event : State_worker.committed) bx by =
    List.find
      (fun (board : State_worker.event_board) ->
        board.board_x = bx && board.board_y = by)
      event.boards
  in
  let change board square =
    List.assoc_opt square board.State_worker.changes
  in
  let e0 = event_for 0 0 in
  let b0 = board_of e0 0 0 in
  check "normal revision" (b0.revision = 1L);
  check "normal source" (change b0 52 = Some Piece.empty);
  check "normal destination" (change b0 36 <> Some Piece.empty);

  let e1 = event_for 1 0 in
  let b1 = board_of e1 1 0 in
  check "capture source" (change b1 32 = Some Piece.empty);
  check "capture destination" (change b1 33 <> Some Piece.empty);

  let e2 = event_for 2 0 in
  let b2 = board_of e2 2 0 in
  check "castle king source" (change b2 60 = Some Piece.empty);
  check "castle rook source" (change b2 63 = Some Piece.empty);
  check "castle king destination" (change b2 62 <> Some Piece.empty);
  check "castle rook destination" (change b2 61 <> Some Piece.empty);

  let e3 = event_for 3 0 in
  let b3 = board_of e3 3 0 in
  check "en passant source" (change b3 36 = Some Piece.empty);
  check "en passant captured" (change b3 35 = Some Piece.empty);
  check "en passant destination" (change b3 27 <> Some Piece.empty);

  let e4 = event_for 4 0 in
  let b4 = board_of e4 4 0 in
  check "promotion source" (change b4 12 = Some Piece.empty);
  check "promotion destination"
    (match change b4 4 with
     | Some piece ->
       Piece.piece_type piece = Piece.Promoted_pawn && Piece.is_white piece
     | None -> false);

  Printf.printf "All State_worker tests passed.\n"
