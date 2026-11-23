(* Bounded, append-only circular buffer of accepted moves.

   Storage is two packed int64 Bigarrays: 16 bytes per event, no per-event
   allocation, constant-time append and lookup, fixed memory ceiling.

   moves:    bits  0..25  source position
             bits 26..51  destination position
             bits 52..63  unused

   metadata: bits  0..24  moved piece ID      (0 = no piece)
             bits 25..49  captured piece ID   (0 = empty square)
             bits 50..63  flags

   A position is:
             bits  0..19  board ID            (up to 1,048,575)
             bits 20..25  square ID           (0..63)

   Sequence numbers are implicit: event [seq] lives at index [seq land mask]
   while [oldest_seq <= seq < head_seq]. This is a single-writer ledger. *)

open Bigarray

type position = int32
type packed_move = int64
type int16 = Int16.t

type move_event = {
  move : packed_move;
  moved_piece_id : int32;
  captured_piece_id : int32;
  flags : int16; (* 14 bits used *)
}

type t = {
  moves : (int64, int64_elt, c_layout) Array1.t;
  metadata : (int64, int64_elt, c_layout) Array1.t;
  capacity : int;
  mask : int;
  mutable head_seq : int64;
  mutable oldest_seq : int64;
}

let board_mask = 0xFFFFFL
let square_mask = 0x3FL
let position_mask = 0x3FFFFFFL
let move_mask = 0xFFFFFFFFFFFFFL
let piece_id_mask = 0x1FFFFFFL
let max_flags = 0x3FFF

let create_ledger ?(next_seq = 0L) capacity =
  if capacity <= 0 || (capacity land (capacity - 1)) <> 0 then
    invalid_arg "Ledger.create_ledger: capacity must be a positive power of two";
  let moves = Array1.create int64 c_layout capacity in
  let metadata = Array1.create int64 c_layout capacity in
  Array1.fill moves 0L;
  Array1.fill metadata 0L;
  {
    moves;
    metadata;
    capacity;
    mask = capacity - 1;
    head_seq = next_seq;
    oldest_seq = next_seq;
  }

let create capacity = create_ledger capacity
let capacity t = t.capacity

let reset t ~next_seq =
  Array1.fill t.moves 0L;
  Array1.fill t.metadata 0L;
  t.head_seq <- next_seq;
  t.oldest_seq <- next_seq

let set_bounds t ~head ~oldest =
  if Int64.compare head 0L <= 0 then
    invalid_arg "Ledger.set_bounds: head must be positive";
  if Int64.compare oldest head > 0 then
    invalid_arg "Ledger.set_bounds: oldest is after head";
  t.head_seq <- head;
  t.oldest_seq <- oldest

let raw_moves t = t.moves
let raw_metadata t = t.metadata

let next_seq t = t.head_seq
let latest_seq t = Int64.pred t.head_seq
let oldest_seq t = t.oldest_seq

let contains t seq =
  Int64.compare seq t.oldest_seq >= 0 && Int64.compare seq t.head_seq < 0

(* {1 Packing} *)

let pack_position board_id square_id =
  if board_id < 0 || board_id > 0xFFFFF then
    invalid_arg "Ledger.pack_position: board ID does not fit in 20 bits";
  if square_id < 0 || square_id > 0x3F then
    invalid_arg "Ledger.pack_position: square ID does not fit in 6 bits";
  Int64.logor
    (Int64.of_int board_id)
    (Int64.shift_left (Int64.of_int square_id) 20)
  |> Int64.to_int32

let unpack_position position =
  let v = Int64.of_int32 position in
  let board_id = Int64.to_int (Int64.logand v board_mask) in
  let square_id =
    Int64.to_int (Int64.logand (Int64.shift_right_logical v 20) square_mask)
  in
  (board_id, square_id)

let pack_move src dst =
  Int64.logor (Int64.of_int32 src) (Int64.shift_left (Int64.of_int32 dst) 26)

let unpack_move move =
  let src = Int64.logand move position_mask |> Int64.to_int32 in
  let dst =
    Int64.shift_right_logical move 26
    |> Int64.logand position_mask
    |> Int64.to_int32
  in
  (src, dst)

let pack_metadata moved_id captured_id flags =
  Int64.logor (Int64.of_int32 moved_id)
    (Int64.logor
       (Int64.shift_left (Int64.of_int32 captured_id) 25)
       (Int64.shift_left (Int64.of_int flags) 50))

let unpack_metadata metadata =
  let moved_id = Int64.logand metadata piece_id_mask |> Int64.to_int32 in
  let captured_id =
    Int64.shift_right_logical metadata 25
    |> Int64.logand piece_id_mask
    |> Int64.to_int32
  in
  let flags = Int64.shift_right_logical metadata 50 |> Int64.to_int in
  (moved_id, captured_id, flags)

(* {1 Operations} *)

let valid_piece_id id =
  let v = Int64.of_int32 id in
  Int64.compare v 0L >= 0 && Int64.compare v piece_id_mask <= 0

let validate_event move moved_piece_id captured_piece_id flags =
  if Int64.compare move 0L < 0 || Int64.compare move move_mask > 0 then
    invalid_arg "Ledger.validate_event: move does not fit in 52 bits";
  if not (valid_piece_id moved_piece_id) then
    invalid_arg "Ledger.validate_event: moved piece ID does not fit in 25 bits";
  if not (valid_piece_id captured_piece_id) then
    invalid_arg "Ledger.validate_event: captured piece ID does not fit in 25 bits";
  if flags < 0 || flags > max_flags then
    invalid_arg "Ledger.validate_event: flags do not fit in 14 bits"

let append t move moved_piece_id captured_piece_id flags =
  validate_event move moved_piece_id captured_piece_id flags;
  let seq = t.head_seq in
  let index = Int64.to_int (Int64.logand seq (Int64.of_int t.mask)) in
  let metadata = pack_metadata moved_piece_id captured_piece_id flags in
  Array1.unsafe_set t.moves index move;
  Array1.unsafe_set t.metadata index metadata;
  t.head_seq <- Int64.succ seq;
  if Int64.compare (Int64.sub t.head_seq t.oldest_seq)
       (Int64.of_int t.capacity)
     > 0
  then t.oldest_seq <- Int64.succ t.oldest_seq;
  seq

let event_at t index =
  let move = Array1.unsafe_get t.moves index in
  let metadata = Array1.unsafe_get t.metadata index in
  let moved_piece_id, captured_piece_id, flags = unpack_metadata metadata in
  { move; moved_piece_id; captured_piece_id; flags = Int16.of_int flags }

let get_event t seq =
  if not (contains t seq) then None
  else
    let index = Int64.to_int (Int64.logand seq (Int64.of_int t.mask)) in
    Some (event_at t index)

let get_range t start_seq end_seq =
  if
    Int64.compare start_seq t.oldest_seq < 0
    || Int64.compare end_seq t.head_seq > 0
    || Int64.compare start_seq end_seq > 0
  then None
  else
    let count = Int64.to_int (Int64.sub end_seq start_seq) in
    Some
      (Array.init count (fun i ->
           let seq = Int64.add start_seq (Int64.of_int i) in
           let index = Int64.to_int (Int64.logand seq (Int64.of_int t.mask)) in
           event_at t index))
