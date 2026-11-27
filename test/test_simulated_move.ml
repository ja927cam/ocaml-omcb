let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let board_pos x y = { Board.board_x = x; board_y = y }

let test_empty_board () =
  let board = Board.create () in
  check "empty board has no simulated move"
    (Simulated_move.pick ~random:(Random.State.make [| 1 |]) board ~board_x:10
       ~board_y:10 ~request_id:(-1l)
    = None)

let test_standard_board () =
  let board = Board.create () in
  Board.initialise_standard_position board (board_pos 500 500);
  let random = Random.State.make [| 0x51 |] in
  let accepted = ref 0 in
  for index = 1 to 64 do
    match
      Simulated_move.pick ~random board ~board_x:500 ~board_y:500
        ~request_id:(Int32.of_int (-index))
    with
    | None -> ()
    | Some request ->
      (match Move_validator.validate board request.move with
       | Move_validator.Illegal rejection ->
         failwith
           (Printf.sprintf "simulated move %d was illegal (%s)" index
              (match rejection with
               | Move_validator.Empty_source -> "empty source"
               | Move_validator.Invalid_geometry -> "invalid geometry"
               | Move_validator.Blocked_path -> "blocked path"
               | Move_validator.Invalid_destination -> "invalid destination"
               | Move_validator.Capture_off_original_board ->
                 "capture off original board"
               | Move_validator.Invalid_special_move -> "invalid special move"))
       | Move_validator.Legal info ->
         check "simulated destination stays on the board"
           (info.dst.board.board_x = 500 && info.dst.board.board_y = 500);
         check "simulated expected ID matches the source"
           (request.expected_piece_id = Piece.id info.moving_piece);
         check "simulated move does not capture a king"
           (Piece.is_empty info.captured_piece
           || Piece.piece_type info.captured_piece <> Piece.King);
         Move_processor.apply board info;
         incr accepted)
  done;
  check "picked a useful number of legal moves" (!accepted >= 32)

let () =
  test_empty_board ();
  test_standard_board ();
  print_endline "simulated move tests: OK"
