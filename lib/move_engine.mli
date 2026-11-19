(** Synchronous, transactional move processing against the authoritative
    state. This module does not use Lwt and must only be called by the single
    state owner. *)

type rejection =
  | Stale_piece
  | Invalid_move of Move_validator.rejection

type accepted = {
  request_id : int32;
  sequence : int64;
  moved_piece : Piece.t;
  captured_piece : Piece.t;
}

type result =
  | Accepted of accepted
  | Rejected of {
      request_id : int32;
      reason : rejection;
    }

val flag_castle : int
val flag_en_passant : int
val flag_promotion : int
(** Ledger metadata flag bits used by this engine. *)

val process : Game_state.t -> Move_request.t -> result
(** Validate and, if accepted, apply the move and append one ledger event.
    Rejected moves change neither the board, ledger nor sequence. *)
