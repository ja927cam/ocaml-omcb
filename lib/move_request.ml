type t = {
  request_id : int32;
  move : Move.t;
  expected_piece_id : int32;
}

let valid_piece_id id =
  Int32.compare id 0l > 0 && Int32.compare id Piece.max_id <= 0

let is_valid t =
  valid_piece_id t.expected_piece_id
  && Board.in_bounds t.move.src
  && Board.in_bounds t.move.dst

let create ~request_id ~move ~expected_piece_id =
  let t = { request_id; move; expected_piece_id } in
  if not (is_valid t) then
    invalid_arg "Move_request.create: invalid piece ID or position";
  t
