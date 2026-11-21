type plan = {
  clears : Board.position list;
  sets : (Board.position * Piece.t) list;
}

let with_original_flag piece board =
  Piece.with_on_original_board piece
    (Piece.is_on_original_board ~board_x:board.Board.board_x
       ~board_y:board.board_y piece)

let normal_plan (info : Move_validator.move_info) =
  let dy = Board.world_y info.dst - Board.world_y info.src in
  let moving =
    match Piece.piece_type info.moving_piece with
    | Piece.Pawn ->
      (* Original semantics: the flag survives until this pawn next moves;
         moves by other pieces do not expire it. *)
      let p =
        Piece.with_just_double_moved info.moving_piece (abs dy = 2)
      in
      if
        (Piece.is_white p && Board.world_y info.dst = 0)
        || ((not (Piece.is_white p)) && Board.world_y info.dst = 7999)
      then Piece.promote p Piece.Promoted_pawn
      else p
    | _ -> info.moving_piece
  in
  let moving = Piece.increment_move_count moving in
  let moving =
    if Piece.is_empty info.captured_piece then moving
    else
      let captured = info.captured_piece in
      let moving = Piece.increment_capture_count moving in
      let moving =
        if Piece.piece_type captured = Piece.Queen then
          Piece.with_queen_killer moving true
        else moving
      in
      let moving =
        if Piece.piece_type captured = Piece.King then
          Piece.with_king_killer moving true
        else moving
      in
      let moving =
        if Piece.piece_type moving = Piece.Pawn then begin
          let moving =
            if Piece.piece_type captured = Piece.Queen then
              Piece.with_queen_pawner moving true
            else moving
          in
          if Piece.piece_type captured = Piece.King then
            Piece.with_king_pawner moving true
          else moving
        end
        else moving
      in
      let moving =
        if Piece.adopted captured then
          Piece.with_adopted_killer moving true
        else moving
      in
      if Piece.piece_type captured <> Piece.piece_type moving then
        Piece.with_has_captured_other_type moving true
      else moving
  in
  let moving = with_original_flag moving info.dst.board in
  { clears = [ info.src ]; sets = [ (info.dst, moving) ] }

let en_passant_plan (info : Move_validator.move_info) captured_pos =
  let moving =
    info.moving_piece
    |> Piece.increment_move_count
    |> Piece.increment_capture_count
    |> fun p -> Piece.with_just_double_moved p false
    |> fun p -> with_original_flag p info.dst.board
  in
  {
    clears = [ info.src; captured_pos ];
    sets = [ (info.dst, moving) ];
  }

let castle_plan board (info : Move_validator.move_info)
    (rook_src : Board.position) (rook_dst : Board.position) =
  let rook = Board.get board rook_src in
  let king =
    Piece.increment_move_count info.moving_piece
    |> fun p -> with_original_flag p info.dst.board
  in
  let rook =
    Piece.increment_move_count rook
    |> fun p -> with_original_flag p rook_dst.board
  in
  {
    clears = [ info.src; rook_src ];
    sets = [ (info.dst, king); (rook_dst, rook) ];
  }

let prepare board (info : Move_validator.move_info) =
  match info.kind with
  | Move_validator.Normal -> normal_plan info
  | Move_validator.Castle { rook_src; rook_dst } ->
    castle_plan board info rook_src rook_dst
  | Move_validator.En_passant { captured_pos } ->
    en_passant_plan info captured_pos

let changes plan =
  List.map (fun p -> (p, Piece.empty)) plan.clears @ plan.sets

let apply_plan board plan =
  List.iter (fun p -> Board.clear board p) plan.clears;
  List.iter (fun (p, piece) -> Board.set board p piece) plan.sets

let apply board info = apply_plan board (prepare board info)
