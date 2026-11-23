(** Binary format for write-ahead-log records.

    A WAL record stores the complete committed state transition for one
    accepted move, not the move command. Recovery therefore never needs the
    chess rules, only the recorded square values and board revisions.

    Record framing (big-endian):

    {v
      magic "SMWL"       4 bytes
      version            1 byte
      reserved           3 bytes
      payload length     4 bytes
      payload            ...
      checksum           8 bytes (FNV-1a 64 over header + payload)
    v}

    A segment file starts with a 16-byte header:

    {v
      magic "SMWG"       4 bytes
      version            1 byte
      reserved           3 bytes
      first sequence     8 bytes
    v} *)

type board_change = {
  board_x : int;
  board_y : int;
  revision : int64;
  changes : (int * Piece.t) list;
  (** Final square values. Cleared squares appear as {!Piece.empty}. *)
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

val record_magic : string
val segment_magic : string
val format_version : int
val record_header_bytes : int
val checksum_bytes : int
val max_payload : int
(** Records larger than this are rejected before allocation. *)

val encode_transition : transition -> Bytes.t
(** @raise Invalid_argument if a field is out of range. *)

val decode_record : Bytes.t -> (transition, string) result
(** [decode_record frame] validates the magic, version, length, checksum and
    every field in one complete record frame. *)

val record_frame_bytes : transition -> int
(** Total framed size of [encode_transition t]. *)

val encode_segment_header : first_sequence:int64 -> Bytes.t

val decode_segment_header : Bytes.t -> (int64, string) result
(** Validates the segment header and returns its first sequence. *)

val segment_header_bytes : int
