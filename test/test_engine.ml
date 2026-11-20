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

let move_request request_id src dst expected_piece_id =
  Move_request.create ~request_id
    ~move:(Move.create ~src ~dst)
    ~expected_piece_id

let expect_accepted = function
  | Move_engine.Accepted accepted -> accepted
  | Move_engine.Rejected { reason; _ } ->
    failwith
      ("expected accepted, got rejection "
      ^ (match reason with
        | Move_engine.Stale_piece -> "Stale_piece"
        | Move_engine.Invalid_move _ -> "Invalid_move"))

let expect_rejected expected = function
  | Move_engine.Accepted _ -> failwith "expected rejection"
  | Move_engine.Rejected { reason; _ } ->
    check "rejection reason" (reason = expected)

let () =
  let state = Game_state.create () in
  let with_ledger f =
    Game_state.with_state state (fun ~board:_ ~ledger ~sequence ->
        (sequence, f ledger))
  in
  let board =
    Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
        (sequence, board))
  in
  let b0 = { Board.board_x = 0; board_y = 0 } in
  let b1 = { Board.board_x = 1; board_y = 0 } in

  (* Accepted pawn move, sequence and ledger. *)
  let pawn = piece Piece.Pawn true in
  place board 0 0 4 6 pawn;
  let accepted =
    expect_accepted
      (Move_engine.process state
         (move_request 10l (pos 0 0 4 6) (pos 0 0 4 4) (Piece.id pawn)))
  in
  check "accepted request id" (accepted.request_id = 10l);
  check "first sequence" (accepted.sequence = 1L);
  check "sequence advanced" (Game_state.sequence state = 1L);
  check "ledger head" (Ledger.next_seq (with_ledger Fun.id) = 2L);
  check "source empty" (Piece.is_empty (Board.get board (pos 0 0 4 6)));
  check "destination" (Piece.id (Board.get board (pos 0 0 4 4)) = Piece.id pawn);
  (match Ledger.get_event (with_ledger Fun.id) 1L with
   | None -> failwith "missing ledger event 1"
   | Some event ->
     check "event moved id" (event.moved_piece_id = Piece.id pawn);
     check "event captured id" (event.captured_piece_id = 0l);
     check "event flags" (Int16.to_int event.flags = 0));
  check "no rejection" (accepted.captured_piece |> Piece.is_empty);

  (* Stale expected ID. *)
  let stale_piece = piece Piece.Pawn true in
  place board 1 0 1 6 stale_piece;
  expect_rejected Move_engine.Stale_piece
    (Move_engine.process state
       (move_request 11l (pos 1 0 1 6) (pos 1 0 1 4)
          (Int32.succ (Piece.id stale_piece))));
  check "stale sequence unchanged" (Game_state.sequence state = 1L);
  check "stale ledger unchanged"
    (Ledger.next_seq (with_ledger Fun.id) = 2L);
  check "stale board unchanged"
    (Piece.id (Board.get board (pos 1 0 1 6)) = Piece.id stale_piece);

  (* Invalid move leaves everything unchanged. *)
  let rook = piece Piece.Rook true in
  let blocker = piece Piece.Pawn false in
  place board 1 0 4 4 rook;
  place board 1 0 4 5 blocker;
  let before_sequence = Game_state.sequence state in
  let before_ledger = Ledger.next_seq (with_ledger Fun.id) in
  expect_rejected
    (Move_engine.Invalid_move Move_validator.Blocked_path)
    (Move_engine.process state
       (move_request 12l (pos 1 0 4 4) (pos 1 0 4 6) (Piece.id rook)));
  check "invalid sequence unchanged" (Game_state.sequence state = before_sequence);
  check "invalid ledger unchanged"
    (Ledger.next_seq (with_ledger Fun.id) = before_ledger);
  check "invalid board source" (Piece.id (Board.get board (pos 1 0 4 4)) = Piece.id rook);
  check "invalid board blocker"
    (Piece.id (Board.get board (pos 1 0 4 5)) = Piece.id blocker);

  (* Capture metadata. *)
  Board.clear_board board b1;
  let white_rook = piece Piece.Rook true in
  let black_knight = piece Piece.Knight false in
  place board 1 0 4 4 white_rook;
  place board 1 0 7 4 black_knight;
  let capture =
    expect_accepted
      (Move_engine.process state
         (move_request 13l (pos 1 0 4 4) (pos 1 0 7 4)
            (Piece.id white_rook)))
  in
  check "capture sequence" (capture.sequence = 2L);
  check "capture id" (Piece.id capture.captured_piece = Piece.id black_knight);
  let snapshot1 = Game_state.snapshot_board state ~board_x:1 ~board_y:0 in
  check "capture snapshot destination" (Piece.id snapshot1.(39) = Piece.id white_rook);
  check "capture snapshot source" (Piece.is_empty snapshot1.(36));
  (match Ledger.get_event (with_ledger Fun.id) 2L with
   | None -> failwith "missing ledger event 2"
   | Some event ->
     check "ledger captured" (event.captured_piece_id = Piece.id black_knight));

  (* En passant flag and captured pawn. *)
  Board.clear_board board b0;
  let epp = piece Piece.Pawn true in
  let epc = piece Piece.Pawn false |> fun p -> Piece.with_just_double_moved p true in
  place board 0 0 4 3 epp;
  place board 0 0 3 3 epc;
  let ep =
    expect_accepted
      (Move_engine.process state
         (move_request 14l (pos 0 0 4 3) (pos 0 0 3 2) (Piece.id epp)))
  in
  check "en passant captured" (Piece.id ep.captured_piece = Piece.id epc);
  check "en passant destination empty"
    (Piece.is_empty (Board.get board (pos 0 0 3 3)));
  let snapshot_ep = Game_state.snapshot_board state ~board_x:0 ~board_y:0 in
  check "en passant snapshot pawn" (Piece.id snapshot_ep.(19) = Piece.id epp);
  check "en passant snapshot captured square"
    (Piece.is_empty snapshot_ep.(27));
  (match Ledger.get_event (with_ledger Fun.id) 3L with
   | None -> failwith "missing ledger event 3"
   | Some event ->
     check "en passant flag"
       (Int16.to_int event.flags = Move_engine.flag_en_passant);
     check "en passant captured id" (event.captured_piece_id = Piece.id epc));

  (* Castling flag and both pieces moved. *)
  Board.clear_board board b0;
  let king = piece Piece.King true in
  let rook2 = piece Piece.Rook true in
  place board 0 0 4 7 king;
  place board 0 0 7 7 rook2;
  let _castle =
    expect_accepted
      (Move_engine.process state
         (move_request 15l (pos 0 0 4 7) (pos 0 0 6 7) (Piece.id king)))
  in
  check "castle king" (Piece.id (Board.get board (pos 0 0 6 7)) = Piece.id king);
  check "castle rook" (Piece.id (Board.get board (pos 0 0 5 7)) = Piece.id rook2);
  let snapshot_castle = Game_state.snapshot_board state ~board_x:0 ~board_y:0 in
  check "castle snapshot king" (Piece.id snapshot_castle.(62) = Piece.id king);
  check "castle snapshot rook" (Piece.id snapshot_castle.(61) = Piece.id rook2);
  (match Ledger.get_event (with_ledger Fun.id) 4L with
   | None -> failwith "missing ledger event 4"
   | Some event ->
     check "castle flag"
       (Int16.to_int event.flags = Move_engine.flag_castle));

  (* Promotion flag, ID preserved. *)
  Board.clear_board board b0;
  let promo = piece Piece.Pawn true in
  place board 0 0 4 1 promo;
  let promoted =
    expect_accepted
      (Move_engine.process state
         (move_request 16l (pos 0 0 4 1) (pos 0 0 4 0) (Piece.id promo)))
  in
  check "promotion id" (Piece.id promoted.moved_piece = Piece.id promo);
  check "promotion type"
    (Piece.piece_type promoted.moved_piece = Piece.Promoted_pawn);
  let snapshot_promoted = Game_state.snapshot_board state ~board_x:0 ~board_y:0 in
  check "promotion snapshot type"
    (Piece.piece_type snapshot_promoted.(4) = Piece.Promoted_pawn);
  (match Ledger.get_event (with_ledger Fun.id) 5L with
   | None -> failwith "missing ledger event 5"
   | Some event ->
     check "promotion flag"
       (Int16.to_int event.flags = Move_engine.flag_promotion));

  check "final sequence" (Game_state.sequence state = 5L);

  (* Client signature identifies the source without a 25-bit ID. *)
  let signature_piece = piece Piece.Rook true in
  place board 2 0 0 0 signature_piece;
  let signature = Piece.client_signature ~square:0 signature_piece in
  let signature_accepted =
    expect_accepted
      (Move_engine.process state
         (move_request 12l (pos 2 0 0 0) (pos 2 0 0 2) signature))
  in
  check "signature accepted" (signature_accepted.request_id = 12l);
  check "signature piece moved"
    (Piece.id (Board.get board (pos 2 0 0 2)) = Piece.id signature_piece);
  let stale_signature_piece = piece Piece.Rook true in
  place board 3 0 0 0 stale_signature_piece;
  expect_rejected Move_engine.Stale_piece
    (Move_engine.process state
       (move_request 13l (pos 3 0 0 0) (pos 3 0 0 2)
          (Int32.succ (Piece.client_signature ~square:0 stale_signature_piece))));

  ignore b0;
  Printf.printf "All Move_engine transaction tests passed.\n"
