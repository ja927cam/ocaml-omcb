type t = {
  board : Board.t;
  ledger : Ledger.t;
  mutable sequence : int64;
}

let ledger_capacity = 1_048_576

let create () =
  {
    board = Board.create ();
    ledger = Ledger.create_ledger ~next_seq:1L ledger_capacity;
    sequence = 0L;
  }

let initialise t =
  for board_y = 0 to 999 do
    for board_x = 0 to 999 do
      Board.initialise_standard_position t.board
        { Board.board_x; board_y }
    done
  done

let board t = t.board
let ledger t = t.ledger
let sequence t = t.sequence

let set_sequence t sequence = t.sequence <- sequence

let occupied_count t = Board.occupied_count t.board
