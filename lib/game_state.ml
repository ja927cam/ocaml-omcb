type t = {
  board : Board.t;
  ledger : Ledger.t;
  revisions : (int64, Bigarray.int64_elt, Bigarray.c_layout) Bigarray.Array1.t;
  mutable sequence : int64;
  mutable initialised : bool;
}

let ledger_capacity = 1_048_576
let board_count = 1_000_000

let create () =
  let revisions =
    Bigarray.Array1.create Bigarray.int64 Bigarray.c_layout board_count
  in
  Bigarray.Array1.fill revisions 0L;
  {
    board = Board.create ();
    ledger = Ledger.create_ledger ~next_seq:1L ledger_capacity;
    revisions;
    sequence = 0L;
    initialised = false;
  }

let initialise t =
  Bigarray.Array1.fill t.revisions 0L;
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

let validate_board_coord name board_x board_y =
  if board_x < 0 || board_x >= 1000 || board_y < 0 || board_y >= 1000 then
    invalid_arg (name ^ ": board coordinates out of range")

let board_index board_x board_y = (board_y * 1000) + board_x

let board_revision t ~board_x ~board_y =
  validate_board_coord "Game_state.board_revision" board_x board_y;
  Bigarray.Array1.unsafe_get t.revisions (board_index board_x board_y)

let bump_board_revision t ~board_x ~board_y =
  validate_board_coord "Game_state.bump_board_revision" board_x board_y;
  let i = board_index board_x board_y in
  let current = Bigarray.Array1.unsafe_get t.revisions i in
  let next =
    if Int64.equal current Int64.max_int then current else Int64.succ current
  in
  Bigarray.Array1.unsafe_set t.revisions i next;
  next

let snapshot_board t ~board_x ~board_y =
  validate_board_coord "Game_state.snapshot_board" board_x board_y;
  Board.get_board t.board { Board.board_x; board_y }

let snapshot_board_with_revision t ~board_x ~board_y =
  validate_board_coord "Game_state.snapshot_board_with_revision" board_x
    board_y;
  ( Board.get_board t.board { Board.board_x; board_y },
    Bigarray.Array1.unsafe_get t.revisions (board_index board_x board_y) )

let with_state t f =
  let sequence, value =
    f ~board:t.board ~ledger:t.ledger ~sequence:t.sequence
  in
  t.sequence <- sequence;
  value
