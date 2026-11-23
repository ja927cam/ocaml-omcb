type header = {
  sequence : int64;
  ledger_head : int64;
  ledger_oldest : int64;
  board_count : int;
  ledger_capacity : int;
}

let magic = "SMSN"
let end_magic = "SMND"
let version = 1
let header_bytes = 40
let footer_bytes = 12

let max_boards = 1_000_000
let max_ledger_capacity = 16_777_216

let encode_header (h : header) =
  let bytes = Bytes.make header_bytes '\000' in
  Bytes.blit_string magic 0 bytes 0 4;
  Bytes.set bytes 4 (Char.chr version);
  Bytes.set_int64_be bytes 8 h.sequence;
  Bytes.set_int64_be bytes 16 h.ledger_head;
  Bytes.set_int64_be bytes 24 h.ledger_oldest;
  Bytes.set_int32_be bytes 32 (Int32.of_int h.board_count);
  Bytes.set_int32_be bytes 36 (Int32.of_int h.ledger_capacity);
  bytes

let decode_header bytes =
  if Bytes.length bytes <> header_bytes then
    Error "snapshot header has the wrong length"
  else if Bytes.sub_string bytes 0 4 <> magic then
    Error "snapshot magic does not match"
  else if Char.code (Bytes.get bytes 4) <> version then
    Error "snapshot version is not supported"
  else
    let sequence = Bytes.get_int64_be bytes 8 in
    let ledger_head = Bytes.get_int64_be bytes 16 in
    let ledger_oldest = Bytes.get_int64_be bytes 24 in
    let board_count = Int32.to_int (Bytes.get_int32_be bytes 32) in
    let ledger_capacity = Int32.to_int (Bytes.get_int32_be bytes 36) in
    if Int64.compare sequence 0L < 0 then
      Error "snapshot sequence is negative"
    else if Int64.compare ledger_head 0L <= 0 then
      Error "snapshot ledger head is not positive"
    else if Int64.compare ledger_oldest 0L < 0 then
      Error "snapshot ledger oldest is negative"
    else if Int64.compare ledger_oldest ledger_head > 0 then
      Error "snapshot ledger bounds are inverted"
    else if board_count <= 0 || board_count > max_boards then
      Error "snapshot board count is out of range"
    else if ledger_capacity <= 0 || ledger_capacity > max_ledger_capacity then
      Error "snapshot ledger capacity is out of range"
    else if ledger_capacity land (ledger_capacity - 1) <> 0 then
      Error "snapshot ledger capacity is not a power of two"
    else
      Ok { sequence; ledger_head; ledger_oldest; board_count; ledger_capacity }

let array_words (h : header) =
  h.board_count + (2 * h.ledger_capacity) + (h.board_count * 64)

let file_bytes (h : header) =
  header_bytes + (array_words h * 8) + footer_bytes
