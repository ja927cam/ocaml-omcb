open Lwt.Infix

(* ------------------------------------------------------------------------- *)
(* Benchmark report model                                                    *)
(* ------------------------------------------------------------------------- *)

type result = {
  group : string;
  name : string;
  variant : string;
  iterations : int;
  total_ns : int64;
  ns_per_op : float;
  ops_per_sec : float;
  single : bool;
  note : string;
}

let results : result list ref = ref []
let sink = ref 0
let now_ns () = Mtime_clock.now_ns ()

let median_int64 values =
  let sorted = List.sort Int64.compare values in
  List.nth sorted (List.length sorted / 2)

let add_result ~group ~name ~variant ~iterations ~total_ns ~single ~note =
  let ns_per_op =
    if iterations = 0 then 0.
    else Int64.to_float total_ns /. float iterations
  in
  let ops_per_sec =
    if Int64.equal total_ns 0L then 0.
    else float iterations /. (Int64.to_float total_ns /. 1e9)
  in
  results :=
    {
      group;
      name;
      variant;
      iterations;
      total_ns;
      ns_per_op;
      ops_per_sec;
      single;
      note;
    }
    :: !results

let run_bench ?(single = false) ?(reps = 3) ?(warmup = true) ~group ~name
    ~variant ~iterations ?(note = "") f =
  if single then begin
    let started = now_ns () in
    f iterations;
    let total = Int64.sub (now_ns ()) started in
    add_result ~group ~name ~variant ~iterations ~total_ns:total ~single:true
      ~note
  end
  else begin
    if warmup then begin
      let warm = max 1 (min 1000 (iterations / 10)) in
      f warm
    end;
    let times =
      List.init reps (fun _ ->
          let started = now_ns () in
          f iterations;
          Int64.sub (now_ns ()) started)
    in
    add_result ~group ~name ~variant ~iterations
      ~total_ns:(median_int64 times) ~single:false ~note
  end

(* ------------------------------------------------------------------------- *)
(* Small helpers                                                             *)
(* ------------------------------------------------------------------------- *)

let position bx by x y =
  { Board.board = { board_x = bx; board_y = by }; square = { x; y } }

let board0 = { Board.board_x = 0; board_y = 0 }

let seed = ref 0x12345678

let rand n =
  seed := ((!seed * 1103515245) + 12345) land 0x3FFFFFFF;
  !seed mod n

let read_file path =
  try
    let ic = open_in path in
    Fun.protect
      ~finally:(fun () -> close_in_noerr ic)
      (fun () -> In_channel.input_all ic)
  with _ -> ""

let cpu_model () =
  let cpuinfo = read_file "/proc/cpuinfo" in
  let lines = String.split_on_char '\n' cpuinfo in
  let rec find = function
    | [] -> "unknown"
    | line :: rest ->
      match String.index_opt line ':' with
      | Some i
        when String.starts_with ~prefix:"model name" (String.sub line 0 i) ->
        String.trim (String.sub line (i + 1) (String.length line - i - 1))
      | _ -> find rest
  in
  find lines

let git_commit () =
  try
    let ic = Unix.open_process_in "git rev-parse --short HEAD 2>/dev/null" in
    let line = input_line ic in
    ignore (Unix.close_process_in ic);
    String.trim line
  with _ -> "unknown"

let rss_kb () =
  let status = read_file "/proc/self/status" in
  let lines = String.split_on_char '\n' status in
  let rec find = function
    | [] -> 0
    | line :: rest ->
      if String.starts_with ~prefix:"VmRSS:" line then
        match String.split_on_char ' ' line |> List.filter (( <> ) "") with
        | _ :: value :: _ -> (try int_of_string value with _ -> 0)
        | _ -> 0
      else find rest
  in
  find lines

let timestamp () =
  let tm = Unix.gmtime (Unix.gettimeofday ()) in
  Printf.sprintf "%04d-%02d-%02dT%02d:%02d:%02dZ" (tm.Unix.tm_year + 1900)
    (tm.tm_mon + 1) tm.tm_mday tm.tm_hour tm.tm_min tm.tm_sec

(* ------------------------------------------------------------------------- *)
(* Board                                                                     *)
(* ------------------------------------------------------------------------- *)

let bench_board board =
  let count = 4096 in
  let positions =
    Array.init count (fun _ ->
        position (rand 1000) (rand 1000) (rand 8) (rand 8))
  in
  let xs = Array.map Board.world_x positions in
  let ys = Array.map Board.world_y positions in
  let mask = count - 1 in
  let raw_index p =
    ((p.Board.board.board_y * 1000) + p.board.board_x) * 64
    + ((p.square.y * 8) + p.square.x)
  in
  run_bench ~group:"Board" ~name:"index" ~variant:"checked" ~iterations:1_000_000
    (fun n ->
      for i = 0 to n - 1 do
        let p = Array.unsafe_get positions (i land mask) in
        sink := !sink + Board.index p
      done);
  run_bench ~group:"Board" ~name:"index" ~variant:"raw arithmetic"
    ~iterations:1_000_000 (fun n ->
      for i = 0 to n - 1 do
        let p = Array.unsafe_get positions (i land mask) in
        sink := !sink + raw_index p
      done);
  run_bench ~group:"Board" ~name:"read" ~variant:"get (checked position)"
    ~iterations:1_000_000 (fun n ->
      for i = 0 to n - 1 do
        let p = Array.unsafe_get positions (i land mask) in
        sink := !sink + Int32.to_int (Piece.id (Board.get board p))
      done);
  run_bench ~group:"Board" ~name:"read" ~variant:"get_world (direct coords)"
    ~iterations:1_000_000 (fun n ->
      for i = 0 to n - 1 do
        let j = i land mask in
        sink :=
          !sink
          + Int32.to_int (Piece.id (Board.get_world board ~x:xs.(j) ~y:ys.(j)))
      done);
  run_bench ~group:"Board" ~name:"occupied_count" ~variant:"full scan"
    ~iterations:1 ~single:true ~note:"64,000,000 squares" (fun _ ->
      sink := !sink + Board.occupied_count board)

(* ------------------------------------------------------------------------- *)
(* Piece                                                                     *)
(* ------------------------------------------------------------------------- *)

let bench_piece () =
  run_bench ~group:"Piece" ~name:"create" ~variant:"packed int64"
    ~iterations:1_000_000 (fun n ->
      for i = 0 to n - 1 do
        let p =
          Piece.create
            ~id:(Int32.of_int ((i mod 32_000_000) + 1))
            ~piece_type:Piece.Knight ~is_white:true
        in
        sink := !sink + Int32.to_int (Piece.id p)
      done);
  let p =
    Piece.create ~id:12345l ~piece_type:Piece.Queen ~is_white:true
    |> fun p -> Piece.with_king_killer p true
    |> Piece.increment_move_count |> Piece.increment_capture_count
  in
  run_bench ~group:"Piece" ~name:"inspect" ~variant:"id/type/flags/counters"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        sink := !sink + Int32.to_int (Piece.id p);
        ignore (Piece.piece_type p);
        ignore (Piece.is_white p);
        ignore (Piece.king_killer p);
        sink := !sink + Piece.move_count p + Piece.capture_count p
      done);
  run_bench ~group:"Piece" ~name:"metadata update" ~variant:"immutable flags"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        let q = Piece.with_queen_killer p true in
        let q = Piece.with_adopted q true in
        let q = Piece.with_just_double_moved q false in
        sink := !sink + Int32.to_int (Piece.id q)
      done);
  run_bench ~group:"Piece" ~name:"promote" ~variant:"type replacement"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        let q = Piece.promote p Piece.Promoted_pawn in
        sink := !sink + Int32.to_int (Piece.id q)
      done)

(* ------------------------------------------------------------------------- *)
(* Protocol                                                                  *)
(* ------------------------------------------------------------------------- *)

let bench_protocol () =
  let move =
    {
      Protocol.Types.src = { board_x = 10; board_y = 20; x = 3; y = 4 };
      dst = { board_x = 10; board_y = 20; x = 3; y = 7 };
    }
  in
  let bytes = Protocol.Types.move_to_bytes move in
  run_bench ~group:"Protocol" ~name:"move encode" ~variant:"6-byte source+delta"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        let b = Protocol.Types.move_to_bytes move in
        sink := !sink + Bytes.length b
      done);
  run_bench ~group:"Protocol" ~name:"move decode" ~variant:"6-byte source+delta"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        match Protocol.Types.move_of_bytes bytes with
        | None -> failwith "decode failed"
        | Some m -> sink := !sink + m.Protocol.Types.src.x + m.dst.y
      done);
  let request =
    {
      Protocol.Types.request_id = 42l;
      expected_piece_id = 123l;
      move;
    }
  in
  let request_bytes = Protocol.Types.move_request_to_bytes request in
  run_bench ~group:"Protocol" ~name:"request encode" ~variant:"14 bytes"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        sink := !sink + Bytes.length (Protocol.Types.move_request_to_bytes request)
      done);
  run_bench ~group:"Protocol" ~name:"request decode" ~variant:"14 bytes"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        match Protocol.Types.move_request_of_bytes request_bytes with
        | None -> failwith "request decode failed"
        | Some r -> sink := !sink + Int32.to_int r.request_id
      done);
  let response =
    {
      Protocol.Types.request_id = 42l;
      status = Protocol.Types.Accepted;
      sequence = 1L;
      moved_piece = 0x1234567890L;
      captured_piece_id = 0l;
      rejection = 0;
    }
  in
  run_bench ~group:"Protocol" ~name:"wire response encode"
    ~variant:"4096-byte frame" ~iterations:100_000 (fun n ->
      for _ = 1 to n do
        let wire =
          Protocol.Types.wire_response_to_bytes
            (Protocol.Types.Wire_move response)
        in
        sink := !sink + Bytes.length wire
      done);
  let wire =
    Protocol.Types.wire_response_to_bytes
      (Protocol.Types.Wire_move response)
  in
  run_bench ~group:"Protocol" ~name:"wire response decode"
    ~variant:"4096-byte frame" ~iterations:100_000 (fun n ->
      for _ = 1 to n do
        match Protocol.Types.wire_response_of_bytes wire with
        | Some (Protocol.Types.Wire_move r) ->
          sink := !sink + Int32.to_int r.request_id
        | _ -> failwith "wire response decode failed"
      done);
  let event_board board_x revision =
    Protocol.Types.
      {
        board_x;
        board_y = 0;
        revision;
        changes =
          [ { square = 52; piece = 0 }; { square = 36; piece = 51 } ];
      }
  in
  let move_event =
    Protocol.Types.
      {
        sequence = 99L;
        request_id = 123l;
        boards = [ event_board 500 8L; event_board 501 3L ];
      }
  in
  run_bench ~group:"Protocol" ~name:"move event encode"
    ~variant:"2 boards, 4096-byte frame" ~iterations:100_000 (fun n ->
      for _ = 1 to n do
        sink :=
          !sink
          + Bytes.length
              (Protocol.Types.wire_response_to_bytes
                 (Protocol.Types.Wire_event move_event))
      done);
  let event_bytes =
    Protocol.Types.wire_response_to_bytes
      (Protocol.Types.Wire_event move_event)
  in
  run_bench ~group:"Protocol" ~name:"move event decode"
    ~variant:"2 boards, 4096-byte frame" ~iterations:100_000 (fun n ->
      for _ = 1 to n do
        match Protocol.Types.wire_response_of_bytes event_bytes with
        | Some (Protocol.Types.Wire_event event) ->
          sink := !sink + List.length event.boards
        | _ -> failwith "event decode failed"
      done);
  let snapshot_response =
    {
      Protocol.Types.request_id = 43l;
      board_x = 0;
      board_y = 0;
      status = Protocol.Types.Snapshot_ok;
      revision = 0L;
      board =
        Bytes.init 64 (fun i -> Char.chr (if i mod 9 = 0 then 0 else i + 1));
    }
  in
  run_bench ~group:"Protocol" ~name:"snapshot response encode"
    ~variant:"81-byte payload" ~iterations:100_000 (fun n ->
      for _ = 1 to n do
        sink :=
          !sink
          + Bytes.length
              (Protocol.Types.snapshot_response_to_bytes snapshot_response)
      done);
  let snapshot_bytes =
    Protocol.Types.snapshot_response_to_bytes snapshot_response
  in
  run_bench ~group:"Protocol" ~name:"snapshot response decode"
    ~variant:"81-byte payload" ~iterations:100_000 (fun n ->
      for _ = 1 to n do
        match Protocol.Types.snapshot_response_of_bytes snapshot_bytes with
        | Some r -> sink := !sink + Char.code (Bytes.get r.board 1)
        | None -> failwith "snapshot response decode failed"
      done)

(* ------------------------------------------------------------------------- *)
(* Move validation and processing                                            *)
(* ------------------------------------------------------------------------- *)

let path_old board src dst =
  let x0 = Board.world_x src and y0 = Board.world_y src in
  let x1 = Board.world_x dst and y1 = Board.world_y dst in
  let dx = Int.compare x1 x0 and dy = Int.compare y1 y0 in
  let x = ref (x0 + dx) and y = ref (y0 + dy) in
  let clear = ref true in
  while !clear && (!x <> x1 || !y <> y1) do
    let p = Board.position_of_world ~x:!x ~y:!y in
    if not (Piece.is_empty (Board.get board p)) then clear := false
    else begin
      x := !x + dx;
      y := !y + dy
    end
  done;
  !clear

let path_new board src dst =
  let x0 = Board.world_x src and y0 = Board.world_y src in
  let x1 = Board.world_x dst and y1 = Board.world_y dst in
  let dx = Int.compare x1 x0 and dy = Int.compare y1 y0 in
  let x = ref (x0 + dx) and y = ref (y0 + dy) in
  let clear = ref true in
  while !clear && (!x <> x1 || !y <> y1) do
    if not (Piece.is_empty (Board.get_world board ~x:!x ~y:!y)) then
      clear := false
    else begin
      x := !x + dx;
      y := !y + dy
    end
  done;
  !clear

let bench_validation_and_processing board =
  for board_x = 0 to 15 do
    Board.clear_board board { Board.board_x; board_y = 0 }
  done;
  let queen = Piece.create ~id:100l ~piece_type:Piece.Queen ~is_white:true in
  Board.set board (position 0 0 0 0) queen;
  let src = position 0 0 0 0 and dst = position 4 0 4 0 in
  let long_move = Move.create ~src ~dst in
  run_bench ~group:"Validation" ~name:"path" ~variant:"position record + checked get"
    ~iterations:100_000 (fun n ->
      for _ = 1 to n do
        if path_old board src dst then incr sink
      done);
  run_bench ~group:"Validation" ~name:"path" ~variant:"world get_world"
    ~iterations:100_000 (fun n ->
      for _ = 1 to n do
        if path_new board src dst then incr sink
      done);
  run_bench ~group:"Validation" ~name:"long queen move" ~variant:"36 squares"
    ~iterations:100_000 (fun n ->
      for _ = 1 to n do
        match Move_validator.validate board long_move with
        | Move_validator.Legal _ -> incr sink
        | Move_validator.Illegal _ -> failwith "expected legal"
      done);
  let info =
    match Move_validator.validate board long_move with
    | Move_validator.Legal info -> info
    | Move_validator.Illegal _ -> failwith "expected legal"
  in
  run_bench ~group:"Processing" ~name:"prepare" ~variant:"queen long move"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        let plan = Move_processor.prepare board info in
        ignore (Sys.opaque_identity plan)
      done);
  let plan = Move_processor.prepare board info in
  run_bench ~group:"Processing" ~name:"apply_plan" ~variant:"queen long move"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        Move_processor.apply_plan board plan
      done)

(* ------------------------------------------------------------------------- *)
(* Ledger                                                                    *)
(* ------------------------------------------------------------------------- *)

let bench_ledger () =
  let ledger = Ledger.create_ledger 1_048_576 in
  let packed =
    Ledger.pack_move (Ledger.pack_position 0 0) (Ledger.pack_position 0 1)
  in
  run_bench ~group:"Ledger" ~name:"append" ~variant:"circular 1M capacity"
    ~iterations:1_000_000 (fun n ->
      for i = 1 to n do
        sink :=
          !sink + Int64.to_int (Ledger.append ledger packed 1l 0l (i land 3))
      done);
  let small = Ledger.create_ledger 4 in
  ignore (Ledger.append small packed 1l 0l 0);
  run_bench ~group:"Ledger" ~name:"get_event" ~variant:"decoded event"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        match Ledger.get_event small 0L with
        | None -> failwith "event missing"
        | Some event -> sink := !sink + Int32.to_int event.moved_piece_id
      done);
  run_bench ~group:"Ledger" ~name:"get_range" ~variant:"1 decoded event"
    ~iterations:100_000 (fun n ->
      for _ = 1 to n do
        match Ledger.get_range small 0L 1L with
        | None -> failwith "range missing"
        | Some events -> sink := !sink + Array.length events
      done)

(* ------------------------------------------------------------------------- *)
(* Snapshots                                                                 *)
(* ------------------------------------------------------------------------- *)

let bench_snapshot state =
  run_bench ~group:"Snapshot" ~name:"board" ~variant:"64-piece copy"
    ~iterations:1_000_000 (fun n ->
      for _ = 1 to n do
        let board =
          Game_state.snapshot_board state ~board_x:0 ~board_y:0
        in
        sink := !sink + Array.length board
      done)

(* ------------------------------------------------------------------------- *)
(* Engine and worker                                                         *)
(* ------------------------------------------------------------------------- *)

let bench_engine state board =
  Board.clear_board board board0;
  let rook = Piece.create ~id:200l ~piece_type:Piece.Rook ~is_white:true in
  Board.set board (position 0 0 4 4) rook;
  let a =
    Move_request.create ~request_id:1l
      ~move:(Move.create ~src:(position 0 0 4 4) ~dst:(position 0 0 4 5))
      ~expected_piece_id:(Piece.id rook)
  in
  let b =
    Move_request.create ~request_id:2l
      ~move:(Move.create ~src:(position 0 0 4 5) ~dst:(position 0 0 4 4))
      ~expected_piece_id:(Piece.id rook)
  in
  let at_a = ref true in
  let next_request () =
    let request = if !at_a then a else b in
    at_a := not !at_a;
    request
  in
  run_bench ~group:"Engine" ~name:"process" ~variant:"alternating legal moves"
    ~iterations:200_000 (fun n ->
      for _ = 1 to n do
        match Move_engine.process state (next_request ()) with
        | Move_engine.Accepted accepted ->
          sink := !sink + Int64.to_int accepted.sequence
        | Move_engine.Rejected _ -> failwith "unexpected rejection"
      done);
  let worker =
    State_worker.start ~config:{ queue_capacity = 4096 } state
  in
  let run_worker n =
    let rec loop i =
      if i = n then Lwt.return_unit
      else
        State_worker.submit worker (next_request ()) >>= function
        | Ok (Move_engine.Accepted accepted) ->
          sink := !sink + Int64.to_int accepted.sequence;
          loop (i + 1)
        | Ok (Move_engine.Rejected _) -> Lwt.fail (Failure "unexpected rejection")
        | Error _ -> Lwt.fail (Failure "worker submit failed")
    in
    Lwt_main.run (loop 0)
  in
  let started = now_ns () in
  run_worker 20_000;
  let total = Int64.sub (now_ns ()) started in
  add_result ~group:"Worker" ~name:"throughput" ~variant:"sequential awaiter"
    ~iterations:20_000 ~total_ns:total ~single:true
    ~note:"one request awaited at a time";
  ignore (Lwt_main.run (State_worker.stop worker));

  (* Submit a burst without awaiting each response; this exercises the
     bounded queue and the worker's batched scheduler loop. *)
  let worker = State_worker.start ~config:{ queue_capacity = 4096 } state in
  let burst = 4000 in
  let requests = Array.init burst (fun _ -> next_request ()) in
  let started = now_ns () in
  let responses =
    Lwt_main.run
      (Lwt.all
         (Array.to_list
            (Array.map (State_worker.submit worker) requests)))
  in
  let total = Int64.sub (now_ns ()) started in
  List.iter
    (function
      | Ok (Move_engine.Accepted _) -> ()
      | _ -> failwith "burst request rejected")
    responses;
  add_result ~group:"Worker" ~name:"throughput" ~variant:"pipelined 4,000"
    ~iterations:burst ~total_ns:total ~single:true
    ~note:"burst queued, queue capacity 4,096";
  ignore (Lwt_main.run (State_worker.stop worker));

  (* Snapshot burst through the same queue. *)
  let worker = State_worker.start ~config:{ queue_capacity = 4096 } state in
  let snapshots = 4000 in
  let requests =
    Array.init snapshots (fun i ->
        State_worker.submit_snapshot worker ~board_x:(i mod 1000)
          ~board_y:0)
  in
  let started = now_ns () in
  let responses = Lwt_main.run (Lwt.all (Array.to_list requests)) in
  let total = Int64.sub (now_ns ()) started in
  List.iter
    (function
      | Ok snapshot when Array.length snapshot.State_worker.board = 64 -> ()
      | _ -> failwith "snapshot burst failed")
    responses;
  add_result ~group:"Worker" ~name:"snapshot throughput"
    ~variant:"pipelined 4,000" ~iterations:snapshots ~total_ns:total
    ~single:true ~note:"64-piece copy per request";
  ignore (Lwt_main.run (State_worker.stop worker))

(* ------------------------------------------------------------------------- *)
(* Startup and report                                                        *)
(* ------------------------------------------------------------------------- *)

let startup_and_world () =
  let started = now_ns () in
  let state = Game_state.create () in
  let allocation = Int64.sub (now_ns ()) started in
  add_result ~group:"Startup" ~name:"allocation" ~variant:"board + ledger"
    ~iterations:1 ~total_ns:allocation ~single:true
    ~note:"512 MB board + 16 MB ledger";
  let started = now_ns () in
  Game_state.initialise state;
  let initialisation = Int64.sub (now_ns ()) started in
  add_result ~group:"Startup" ~name:"initialisation" ~variant:"1,000,000 boards"
    ~iterations:1 ~total_ns:initialisation ~single:true
    ~note:"32,000,000 pieces";
  let started = now_ns () in
  let occupied = Game_state.occupied_count state in
  let verification = Int64.sub (now_ns ()) started in
  if occupied <> 32_000_000 then failwith "bad occupied count";
  add_result ~group:"Startup" ~name:"verification" ~variant:"occupied count"
    ~iterations:1 ~total_ns:verification ~single:true ~note:"64,000,000 square scan";
  state

let () =
  let state = startup_and_world () in
  let board =
    Game_state.with_state state (fun ~board ~ledger:_ ~sequence ->
        (sequence, board))
  in
  bench_board board;
  bench_piece ();
  bench_protocol ();
  bench_validation_and_processing board;
  bench_ledger ();
  bench_snapshot state;
  bench_engine state board;

  let generated = timestamp () in
  let commit = git_commit () in
  let cpu = cpu_model () in
  let rss = rss_kb () in
  let all = List.rev !results in
  let json_result r =
    Printf.sprintf
      {|{"group":"%s","name":"%s","variant":"%s","iterations":%d,"total_ns":%Ld,"ns_per_op":%.3f,"ops_per_sec":%.3f,"single":%b,"note":"%s"}|}
      (String.escaped r.group) (String.escaped r.name)
      (String.escaped r.variant) r.iterations r.total_ns r.ns_per_op
      r.ops_per_sec r.single (String.escaped r.note)
  in
  let body =
    Printf.sprintf
      {|{
  "generated": "%s",
  "commit": "%s",
  "ocaml": "%s",
  "cpu": "%s",
  "rss_kb": %d,
  "results": [%s]
}|}
      (String.escaped generated) (String.escaped commit)
      (String.escaped Sys.ocaml_version) (String.escaped cpu) rss
      (String.concat ",\n    " (List.map json_result all))
  in
  let root =
    match Sys.getenv_opt "DUNE_SOURCEROOT" with
    | Some root -> root
    | None -> Sys.getcwd ()
  in
  let write name contents =
    let path = Filename.concat root ("bench/" ^ name) in
    let oc = open_out path in
    Fun.protect ~finally:(fun () -> close_out oc) (fun () ->
        output_string oc contents)
  in
  write "results.json" (body ^ "\n");
  write "results.js" ("window.BENCH_RESULTS = " ^ body ^ ";\n");

  Printf.printf
    "%-12s %-20s %-30s %12s %14s %14s\n" "group" "name" "variant" "ns/op"
    "ops/s" "iterations";
  List.iter
    (fun r ->
      Printf.printf "%-12s %-20s %-30s %12.2f %14.0f %14d\n" r.group r.name
        r.variant r.ns_per_op r.ops_per_sec r.iterations)
    all;
  Printf.printf "\nwrote bench/results.json and bench/results.js\n%!";
  ignore sink
