type position = {
  board_x : int;
  board_y : int;
  x : int;
  y : int;
}

type move = {
  src : position;
  dst : position;
}

(* Wire format (little-endian, 6 bytes = 48 bits):
     bits  0..25  source position
     bits 26..34  dx (9-bit signed, -128..128)
     bits 35..43  dy (9-bit signed, -128..128)
     bits 44..47  unused

   A position is packed into 26 bits:
     bits  0..9   board_x   (10 bits)
     bits 10..19  board_y   (10 bits)
     bits 20..22  x         (3 bits)
     bits 23..25  y         (3 bits)

   The destination is reconstructed from the source in absolute world
   coordinates, which is exact while the server's 36-square limit holds. *)

let world_boards = 1000
let world_size = world_boards * 8
let max_delta = 128
let move_bytes = 6

let position_to_int p =
  (p.board_x land 0x3ff)
  lor ((p.board_y land 0x3ff) lsl 10)
  lor ((p.x land 0x7) lsl 20)
  lor ((p.y land 0x7) lsl 23)

let position_of_int v =
  {
    board_x = v land 0x3ff;
    board_y = (v lsr 10) land 0x3ff;
    x = (v lsr 20) land 0x7;
    y = (v lsr 23) land 0x7;
  }

let position_in_world p =
  p.board_x >= 0 && p.board_x < world_boards && p.board_y >= 0
  && p.board_y < world_boards && p.x >= 0 && p.x < 8 && p.y >= 0 && p.y < 8

let world_x p = (p.board_x * 8) + p.x
let world_y p = (p.board_y * 8) + p.y

let get_u32_le b off =
  Char.code (Bytes.get b off)
  lor (Char.code (Bytes.get b (off + 1)) lsl 8)
  lor (Char.code (Bytes.get b (off + 2)) lsl 16)
  lor ((Char.code (Bytes.get b (off + 3)) land 0x3) lsl 24)

let set_u32_le b off v =
  Bytes.set b off (Char.chr (v land 0xff));
  Bytes.set b (off + 1) (Char.chr ((v lsr 8) land 0xff));
  Bytes.set b (off + 2) (Char.chr ((v lsr 16) land 0xff));
  Bytes.set b (off + 3) (Char.chr ((v lsr 24) land 0x03))

let position_to_bytes p =
  let b = Bytes.create 4 in
  set_u32_le b 0 (position_to_int p);
  b

let position_of_bytes b = position_of_int (get_u32_le b 0)

let sign9 v = if v >= 256 then v - 512 else v

let move_to_bytes m =
  if not (position_in_world m.src && position_in_world m.dst) then
    invalid_arg "Protocol.Types.move_to_bytes: position outside the world";
  let dx = world_x m.dst - world_x m.src in
  let dy = world_y m.dst - world_y m.src in
  if dx < -max_delta || dx > max_delta || dy < -max_delta || dy > max_delta
  then invalid_arg "Protocol.Types.move_to_bytes: delta exceeds 128 squares";
  let packed =
    Int64.logor
      (Int64.of_int (position_to_int m.src))
      (Int64.logor
         (Int64.shift_left (Int64.of_int (dx land 0x1ff)) 26)
         (Int64.shift_left (Int64.of_int (dy land 0x1ff)) 35))
  in
  let b = Bytes.create move_bytes in
  for i = 0 to move_bytes - 1 do
    let byte =
      Int64.logand (Int64.shift_right_logical packed (i * 8)) 0xffL
      |> Int64.to_int
    in
    Bytes.set b i (Char.chr byte)
  done;
  b

let move_of_bytes b =
  if Bytes.length b <> move_bytes then None
  else
    let packed = ref 0L in
    for i = 0 to move_bytes - 1 do
      packed :=
        Int64.logor !packed
          (Int64.shift_left
             (Int64.of_int (Char.code (Bytes.get b i)))
             (i * 8))
    done;
    let src =
      position_of_int
        (Int64.to_int (Int64.logand !packed 0x3FFFFFFL))
    in
    let dx =
      Int64.logand (Int64.shift_right_logical !packed 26) 0x1FFL
      |> Int64.to_int |> sign9
    in
    let dy =
      Int64.logand (Int64.shift_right_logical !packed 35) 0x1FFL
      |> Int64.to_int |> sign9
    in
    if
      (not (position_in_world src))
      || dx < -max_delta || dx > max_delta
      || dy < -max_delta || dy > max_delta
    then None
    else
      let wx = world_x src + dx in
      let wy = world_y src + dy in
      if wx < 0 || wx >= world_size || wy < 0 || wy >= world_size then None
      else
        Some
          {
            src;
            dst =
              {
                board_x = wx / 8;
                board_y = wy / 8;
                x = wx mod 8;
                y = wy mod 8;
              };
          }

(* {2 Move requests (14 bytes)}

   byte  0..5   move (6-byte codec above)
   byte  6..9   expected piece ID (int32, little-endian)
   byte 10..13  request ID (int32, little-endian) *)

type move_request = {
  request_id : int32;
  expected_piece_id : int32;
  move : move;
}

let request_bytes = 14
let max_piece_id = 0x1FFFFFFl

let get_i32_le b off =
  let byte i = Int32.of_int (Char.code (Bytes.get b (off + i))) in
  Int32.logor (byte 0)
    (Int32.logor
       (Int32.shift_left (byte 1) 8)
       (Int32.logor
          (Int32.shift_left (byte 2) 16)
          (Int32.shift_left (byte 3) 24)))

let set_i32_le b off v =
  for i = 0 to 3 do
    let byte =
      Int32.logand (Int32.shift_right_logical v (i * 8)) 0xffl
      |> Int32.to_int
    in
    Bytes.set b (off + i) (Char.chr byte)
  done

let get_i64_le b off =
  let packed = ref 0L in
  for i = 0 to 7 do
    packed :=
      Int64.logor !packed
        (Int64.shift_left
           (Int64.of_int (Char.code (Bytes.get b (off + i))))
           (i * 8))
  done;
  !packed

let set_i64_le b off v =
  for i = 0 to 7 do
    let byte =
      Int64.logand (Int64.shift_right_logical v (i * 8)) 0xffL
      |> Int64.to_int
    in
    Bytes.set b (off + i) (Char.chr byte)
  done

let valid_piece_id id =
  Int32.compare id 0l > 0 && Int32.compare id max_piece_id <= 0

let move_request_to_bytes request =
  if not (valid_piece_id request.expected_piece_id) then
    invalid_arg "Protocol.Types.move_request_to_bytes: invalid piece ID";
  let b = Bytes.create request_bytes in
  let move = move_to_bytes request.move in
  Bytes.blit move 0 b 0 move_bytes;
  set_i32_le b 6 request.expected_piece_id;
  set_i32_le b 10 request.request_id;
  b

let move_request_of_bytes b =
  if Bytes.length b <> request_bytes then None
  else
    match move_of_bytes (Bytes.sub b 0 move_bytes) with
    | None -> None
    | Some move ->
      let expected_piece_id = get_i32_le b 6 in
      if not (valid_piece_id expected_piece_id) then None
      else
        Some
          {
            request_id = get_i32_le b 10;
            expected_piece_id;
            move;
          }

(* {2 Responses (26 bytes)}

   byte  0      status: 1 accepted, 0 rejected
   byte  1..4   request ID (int32, little-endian)
   byte  5..12  sequence (int64, little-endian; 0 when rejected)
   byte 13..20  updated moving piece (int64; 0 when rejected)
   byte 21..24  captured piece ID (int32; 0 when none/rejected)
   byte 25      rejection code (0 for accepted) *)

type response_status =
  | Accepted
  | Rejected

type response = {
  request_id : int32;
  status : response_status;
  sequence : int64;
  moved_piece : int64;
  captured_piece_id : int32;
  rejection : int;
}

let response_bytes = 26

let rejection_none = 0
let rejection_stale_piece = 1
let rejection_empty_source = 2
let rejection_invalid_geometry = 3
let rejection_blocked_path = 4
let rejection_invalid_destination = 5
let rejection_cross_board_capture = 6
let rejection_invalid_special_move = 7
let rejection_invalid_request = 8
let rejection_queue_full = 9
let rejection_worker_stopped = 10
let rejection_worker_failed = 11

let response_to_bytes response =
  let b = Bytes.create response_bytes in
  Bytes.set b 0
    (Char.chr (match response.status with Accepted -> 1 | Rejected -> 0));
  set_i32_le b 1 response.request_id;
  set_i64_le b 5 response.sequence;
  set_i64_le b 13 response.moved_piece;
  set_i32_le b 21 response.captured_piece_id;
  Bytes.set b 25 (Char.chr (response.rejection land 0xff));
  b

let response_of_bytes b =
  if Bytes.length b <> response_bytes then None
  else
    let status =
      match Char.code (Bytes.get b 0) with
      | 1 -> Accepted
      | _ -> Rejected
    in
    Some
      {
        request_id = get_i32_le b 1;
        status;
        sequence = get_i64_le b 5;
        moved_piece = get_i64_le b 13;
        captured_piece_id = get_i32_le b 21;
        rejection = Char.code (Bytes.get b 25);
      }


type client_msg =
  | Move of { x : float; y : float }
  | Cast_ray of { angle : float }
[@@deriving yojson]
