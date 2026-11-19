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

let flag_castle = 1
let flag_en_passant = 2
let flag_promotion = 4

let board_id (bp : Board.board_pos) = (bp.board_y * 1000) + bp.board_x

let ledger_position (p : Board.position) =
  Ledger.pack_position (board_id p.board) ((p.square.y * 8) + p.square.x)

let is_promotion (info : Move_validator.move_info) =
  Piece.piece_type info.moving_piece = Piece.Pawn
  && ((Piece.is_white info.moving_piece && Board.world_y info.dst = 0)
     || ((not (Piece.is_white info.moving_piece))
        && Board.world_y info.dst = 7999))

let process state (request : Move_request.t) =
  Game_state.with_state state
    (fun ~board ~ledger ~sequence ->
      let source = Board.get board request.move.src in
      if Piece.is_empty source then
        ( sequence,
          Rejected
            {
              request_id = request.request_id;
              reason = Invalid_move Move_validator.Empty_source;
            } )
      else if Piece.id source <> request.expected_piece_id then
        ( sequence,
          Rejected { request_id = request.request_id; reason = Stale_piece } )
      else
        match Move_validator.validate board request.move with
        | Move_validator.Illegal rejection ->
          ( sequence,
            Rejected
              {
                request_id = request.request_id;
                reason = Invalid_move rejection;
              } )
        | Move_validator.Legal info ->
          let move =
            Ledger.pack_move (ledger_position info.src)
              (ledger_position info.dst)
          in
          let moved_id = Piece.id info.moving_piece in
          let captured_id =
            if Piece.is_empty info.captured_piece then 0l
            else Piece.id info.captured_piece
          in
          let flags =
            match info.kind with
            | Move_validator.Castle _ -> flag_castle
            | Move_validator.En_passant _ -> flag_en_passant
            | Move_validator.Normal ->
              if is_promotion info then flag_promotion else 0
          in
          if Int64.equal sequence Int64.max_int then
            failwith "Move_engine.process: sequence number exhausted";
          let next = Int64.succ sequence in
          (* Everything that can fail as an ordinary validation is done
             before the first board write. *)
          Ledger.validate_event move moved_id captured_id flags;
          let plan = Move_processor.prepare board info in
          Move_processor.apply_plan board plan;
          let recorded = Ledger.append ledger move moved_id captured_id flags in
          if not (Int64.equal recorded next) then
            failwith "Move_engine.process: ledger sequence mismatch";
          let moved_piece = Board.get board info.dst in
          ( next,
            Accepted
              {
                request_id = request.request_id;
                sequence = next;
                moved_piece;
                captured_piece = info.captured_piece;
              } ))
