type t = {
  board : Board.t;
  ledger : Ledger.t;
  mutable sequence : int64;
  mutable initialised : bool;
}

let ledger_capacity = 1_048_576

let create () =
  {
    board = Board.create ();
    ledger = Ledger.create_ledger ~next_seq:1L ledger_capacity;
    sequence = 0L;
    initialised = false;
  }

let initialise t =
  let clear = t.initialised in
  for board_y = 0 to 999 do
    for board_x = 0 to 999 do
      Board.initialise_standard_position ~clear t.board
        { Board.board_x; board_y }
    done
  done;
  t.initialised <- true

let sequence t = t.sequence

let occupied_count t = Board.occupied_count t.board

let snapshot_board t ~board_x ~board_y =
  if board_x < 0 || board_x >= 1000 || board_y < 0 || board_y >= 1000 then
    invalid_arg "Game_state.snapshot_board: board coordinates out of range";
  Board.get_board t.board { Board.board_x; board_y }

let with_state t f =
  let sequence, value =
    f ~board:t.board ~ledger:t.ledger ~sequence:t.sequence
  in
  t.sequence <- sequence;
  value
