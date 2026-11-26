type rejection =
  | Empty_source
  | Invalid_geometry
  | Blocked_path
  | Invalid_destination
  | Capture_off_original_board
  | Invalid_special_move

type move_kind =
  | Normal
  | Castle of {
      rook_src : Board.position;
      rook_dst : Board.position;
    }
  | En_passant of { captured_pos : Board.position }

type move_info = {
  moving_piece : Piece.t;
  captured_piece : Piece.t;
  src : Board.position;
  dst : Board.position;
  kind : move_kind;
}

type result =
  | Legal of move_info
  | Illegal of rejection

let max_move_distance = 36

let abs_int x = if x < 0 then -x else x

let boards_differ (a : Board.position) (b : Board.position) =
  a.board.board_x <> b.board.board_x || a.board.board_y <> b.board.board_y

let world_in_bounds x y =
  x >= 0 && x < 8000 && y >= 0 && y < 8000

let path_clear t (src : Board.position) (dst : Board.position) =
  let x0 = Board.world_x src and y0 = Board.world_y src in
  let x1 = Board.world_x dst and y1 = Board.world_y dst in
  let dx = Int.compare x1 x0 and dy = Int.compare y1 y0 in
  let x = ref (x0 + dx) and y = ref (y0 + dy) in
  let clear = ref true in
  while !clear && (!x <> x1 || !y <> y1) do
    if not (Piece.is_empty (Board.get_world t ~x:!x ~y:!y)) then
      clear := false
    else begin
      x := !x + dx;
      y := !y + dy
    end
  done;
  !clear

let legal kind moving captured src dst =
  Legal { moving_piece = moving; captured_piece = captured; src; dst; kind }

let same_colour a b = Piece.is_white a = Piece.is_white b

let validate_castle t (move : Move.t) moving =
  let src = move.src and dst = move.dst in
  let src_x = Board.world_x src and src_y = Board.world_y src in
  let dst_x = Board.world_x dst and dst_y = Board.world_y dst in
  let dx = dst_x - src_x in
  if
    dst_y <> src_y || abs_int dx < 2 || abs_int dx > max_move_distance
    || Piece.move_count moving <> 0
  then Illegal Invalid_special_move
  else
    let direction = if dx > 0 then 1 else -1 in
    let rec find_rook x =
      if
        abs (x - src_x) > max_move_distance
        || not (world_in_bounds x src_y)
      then None
      else
        let candidate = Board.position_of_world ~x ~y:src_y in
        let piece = Board.get t candidate in
        if Piece.is_empty piece then find_rook (x + direction)
        else if
          Piece.piece_type piece = Piece.Rook
          && same_colour piece moving
          && Piece.move_count piece = 0
        then Some (x, candidate)
        else find_rook (x + direction)
    in
    match find_rook (src_x + direction) with
    | None -> Illegal Invalid_special_move
    | Some (rook_x, rook_src) ->
      let lo = min src_x rook_x and hi = max src_x rook_x in
      let distance = hi - lo in
      if distance < 3 then Illegal Invalid_special_move
      else
        let mid_lo = (lo + hi) / 2 in
        let mid_hi = mid_lo + 1 in
        let king_dst_x = if rook_x > src_x then mid_hi else mid_lo in
        let rook_dst_x = if rook_x > src_x then mid_lo else mid_hi in
        if dst_x <> king_dst_x then Illegal Invalid_special_move
        else if not (path_clear t src rook_src) then Illegal Blocked_path
        else if not (world_in_bounds rook_dst_x src_y) then
          Illegal Invalid_special_move
        else
          let rook_dst = Board.position_of_world ~x:rook_dst_x ~y:src_y in
          if not (Piece.is_empty (Board.get t rook_dst)) then
            Illegal Invalid_special_move
          else legal (Castle { rook_src; rook_dst }) moving Piece.empty src dst

let validate_en_passant t (move : Move.t) moving =
  let src = move.src and dst = move.dst in
  let src_x = Board.world_x src and src_y = Board.world_y src in
  let dx = Board.world_x dst - src_x in
  let dy = Board.world_y dst - src_y in
  let expected_dy = if Piece.is_white moving then -1 else 1 in
  if dy <> expected_dy || abs_int dx <> 1 then Illegal Invalid_special_move
  else
    let captured_x = src_x + dx in
    if not (world_in_bounds captured_x src_y) then
      Illegal Invalid_special_move
    else
      let captured_pos = Board.position_of_world ~x:captured_x ~y:src_y in
      let captured = Board.get t captured_pos in
      if
        Piece.is_empty captured
        || Piece.piece_type captured <> Piece.Pawn
        || same_colour captured moving
        || not (Piece.just_double_moved captured)
      then Illegal Invalid_special_move
      else if
        boards_differ move.src move.dst
        || not (Piece.on_original_board moving)
      then Illegal Capture_off_original_board
      else legal (En_passant { captured_pos }) moving captured src dst

let validate_pawn t (move : Move.t) ~dx ~dy moving ~captured =
  let adx = abs_int dx and ady = abs_int dy in
  let forward = if Piece.is_white moving then dy < 0 else dy > 0 in
  if ady <> 1 && ady <> 2 then Illegal Invalid_geometry
  else if adx > 1 then Illegal Invalid_geometry
  else if not forward then Illegal Invalid_geometry
  else if adx = 1 && Piece.is_empty captured then Illegal Invalid_geometry
  else if adx = 0 && not (Piece.is_empty captured) then
    Illegal Invalid_geometry
  else if ady = 2 && (adx <> 0 || Piece.move_count moving <> 0) then
    Illegal Invalid_geometry
  else if not (path_clear t move.src move.dst) then Illegal Blocked_path
  else legal Normal moving captured move.src move.dst

let validate_normal t (move : Move.t) moving ~dx ~dy ~captured =
  let adx = abs_int dx and ady = abs_int dy in
  match Piece.piece_type moving with
  | Piece.Pawn -> validate_pawn t move ~dx ~dy moving ~captured
  | Piece.Knight ->
    if (adx = 1 && ady = 2) || (adx = 2 && ady = 1) then
      legal Normal moving captured move.src move.dst
    else Illegal Invalid_geometry
  | Piece.Bishop ->
    if adx <> ady || adx = 0 then Illegal Invalid_geometry
    else if not (path_clear t move.src move.dst) then Illegal Blocked_path
    else legal Normal moving captured move.src move.dst
  | Piece.Rook ->
    if (adx = 0) = (ady = 0) then Illegal Invalid_geometry
    else if not (path_clear t move.src move.dst) then Illegal Blocked_path
    else legal Normal moving captured move.src move.dst
  | Piece.Queen | Piece.Promoted_pawn ->
    let diagonal = adx = ady && adx > 0 in
    let straight = (adx = 0) <> (ady = 0) in
    if not (diagonal || straight) then Illegal Invalid_geometry
    else if not (path_clear t move.src move.dst) then Illegal Blocked_path
    else legal Normal moving captured move.src move.dst
  | Piece.King ->
    if adx <= 1 && ady <= 1 && not (boards_differ move.src move.dst) then
      legal Normal moving captured move.src move.dst
    else Illegal Invalid_geometry

let validate t (move : Move.t) =
  if not (Board.in_bounds move.src) then Illegal Empty_source
  else if not (Board.in_bounds move.dst) then Illegal Invalid_destination
  else
    let moving = Board.get t move.src in
    if Piece.is_empty moving then Illegal Empty_source
    else if move.src = move.dst then Illegal Invalid_geometry
    else
      let captured = Board.get t move.dst in
      if
        (not (Piece.is_empty captured))
        && same_colour captured moving
      then Illegal Invalid_destination
      else
        let dx = Board.world_x move.dst - Board.world_x move.src in
        let dy = Board.world_y move.dst - Board.world_y move.src in
        if abs_int dx > max_move_distance || abs_int dy > max_move_distance
        then Illegal Invalid_geometry
        else if
          Piece.piece_type moving = Piece.King
          && abs_int dx >= 2 && dy = 0
        then validate_castle t move moving
        else if
          Piece.piece_type moving = Piece.Pawn
          && abs_int dx = 1 && Piece.is_empty captured
        then validate_en_passant t move moving
        else if
          (not (Piece.is_empty captured))
          && (boards_differ move.src move.dst
             || not (Piece.on_original_board moving))
        then Illegal Capture_off_original_board
        else validate_normal t move moving ~dx ~dy ~captured
