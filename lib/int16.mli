(** Unsigned 16-bit integers.

    OCaml's fixed-width integer types stop at 32 bits; this module supplies
    the missing 16-bit type. Values are validated at construction and are in
    the range [0, 65535]. The runtime representation is an OCaml [int]. *)

type t

val of_int : int -> t
(** [of_int n] is [n] as a 16-bit value.
    @raise Invalid_argument if [n] is outside [0; 65535]. *)

val to_int : t -> int
(** [to_int v] is the integer value of [v]. *)

val zero : t
(** [zero] is [0]. *)

val max_value : t
(** [max_value] is [65535]. *)

val compare : t -> t -> int
(** [compare a b] orders [a] and [b]. *)

val equal : t -> t -> bool
(** [equal a b] is [true] iff [a] and [b] are the same value. *)
