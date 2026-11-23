type board_change = {
  board_x : int;
  board_y : int;
  revision : int64;
  changes : (int * Piece.t) list;
}

type transition = {
  sequence : int64;
  request_id : int32;
  boards : board_change list;
  ledger_move : int64;
  ledger_moved_id : int32;
  ledger_captured_id : int32;
  ledger_flags : int;
}

let record_magic = "SMWL"
let segment_magic = "SMWG"
let format_version = 1
let record_header_bytes = 12
let checksum_bytes = 8
let segment_header_bytes = 16
let max_payload = 64 * 1024

let max_boards = 8
let max_changes = 64
let max_piece_id = 0x1FFFFFFl
let max_ledger_move = 0xFFFFFFFFFFFFFL
let max_flags = 0x3FFF

let invalid fmt = Printf.ksprintf invalid_arg fmt

let check_board name board_x board_y =
  if board_x < 0 || board_x >= 1000 then
    invalid "%s: board_x is out of range" name;
  if board_y < 0 || board_y >= 1000 then
    invalid "%s: board_y is out of range" name

let check_id name id =
  if Int32.compare id 0l < 0 || Int32.compare id max_piece_id > 0 then
    invalid "%s: piece ID is out of range" name

let payload_size (t : transition) =
  List.fold_left
    (fun total (b : board_change) ->
      total + 2 + 2 + 8 + 2 + (List.length b.changes * (1 + 8)))
    (8 + 4 + 2) t.boards
  + 8 + 4 + 4 + 2

let encode_transition (t : transition) =
  if Int64.compare t.sequence 1L < 0 then
    invalid "Wal_format.encode_transition: sequence must be positive";
  check_id "Wal_format.encode_transition" t.ledger_moved_id;
  check_id "Wal_format.encode_transition" t.ledger_captured_id;
  if
    Int64.compare t.ledger_move 0L < 0
    || Int64.compare t.ledger_move max_ledger_move > 0
  then invalid "Wal_format.encode_transition: ledger move is out of range";
  if t.ledger_flags < 0 || t.ledger_flags > max_flags then
    invalid "Wal_format.encode_transition: flags are out of range";
  let board_count = List.length t.boards in
  if board_count < 1 || board_count > max_boards then
    invalid "Wal_format.encode_transition: invalid board count";
  List.iter
    (fun (b : board_change) ->
      check_board "Wal_format.encode_transition" b.board_x b.board_y;
      if Int64.compare b.revision 0L < 0 then
        invalid "Wal_format.encode_transition: negative revision";
      let change_count = List.length b.changes in
      if change_count < 1 || change_count > max_changes then
        invalid "Wal_format.encode_transition: invalid change count";
      List.iter
        (fun (square, _) ->
          if square < 0 || square >= 64 then
            invalid "Wal_format.encode_transition: square is out of range")
        b.changes)
    t.boards;
  let payload_length = payload_size t in
  if payload_length > max_payload then
    invalid "Wal_format.encode_transition: record is too large";
  let frame =
    Bytes.make (record_header_bytes + payload_length + checksum_bytes) '\000'
  in
  Bytes.blit_string record_magic 0 frame 0 4;
  Bytes.set frame 4 (Char.chr format_version);
  Bytes.set_int32_be frame 8 (Int32.of_int payload_length);
  let offset = ref record_header_bytes in
  Bytes.set_int64_be frame !offset t.sequence;
  offset := !offset + 8;
  Bytes.set_int32_be frame !offset t.request_id;
  offset := !offset + 4;
  Bytes.set_uint16_be frame !offset board_count;
  offset := !offset + 2;
  List.iter
    (fun (b : board_change) ->
      Bytes.set_uint16_be frame !offset b.board_x;
      offset := !offset + 2;
      Bytes.set_uint16_be frame !offset b.board_y;
      offset := !offset + 2;
      Bytes.set_int64_be frame !offset b.revision;
      offset := !offset + 8;
      Bytes.set_uint16_be frame !offset (List.length b.changes);
      offset := !offset + 2;
      List.iter
        (fun (square, piece) ->
          Bytes.set frame !offset (Char.chr square);
          offset := !offset + 1;
          Bytes.set_int64_be frame !offset piece;
          offset := !offset + 8)
        b.changes)
    t.boards;
  Bytes.set_int64_be frame !offset t.ledger_move;
  offset := !offset + 8;
  Bytes.set_int32_be frame !offset t.ledger_moved_id;
  offset := !offset + 4;
  Bytes.set_int32_be frame !offset t.ledger_captured_id;
  offset := !offset + 4;
  Bytes.set_uint16_be frame !offset t.ledger_flags;
  let digest =
    Checksum.bytes Checksum.empty frame 0 (record_header_bytes + payload_length)
  in
  Bytes.set_int64_be frame (record_header_bytes + payload_length) digest;
  frame

exception Parse_error of string

let decode_record frame =
  let length = Bytes.length frame in
  if length < record_header_bytes + checksum_bytes then
    Error "record is too short for a header and checksum"
  else if Bytes.sub_string frame 0 4 <> record_magic then
    Error "record magic does not match"
  else if Char.code (Bytes.get frame 4) <> format_version then
    Error "record version is not supported"
  else
    let payload_length = Int32.to_int (Bytes.get_int32_be frame 8) in
    if payload_length < 0 || payload_length > max_payload then
      Error "record payload length is out of range"
    else if length <> record_header_bytes + payload_length + checksum_bytes then
      Error "record length does not match its payload length"
    else begin
      let expected =
        Bytes.get_int64_be frame (record_header_bytes + payload_length)
      in
      let actual =
        Checksum.bytes Checksum.empty frame 0
          (record_header_bytes + payload_length)
      in
      if not (Int64.equal expected actual) then
        Error "record checksum does not match"
      else
        let limit = record_header_bytes + payload_length in
        let offset = ref record_header_bytes in
        let need n =
          if !offset + n > limit then
            raise (Parse_error "record payload is truncated")
          else begin
            let at = !offset in
            offset := !offset + n;
            at
          end
        in
        let get_i64 () = Bytes.get_int64_be frame (need 8) in
        let get_i32 () = Bytes.get_int32_be frame (need 4) in
        let get_u16 () = Bytes.get_uint16_be frame (need 2) in
        let get_u8 () = Char.code (Bytes.get frame (need 1)) in
        try
          let sequence = get_i64 () in
          if Int64.compare sequence 1L < 0 then
            raise (Parse_error "sequence is not positive");
          let request_id = get_i32 () in
          let board_count = get_u16 () in
          if board_count < 1 || board_count > max_boards then
            raise (Parse_error "board count is out of range");
          let rec read_changes acc remaining =
            if remaining = 0 then List.rev acc
            else
              let square = get_u8 () in
              if square >= 64 then raise (Parse_error "square is out of range");
              let piece = get_i64 () in
              read_changes ((square, piece) :: acc) (remaining - 1)
          in
          let rec read_boards acc remaining =
            if remaining = 0 then List.rev acc
            else
              let board_x = get_u16 () in
              let board_y = get_u16 () in
              if board_x >= 1000 || board_y >= 1000 then
                raise (Parse_error "board coordinate is out of range");
              let revision = get_i64 () in
              if Int64.compare revision 0L < 0 then
                raise (Parse_error "revision is negative");
              let change_count = get_u16 () in
              if change_count < 1 || change_count > max_changes then
                raise (Parse_error "change count is out of range");
              let changes = read_changes [] change_count in
              read_boards
                ({ board_x; board_y; revision; changes } :: acc)
                (remaining - 1)
          in
          let boards = read_boards [] board_count in
          let ledger_move = get_i64 () in
          if
            Int64.compare ledger_move 0L < 0
            || Int64.compare ledger_move max_ledger_move > 0
          then raise (Parse_error "ledger move is out of range");
          let ledger_moved_id = get_i32 () in
          if
            Int32.compare ledger_moved_id 0l < 0
            || Int32.compare ledger_moved_id max_piece_id > 0
          then raise (Parse_error "ledger moved ID is out of range");
          let ledger_captured_id = get_i32 () in
          if
            Int32.compare ledger_captured_id 0l < 0
            || Int32.compare ledger_captured_id max_piece_id > 0
          then raise (Parse_error "ledger captured ID is out of range");
          let ledger_flags = get_u16 () in
          if ledger_flags < 0 || ledger_flags > max_flags then
            raise (Parse_error "ledger flags are out of range");
          if !offset <> limit then
            raise (Parse_error "record has trailing payload bytes");
          Ok
            {
              sequence;
              request_id;
              boards;
              ledger_move;
              ledger_moved_id;
              ledger_captured_id;
              ledger_flags;
            }
        with Parse_error message -> Error message
    end

let record_frame_bytes t =
  record_header_bytes + payload_size t + checksum_bytes

let encode_segment_header ~first_sequence =
  let bytes = Bytes.make segment_header_bytes '\000' in
  Bytes.blit_string segment_magic 0 bytes 0 4;
  Bytes.set bytes 4 (Char.chr format_version);
  Bytes.set_int64_be bytes 8 first_sequence;
  bytes

let decode_segment_header bytes =
  if Bytes.length bytes <> segment_header_bytes then
    Error "segment header has the wrong length"
  else if Bytes.sub_string bytes 0 4 <> segment_magic then
    Error "segment magic does not match"
  else if Char.code (Bytes.get bytes 4) <> format_version then
    Error "segment version is not supported"
  else
    let first_sequence = Bytes.get_int64_be bytes 8 in
    if Int64.compare first_sequence 1L < 0 then
      Error "segment first sequence is not positive"
    else Ok first_sequence
