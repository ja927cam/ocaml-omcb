let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let pos bx by x y =
  { Board.board = { board_x = bx; board_y = by }; square = { x; y } }

let count_board board bp =
  let count = ref 0 in
  Board.iter_board board bp (fun _ piece ->
      if not (Piece.is_empty piece) then incr count);
  !count

let () =
  let state = Game_state.create () in
  let with_ledger f =
    Game_state.with_state state (fun ~board:_ ~ledger ~sequence ->
        (sequence, f ledger))
  in
  let with_board f =
    Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
        (sequence, f board))
  in
  check "sequence starts at zero" (Game_state.sequence state = 0L);
  check "ledger latest starts at zero"
    (Ledger.latest_seq (with_ledger Fun.id) = 0L);
  check "ledger next starts at one"
    (Ledger.next_seq (with_ledger Fun.id) = 1L);
  check "ledger oldest" (Ledger.oldest_seq (with_ledger Fun.id) = 1L);
  check "no first event" (Ledger.get_event (with_ledger Fun.id) 1L = None);

  Game_state.initialise state;
  let ledger = with_ledger Fun.id in
  check "ledger latest after initialisation" (Ledger.latest_seq ledger = 0L);
  check "ledger next after initialisation" (Ledger.next_seq ledger = 1L);
  let board = with_board Fun.id in
  check "32m occupied" (Board.occupied_count board = 32_000_000);
  check "sequence still zero" (Game_state.sequence state = 0L);

  let corners =
    [ { Board.board_x = 0; board_y = 0 };
      { Board.board_x = 999; board_y = 0 };
      { Board.board_x = 0; board_y = 999 };
      { Board.board_x = 999; board_y = 999 } ]
  in
  List.iter
    (fun bp -> check "32 pieces per corner" (count_board board bp = 32))
    corners;

  let black_rook = Board.get board (pos 0 0 0 0) in
  let black_king = Board.get board (pos 0 0 4 0) in
  let white_pawn = Board.get board (pos 0 0 0 6) in
  let white_rook = Board.get board (pos 0 0 7 7) in
  check "corner black rook"
    (Piece.piece_type black_rook = Piece.Rook
    && not (Piece.is_white black_rook));
  check "corner black king"
    (Piece.piece_type black_king = Piece.King
    && not (Piece.is_white black_king));
  check "corner white pawn"
    (Piece.piece_type white_pawn = Piece.Pawn && Piece.is_white white_pawn);
  check "corner white rook"
    (Piece.piece_type white_rook = Piece.Rook && Piece.is_white white_rook);
  check "initial counts"
    (Piece.move_count black_rook = 0
    && Piece.capture_count black_rook = 0
    && not (Piece.adopted black_rook));

  (* Exhaustive ID uniqueness and bounds. *)
  let seen = Bytes.make ((32_000_000 + 7) / 8) '\000' in
  let pieces = ref 0 in
  let min_id = ref max_int in
  let max_id = ref 0 in
  for by = 0 to 999 do
    for bx = 0 to 999 do
      let squares =
        Board.get_board board { Board.board_x = bx; board_y = by }
      in
      for i = 0 to 63 do
        let piece = squares.(i) in
        if not (Piece.is_empty piece) then begin
          incr pieces;
          let id = Int32.to_int (Piece.id piece) in
          if id < !min_id then min_id := id;
          if id > !max_id then max_id := id;
          let byte = (id - 1) lsr 3 and bit = (id - 1) land 7 in
          let current = Char.code (Bytes.get seen byte) in
          if current land (1 lsl bit) <> 0 then
            failwith "FAIL: duplicate piece ID";
          Bytes.set seen byte (Char.chr (current lor (1 lsl bit)))
        end
      done
    done
  done;
  check "32m pieces enumerated" (!pieces = 32_000_000);
  check "minimum ID" (!min_id = 1);
  check "maximum ID" (!max_id = 32_000_000);
  check "first board id formula"
    (Piece.id (Board.get board (pos 0 0 0 0)) = 1l);
  check "last board id formula"
    (Piece.id (Board.get board (pos 999 999 7 7)) = 32_000_000l);
  Printf.printf "All Game_state initialisation tests passed.\n"
