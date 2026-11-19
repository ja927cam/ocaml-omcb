let abs_int x = if x < 0 then -x else x

let is_castle (info : Move_validator.move_info) =
  Piece.piece_type info.moving_piece = Piece.King
  && abs_int (Board.world_x info.dst - Board.world_x info.src) = 2
  && Board.world_y info.dst = Board.world_y info.src

let is_en_passant board (info : Move_validator.move_info) =
  Piece.piece_type info.moving_piece = Piece.Pawn
  && abs_int (Board.world_x info.dst - Board.world_x info.src) = 1
  && Piece.is_empty (Board.get board info.dst)

let apply_castle board (info : Move_validator.move_info) =
  let src = info.src and dst = info.dst in
  let src_x = Board.world_x src in
  let y = Board.world_y src in
  let dx = Board.world_x dst - src_x in
  let rook_src_x = src_x + if dx = 2 then 3 else -4 in
  let rook_dst_x = Board.world_x dst + if dx = 2 then -1 else 1 in
  let rook_src = Board.position_of_world ~x:rook_src_x ~y:y in
  let rook_dst = Board.position_of_world ~x:rook_dst_x ~y:y in
  let rook = Board.get board rook_src in
  let king = Piece.increment_move_count info.moving_piece in
  let rook = Piece.increment_move_count rook in
  Board.clear board src;
  Board.clear board rook_src;
  Board.set board dst king;
  Board.set board rook_dst rook

let apply_en_passant board (info : Move_validator.move_info) =
  let captured_pos =
    Board.position_of_world ~x:(Board.world_x info.dst) ~y:(Board.world_y info.src)
  in
  let moving =
    info.moving_piece
    |> Piece.increment_move_count
    |> Piece.increment_capture_count
    |> fun p -> Piece.with_just_double_moved p false
  in
  Board.clear board info.src;
  Board.clear board captured_pos;
  Board.set board info.dst moving

let apply_normal board (info : Move_validator.move_info) =
  let dy = Board.world_y info.dst - Board.world_y info.src in
  let moving =
    match Piece.piece_type info.moving_piece with
    | Piece.Pawn ->
      let p =
        Piece.with_just_double_moved info.moving_piece (abs_int dy = 2)
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
  Board.clear board info.src;
  Board.set board info.dst moving

let apply board (info : Move_validator.move_info) =
  if is_castle info then apply_castle board info
  else if is_en_passant board info then apply_en_passant board info
  else apply_normal board info
