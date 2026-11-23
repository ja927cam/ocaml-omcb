(** Stable, non-cryptographic checksums used by the persistence format.

    FNV-1a 64 is used both for WAL record integrity and for full-world state
    digests. It is deliberately simple: the same code runs while writing and
    while recovering, and there is no dependency on an external hash library. *)

val offset_basis : int64
(** [offset_basis] is the FNV-1a 64 initial value. *)

val empty : int64
(** [empty] is {!offset_basis}. *)

val int64 : int64 -> int64 -> int64
(** [int64 h v] folds the 64-bit value [v] into [h]. *)

val byte : int64 -> int -> int64
(** [byte h b] folds the low 8 bits of [b] into [h]. *)

val bytes : int64 -> Bytes.t -> int -> int -> int64
(** [bytes h b off len] folds [len] bytes from [b] starting at [off]. *)

val words :
  int64 ->
  (int64, Bigarray.int64_elt, Bigarray.c_layout) Bigarray.Array1.t ->
  int ->
  int ->
  int64
(** [words h a off len] folds [len] 64-bit words from [a] starting at [off]. *)

val to_hex : int64 -> string
(** [to_hex h] is a fixed-width 16-character hexadecimal rendering. *)
