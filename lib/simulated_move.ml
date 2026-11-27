let position ~board_x ~board_y ~x ~y : Board.position =
  {
    Board.board = { Board.board_x = board_x; board_y = board_y };
    square = { Board.x = x; y = y };
  }

let captures_king (info : Move_validator.move_info) =
  (not (Piece.is_empty info.captured_piece))
  && Piece.piece_type info.captured_piece = Piece.King

let pick ~random board ~board_x ~board_y ~request_id =
  if
    board_x < 0 || board_x >= 1000 || board_y < 0 || board_y >= 1000
  then None
  else begin
    let occupied = ref [] in
    for y = 0 to 7 do
      for x = 0 to 7 do
        let piece = Board.get board (position ~board_x ~board_y ~x ~y) in
        if not (Piece.is_empty piece) then
          occupied := (x, y, piece) :: !occupied
      done
    done;
    let sources = Array.of_list !occupied in
    let count = Array.length sources in
    if count = 0 then None
    else begin
      let source_offset = Random.State.int random count in
      let rec try_source index =
        if index >= count then None
        else begin
          let x, y, piece = sources.((source_offset + index) mod count) in
          let src = position ~board_x ~board_y ~x ~y in
          let destination_offset = Random.State.int random 64 in
          let rec try_destination step =
            if step >= 64 then try_source (index + 1)
            else begin
              let square = (destination_offset + step) mod 64 in
              if square = (y * 8) + x then try_destination (step + 1)
              else begin
                let dst =
                  position ~board_x ~board_y ~x:(square mod 8)
                    ~y:(square / 8)
                in
                let move = Move.create ~src ~dst in
                match Move_validator.validate board move with
                | Move_validator.Illegal _ -> try_destination (step + 1)
                | Move_validator.Legal info ->
                  if captures_king info then try_destination (step + 1)
                  else
                    Some
                      (Move_request.create ~request_id ~move
                         ~expected_piece_id:(Piece.id piece))
              end
            end
          in
          try_destination 0
        end
      in
      try_source 0
    end
  end
