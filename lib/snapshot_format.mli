(** Full-world snapshot framing.

    A snapshot is one file containing the complete authoritative world and the
    bounded move ledger. The header is fixed-size, the arrays are raw
    big-endian 64-bit values, and a footer carries an FNV-1a 64 checksum over
    everything before it.

    {v
      magic "SMSN"       4 bytes
      version            1 byte
      reserved           3 bytes
      sequence           8 bytes
      ledger head         8 bytes
      ledger oldest       8 bytes
      board count         4 bytes
      ledger capacity     4 bytes
      board revisions     board_count * 8
      ledger moves        ledger_capacity * 8
      ledger metadata     ledger_capacity * 8
      board squares       board_count * 64 * 8
      magic "SMND"       4 bytes
      checksum           8 bytes
    v} *)

type header = {
  sequence : int64;
  ledger_head : int64;
  ledger_oldest : int64;
  board_count : int;
  ledger_capacity : int;
}

val magic : string
val end_magic : string
val version : int
val header_bytes : int
val footer_bytes : int

val encode_header : header -> Bytes.t
val decode_header : Bytes.t -> (header, string) result

val array_words : header -> int
(** [array_words h] is the number of 64-bit words between the header and the
    footer: revisions plus both ledger arrays plus board squares. *)

val file_bytes : header -> int
(** Exact expected size of a snapshot file described by [h]. *)
