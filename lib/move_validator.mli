(** Move legality, without changing the board.

    The rules intentionally follow the original One Million Chessboards
    implementation: pieces move in absolute 8000 x 8000 coordinates, a move may
    span at most 36 squares on either axis, and a capture on a different board
    is only allowed if the captured piece has already moved. *)

type rejection =
  | Empty_source
  | Invalid_geometry
  | Blocked_path
  | Invalid_destination
  | Cross_board_capture
  | Invalid_special_move

type move_kind =
  | Normal
  | Castle of {
      rook_src : Board.position;
      rook_dst : Board.position;
    }
  | En_passant of { captured_pos : Board.position }

type move_info = {
  moving_piece : Piece.t;
  captured_piece : Piece.t;
  src : Board.position;
  dst : Board.position;
  kind : move_kind;
}

type result =
  | Legal of move_info
  | Illegal of rejection

val validate : Board.t -> Move.t -> result
(** [validate board move] classifies [move] without modifying [board]. *)
