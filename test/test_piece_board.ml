let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let expect_invalid name f =
  match f () with
  | exception Invalid_argument _ -> ()
  | _ -> failwith ("FAIL: " ^ name ^ " did not raise Invalid_argument")

let contains s sub =
  let n = String.length s and m = String.length sub in
  let rec loop i = i + m <= n && (String.sub s i m = sub || loop (i + 1)) in
  m = 0 || loop 0

let piece_type_tests =
  [ (Piece.Pawn, "pawn"); (Piece.Knight, "knight"); (Piece.Bishop, "bishop");
    (Piece.Rook, "rook"); (Piece.Queen, "queen"); (Piece.King, "king");
    (Piece.Promoted_pawn, "promoted_pawn") ]

let test_piece () =
  let p = Piece.create ~id:1l ~piece_type:Piece.Pawn ~is_white:true in
  check "created piece is non-empty" (not (Piece.is_empty p));
  check "id" (Piece.id p = 1l);
  check "type" (Piece.piece_type p = Piece.Pawn);
  check "colour" (Piece.is_white p);
  check "initial flags and counters"
    ((not (Piece.just_double_moved p))
    && (not (Piece.king_killer p))
    && (not (Piece.king_pawner p))
    && (not (Piece.queen_killer p))
    && (not (Piece.queen_pawner p))
    && (not (Piece.adopted_killer p))
    && (not (Piece.has_captured_other_type p))
    && (not (Piece.adopted p))
    && (Piece.move_count p = 0)
    && (Piece.capture_count p = 0));

  List.iter
    (fun (piece_type, _) ->
      let q = Piece.create ~id:2l ~piece_type ~is_white:false in
      check "type roundtrip" (Piece.piece_type q = piece_type);
      check "black colour" (not (Piece.is_white q)))
    piece_type_tests;

  let max_piece =
    Piece.create ~id:Piece.max_id ~piece_type:Piece.King ~is_white:false
  in
  check "max id" (Piece.id max_piece = Piece.max_id);
  expect_invalid "id zero" (fun () ->
      Piece.create ~id:0l ~piece_type:Piece.Pawn ~is_white:true);
  expect_invalid "id above max" (fun () ->
      Piece.create ~id:(Int32.succ Piece.max_id) ~piece_type:Piece.Pawn
        ~is_white:true);
  expect_invalid "piece type on empty" (fun () -> Piece.piece_type Piece.empty);

  let flag_tests =
    [ ("double", Piece.just_double_moved, Piece.with_just_double_moved);
      ("kk", Piece.king_killer, Piece.with_king_killer);
      ("kp", Piece.king_pawner, Piece.with_king_pawner);
      ("qk", Piece.queen_killer, Piece.with_queen_killer);
      ("qp", Piece.queen_pawner, Piece.with_queen_pawner);
      ("ak", Piece.adopted_killer, Piece.with_adopted_killer);
      ("other", Piece.has_captured_other_type,
       Piece.with_has_captured_other_type);
      ("adopted", Piece.adopted, Piece.with_adopted) ]
  in
  List.iter
    (fun (name, get, set) ->
      let p1 = set p true in
      check (name ^ " set") (get p1);
      check (name ^ " preserves id") (Piece.id p1 = Piece.id p);
      check (name ^ " preserves type") (Piece.piece_type p1 = Piece.Pawn);
      check (name ^ " preserves colour") (Piece.is_white p1);
      check (name ^ " preserves counters")
        ((Piece.move_count p1 = 0) && (Piece.capture_count p1 = 0));
      let p2 = set p1 false in
      check (name ^ " clear") (not (get p2));
      check (name ^ " other flags")
        (List.for_all
           (fun (other_name, other_get, _) ->
             other_name = name || not (other_get p2))
           flag_tests))
    flag_tests;

  let all_flags =
    List.fold_left (fun p (_, _, set) -> set p true) p flag_tests
  in
  check "all flags set"
    (List.for_all (fun (_, get, _) -> get all_flags) flag_tests);

  let p4095 = ref p in
  for _ = 1 to 4096 do
    p4095 := Piece.increment_move_count !p4095
  done;
  check "move count saturates" (Piece.move_count !p4095 = 4095);
  check "move saturation preserves capture count"
    (Piece.capture_count !p4095 = 0);
  let q4095 = ref p in
  for _ = 1 to 4096 do
    q4095 := Piece.increment_capture_count !q4095
  done;
  check "capture count saturates" (Piece.capture_count !q4095 = 4095);
  check "capture saturation preserves move count"
    (Piece.move_count !q4095 = 0);

  let promoted = Piece.promote p Piece.Queen in
  check "promotion changes type" (Piece.piece_type promoted = Piece.Queen);
  check "promotion preserves id" (Piece.id promoted = Piece.id p);
  check "promotion preserves colour" (Piece.is_white promoted);
  check "promotion preserves counters"
    ((Piece.move_count promoted = 0) && (Piece.capture_count promoted = 0));
  check "promotion preserves flags" (not (Piece.adopted promoted));

  let decorated =
    p |> fun x -> Piece.with_king_killer x true
    |> fun x -> Piece.with_adopted x true
    |> Piece.increment_move_count |> Piece.increment_capture_count
  in
  let promoted_decorated = Piece.promote decorated Piece.Rook in
  check "promotion preserves metadata"
    (Piece.king_killer promoted_decorated
    && Piece.adopted promoted_decorated
    && Piece.move_count promoted_decorated = 1
    && Piece.capture_count promoted_decorated = 1);

  (* Compact client snapshot byte and move signature. *)
  let white_pawn = Piece.create ~id:10l ~piece_type:Piece.Pawn ~is_white:true in
  let black_pawn = Piece.create ~id:11l ~piece_type:Piece.Pawn ~is_white:false in
  check "client byte white pawn original" (Piece.client_byte white_pawn = 19);
  check "client byte black pawn original" (Piece.client_byte black_pawn = 18);
  check "client byte empty" (Piece.client_byte Piece.empty = 0);
  check "client byte en passant"
    (Piece.client_byte (Piece.with_just_double_moved white_pawn true) = 51);
  check "client byte moved pawn clears original"
    (Piece.client_byte (Piece.increment_move_count white_pawn) = 3);
  let white_rook = Piece.create ~id:12l ~piece_type:Piece.Rook ~is_white:true in
  check "client byte castling rook" (Piece.client_byte white_rook = 57);
  check "client byte moved rook"
    (Piece.client_byte (Piece.increment_move_count white_rook) = 9);
  let black_bishop = Piece.create ~id:13l ~piece_type:Piece.Bishop ~is_white:false in
  check "client byte bishop before knight"
    (Piece.client_byte black_bishop = 20);
  let white_knight = Piece.create ~id:14l ~piece_type:Piece.Knight ~is_white:true in
  check "client byte knight" (Piece.client_byte white_knight = 23);
  let promoted =
    Piece.promote (Piece.increment_move_count white_pawn) Piece.Promoted_pawn
  in
  check "client byte promoted pawn is queen" (Piece.client_byte promoted = 11);
  check "client signature"
    (Piece.client_signature ~square:52 white_pawn = Int32.of_int ((52 lsl 8) lor 19));
  check "client empty signature"
    (Piece.client_signature ~square:0 Piece.empty = 0l);
  expect_invalid "client signature square" (fun () ->
      Piece.client_signature ~square:64 white_pawn);

  expect_invalid "promote empty" (fun () -> Piece.promote Piece.empty Piece.Queen);
  expect_invalid "increment empty" (fun () -> Piece.increment_move_count Piece.empty);
  check "empty id" (Piece.id Piece.empty = 0l);
  check "empty is empty" (Piece.is_empty Piece.empty);
  check "empty string" (Piece.to_string Piece.empty = "empty");
  check "to_string mentions id" (contains (Piece.to_string p) "id=1")

let position bx by x y =
  { Board.board = { board_x = bx; board_y = by }; square = { x; y } }

let test_board () =
  let world = Board.create () in
  check "dimensions" (Board.dimensions = (1000, 1000));
  check "board id first" (Board.board_id { board_x = 0; board_y = 0 } = 0);
  check "board id last"
    (Board.board_id { board_x = 999; board_y = 999 } = 999_999);
  check "first index" (Board.index (position 0 0 0 0) = 0);
  check "last index" (Board.index (position 999 999 7 7) = 63_999_999);

  let first = position 0 0 0 0 in
  let last = position 999 999 7 7 in
  check "initial empty" (Piece.is_empty (Board.get world first));
  let p = Piece.create ~id:42l ~piece_type:Piece.Knight ~is_white:true in
  Board.set world first p;
  check "set/get first" (Piece.id (Board.get world first) = 42l);
  check "get_world first"
    (Piece.id
       (Board.get_world world ~x:(Board.world_x first)
          ~y:(Board.world_y first))
    = 42l);
  check "occupied after set" (Board.occupied_count world = 1);
  Board.set world last p;
  check "set/get last" (Piece.id (Board.get world last) = 42l);
  check "occupied after second set" (Board.occupied_count world = 2);
  Board.clear world first;
  check "clear first" (Piece.is_empty (Board.get world first));
  Board.clear world last;

  expect_invalid "negative board x" (fun () ->
      Board.index (position (-1) 0 0 0));
  expect_invalid "board x too large" (fun () ->
      Board.index (position 1000 0 0 0));
  expect_invalid "negative x" (fun () -> Board.index (position 0 0 (-1) 0));
  expect_invalid "y too large" (fun () -> Board.index (position 0 0 0 8));

  let b0 = { Board.board_x = 0; board_y = 0 } in
  Board.set world (position 0 0 0 0) p;
  let squares = Board.get_board world b0 in
  check "get_board length" (Array.length squares = 64);
  check "get_board piece" (Piece.id squares.(0) = 42l);
  squares.(0) <- Piece.empty;
  check "get_board is a copy"
    (not (Piece.is_empty (Board.get world (position 0 0 0 0))));

  let replacement = Array.make 64 Piece.empty in
  replacement.(9) <- p;
  Board.set_board world b0 replacement;
  check "set_board" (Piece.id (Board.get world (position 0 0 1 1)) = 42l);
  expect_invalid "set_board length" (fun () ->
      Board.set_board world b0 (Array.make 63 Piece.empty));
  Board.clear_board world b0;
  check "clear_board" (Board.occupied_count world = 0);

  let seen = ref [] in
  Board.iter_board world b0 (fun sq _ -> seen := (sq.x, sq.y) :: !seen);
  let seen = List.rev !seen in
  check "iter_board count" (List.length seen = 64);
  check "iter_board first" (List.hd seen = (0, 0));
  check "iter_board last" (List.nth seen 63 = (7, 7));

  Board.initialise_standard_position world b0;
  let b1 = { Board.board_x = 0; board_y = 1 } in
  Board.initialise_standard_position world b1;
  check "standard board occupied"
    (let n = ref 0 in
     Board.iter_board world b0 (fun _ piece ->
         if not (Piece.is_empty piece) then incr n);
     !n = 32);
  check "black rook" (Piece.piece_type (Board.get world (position 0 0 0 0)) = Piece.Rook
                      && not (Piece.is_white (Board.get world (position 0 0 0 0))));
  check "black king" (Piece.piece_type (Board.get world (position 0 0 4 0)) = Piece.King
                      && not (Piece.is_white (Board.get world (position 0 0 4 0))));
  check "white king" (Piece.piece_type (Board.get world (position 0 0 4 7)) = Piece.King
                      && Piece.is_white (Board.get world (position 0 0 4 7)));
  check "black pawn" (Piece.piece_type (Board.get world (position 0 0 0 1)) = Piece.Pawn
                      && not (Piece.is_white (Board.get world (position 0 0 0 1))));
  check "white pawn" (Piece.piece_type (Board.get world (position 0 0 0 6)) = Piece.Pawn
                      && Piece.is_white (Board.get world (position 0 0 0 6)));

  let ids = Hashtbl.create 64 in
  let add_ids bp =
    Board.iter_board world bp (fun _ piece ->
        if not (Piece.is_empty piece) then begin
          let id = Piece.id piece in
          Hashtbl.replace ids id ();
          check "id nonzero" (Int32.compare id 0l > 0);
          check "id in range" (Int32.compare id Piece.max_id <= 0)
        end)
  in
  add_ids b0;
  add_ids b1;
  check "unique ids across boards" (Hashtbl.length ids = 64);

  check "world occupied count" (Board.occupied_count world = 64);
  let iter_count = ref 0 in
  Board.iter world (fun _ piece ->
      check "iter skips empty" (not (Piece.is_empty piece));
      incr iter_count);
  check "iter visits only occupied" (!iter_count = 64);

  let copy = Board.copy world in
  check "copy occupied count" (Board.occupied_count copy = 64);
  Board.clear copy (position 0 0 0 0);
  check "copy is independent"
    (not (Piece.is_empty (Board.get world (position 0 0 0 0))));

  Board.clear_board world b0;
  Board.clear_board world b1;
  check "clear_board empties world" (Board.occupied_count world = 0);

  Board.initialise_standard_position world b0;
  Printf.printf "Standard board (0,0):\n";
  Board.print_board world b0

let () =
  test_piece ();
  test_board ();
  Printf.printf "All Piece and Board tests passed.\n"
