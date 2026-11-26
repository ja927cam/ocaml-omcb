open Move_validator
let world = Board.create ()

let b0 = { Board.board_x = 0; board_y = 0 }
let b1 = { Board.board_x = 1; board_y = 0 }
let b4 = { Board.board_x = 4; board_y = 0 }
let last_board = { Board.board_x = 999; board_y = 999 }
let boards = [ b0; b1; b4; last_board ]

let reset () = List.iter (Board.clear_board world) boards

let pos bx by x y =
  { Board.board = { board_x = bx; board_y = by }; square = { x; y } }

let next_id = ref 1

let new_piece piece_type is_white =
  let id = !next_id in
  incr next_id;
  Piece.create ~id:(Int32.of_int id) ~piece_type ~is_white

let place piece_type is_white bx by x y =
  let piece = new_piece piece_type is_white in
  Board.set world (pos bx by x y) piece;
  piece

let put piece bx by x y = Board.set world (pos bx by x y) piece

let piece_at bx by x y = Board.get world (pos bx by x y)

let move src dst = Move.create ~src ~dst

let rejection_name = function
  | Move_validator.Empty_source -> "Empty_source"
  | Move_validator.Invalid_geometry -> "Invalid_geometry"
  | Move_validator.Blocked_path -> "Blocked_path"
  | Move_validator.Invalid_destination -> "Invalid_destination"
  | Move_validator.Capture_off_original_board ->
    "Capture_off_original_board"
  | Move_validator.Invalid_special_move -> "Invalid_special_move"

let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let expect_legal m =
  match Move_validator.validate world m with
  | Move_validator.Legal info -> info
  | Move_validator.Illegal rejection ->
    failwith
      (Printf.sprintf "expected legal %s, got %s" (Move.to_string m)
         (rejection_name rejection))

let expect_illegal expected m =
  match Move_validator.validate world m with
  | Move_validator.Illegal rejection when rejection = expected -> ()
  | Move_validator.Illegal rejection ->
    failwith
      (Printf.sprintf "expected %s for %s, got %s" (rejection_name expected)
         (Move.to_string m) (rejection_name rejection))
  | Move_validator.Legal _ ->
    failwith
      (Printf.sprintf "expected illegal %s, got legal" (Move.to_string m))

let apply m =
  let info = expect_legal m in
  Move_processor.apply world info;
  info

let test_move_type () =
  let src = pos 0 0 4 6 and dst = pos 0 0 4 4 in
  let m = Move.create ~src ~dst in
  check "move src" (m.Move.src = src);
  check "move dst" (m.Move.dst = dst);
  check "move to_string" (String.length (Move.to_string m) > 0)

let test_empty_and_bounds () =
  reset ();
  expect_illegal Empty_source (move (pos 0 0 0 0) (pos 0 0 0 1));
  expect_illegal Empty_source (move (pos 1000 0 0 0) (pos 0 0 0 0));
  expect_illegal Invalid_destination (move (pos 0 0 0 0) (pos 1000 0 0 0));
  let _ = place Piece.Pawn true 0 0 0 0 in
  expect_illegal Invalid_geometry (move (pos 0 0 0 0) (pos 0 0 0 0));
  let _ = place Piece.Pawn true 0 0 0 1 in
  expect_illegal Invalid_destination (move (pos 0 0 0 0) (pos 0 0 0 1))

let test_pawn () =
  reset ();
  let pawn = place Piece.Pawn true 0 0 4 6 in
  let info = apply (move (pos 0 0 4 6) (pos 0 0 4 4)) in
  check "pawn double no capture" (Piece.is_empty info.captured_piece);
  check "pawn classification" (info.kind = Move_validator.Normal);
  check "pawn double source empty" (Piece.is_empty (piece_at 0 0 4 6));
  let moved = piece_at 0 0 4 4 in
  check "pawn double id" (Piece.id moved = Piece.id pawn);
  check "pawn double count" (Piece.move_count moved = 1);
  check "pawn double flag" (Piece.just_double_moved moved);

  let _ = apply (move (pos 0 0 4 4) (pos 0 0 4 3)) in
  let moved = piece_at 0 0 4 3 in
  check "pawn single count" (Piece.move_count moved = 2);
  check "pawn single clears double flag" (not (Piece.just_double_moved moved));
  expect_illegal Invalid_geometry (move (pos 0 0 4 3) (pos 0 0 4 1));

  let _ = place Piece.Pawn true 0 0 0 2 in
  expect_illegal Invalid_geometry (move (pos 0 0 0 2) (pos 0 0 0 3));

  reset ();
  let _ = place Piece.Pawn true 0 0 4 4 in
  let _ = place Piece.Knight false 0 0 4 3 in
  expect_illegal Invalid_geometry (move (pos 0 0 4 4) (pos 0 0 4 3));

  reset ();
  let _ = place Piece.Pawn true 0 0 4 4 in
  let knight = place Piece.Knight false 0 0 3 3 in
  let info = apply (move (pos 0 0 4 4) (pos 0 0 3 3)) in
  check "pawn capture piece" (Piece.id info.captured_piece = Piece.id knight);
  let moved = piece_at 0 0 3 3 in
  check "pawn capture count" (Piece.capture_count moved = 1);
  check "pawn capture move count" (Piece.move_count moved = 1);
  check "captured square replaced"
    (Piece.id (piece_at 0 0 3 3) = Piece.id moved);

  reset ();
  let _ = place Piece.Pawn true 0 0 4 4 in
  expect_illegal Invalid_special_move
    (move (pos 0 0 4 4) (pos 0 0 3 3));

  reset ();
  let _ = place Piece.Pawn true 0 0 4 6 in
  let _ = place Piece.Rook false 0 0 4 5 in
  expect_illegal Blocked_path (move (pos 0 0 4 6) (pos 0 0 4 4));

  reset ();
  let _ = place Piece.Pawn true 0 0 4 6 in
  let _ = place Piece.Rook false 0 0 4 4 in
  expect_illegal Invalid_geometry (move (pos 0 0 4 6) (pos 0 0 4 4));

  reset ();
  let _ = place Piece.Pawn true 0 0 4 6 in
  let _ = place Piece.Rook false 0 0 5 4 in
  expect_illegal Invalid_geometry (move (pos 0 0 4 6) (pos 0 0 5 4))

let test_knight () =
  reset ();
  let _ = place Piece.Knight true 0 0 4 4 in
  ignore (expect_legal (move (pos 0 0 4 4) (pos 0 0 5 6)));
  expect_illegal Invalid_geometry (move (pos 0 0 4 4) (pos 0 0 5 5));

  reset ();
  let _ = place Piece.Knight true 0 0 4 4 in
  let _ = place Piece.Pawn true 0 0 5 5 in
  let _ = place Piece.Pawn true 0 0 4 5 in
  ignore (expect_legal (move (pos 0 0 4 4) (pos 0 0 5 6)));

  reset ();
  let _ = place Piece.Knight true 0 0 7 0 in
  ignore (expect_legal (move (pos 0 0 7 0) (pos 1 0 1 1)))

let test_sliders () =
  reset ();
  let _ = place Piece.Bishop true 0 0 4 4 in
  ignore (expect_legal (move (pos 0 0 4 4) (pos 0 0 6 6)));
  expect_illegal Invalid_geometry (move (pos 0 0 4 4) (pos 0 0 5 6));

  reset ();
  let _ = place Piece.Bishop true 0 0 4 4 in
  let _ = place Piece.Pawn true 0 0 5 5 in
  expect_illegal Blocked_path (move (pos 0 0 4 4) (pos 0 0 6 6));

  reset ();
  let _ = place Piece.Rook true 0 0 4 4 in
  ignore (expect_legal (move (pos 0 0 4 4) (pos 0 0 4 7)));
  expect_illegal Invalid_geometry (move (pos 0 0 4 4) (pos 0 0 5 5));

  reset ();
  let _ = place Piece.Rook true 0 0 4 4 in
  let _ = place Piece.Pawn true 0 0 4 5 in
  expect_illegal Blocked_path (move (pos 0 0 4 4) (pos 0 0 4 7));

  reset ();
  let _ = place Piece.Queen true 0 0 4 4 in
  ignore (expect_legal (move (pos 0 0 4 4) (pos 0 0 7 7)));
  ignore (expect_legal (move (pos 0 0 4 4) (pos 0 0 4 0)));

  reset ();
  let _ = place Piece.Queen true 0 0 4 4 in
  let _ = place Piece.Pawn false 0 0 4 3 in
  expect_illegal Blocked_path (move (pos 0 0 4 4) (pos 0 0 4 0));

  reset ();
  let _ = place Piece.Promoted_pawn true 0 0 4 4 in
  ignore (expect_legal (move (pos 0 0 4 4) (pos 0 0 6 6)))

let test_king () =
  reset ();
  let _ = place Piece.King true 0 0 4 7 in
  ignore (expect_legal (move (pos 0 0 4 7) (pos 0 0 5 7)));
  expect_illegal Invalid_special_move
    (move (pos 0 0 4 7) (pos 0 0 6 7));
  expect_illegal Invalid_geometry (move (pos 0 0 4 7) (pos 0 0 4 5));

  reset ();
  let _ = place Piece.King true 0 0 7 7 in
  expect_illegal Invalid_geometry (move (pos 0 0 7 7) (pos 1 0 0 7));

  reset ();
  let king = place Piece.King true 0 0 4 7 in
  let rook = place Piece.Rook true 0 0 7 7 in
  let info = expect_legal (move (pos 0 0 4 7) (pos 0 0 6 7)) in
  check "castle no capture" (Piece.is_empty info.captured_piece);
  (match info.kind with
   | Move_validator.Castle { rook_src; rook_dst } ->
     check "castle rook source" (rook_src = pos 0 0 7 7);
     check "castle rook destination" (rook_dst = pos 0 0 5 7)
   | _ -> failwith "FAIL: castle not classified as Castle");
  Move_processor.apply world info;
  check "castle king square" (Piece.id (piece_at 0 0 6 7) = Piece.id king);
  check "castle rook square" (Piece.id (piece_at 0 0 5 7) = Piece.id rook);
  check "castle king count" (Piece.move_count (piece_at 0 0 6 7) = 1);
  check "castle rook count" (Piece.move_count (piece_at 0 0 5 7) = 1);
  check "castle source empty" (Piece.is_empty (piece_at 0 0 4 7));
  check "castle old rook empty" (Piece.is_empty (piece_at 0 0 7 7));

  reset ();
  let king = place Piece.King true 0 0 4 7 in
  let rook = place Piece.Rook true 0 0 0 7 in
  let info = expect_legal (move (pos 0 0 4 7) (pos 0 0 2 7)) in
  Move_processor.apply world info;
  check "queenside king" (Piece.id (piece_at 0 0 2 7) = Piece.id king);
  check "queenside rook" (Piece.id (piece_at 0 0 3 7) = Piece.id rook);

  reset ();
  let _ = place Piece.King true 0 0 4 7 in
  let rook = place Piece.Rook true 0 0 7 7 in
  put (Piece.increment_move_count rook) 0 0 7 7;
  expect_illegal Invalid_special_move
    (move (pos 0 0 4 7) (pos 0 0 6 7));

  reset ();
  let king = place Piece.King true 0 0 4 7 in
  let _ = place Piece.Rook true 0 0 7 7 in
  put (Piece.increment_move_count king) 0 0 4 7;
  expect_illegal Invalid_special_move
    (move (pos 0 0 4 7) (pos 0 0 6 7));

  reset ();
  let _ = place Piece.King true 0 0 4 7 in
  let _ = place Piece.Rook true 0 0 7 7 in
  let _ = place Piece.Knight false 0 0 5 7 in
  expect_illegal Blocked_path (move (pos 0 0 4 7) (pos 0 0 6 7))

let test_extended_castle () =
  reset ();
  let king = place Piece.King true 0 0 4 7 in
  let rook = place Piece.Rook true 1 0 4 7 in
  let info = expect_legal (move (pos 0 0 4 7) (pos 1 0 1 7)) in
  (match info.kind with
   | Move_validator.Castle { rook_src; rook_dst } ->
     check "extended castle rook source" (rook_src = pos 1 0 4 7);
     check "extended castle rook destination" (rook_dst = pos 1 0 0 7)
   | _ -> failwith "FAIL: extended castle not classified as Castle");
  Move_processor.apply world info;
  check "extended castle king" (Piece.id (piece_at 1 0 1 7) = Piece.id king);
  check "extended castle rook" (Piece.id (piece_at 1 0 0 7) = Piece.id rook);
  check "extended castle king source empty" (Piece.is_empty (piece_at 0 0 4 7));
  check "extended castle rook source empty" (Piece.is_empty (piece_at 1 0 4 7));

  reset ();
  let _ = place Piece.King true 0 0 4 7 in
  let _ = place Piece.Rook true 1 0 4 7 in
  let _ = place Piece.Knight true 0 0 5 7 in
  expect_illegal Blocked_path (move (pos 0 0 4 7) (pos 1 0 1 7));

  reset ();
  let _ = place Piece.King true 0 0 4 7 in
  let _ = place Piece.Rook true 1 0 4 7 in
  let king = piece_at 0 0 4 7 in
  put (Piece.increment_move_count king) 0 0 4 7;
  expect_illegal Invalid_special_move (move (pos 0 0 4 7) (pos 1 0 1 7));

  reset ();
  let _ = place Piece.King true 0 0 4 7 in
  let _ = place Piece.Rook true 1 0 4 7 in
  let rook = piece_at 1 0 4 7 in
  put (Piece.increment_move_count rook) 1 0 4 7;
  expect_illegal Invalid_special_move (move (pos 0 0 4 7) (pos 1 0 1 7));

  reset ();
  let _ = place Piece.King true 0 0 4 7 in
  let _ = place Piece.Rook true 1 0 4 7 in
  expect_illegal Invalid_special_move (move (pos 0 0 4 7) (pos 1 0 0 7));

  reset ();
  let _ = place Piece.King true 0 0 4 7 in
  let _ = place Piece.Rook true 5 0 4 7 in
  expect_illegal Invalid_special_move (move (pos 0 0 4 7) (pos 2 0 1 7))

let test_capture_off_original_board () =
  reset ();
  let rook =
    Piece.create ~id:1l ~piece_type:Piece.Rook ~is_white:true
  in
  let pawn =
    Piece.create ~id:33l ~piece_type:Piece.Pawn ~is_white:false
  in
  put rook 0 0 7 4;
  put pawn 1 0 0 4;
  expect_illegal Capture_off_original_board
    (move (pos 0 0 7 4) (pos 1 0 0 4));

  reset ();
  let rook =
    Piece.create ~id:1l ~piece_type:Piece.Rook ~is_white:true
  in
  put rook 0 0 0 0;
  let _ = apply (move (pos 0 0 0 0) (pos 1 0 0 0)) in
  check "quiet move left original board"
    (not (Piece.on_original_board (piece_at 1 0 0 0)));
  let blocker =
    Piece.create ~id:34l ~piece_type:Piece.Pawn ~is_white:false
  in
  put blocker 1 0 1 0;
  expect_illegal Capture_off_original_board
    (move (pos 1 0 0 0) (pos 1 0 1 0));

  let _ = apply (move (pos 1 0 0 0) (pos 0 0 7 0)) in
  check "returned to original board"
    (Piece.on_original_board (piece_at 0 0 7 0));
  let target =
    Piece.create ~id:2l ~piece_type:Piece.Pawn ~is_white:false
  in
  put target 0 0 6 0;
  let info = apply (move (pos 0 0 7 0) (pos 0 0 6 0)) in
  check "capture after returning home"
    (Piece.id info.captured_piece = Piece.id target);

  reset ();
  let rook =
    Piece.create ~id:1l ~piece_type:Piece.Rook ~is_white:true
  in
  let target =
    Piece.create ~id:2l ~piece_type:Piece.Pawn ~is_white:false
  in
  put rook 0 0 4 4;
  put target 0 0 7 4;
  let info = apply (move (pos 0 0 4 4) (pos 0 0 7 4)) in
  check "same-board capture at home"
    (Piece.id info.captured_piece = Piece.id target);

  reset ();
  let rook =
    Piece.create ~id:1l ~piece_type:Piece.Rook ~is_white:true
  in
  put rook 0 0 7 4;
  let info = apply (move (pos 0 0 7 4) (pos 1 0 0 4)) in
  check "cross-board quiet move" (Piece.is_empty info.captured_piece)

let test_en_passant () =
  reset ();
  let _ = place Piece.Pawn true 0 0 4 3 in
  let captured = new_piece Piece.Pawn false |> fun p -> Piece.with_just_double_moved p true in
  put captured 0 0 3 3;
  let info = apply (move (pos 0 0 4 3) (pos 0 0 3 2)) in
  check "en passant captured piece" (Piece.id info.captured_piece = Piece.id captured);
  (match info.kind with
   | Move_validator.En_passant { captured_pos } ->
     check "en passant captured square"
       (captured_pos = pos 0 0 3 3)
   | _ -> failwith "FAIL: en passant not classified as En_passant");
  check "en passant captured square empty" (Piece.is_empty (piece_at 0 0 3 3));
  check "en passant destination" (not (Piece.is_empty (piece_at 0 0 3 2)));
  check "en passant capture count" (Piece.capture_count (piece_at 0 0 3 2) = 1);
  check "en passant clears double flag"
    (not (Piece.just_double_moved (piece_at 0 0 3 2)));

  reset ();
  let _ = place Piece.Pawn true 0 0 4 3 in
  let _ = place Piece.Pawn false 0 0 3 3 in
  expect_illegal Invalid_special_move
    (move (pos 0 0 4 3) (pos 0 0 3 2));

  reset ();
  let _ = place Piece.Pawn true 0 0 4 3 in
  let _ = new_piece Piece.Pawn true |> fun p -> put (Piece.with_just_double_moved p true) 0 0 3 3 in
  expect_illegal Invalid_special_move
    (move (pos 0 0 4 3) (pos 0 0 3 2));

  reset ();
  let _ = place Piece.Pawn true 0 0 4 3 in
  expect_illegal Invalid_special_move
    (move (pos 0 0 4 3) (pos 0 0 3 2));

  reset ();
  let _ = place Piece.Pawn true 0 0 7 3 in
  let captured =
    new_piece Piece.Pawn false
    |> fun p -> Piece.with_just_double_moved p true
  in
  put captured 1 0 0 3;
  expect_illegal Capture_off_original_board
    (move (pos 0 0 7 3) (pos 1 0 0 2))

let test_promotion () =
  reset ();
  let pawn = place Piece.Pawn true 0 0 4 1 in
  let info = apply (move (pos 0 0 4 1) (pos 0 0 4 0)) in
  check "white promotion no capture" (Piece.is_empty info.captured_piece);
  let promoted = piece_at 0 0 4 0 in
  check "white promotes" (Piece.piece_type promoted = Piece.Promoted_pawn);
  check "white promotion id" (Piece.id promoted = Piece.id pawn);
  check "white promotion count" (Piece.move_count promoted = 1);
  check "white promotion clears double"
    (not (Piece.just_double_moved promoted));

  reset ();
  let pawn = place Piece.Pawn false 999 999 4 6 in
  ignore (apply (move (pos 999 999 4 6) (pos 999 999 4 7)));
  let promoted = piece_at 999 999 4 7 in
  check "black promotes" (Piece.piece_type promoted = Piece.Promoted_pawn);
  check "black promotion id" (Piece.id promoted = Piece.id pawn);

  reset ();
  let pawn = place Piece.Pawn true 0 0 4 1 in
  let queen = place Piece.Queen false 0 0 3 0 in
  let info = apply (move (pos 0 0 4 1) (pos 0 0 3 0)) in
  check "promotion capture" (Piece.id info.captured_piece = Piece.id queen);
  let promoted = piece_at 0 0 3 0 in
  check "promoted type" (Piece.piece_type promoted = Piece.Promoted_pawn);
  check "promoted id" (Piece.id promoted = Piece.id pawn);
  check "promoted queen killer" (Piece.queen_killer promoted);
  check "promoted is not a pawn" (not (Piece.queen_pawner promoted));
  check "promoted captured other type" (Piece.has_captured_other_type promoted)

let test_capture_metadata () =
  reset ();
  let _ = place Piece.Pawn true 0 0 4 4 in
  let _ = place Piece.Queen false 0 0 3 3 in
  ignore (apply (move (pos 0 0 4 4) (pos 0 0 3 3)));
  let moved = piece_at 0 0 3 3 in
  check "pawn queen killer" (Piece.queen_killer moved);
  check "pawn queen pawner" (Piece.queen_pawner moved);
  check "pawn captured other type" (Piece.has_captured_other_type moved);
  check "pawn capture count" (Piece.capture_count moved = 1);

  reset ();
  let _ = place Piece.Pawn true 0 0 4 4 in
  let _ = place Piece.King false 0 0 3 3 in
  ignore (apply (move (pos 0 0 4 4) (pos 0 0 3 3)));
  let moved = piece_at 0 0 3 3 in
  check "pawn king killer" (Piece.king_killer moved);
  check "pawn king pawner" (Piece.king_pawner moved);

  reset ();
  let _ = place Piece.Knight true 0 0 4 4 in
  let captured = new_piece Piece.Knight false |> fun p -> Piece.with_adopted p true in
  put captured 0 0 5 6;
  ignore (apply (move (pos 0 0 4 4) (pos 0 0 5 6)));
  let moved = piece_at 0 0 5 6 in
  check "adopted killer" (Piece.adopted_killer moved);
  check "same type captured" (not (Piece.has_captured_other_type moved))

let test_expired_double_move_flag () =
  reset ();
  let white = place Piece.Pawn true 0 0 4 3 in
  let _black = place Piece.Pawn false 0 0 3 3 in
  (* Flag false: the same geometrical en passant is rejected. *)
  expect_illegal Invalid_special_move
    (move (pos 0 0 3 3) (pos 0 0 4 4));
  (* Flag true: the same move is accepted. *)
  put (Piece.with_just_double_moved white true) 0 0 4 3;
  let info = expect_legal (move (pos 0 0 3 3) (pos 0 0 4 4)) in
  (match info.kind with
   | Move_validator.En_passant { captured_pos } ->
     check "expiry control captured square" (captured_pos = pos 0 0 4 3)
   | _ -> failwith "FAIL: expected en passant");

  (* A double-move flag expires when the pawn next moves. *)
  reset ();
  let pawn = place Piece.Pawn true 0 0 0 6 in
  ignore (apply (move (pos 0 0 0 6) (pos 0 0 0 4)));
  check "expiry double flag set" (Piece.just_double_moved pawn
                                 || Piece.just_double_moved (piece_at 0 0 0 4));
  ignore (apply (move (pos 0 0 0 4) (pos 0 0 0 3)));
  check "expiry flag cleared"
    (not (Piece.just_double_moved (piece_at 0 0 0 3)));
  let _black = place Piece.Pawn false 0 0 1 3 in
  expect_illegal Invalid_special_move
    (move (pos 0 0 1 3) (pos 0 0 0 4))

let test_prepare_does_not_mutate () =
  reset ();
  let rook = place Piece.Rook true 0 0 4 4 in
  let pawn = place Piece.Pawn false 0 0 7 4 in
  let info = expect_legal (move (pos 0 0 4 4) (pos 0 0 7 4)) in
  let plan = Move_processor.prepare world info in
  check "prepare leaves source"
    (Piece.id (piece_at 0 0 4 4) = Piece.id rook);
  check "prepare leaves destination"
    (Piece.id (piece_at 0 0 7 4) = Piece.id pawn);
  Move_processor.apply_plan world plan;
  check "commit source empty" (Piece.is_empty (piece_at 0 0 4 4));
  check "commit destination"
    (Piece.id (piece_at 0 0 7 4) = Piece.id rook)

let test_illegal_does_not_modify () =
  reset ();
  let rook = place Piece.Rook true 0 0 4 4 in
  let blocker = place Piece.Pawn false 0 0 4 5 in
  expect_illegal Blocked_path (move (pos 0 0 4 4) (pos 0 0 4 6));
  check "illegal move leaves source" (Piece.id (piece_at 0 0 4 4) = Piece.id rook);
  check "illegal move leaves blocker"
    (Piece.id (piece_at 0 0 4 5) = Piece.id blocker);
  check "illegal move leaves destination empty" (Piece.is_empty (piece_at 0 0 4 6))

let () =
  test_move_type ();
  test_empty_and_bounds ();
  test_pawn ();
  test_knight ();
  test_sliders ();
  test_king ();
  test_extended_castle ();
  test_capture_off_original_board ();
  test_en_passant ();
  test_promotion ();
  test_capture_metadata ();
  test_expired_double_move_flag ();
  test_prepare_does_not_mutate ();
  test_illegal_does_not_modify ();
  Printf.printf "All Move, validator, and processor tests passed.\n"
