(** Prepared board updates for a validated move.

    [prepare] reads the board and computes every updated value without writing
    anything. [apply_plan] performs the writes. This lets the engine validate
    all commit data before the first board mutation. *)

type plan

val prepare : Board.t -> Move_validator.move_info -> plan
(** Compute all updated values and affected positions. Does not mutate. *)

val changes : plan -> (Board.position * Piece.t) list
(** Final square values in application order: clears (as [Piece.empty]) then
    writes. This is the exact set of squares a broadcast must carry. *)

val apply_plan : Board.t -> plan -> unit
(** Apply a previously prepared plan. *)

val apply : Board.t -> Move_validator.move_info -> unit
(** Convenience: [apply board info = apply_plan board (prepare board info)]. *)
