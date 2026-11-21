type t = int64

type piece_type =
  | Pawn
  | Knight
  | Bishop
  | Rook
  | Queen
  | King
  | Promoted_pawn

(* Bit layout:
     0..24  piece ID (25 bits, nonzero)
     25..28 piece type (4 bits, 1..7)
     29     is white
     30     just double moved
     31     king killer
     32     king pawner
     33     queen killer
     34     queen pawner
     35     adopted killer
     36     has captured a piece type other than its own
     37    reserved
     38     on original board (cached; updated by moves)
     39     adopted
     40..51 move count (12 bits)
     52..63 capture count (12 bits) *)

let empty = 0L
let max_id = 0x1FFFFFFl

let id_mask = 0x1FFFFFFL
let type_shift = 25
let type_mask = 0xFL
let white_bit = 29
let just_double_moved_bit = 30
let king_killer_bit = 31
let king_pawner_bit = 32
let queen_killer_bit = 33
let queen_pawner_bit = 34
let adopted_killer_bit = 35
let has_captured_other_type_bit = 36
let on_original_board_bit = 38
let adopted_bit = 39
let move_count_shift = 40
let capture_count_shift = 52
let counter_mask = 0xFFFL
let counter_max = 0xFFF

let is_empty t = Int64.equal t empty

let type_code = function
  | Pawn -> 1
  | Knight -> 2
  | Bishop -> 3
  | Rook -> 4
  | Queen -> 5
  | King -> 6
  | Promoted_pawn -> 7

let type_name = function
  | Pawn -> "pawn"
  | Knight -> "knight"
  | Bishop -> "bishop"
  | Rook -> "rook"
  | Queen -> "queen"
  | King -> "king"
  | Promoted_pawn -> "promoted_pawn"

let create ~id ~piece_type ~is_white =
  if Int32.compare id 0l <= 0 then
    invalid_arg "Piece.create: id must be positive";
  if Int32.compare id max_id > 0 then
    invalid_arg "Piece.create: id exceeds max_id";
  let bits =
    Int64.logor (Int64.of_int32 id)
      (Int64.logor
         (Int64.shift_left (Int64.of_int (type_code piece_type)) type_shift)
         (if is_white then Int64.shift_left 1L white_bit else 0L))
  in
  (* New pieces are created on their original board. Moves update this. *)
  Int64.logor bits (Int64.shift_left 1L on_original_board_bit)

let id t = Int64.logand t id_mask |> Int64.to_int32

let piece_type t =
  let code =
    Int64.logand (Int64.shift_right_logical t type_shift) type_mask
    |> Int64.to_int
  in
  match code with
  | 1 -> Pawn
  | 2 -> Knight
  | 3 -> Bishop
  | 4 -> Rook
  | 5 -> Queen
  | 6 -> King
  | 7 -> Promoted_pawn
  | _ -> invalid_arg "Piece.piece_type: empty or invalid piece"

let is_white t = Int64.logand t (Int64.shift_left 1L white_bit) <> 0L

let get_flag t bit = Int64.logand t (Int64.shift_left 1L bit) <> 0L

let set_flag t bit value =
  if value then Int64.logor t (Int64.shift_left 1L bit)
  else Int64.logand t (Int64.lognot (Int64.shift_left 1L bit))

let require_piece name t =
  if is_empty t then invalid_arg (name ^ ": empty piece")

let just_double_moved t = get_flag t just_double_moved_bit
let king_killer t = get_flag t king_killer_bit
let king_pawner t = get_flag t king_pawner_bit
let queen_killer t = get_flag t queen_killer_bit
let queen_pawner t = get_flag t queen_pawner_bit
let adopted_killer t = get_flag t adopted_killer_bit
let has_captured_other_type t = get_flag t has_captured_other_type_bit
let adopted t = get_flag t adopted_bit
let on_original_board t = get_flag t on_original_board_bit

let get_counter t shift =
  Int64.logand (Int64.shift_right_logical t shift) counter_mask
  |> Int64.to_int

let set_counter t shift value =
  let value = if value > counter_max then counter_max else value in
  let cleared =
    Int64.logand t (Int64.lognot (Int64.shift_left counter_mask shift))
  in
  Int64.logor cleared (Int64.shift_left (Int64.of_int value) shift)

let move_count t = get_counter t move_count_shift
let capture_count t = get_counter t capture_count_shift

let with_just_double_moved t value =
  require_piece "Piece.with_just_double_moved" t;
  set_flag t just_double_moved_bit value

let with_king_killer t value =
  require_piece "Piece.with_king_killer" t;
  set_flag t king_killer_bit value

let with_king_pawner t value =
  require_piece "Piece.with_king_pawner" t;
  set_flag t king_pawner_bit value

let with_queen_killer t value =
  require_piece "Piece.with_queen_killer" t;
  set_flag t queen_killer_bit value

let with_queen_pawner t value =
  require_piece "Piece.with_queen_pawner" t;
  set_flag t queen_pawner_bit value

let with_adopted_killer t value =
  require_piece "Piece.with_adopted_killer" t;
  set_flag t adopted_killer_bit value

let with_has_captured_other_type t value =
  require_piece "Piece.with_has_captured_other_type" t;
  set_flag t has_captured_other_type_bit value

let with_adopted t value =
  require_piece "Piece.with_adopted" t;
  set_flag t adopted_bit value

let with_on_original_board t value =
  require_piece "Piece.with_on_original_board" t;
  set_flag t on_original_board_bit value

let original_board_id t =
  require_piece "Piece.original_board_id" t;
  (Int32.to_int (id t) - 1) / 32

let is_on_original_board ~board_x ~board_y t =
  original_board_id t = (board_y * 1000) + board_x

let increment_move_count t =
  require_piece "Piece.increment_move_count" t;
  let count = move_count t in
  if count >= counter_max then t else set_counter t move_count_shift (count + 1)

let increment_capture_count t =
  require_piece "Piece.increment_capture_count" t;
  let count = capture_count t in
  if count >= counter_max then t
  else set_counter t capture_count_shift (count + 1)

let promote t piece_type =
  require_piece "Piece.promote" t;
  let cleared =
    Int64.logand t (Int64.lognot (Int64.shift_left type_mask type_shift))
  in
  Int64.logor cleared
    (Int64.shift_left (Int64.of_int (type_code piece_type)) type_shift)

(* Compact one-byte representation sent in board snapshots.

   bit 0    white
   bits 1-3 type: 0 empty, 1 pawn, 2 bishop, 3 knight, 4 rook, 5 queen, 6 king
   bit 4    on its original board (never moved)
   bit 5    en passantable (pawn) or castling-eligible (king/rook)
   bits 6-7 zero *)

let client_type_code = function
  | Pawn -> 1
  | Bishop -> 2
  | Knight -> 3
  | Rook -> 4
  | Queen | Promoted_pawn -> 5
  | King -> 6

let client_byte t =
  if is_empty t then 0
  else
    let byte = client_type_code (piece_type t) lsl 1 in
    let byte = if is_white t then byte lor 1 else byte in
    let byte = if on_original_board t then byte lor (1 lsl 4) else byte in
    let byte =
      match piece_type t with
      | Pawn -> if just_double_moved t then byte lor (1 lsl 5) else byte
      | King | Rook -> if move_count t = 0 then byte lor (1 lsl 5) else byte
      | _ -> byte
    in
    byte

let client_byte_at ~board_x ~board_y t =
  if is_empty t then 0
  else
    let byte = client_byte t in
    if is_on_original_board ~board_x ~board_y t then byte lor (1 lsl 4)
    else byte land lnot (1 lsl 4)

let client_signature ~square t =
  if square < 0 || square >= 64 then
    invalid_arg "Piece.client_signature: square is out of range";
  Int32.of_int ((square lsl 8) lor client_byte t)

let to_string t =
  if is_empty t then "empty"
  else
    Printf.sprintf
      "{id=%ld type=%s colour=%s dbl=%b kk=%b kp=%b qk=%b qp=%b ak=%b \
       other=%b adopted=%b original=%b moves=%d captures=%d}"
      (id t) (type_name (piece_type t))
      (if is_white t then "white" else "black")
      (just_double_moved t) (king_killer t) (king_pawner t) (queen_killer t)
      (queen_pawner t) (adopted_killer t) (has_captured_other_type t)
      (adopted t) (on_original_board t) (move_count t) (capture_count t)

let pp fmt t = Format.pp_print_string fmt (to_string t)
