let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let pos bx by x y =
  { Board.board = { board_x = bx; board_y = by }; square = { x; y } }

let created_dirs = ref []

let temp_dir () =
  let path = Filename.temp_file "sim-map-persistence-" "" in
  Unix.unlink path;
  Unix.mkdir path 0o700;
  created_dirs := path :: !created_dirs;
  path

let rec remove_tree path =
  match (Unix.lstat path).Unix.st_kind with
  | Unix.S_DIR ->
    Array.iter
      (fun name -> remove_tree (Filename.concat path name))
      (Sys.readdir path);
    Unix.rmdir path
  | _ -> Unix.unlink path

let config dir =
  {
    Persistence.data_dir = dir;
    sync = false;
    group_size = 1;
    snapshot_every_moves = 0;
    snapshot_every_seconds = 0.;
  }

let source_id state src =
  Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
      (sequence, Piece.id (Board.get board src)))

let commit state persistence ~request_id src dst =
  let id = source_id state src in
  let request =
    Move_request.create ~request_id ~move:(Move.create ~src ~dst)
      ~expected_piece_id:id
  in
  match
    Move_engine.process
      ~precommit:(Persistence.before_commit persistence state)
      state request
  with
  | Move_engine.Accepted accepted ->
    let boards = Hashtbl.create 2 in
    List.iter
      (fun ((position : Board.position), _) ->
        Hashtbl.replace boards
          ((position.board.board_y * 1000) + position.board.board_x)
          position.board)
      accepted.changes;
    Hashtbl.iter
      (fun _ (board : Board.board_pos) ->
        ignore
          (Game_state.bump_board_revision state ~board_x:board.board_x
             ~board_y:board.board_y))
      boards;
    Persistence.note_commit persistence;
    Persistence.sync persistence ~moves:1;
    accepted
  | Move_engine.Rejected _ -> failwith "expected an accepted move"

let snapshot persistence state =
  Persistence.capture persistence state;
  Lwt_main.run (Persistence.wait_for_snapshot persistence)

let recover_with cfg state =
  match Persistence.recover cfg state with
  | Ok (persistence, _) -> persistence
  | Error message -> failwith ("recovery failed: " ^ message)

let recover dir state = recover_with (config dir) state

let close persistence =
  try Persistence.close persistence with _ -> ()

let check_recovered dir expected_digest =
  let state = Game_state.create () in
  let persistence = recover dir state in
  check "recovered digest matches" (Persistence.state_digest state = expected_digest);
  close persistence;
  state

let normal_move state persistence =
  commit state persistence ~request_id:1l (pos 0 0 4 6) (pos 0 0 4 4)

let () =
  (* Empty world: recovery without any files must reproduce the deterministic
     initial position. *)
  let empty_dir = temp_dir () in
  let empty_state = Game_state.create () in
  Game_state.initialise empty_state;
  let empty_digest = Persistence.state_digest empty_state in
  let empty_persistence = recover empty_dir empty_state in
  close empty_persistence;
  ignore (check_recovered empty_dir empty_digest);

  (* Several moves, a cross-board move, castling, en passant and promotion. *)
  let dir = temp_dir () in
  let state = Game_state.create () in
  Game_state.initialise state;
  let persistence = recover dir state in
  ignore (normal_move state persistence);

  (* a2-a4, a1-a3, then the rook crosses from board (0,0) to (1,0). *)
  ignore
    (commit state persistence ~request_id:2l (pos 0 0 0 6) (pos 0 0 0 4));
  ignore
    (commit state persistence ~request_id:3l (pos 0 0 0 7) (pos 0 0 0 5));
  ignore
    (commit state persistence ~request_id:4l (pos 0 0 0 5) (pos 1 0 7 5));

  (* Prepare special-move positions. These direct board edits are not moves,
     so take a snapshot afterwards; recovery then starts from that boundary and
     replays only the special moves themselves. *)
  Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
      (sequence, Board.clear board (pos 2 0 5 7)));
  Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
      (sequence, Board.clear board (pos 2 0 6 7)));
  let board3 = { Board.board_x = 3; board_y = 0 } in
  Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
      (sequence, Board.clear_board board board3));
  let white_pawn =
    Piece.create ~id:97l ~piece_type:Piece.Pawn ~is_white:true
  in
  let black_pawn =
    Piece.create ~id:98l ~piece_type:Piece.Pawn ~is_white:false
    |> fun piece -> Piece.with_just_double_moved piece true
  in
  Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
      Board.set board (pos 3 0 4 3) white_pawn;
      Board.set board (pos 3 0 3 3) black_pawn;
      (sequence, ()));
  let board4 = { Board.board_x = 4; board_y = 0 } in
  Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
      (sequence, Board.clear_board board board4));
  let promotion_pawn =
    Piece.create ~id:129l ~piece_type:Piece.Pawn ~is_white:true
  in
  Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
      (sequence, Board.set board (pos 4 0 4 1) promotion_pawn));
  snapshot persistence state;

  (* Castling: e1-g1 with the rook on h1 and f1/g1 empty. *)
  ignore
    (commit state persistence ~request_id:5l (pos 2 0 4 7) (pos 2 0 6 7));

  (* En passant: white pawn e5 takes black pawn d5. *)
  ignore
    (commit state persistence ~request_id:6l (pos 3 0 4 3) (pos 3 0 3 2));

  (* Promotion on a cleared board. *)
  ignore
    (commit state persistence ~request_id:7l (pos 4 0 4 1) (pos 4 0 4 0));

  let expected_digest = Persistence.state_digest state in
  close persistence;
  ignore (check_recovered dir expected_digest);

  (* A snapshot must restore the same world as WAL replay. *)
  let dir = temp_dir () in
  let state = Game_state.create () in
  Game_state.initialise state;
  let persistence = recover dir state in
  let request_id = ref 1l in
  for board = 0 to 9 do
    ignore
      (commit state persistence ~request_id:!request_id
         (pos board 1 4 6) (pos board 1 4 4));
    request_id := Int32.succ !request_id
  done;
  let expected_digest = Persistence.state_digest state in
  snapshot persistence state;
  close persistence;
  ignore (check_recovered dir expected_digest);

  (* A torn trailing WAL record is ignored and truncated, leaving every
     complete record intact. *)
  let dir = temp_dir () in
  let state = Game_state.create () in
  Game_state.initialise state;
  let persistence = recover dir state in
  for board = 0 to 4 do
    ignore
      (commit state persistence ~request_id:(Int32.of_int (board + 1))
         (pos board 2 4 6) (pos board 2 4 4))
  done;
  let expected_digest = Persistence.state_digest state in
  (* Add one more durable record, then lop off its tail. *)
  ignore
    (commit state persistence ~request_id:20l (pos 5 2 4 6) (pos 5 2 4 4));
  close persistence;
  let wal_path =
    Array.to_list (Sys.readdir dir)
    |> List.filter (fun name -> Filename.check_suffix name ".log")
    |> List.map (Filename.concat dir)
    |> List.hd
  in
  let size = (Unix.stat wal_path).Unix.st_size in
  let fd = Unix.openfile wal_path [ Unix.O_RDWR ] 0 in
  Unix.ftruncate fd (size - 12);
  Unix.close fd;
  let state2 = Game_state.create () in
  let persistence2 = recover dir state2 in
  check "torn record restored the complete prefix"
    (Int64.equal (Game_state.sequence state2) 5L);
  check "torn record prefix digest"
    (Persistence.state_digest state2 = expected_digest);
  close persistence2;

  (* A corrupt newest snapshot falls back to the previous snapshot plus the
     WAL, and does not lose acknowledged moves. *)
  let dir = temp_dir () in
  let state = Game_state.create () in
  Game_state.initialise state;
  let persistence = recover dir state in
  for board = 0 to 2 do
    ignore
      (commit state persistence ~request_id:(Int32.of_int (board + 1))
         (pos board 3 4 6) (pos board 3 4 4))
  done;
  snapshot persistence state;
  for board = 3 to 5 do
    ignore
      (commit state persistence ~request_id:(Int32.of_int (board + 1))
         (pos board 3 4 6) (pos board 3 4 4))
  done;
  let expected_digest = Persistence.state_digest state in
  snapshot persistence state;
  close persistence;
  let snapshots =
    Array.to_list (Sys.readdir dir)
    |> List.filter (fun name -> Filename.check_suffix name ".snap")
    |> List.sort compare
  in
  let newest = Filename.concat dir (List.hd (List.rev snapshots)) in
  let fd = Unix.openfile newest [ Unix.O_RDWR ] 0 in
  Unix.lseek fd 100 Unix.SEEK_SET |> ignore;
  ignore (Unix.write fd (Bytes.make 1 '\255') 0 1);
  Unix.close fd;
  ignore (check_recovered dir expected_digest);

  (* Reusing an empty active segment at startup must not duplicate it in the
     segment list: a later snapshot cleanup must never unlink the active WAL. *)
  let dir = temp_dir () in
  let state = Game_state.create () in
  Game_state.initialise state;
  let persistence = recover dir state in
  close persistence;
  let persistence = recover dir state in
  ignore (normal_move state persistence);
  snapshot persistence state;
  ignore
    (commit state persistence ~request_id:2l (pos 1 0 4 6) (pos 1 0 4 4));
  snapshot persistence state;
  let expected_digest = Persistence.state_digest state in
  close persistence;
  ignore (check_recovered dir expected_digest);

  (* Large WAL replay with synchronous durability. *)
  let dir = temp_dir () in
  let state = Game_state.create () in
  Game_state.initialise state;
  let persistence =
    recover_with { (config dir) with Persistence.sync = true } state
  in
  for board = 0 to 199 do
    ignore
      (commit state persistence ~request_id:(Int32.of_int (board + 1))
         (pos board 4 4 6) (pos board 4 4 4))
  done;
  let expected_digest = Persistence.state_digest state in
  check "large WAL sequence" (Int64.equal (Game_state.sequence state) 200L);
  close persistence;
  ignore (check_recovered dir expected_digest);

  Printf.printf "All persistence tests passed.\n%!";
  List.iter remove_tree !created_dirs
