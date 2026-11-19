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

(* Wire format (little-endian, 32 bits per position):
     bits  0..9   board_x   (10 bits)
     bits 10..19  board_y   (10 bits)
     bits 20..22  x         (3 bits)
     bits 23..25  y         (3 bits)
     bits 26..31  unused
   A move is two positions, so 64 bits total (52 used), sent as 8 bytes. *)

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

let move_to_bytes m =
  let b = Bytes.create 8 in
  set_u32_le b 0 (position_to_int m.src);
  set_u32_le b 4 (position_to_int m.dst);
  b

let move_of_bytes b =
  {
    src = position_of_int (get_u32_le b 0);
    dst = position_of_int (get_u32_le b 4);
  }

type client_msg =
  | Move of { x : float; y : float }
  | Cast_ray of { angle : float }
[@@deriving yojson]
