(** A client request to move one specific piece. *)

type t = {
  request_id : int32;
  move : Move.t;
  expected_piece_id : int32;
}

val create :
  request_id:int32 ->
  move:Move.t ->
  expected_piece_id:int32 ->
  t
(** @raise Invalid_argument if [expected_piece_id] is not in
    [1; Piece.max_id] or either move position is outside the world. *)

val is_valid : t -> bool
(** Structural validity only; no board access or chess legality. *)
