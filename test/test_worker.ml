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

let accepted_sequence = function
  | Ok (Move_engine.Accepted accepted) -> accepted.sequence
  | Ok (Move_engine.Rejected _) -> failwith "expected accepted"
  | Error _ -> failwith "expected worker result"

let () =
  let state = Game_state.create () in
  let board = Game_state.board state in
  let p0 = piece Piece.Pawn true in
  let p1 = piece Piece.Pawn true in
  place board 0 0 0 6 p0;
  place board 1 0 0 6 p1;

  let worker = State_worker.start ~config:{ queue_capacity = 8 } state in
  let r1 =
    State_worker.submit worker
      (request 1l (pos 0 0 0 6) (pos 0 0 0 5) (Piece.id p0))
  in
  let r2 =
    State_worker.submit worker
      (request 2l (pos 1 0 0 6) (pos 1 0 0 5) (Piece.id p1))
  in
  let results = Lwt_main.run (Lwt.all [ r1; r2 ]) in
  check "two accepted" (List.for_all (fun r -> Result.is_ok r) results);
  check "fifo sequence 1"
    (accepted_sequence (List.nth results 0) = 1L);
  check "fifo sequence 2"
    (accepted_sequence (List.nth results 1) = 2L);
  check "sequence after two" (Game_state.sequence state = 2L);

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

  let metrics = State_worker.metrics worker in
  check "metrics processed" (metrics.requests_processed = 3L);
  check "metrics rejected" (metrics.requests_rejected = 1L);
  check "metrics queue depth" (metrics.queue_depth = 0);
  check "metrics capacity" (metrics.queue_capacity = 8);
  Lwt_main.run (State_worker.stop worker);

  (* Stopping with an accepted request pending still processes it. *)
  let p4 = piece Piece.Knight true in
  place board 0 0 6 6 p4;
  let worker = State_worker.start ~config:{ queue_capacity = 8 } state in
  let pending =
    State_worker.submit worker
      (request 6l (pos 0 0 6 6) (pos 0 0 7 4) (Piece.id p4))
  in
  let stopped = State_worker.stop worker in
  let result, () = Lwt_main.run (Lwt.both pending stopped) in
  check "pending processed on stop"
    (match result with
     | Ok (Move_engine.Accepted accepted) -> accepted.request_id = 6l
     | _ -> false);

  Printf.printf "All State_worker tests passed.\n"
