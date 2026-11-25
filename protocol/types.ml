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

(* Fixed-size wire frames; see wire_response_to_bytes below. *)
let wire_response_bytes = 4096
let wire_kind_move = 1
let wire_kind_snapshot = 2
let wire_kind_event = 3
let wire_kind_event_batch = 4

let rejection_none = 0
let rejection_stale_piece = 1
let rejection_empty_source = 2
let rejection_invalid_geometry = 3
let rejection_blocked_path = 4
let rejection_invalid_destination = 5
let rejection_capture_off_original_board = 6
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

(* {2 Snapshot requests and responses} *)

let snapshot_message_type = 0x02
let snapshot_request_bytes = 9
let snapshot_response_bytes = 1 + 4 + 2 + 2 + 8 + 64

let get_u16_le b off =
  Char.code (Bytes.get b off) lor (Char.code (Bytes.get b (off + 1)) lsl 8)

let set_u16_le b off v =
  Bytes.set b off (Char.chr (v land 0xff));
  Bytes.set b (off + 1) (Char.chr ((v lsr 8) land 0xff))

let valid_board_coord x = x >= 0 && x < 1000

type snapshot_request = {
  request_id : int32;
  board_x : int;
  board_y : int;
}

type snapshot_status =
  | Snapshot_ok
  | Snapshot_failed

type snapshot_response = {
  request_id : int32;
  board_x : int;
  board_y : int;
  status : snapshot_status;
  revision : int64; (* monotonic per-board revision *)
  board : Bytes.t; (* 64 one-byte client pieces, row-major *)
}

let snapshot_request_to_bytes (request : snapshot_request) =
  if
    not
      (valid_board_coord request.board_x
      && valid_board_coord request.board_y)
  then
    invalid_arg
      "Protocol.Types.snapshot_request_to_bytes: board coordinates out of range";
  let b = Bytes.create snapshot_request_bytes in
  Bytes.set b 0 (Char.chr snapshot_message_type);
  set_i32_le b 1 request.request_id;
  set_u16_le b 5 request.board_x;
  set_u16_le b 7 request.board_y;
  b

let snapshot_request_of_bytes b : snapshot_request option =
  if Bytes.length b <> snapshot_request_bytes then None
  else if Char.code (Bytes.get b 0) <> snapshot_message_type then None
  else
    let board_x = get_u16_le b 5 and board_y = get_u16_le b 7 in
    if not (valid_board_coord board_x && valid_board_coord board_y) then None
    else
      Some
        {
          request_id = get_i32_le b 1;
          board_x;
          board_y;
        }

let snapshot_response_to_bytes (response : snapshot_response) =
  if
    not
      (valid_board_coord response.board_x
      && valid_board_coord response.board_y)
  then
    invalid_arg
      "Protocol.Types.snapshot_response_to_bytes: board coordinates out of range";
  let success = response.status = Snapshot_ok in
  if success && Bytes.length response.board <> 64 then
    invalid_arg
      "Protocol.Types.snapshot_response_to_bytes: expected 64 pieces";
  let b = Bytes.create snapshot_response_bytes in
  Bytes.set b 0 (Char.chr (if success then 1 else 0));
  set_i32_le b 1 response.request_id;
  set_u16_le b 5 response.board_x;
  set_u16_le b 7 response.board_y;
  set_i64_le b 9 (if success then response.revision else 0L);
  if success then Bytes.blit response.board 0 b 17 64;
  b

let snapshot_response_of_bytes b : snapshot_response option =
  if Bytes.length b <> snapshot_response_bytes then None
  else
    let status =
      match Char.code (Bytes.get b 0) with
      | 1 -> Snapshot_ok
      | _ -> Snapshot_failed
    in
    let board_x = get_u16_le b 5 and board_y = get_u16_le b 7 in
    if not (valid_board_coord board_x && valid_board_coord board_y) then None
    else
      let revision = get_i64_le b 9 in
      let board = Bytes.sub b 17 64 in
      Some
        {
          request_id = get_i32_le b 1;
          board_x;
          board_y;
          status;
          revision;
          board;
        }

(* {2 WebSocket response framing}

   Dream 1.0.0~alpha8 buffers WebSocket writes until 4096 bytes accumulate.
   A move acknowledgement is only 26 bytes, so it could sit in the buffer while
   the client waits for it before sending anything else. Every response is
   therefore carried in a fixed 4096-byte frame: a one-byte kind followed by
   the encoded response and zero padding. This makes each send cross Dream's
   flush threshold immediately, at the cost of some padding on the wire. *)

type event_change = {
  square : int;
  piece : int;
}

type event_board = {
  board_x : int;
  board_y : int;
  revision : int64;
  changes : event_change list;
}

type move_event = {
  sequence : int64;
  request_id : int32;
  boards : event_board list;
}

type wire_response =
  | Wire_move of response
  | Wire_snapshot of snapshot_response
  | Wire_event of move_event

let wrap_wire kind payload =
  let bytes = Bytes.make wire_response_bytes '\000' in
  Bytes.set bytes 0 (Char.chr kind);
  Bytes.blit payload 0 bytes 1 (Bytes.length payload);
  bytes

let move_event_payload_to_bytes (event : move_event) =
  let board_count = List.length event.boards in
  if board_count > 255 then
    invalid_arg "Protocol.Types.move_event_payload_to_bytes: too many boards";
  let payload_size =
    8 + 4 + 1
    + List.fold_left
        (fun total (board : event_board) ->
          total + 13 + (List.length board.changes * 2))
        0 event.boards
  in
  if payload_size > wire_response_bytes then
    invalid_arg "Protocol.Types.move_event_payload_to_bytes: event too large";
  let bytes = Bytes.create payload_size in
  set_i64_le bytes 0 event.sequence;
  set_i32_le bytes 8 event.request_id;
  Bytes.set bytes 12 (Char.chr board_count);
  let offset = ref 13 in
  List.iter
    (fun (board : event_board) ->
      if not (valid_board_coord board.board_x && valid_board_coord board.board_y)
      then
        invalid_arg
          "Protocol.Types.move_event_payload_to_bytes: board coordinates out of range";
      let change_count = List.length board.changes in
      if change_count > 255 then
        invalid_arg
          "Protocol.Types.move_event_payload_to_bytes: too many changes";
      set_u16_le bytes !offset board.board_x;
      set_u16_le bytes (!offset + 2) board.board_y;
      set_i64_le bytes (!offset + 4) board.revision;
      Bytes.set bytes (!offset + 12) (Char.chr change_count);
      offset := !offset + 13;
      List.iter
        (fun (change : event_change) ->
          if change.square < 0 || change.square >= 64 then
            invalid_arg
              "Protocol.Types.move_event_payload_to_bytes: square out of range";
          if change.piece < 0 || change.piece > 255 then
            invalid_arg
              "Protocol.Types.move_event_payload_to_bytes: piece byte out of range";
          Bytes.set bytes !offset (Char.chr change.square);
          Bytes.set bytes (!offset + 1) (Char.chr change.piece);
          offset := !offset + 2)
        board.changes)
    event.boards;
  bytes

let move_event_to_bytes (event : move_event) =
  let payload = move_event_payload_to_bytes event in
  let bytes = Bytes.make wire_response_bytes '\000' in
  Bytes.set bytes 0 (Char.chr wire_kind_event);
  Bytes.blit payload 0 bytes 1 (Bytes.length payload);
  bytes

let move_event_of_bytes bytes =
  if Bytes.length bytes <> wire_response_bytes then None
  else if Char.code (Bytes.get bytes 0) <> wire_kind_event then None
  else
    let board_count = Char.code (Bytes.get bytes 13) in
    if board_count = 0 || board_count > 2 then None
    else
      let offset = ref 14 in
      let boards = ref [] in
      let ok = ref true in
      for _ = 1 to board_count do
        if !offset + 13 > wire_response_bytes then ok := false
        else begin
          let board_x = get_u16_le bytes !offset in
          let board_y = get_u16_le bytes (!offset + 2) in
          let revision = get_i64_le bytes (!offset + 4) in
          let change_count = Char.code (Bytes.get bytes (!offset + 12)) in
          offset := !offset + 13;
          if
            (not (valid_board_coord board_x && valid_board_coord board_y))
            || !offset + (change_count * 2) > wire_response_bytes
          then ok := false
          else begin
            let changes = ref [] in
            for _ = 1 to change_count do
              let square = Char.code (Bytes.get bytes !offset) in
              let piece = Char.code (Bytes.get bytes (!offset + 1)) in
              if square >= 64 || piece > 255 then ok := false;
              changes := { square; piece } :: !changes;
              offset := !offset + 2
            done;
            boards :=
              { board_x; board_y; revision; changes = List.rev !changes }
              :: !boards
          end
        end
      done;
      if not !ok then None
      else
        Some
          {
            sequence = get_i64_le bytes 1;
            request_id = get_i32_le bytes 9;
            boards = List.rev !boards;
          }

let move_event_payload_of_bytes bytes offset =
  let length = Bytes.length bytes in
  if offset < 0 || offset + 13 > length then None
  else
    let board_count = Char.code (Bytes.get bytes (offset + 12)) in
    if board_count = 0 || board_count > 2 then None
    else
      let cursor = ref (offset + 13) in
      let boards = ref [] in
      let ok = ref true in
      for _ = 1 to board_count do
        if !cursor + 13 > length then ok := false
        else begin
          let board_x = get_u16_le bytes !cursor in
          let board_y = get_u16_le bytes (!cursor + 2) in
          let revision = get_i64_le bytes (!cursor + 4) in
          let change_count = Char.code (Bytes.get bytes (!cursor + 12)) in
          cursor := !cursor + 13;
          if
            (not (valid_board_coord board_x && valid_board_coord board_y))
            || !cursor + (change_count * 2) > length
          then ok := false
          else begin
            let changes = ref [] in
            for _ = 1 to change_count do
              let square = Char.code (Bytes.get bytes !cursor) in
              let piece = Char.code (Bytes.get bytes (!cursor + 1)) in
              if square >= 64 || piece > 255 then ok := false;
              changes := { square; piece } :: !changes;
              cursor := !cursor + 2
            done;
            boards :=
              { board_x; board_y; revision; changes = List.rev !changes }
              :: !boards
          end
        end
      done;
      if not !ok then None
      else
        Some
          ( {
              sequence = get_i64_le bytes offset;
              request_id = get_i32_le bytes (offset + 8);
              boards = List.rev !boards;
            },
            !cursor )

let move_events_of_bytes bytes =
  if Bytes.length bytes <> wire_response_bytes then None
  else if Char.code (Bytes.get bytes 0) <> wire_kind_event_batch then None
  else
    let count = Char.code (Bytes.get bytes 1) in
    let offset = ref 2 in
    let events = ref [] in
    let ok = ref true in
    for _ = 1 to count do
      if not !ok then ()
      else
        match move_event_payload_of_bytes bytes !offset with
        | None -> ok := false
        | Some (event, next) ->
          events := event :: !events;
          offset := next
    done;
    if not !ok then None else Some (List.rev !events)

let wire_response_to_bytes response =
  match response with
  | Wire_move response ->
    wrap_wire wire_kind_move (response_to_bytes response)
  | Wire_snapshot response ->
    wrap_wire wire_kind_snapshot (snapshot_response_to_bytes response)
  | Wire_event event -> move_event_to_bytes event

let wire_response_of_bytes bytes =
  if Bytes.length bytes <> wire_response_bytes then None
  else
    match Char.code (Bytes.get bytes 0) with
    | kind when kind = wire_kind_move ->
      response_of_bytes (Bytes.sub bytes 1 response_bytes)
      |> Option.map (fun response -> Wire_move response)
    | kind when kind = wire_kind_snapshot ->
      snapshot_response_of_bytes (Bytes.sub bytes 1 snapshot_response_bytes)
      |> Option.map (fun response -> Wire_snapshot response)
    | kind when kind = wire_kind_event ->
      move_event_of_bytes bytes |> Option.map (fun event -> Wire_event event)
    | _ -> None

(* Project a packed piece to the one-byte client snapshot representation.
   This is the inverse direction of the move-response update: the client
   receives a moved_piece int64 and refreshes its local byte without a new
   snapshot. The bit layout is the Piece.t layout documented in lib/piece.ml. *)
let client_byte_of_packed value =
  if Int64.equal value 0L then 0
  else begin
    let code =
      Int64.logand (Int64.shift_right_logical value 25) 0xFL |> Int64.to_int
    in
    let type_code =
      match code with
      | 1 -> 1
      | 2 -> 3 (* knight *)
      | 3 -> 2 (* bishop *)
      | 4 -> 4
      | 5 -> 5
      | 6 -> 6
      | 7 -> 5 (* promoted pawn renders as a queen *)
      | _ -> 0
    in
    let white = Int64.logand value (Int64.shift_left 1L 29) <> 0L in
    let moves =
      Int64.logand (Int64.shift_right_logical value 40) 0xFFFL |> Int64.to_int
    in
    let double = Int64.logand value (Int64.shift_left 1L 30) <> 0L in
    let on_original =
      Int64.logand value (Int64.shift_left 1L 38) <> 0L
    in
    let byte = type_code lsl 1 in
    let byte = if white then byte lor 1 else byte in
    let byte = if on_original then byte lor 0x10 else byte in
    match type_code with
    | 1 -> if double then byte lor 0x20 else byte
    | 4 | 6 -> if moves = 0 then byte lor 0x20 else byte
    | _ -> byte
  end

(* {2 Batched board snapshots}

   Loading a 25 x 25 cache one 9-byte request at a time costs 625 network
   round trips and 625 fixed-size 4096-byte reply frames. Both are dominated by
   latency and padding rather than by board data. A batch request asks for a
   rectangular region in a single message and gets a single variable-size frame
   back.

   Batch request (13 bytes):
     byte  0      message type 0x06
     byte  1..4   request ID (int32, little-endian)
     byte  5..6   x0 (first board x)
     byte  7..8   y0 (first board y)
     byte  9..10  x1 (last board x, inclusive)
     byte 11..12  y1 (last board y, inclusive)

   Batch response (wire kind 5):
     byte  0      kind 5
     byte  1..4   request ID (int32, little-endian)
     byte  5..6   x0
     byte  7..8   y0
     byte  9..10  width
     byte 11..12  height
     then [width * height] board records, row-major:
       byte 0..7   per-board revision (int64, little-endian)
       byte 8..15  occupancy bitmap (int64: bit i set when square i is occupied)
       byte 16..   one client piece byte per set bit, in increasing square order

   A standard starting board therefore costs 16 + 32 = 48 bytes instead of a
   4096-byte padded frame, and the whole 625-board cache is one frame of about
   30 KiB. The format is strictly additive: the original single-board request
   and response are unchanged and remain the resynchronisation fallback. *)

let snapshot_batch_request_message_type = 0x06
let snapshot_batch_request_bytes = 13
let wire_kind_snapshot_batch = 5
let snapshot_batch_header_bytes = 13
let snapshot_batch_board_header_bytes = 16
let snapshot_batch_area_limit = 4096

type snapshot_batch_request = {
  request_id : int32;
  x0 : int;
  y0 : int;
  x1 : int;
  y1 : int;
}

let valid_batch_region x0 y0 x1 y1 =
  valid_board_coord x0 && valid_board_coord y0 && valid_board_coord x1
  && valid_board_coord y1 && x0 <= x1 && y0 <= y1
  && (x1 - x0 + 1) * (y1 - y0 + 1) <= snapshot_batch_area_limit

let snapshot_batch_request_to_bytes (request : snapshot_batch_request) =
  if
    not
      (valid_batch_region request.x0 request.y0 request.x1 request.y1)
  then
    invalid_arg
      "Protocol.Types.snapshot_batch_request_to_bytes: invalid region";
  let b = Bytes.create snapshot_batch_request_bytes in
  Bytes.set b 0 (Char.chr snapshot_batch_request_message_type);
  set_i32_le b 1 request.request_id;
  set_u16_le b 5 request.x0;
  set_u16_le b 7 request.y0;
  set_u16_le b 9 request.x1;
  set_u16_le b 11 request.y1;
  b

let snapshot_batch_request_of_bytes b : snapshot_batch_request option =
  if Bytes.length b <> snapshot_batch_request_bytes then None
  else if
    Char.code (Bytes.get b 0) <> snapshot_batch_request_message_type
  then None
  else
    let x0 = get_u16_le b 5
    and y0 = get_u16_le b 7
    and x1 = get_u16_le b 9
    and y1 = get_u16_le b 11 in
    if not (valid_batch_region x0 y0 x1 y1) then None
    else Some { request_id = get_i32_le b 1; x0; y0; x1; y1 }

type snapshot_batch_board = {
  revision : int64;
  pieces : Bytes.t; (* 64 dense client piece bytes, row-major *)
}

type snapshot_batch = {
  request_id : int32;
  x0 : int;
  y0 : int;
  width : int;
  height : int;
  boards : snapshot_batch_board array;
}

let populated_bits pieces =
  if Bytes.length pieces <> 64 then
    invalid_arg "Protocol.Types.populated_bits: expected 64 pieces";
  let bits = ref 0L in
  for i = 0 to 63 do
    if Char.code (Bytes.unsafe_get pieces i) <> 0 then
      bits := Int64.logor !bits (Int64.shift_left 1L i)
  done;
  !bits

let bit_count value =
  let value = ref value and count = ref 0 in
  while not (Int64.equal !value 0L) do
    value := Int64.logand !value (Int64.pred !value);
    incr count
  done;
  !count

let snapshot_batch_encoded_length (batch : snapshot_batch) =
  let total = ref snapshot_batch_header_bytes in
  Array.iter
    (fun (board : snapshot_batch_board) ->
      total :=
        !total + snapshot_batch_board_header_bytes
        + bit_count (populated_bits board.pieces))
    batch.boards;
  !total

let snapshot_batch_to_bytes (batch : snapshot_batch) =
  let count = Array.length batch.boards in
  if
    batch.width <= 0 || batch.height <= 0
    || count <> batch.width * batch.height
  then
    invalid_arg
      "Protocol.Types.snapshot_batch_to_bytes: board count does not match \
       width * height";
  if not (valid_batch_region batch.x0 batch.y0
            (batch.x0 + batch.width - 1) (batch.y0 + batch.height - 1))
  then
    invalid_arg
      "Protocol.Types.snapshot_batch_to_bytes: invalid region";
  let b = Bytes.create (snapshot_batch_encoded_length batch) in
  Bytes.set b 0 (Char.chr wire_kind_snapshot_batch);
  set_i32_le b 1 batch.request_id;
  set_u16_le b 5 batch.x0;
  set_u16_le b 7 batch.y0;
  set_u16_le b 9 batch.width;
  set_u16_le b 11 batch.height;
  let offset = ref snapshot_batch_header_bytes in
  Array.iter
    (fun (board : snapshot_batch_board) ->
      if Bytes.length board.pieces <> 64 then
        invalid_arg
          "Protocol.Types.snapshot_batch_to_bytes: expected 64 pieces";
      let bits = populated_bits board.pieces in
      set_i64_le b !offset board.revision;
      set_i64_le b (!offset + 8) bits;
      offset := !offset + snapshot_batch_board_header_bytes;
      for i = 0 to 63 do
        let piece = Char.code (Bytes.unsafe_get board.pieces i) in
        if piece <> 0 then begin
          Bytes.unsafe_set b !offset (Char.chr piece);
          incr offset
        end
      done)
    batch.boards;
  if !offset <> Bytes.length b then
    invalid_arg
      "Protocol.Types.snapshot_batch_to_bytes: encoded length mismatch";
  b

let snapshot_batch_of_bytes b : snapshot_batch option =
  let length = Bytes.length b in
  if length < snapshot_batch_header_bytes then None
  else if Char.code (Bytes.unsafe_get b 0) <> wire_kind_snapshot_batch then
    None
  else
    let x0 = get_u16_le b 5
    and y0 = get_u16_le b 7
    and width = get_u16_le b 9
    and height = get_u16_le b 11 in
    if
      width <= 0 || height <= 0
      || not
           (valid_batch_region x0 y0 (x0 + width - 1) (y0 + height - 1))
    then None
    else
      let count = width * height in
      let boards = Array.make count { revision = 0L; pieces = Bytes.empty } in
      let offset = ref snapshot_batch_header_bytes in
      let ok = ref true in
      for index = 0 to count - 1 do
        if (not !ok) || !offset + snapshot_batch_board_header_bytes > length
        then ok := false
        else begin
          let revision = get_i64_le b !offset in
          let bits = get_i64_le b (!offset + 8) in
          offset := !offset + snapshot_batch_board_header_bytes;
          let populated = bit_count bits in
          if !offset + populated > length then ok := false
          else begin
            let pieces = Bytes.make 64 '\000' in
            for square = 0 to 63 do
              if
                Int64.logand bits (Int64.shift_left 1L square) <> 0L
                && !ok
              then begin
                Bytes.unsafe_set pieces square
                  (Bytes.unsafe_get b !offset);
                incr offset
              end
            done;
            boards.(index) <- { revision; pieces }
          end
        end
      done;
      if (not !ok) || !offset <> length then None
      else Some { request_id = get_i32_le b 1; x0; y0; width; height; boards }

(* {2 Board subscriptions}

   Clients announce the 25 x 25 (or arbitrary radius) window they cache with a
   single window message, or adjust individual boards with subscribe /
   unsubscribe messages. All messages are connection-local. *)

type subscription_kind =
  | Subscribe
  | Unsubscribe

let subscribe_message_type = 0x03
let unsubscribe_message_type = 0x04
let subscription_window_message_type = 0x05
let board_subscription_bytes = 5
let subscription_window_bytes = 6

let board_subscription_to_bytes kind board_x board_y =
  if not (valid_board_coord board_x && valid_board_coord board_y) then
    invalid_arg
      "Protocol.Types.board_subscription_to_bytes: board coordinates out of range";
  let b = Bytes.create board_subscription_bytes in
  Bytes.set b 0
    (Char.chr
       (match kind with Subscribe -> subscribe_message_type | Unsubscribe ->
         unsubscribe_message_type));
  set_u16_le b 1 board_x;
  set_u16_le b 3 board_y;
  b

let board_subscription_of_bytes b =
  if Bytes.length b <> board_subscription_bytes then None
  else
    let kind =
      match Char.code (Bytes.get b 0) with
      | 3 -> Some Subscribe
      | 4 -> Some Unsubscribe
      | _ -> None
    in
    match kind with
    | None -> None
    | Some kind ->
      let board_x = get_u16_le b 1 and board_y = get_u16_le b 3 in
      if valid_board_coord board_x && valid_board_coord board_y then
        Some (kind, board_x, board_y)
      else None

type subscription_window = {
  center_x : int;
  center_y : int;
  radius : int;
}

let subscription_window_to_bytes window =
  if
    not
      (valid_board_coord window.center_x
      && valid_board_coord window.center_y)
  then
    invalid_arg
      "Protocol.Types.subscription_window_to_bytes: centre out of range";
  if window.radius < 0 || window.radius > 100 then
    invalid_arg
      "Protocol.Types.subscription_window_to_bytes: radius out of range";
  let b = Bytes.create subscription_window_bytes in
  Bytes.set b 0 (Char.chr subscription_window_message_type);
  set_u16_le b 1 window.center_x;
  set_u16_le b 3 window.center_y;
  Bytes.set b 5 (Char.chr window.radius);
  b

let subscription_window_of_bytes b =
  if Bytes.length b <> subscription_window_bytes then None
  else if Char.code (Bytes.get b 0) <> subscription_window_message_type then
    None
  else
    let center_x = get_u16_le b 1
    and center_y = get_u16_le b 3
    and radius = Char.code (Bytes.get b 5) in
    if
      valid_board_coord center_x && valid_board_coord center_y
      && radius >= 0 && radius <= 100
    then Some { center_x; center_y; radius }
    else None
