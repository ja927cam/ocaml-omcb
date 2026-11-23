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

let reset t =
  Board.clear_all t.board;
  Bigarray.Array1.fill t.revisions 0L;
  Ledger.reset t.ledger ~next_seq:1L;
  t.sequence <- 0L;
  t.initialised <- false

let copy_board t = Board.copy t.board
let raw_board t = Board.raw_words t.board
let raw_revisions t = t.revisions
let raw_ledger_moves t = Ledger.raw_moves t.ledger
let raw_ledger_metadata t = Ledger.raw_metadata t.ledger
let ledger_head t = Ledger.next_seq t.ledger
let ledger_oldest t = Ledger.oldest_seq t.ledger

let restore_sequence t sequence =
  if Int64.compare sequence 0L < 0 then
    invalid_arg "Game_state.restore_sequence: negative sequence";
  t.sequence <- sequence

let restore_ledger_bounds t ~head ~oldest =
  Ledger.set_bounds t.ledger ~head ~oldest

let mark_initialised t = t.initialised <- true

let next_board_revision t ~board_x ~board_y =
  validate_board_coord "Game_state.next_board_revision" board_x board_y;
  let current =
    Bigarray.Array1.unsafe_get t.revisions (board_index board_x board_y)
  in
  if Int64.equal current Int64.max_int then current else Int64.succ current

type recovered_board = {
  board_x : int;
  board_y : int;
  revision : int64;
  changes : (int * Piece.t) list;
}

let replay_transition t ~sequence ~boards ~ledger_move ~ledger_moved_id
    ~ledger_captured_id ~ledger_flags =
  if not (Int64.equal sequence (Int64.succ t.sequence)) then
    failwith "Game_state.replay_transition: sequence is not contiguous";
  List.iter
    (fun (board : recovered_board) ->
      validate_board_coord "Game_state.replay_transition" board.board_x
        board.board_y;
      let i = board_index board.board_x board.board_y in
      let current = Bigarray.Array1.unsafe_get t.revisions i in
      let expected =
        if Int64.equal current Int64.max_int then current
        else Int64.succ current
      in
      if not (Int64.equal board.revision expected) then
        failwith
          "Game_state.replay_transition: board revision is not the next one";
      Bigarray.Array1.unsafe_set t.revisions i board.revision;
      List.iter
        (fun (square, piece) ->
          if square < 0 || square >= 64 then
            failwith
              "Game_state.replay_transition: square is out of range";
          if not (Piece.is_empty piece) then begin
            let id = Piece.id piece in
            if
              Int32.compare id 0l <= 0
              || Int32.compare id Piece.max_id > 0
            then
              failwith
                "Game_state.replay_transition: invalid piece ID";
            ignore (Piece.piece_type piece)
          end;
          Board.set t.board
            {
              board = { Board.board_x = board.board_x; board_y = board.board_y };
              square = { Board.x = square mod 8; y = square / 8 };
            }
            piece)
        board.changes)
    boards;
  let recorded =
    Ledger.append t.ledger ledger_move ledger_moved_id ledger_captured_id
      ledger_flags
  in
  if not (Int64.equal recorded sequence) then
    failwith "Game_state.replay_transition: ledger sequence mismatch";
  t.sequence <- sequence
