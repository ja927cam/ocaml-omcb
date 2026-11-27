(** Pick a legal, non-king-capturing move on one board.

    The world simulator only needs a stream of plausible activity; it does not
    need a search engine. It chooses a random occupied piece and then walks the
    64 squares of the same board in a random cyclic order, returning the first
    move that the authoritative validator accepts.

    Keeping every destination on the same board means a simulated move is
    always visible to a viewer looking at that neighbourhood and never drags a
    piece away from the active area. Castling and promotion are accepted if the
    validator allows them. Capturing a king is skipped so simulated activity
    does not consume a player's king. *)

val pick :
  random:Random.State.t ->
  Board.t ->
  board_x:int ->
  board_y:int ->
  request_id:int32 ->
  Move_request.t option
(** [pick ~random board ~board_x ~board_y ~request_id] is a legal request on
    the given board, or [None] if the board has no legal non-king-capturing
    move. The expected piece ID is the full ID of the chosen source piece. *)
