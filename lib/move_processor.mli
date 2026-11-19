(** Apply a move that has already been validated.

    Validation and application are deliberately separate. [apply] assumes the
    move came from {!Move_validator.Legal}; it never validates and never
    reports failure. A rejected move must not be passed here. *)

val apply : Board.t -> Move_validator.move_info -> unit
(** [apply board info] removes the moving piece from its source, removes any
    captured piece, places the moving piece on the destination, and updates
    move/capture counters and metadata. *)
