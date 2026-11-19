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

(* Wire format (little-endian, 5 bytes = 40 bits):
     bits  0..25  source position
     bits 26..32  dx (7-bit signed, -36..36)
     bits 33..39  dy (7-bit signed, -36..36)

   A position is packed into 26 bits:
     bits  0..9   board_x   (10 bits)
     bits 10..19  board_y   (10 bits)
     bits 20..22  x         (3 bits)
     bits 23..25  y         (3 bits)

   The destination is reconstructed from the source in absolute world
   coordinates, which is exact while the server's 36-square limit holds. *)

let world_boards = 1000
let world_size = world_boards * 8
let max_delta = 36
let move_bytes = 5

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

let sign7 v = if v >= 64 then v - 128 else v

let move_to_bytes m =
  if not (position_in_world m.src && position_in_world m.dst) then
    invalid_arg "Protocol.Types.move_to_bytes: position outside the world";
  let dx = world_x m.dst - world_x m.src in
  let dy = world_y m.dst - world_y m.src in
  if dx < -max_delta || dx > max_delta || dy < -max_delta || dy > max_delta
  then invalid_arg "Protocol.Types.move_to_bytes: delta exceeds 36 squares";
  let packed =
    Int64.logor
      (Int64.of_int (position_to_int m.src))
      (Int64.logor
         (Int64.shift_left (Int64.of_int (dx land 0x7f)) 26)
         (Int64.shift_left (Int64.of_int (dy land 0x7f)) 33))
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
      Int64.logand (Int64.shift_right_logical !packed 26) 0x7FL
      |> Int64.to_int |> sign7
    in
    let dy =
      Int64.logand (Int64.shift_right_logical !packed 33) 0x7FL
      |> Int64.to_int |> sign7
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

type client_msg =
  | Move of { x : float; y : float }
  | Cast_ray of { angle : float }
[@@deriving yojson]
