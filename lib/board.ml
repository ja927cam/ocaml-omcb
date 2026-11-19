open Bigarray

type board_pos = {
  board_x : int;
  board_y : int;
}

type square_pos = {
  x : int;
  y : int;
}

type position = {
  board : board_pos;
  square : square_pos;
}

type t = {
  squares : (int64, int64_elt, c_layout) Array1.t;
}

let boards_x = 1000
let boards_y = 1000
let squares_per_board = 64
let total_squares = boards_x * boards_y * squares_per_board
let dimensions = (boards_x, boards_y)

let in_bounds_board bp =
  bp.board_x >= 0 && bp.board_x < boards_x && bp.board_y >= 0
  && bp.board_y < boards_y

let in_bounds_square sp = sp.x >= 0 && sp.x < 8 && sp.y >= 0 && sp.y < 8
let in_bounds p = in_bounds_board p.board && in_bounds_square p.square

let validate_board bp =
  if bp.board_x < 0 || bp.board_x >= boards_x then
    invalid_arg "Board: board_x is out of range";
  if bp.board_y < 0 || bp.board_y >= boards_y then
    invalid_arg "Board: board_y is out of range"

let validate_square sp =
  if sp.x < 0 || sp.x >= 8 then invalid_arg "Board: x is out of range";
  if sp.y < 0 || sp.y >= 8 then invalid_arg "Board: y is out of range"

let board_id_unchecked bp = (bp.board_y * boards_x) + bp.board_x

let board_id bp =
  validate_board bp;
  board_id_unchecked bp

let index_unchecked p =
  (board_id_unchecked p.board * squares_per_board)
  + ((p.square.y * 8) + p.square.x)

let index p =
  validate_board p.board;
  validate_square p.square;
  index_unchecked p

let world_x p = (p.board.board_x * 8) + p.square.x
let world_y p = (p.board.board_y * 8) + p.square.y

let position_of_world ~x ~y =
  let world_size = boards_x * 8 in
  if x < 0 || x >= world_size then
    invalid_arg "Board.position_of_world: x is out of range";
  if y < 0 || y >= world_size then
    invalid_arg "Board.position_of_world: y is out of range";
  {
    board = { board_x = x / 8; board_y = y / 8 };
    square = { x = x mod 8; y = y mod 8 };
  }

let create () =
  let squares = Array1.create int64 c_layout total_squares in
  Array1.fill squares Piece.empty;
  { squares }

let get t p = Array1.unsafe_get t.squares (index p)

let set t p piece = Array1.unsafe_set t.squares (index p) piece

let clear t p = Array1.unsafe_set t.squares (index p) Piece.empty

let get_board t bp =
  let base = board_id bp * squares_per_board in
  Array.init squares_per_board (fun i ->
      Array1.unsafe_get t.squares (base + i))

let set_board t bp pieces =
  validate_board bp;
  if Array.length pieces <> squares_per_board then
    invalid_arg "Board.set_board: expected exactly 64 pieces";
  let base = board_id_unchecked bp * squares_per_board in
  for i = 0 to squares_per_board - 1 do
    Array1.unsafe_set t.squares (base + i) pieces.(i)
  done

let clear_board t bp =
  let base = board_id bp * squares_per_board in
  for i = 0 to squares_per_board - 1 do
    Array1.unsafe_set t.squares (base + i) Piece.empty
  done

let iter_board t bp f =
  let base = board_id bp * squares_per_board in
  for y = 0 to 7 do
    for x = 0 to 7 do
      f { x; y }
        (Array1.unsafe_get t.squares (base + ((y * 8) + x)))
    done
  done

let iter t f =
  let world_boards = boards_x * boards_y in
  for b = 0 to world_boards - 1 do
    let base = b * squares_per_board in
    let board =
      { board_x = b mod boards_x; board_y = b / boards_x }
    in
    for i = 0 to squares_per_board - 1 do
      let piece = Array1.unsafe_get t.squares (base + i) in
      if not (Piece.is_empty piece) then
        f { board; square = { x = i mod 8; y = i / 8 } } piece
    done
  done

let occupied_count t =
  let count = ref 0 in
  for i = 0 to total_squares - 1 do
    if not (Piece.is_empty (Array1.unsafe_get t.squares i)) then incr count
  done;
  !count

let copy t =
  let squares = Array1.create int64 c_layout total_squares in
  Array1.blit t.squares squares;
  { squares }

let back_rank =
  [| Piece.Rook; Piece.Knight; Piece.Bishop; Piece.Queen; Piece.King;
     Piece.Bishop; Piece.Knight; Piece.Rook |]

let initialise_standard_position t bp =
  let bid = board_id bp in
  clear_board t bp;
  let base = bid * squares_per_board in
  let next_id = ref ((bid * 32) + 1) in
  let put x y piece_type is_white =
    let id = !next_id in
    incr next_id;
    let piece =
      Piece.create ~id:(Int32.of_int id) ~piece_type ~is_white
    in
    Array1.unsafe_set t.squares (base + ((y * 8) + x)) piece
  in
  Array.iteri (fun x piece_type -> put x 0 piece_type false) back_rank;
  for x = 0 to 7 do put x 1 Piece.Pawn false done;
  for x = 0 to 7 do put x 6 Piece.Pawn true done;
  Array.iteri (fun x piece_type -> put x 7 piece_type true) back_rank

let piece_letter = function
  | Piece.Pawn | Piece.Promoted_pawn -> 'P'
  | Piece.Knight -> 'N'
  | Piece.Bishop -> 'B'
  | Piece.Rook -> 'R'
  | Piece.Queen -> 'Q'
  | Piece.King -> 'K'

let piece_char piece =
  if Piece.is_empty piece then '.'
  else
    let c = piece_letter (Piece.piece_type piece) in
    if Piece.is_white piece then c else Char.lowercase_ascii c

let print_board t bp =
  let base = board_id bp * squares_per_board in
  for y = 0 to 7 do
    for x = 0 to 7 do
      print_char (piece_char (Array1.unsafe_get t.squares (base + ((y * 8) + x))))
    done;
    print_newline ()
  done
