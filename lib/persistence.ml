open Lwt.Infix

type config = {
  data_dir : string;
  sync : bool;
  snapshot_every_moves : int;
  snapshot_every_seconds : float;
}

let default_config ~data_dir =
  {
    data_dir;
    sync = true;
    snapshot_every_moves = 100_000;
    snapshot_every_seconds = 600.;
  }

type recovery = {
  snapshot_sequence : int64 option;
  replayed_transitions : int;
  truncated_wal : bool;
  initialised_world : bool;
  duration_ms : float;
}

type segment = {
  path : string;
  first_sequence : int64;
  mutable last_sequence : int64;
  mutable bytes : int64;
}

type snapshot_info = { path : string; sequence : int64 }

type t = {
  config : config;
  snapshot_condition : unit Lwt_condition.t;
  dir : string;
  mutable fd : Unix.file_descr;
  mutable active : segment;
  mutable segments : segment list; (* ascending by first_sequence *)
  mutable last_sequence : int64;
  mutable snapshots : snapshot_info list; (* descending by sequence *)
  mutable commits_since_snapshot : int;
  mutable last_snapshot_time : float;
  mutable last_snapshot_sequence : int64 option;
  mutable snapshot_pending : bool;
  mutable snapshot_in_progress : bool;
  mutable snapshot_write_ms : float;
  truncated_wal : bool;
  mutable closed : bool;
}

let now_ms () = Unix.gettimeofday () *. 1000.

let log fmt = Printf.ksprintf (fun s -> Printf.eprintf "persistence: %s\n%!" s) fmt

let crash_point name =
  match Sys.getenv_opt "SIM_MAP_CRASH_POINT" with
  | Some point when point = name ->
    Printf.eprintf "persistence: crash point %s\n%!" name;
    flush stderr;
    Unix.kill (Unix.getpid ()) Sys.sigkill
  | _ -> ()

let ensure_dir dir =
  match Unix.mkdir dir 0o755 with
  | () -> ()
  | exception Unix.Unix_error (Unix.EEXIST, _, _) ->
    if not (Sys.is_directory dir) then
      invalid_arg ("Persistence: not a directory: " ^ dir)
  | exception Unix.Unix_error (error, _, _) ->
    invalid_arg
      (Printf.sprintf "Persistence: cannot create %s: %s" dir
         (Unix.error_message error))

let fsync_dir dir =
  let fd = Unix.openfile dir [ Unix.O_RDONLY ] 0 in
  try
    Unix.fsync fd;
    Unix.close fd
  with exn ->
    (try Unix.close fd with _ -> ());
    raise exn

let read_exact fd bytes offset length =
  let rec loop position remaining =
    if remaining = 0 then true
    else
      let read = Unix.read fd bytes position remaining in
      if read = 0 then false
      else loop (position + read) (remaining - read)
  in
  loop offset length

let read_up_to fd bytes offset length =
  let rec loop position remaining =
    if remaining = 0 then length
    else
      let read = Unix.read fd bytes position remaining in
      if read = 0 then length - remaining
      else loop (position + read) (remaining - read)
  in
  loop offset length

let write_all fd bytes offset length =
  let written = Unix.write fd bytes offset length in
  if written <> length then
    failwith "Persistence: short write"

let file_size path =
  try (Unix.stat path).Unix.st_size with Unix.Unix_error _ -> 0

let list_dir dir = try Sys.readdir dir with Sys_error _ -> [||]

let snapshot_name sequence = Printf.sprintf "snapshot-%020Ld.snap" sequence
let wal_name sequence = Printf.sprintf "wal-%020Ld.log" sequence

let parse_sequence name prefix suffix =
  let prefix_length = String.length prefix in
  let suffix_length = String.length suffix in
  let expected_length = prefix_length + 20 + suffix_length in
  if String.length name <> expected_length then None
  else if String.sub name 0 prefix_length <> prefix then None
  else if
    String.sub name (prefix_length + 20) suffix_length <> suffix
  then None
  else
    match
      Int64.of_string (String.sub name prefix_length 20)
    with
    | exception Failure _ -> None
    | sequence -> Some sequence

let list_snapshots dir =
  Array.to_list (list_dir dir)
  |> List.filter_map (fun name ->
         match parse_sequence name "snapshot-" ".snap" with
         | None -> None
         | Some sequence ->
           Some { path = Filename.concat dir name; sequence })
  |> List.sort (fun a b -> Int64.compare b.sequence a.sequence)

let list_wal_paths dir =
  Array.to_list (list_dir dir)
  |> List.filter_map (fun name ->
         match parse_sequence name "wal-" ".log" with
         | None -> None
         | Some sequence ->
           Some (sequence, Filename.concat dir name))
  |> List.sort (fun (a, _) (b, _) -> Int64.compare a b)

let contains_substring text pattern =
  let text_length = String.length text
  and pattern_length = String.length pattern in
  let rec loop index =
    if index + pattern_length > text_length then false
    else if String.sub text index pattern_length = pattern then true
    else loop (index + 1)
  in
  pattern_length = 0 || loop 0

let remove_stale_temps dir =
  Array.iter
    (fun name ->
      if
        String.length name > 5
        && String.sub name 0 5 = "snapsh"
        && contains_substring name ".tmp."
      then
        try Unix.unlink (Filename.concat dir name) with Unix.Unix_error _ -> ())
    (list_dir dir)

(* ------------------------------------------------------------------------- *)
(* Snapshot I/O                                                              *)
(* ------------------------------------------------------------------------- *)

let write_words fd hash array offset length =
  let chunk_words = 262_144 in
  let buffer = Bytes.create (chunk_words * 8) in
  let hash = ref hash in
  let position = ref offset in
  let limit = offset + length in
  while !position < limit do
    let count = min chunk_words (limit - !position) in
    for i = 0 to count - 1 do
      let value = Bigarray.Array1.unsafe_get array (!position + i) in
      Bytes.set_int64_be buffer (i * 8) value;
      hash := Checksum.int64 !hash value
    done;
    write_all fd buffer 0 (count * 8);
    position := !position + count
  done;
  !hash

let read_words fd hash array offset length =
  let chunk_words = 262_144 in
  let buffer = Bytes.create (chunk_words * 8) in
  let hash = ref hash in
  let position = ref offset in
  let limit = offset + length in
  while !position < limit do
    let count = min chunk_words (limit - !position) in
    let bytes = count * 8 in
    if not (read_exact fd buffer 0 bytes) then
      failwith "Persistence: snapshot is truncated";
    for i = 0 to count - 1 do
      let value = Bytes.get_int64_be buffer (i * 8) in
      Bigarray.Array1.unsafe_set array (!position + i) value;
      hash := Checksum.int64 !hash value
    done;
    position := !position + count
  done;
  !hash

type world_copy = {
  sequence : int64;
  board : Board.t;
  revisions : (int64, Bigarray.int64_elt, Bigarray.c_layout) Bigarray.Array1.t;
  ledger_moves :
    (int64, Bigarray.int64_elt, Bigarray.c_layout) Bigarray.Array1.t;
  ledger_metadata :
    (int64, Bigarray.int64_elt, Bigarray.c_layout) Bigarray.Array1.t;
  ledger_head : int64;
  ledger_oldest : int64;
}

let copy_array source =
  let copy =
    Bigarray.Array1.create Bigarray.int64 Bigarray.c_layout
      (Bigarray.Array1.dim source)
  in
  Bigarray.Array1.blit source copy;
  copy

let capture_copy (state : Game_state.t) : world_copy =
  {
    sequence = Game_state.sequence state;
    board = Game_state.copy_board state;
    revisions = copy_array (Game_state.raw_revisions state);
    ledger_moves = copy_array (Game_state.raw_ledger_moves state);
    ledger_metadata = copy_array (Game_state.raw_ledger_metadata state);
    ledger_head = Game_state.ledger_head state;
    ledger_oldest = Game_state.ledger_oldest state;
  }

(* The board is private; expose a copy only. *)
let _ = capture_copy

let write_snapshot_file path (copy : world_copy) =
  let header : Snapshot_format.header =
    {
      sequence = copy.sequence;
      ledger_head = copy.ledger_head;
      ledger_oldest = copy.ledger_oldest;
      board_count = Game_state.board_count;
      ledger_capacity = Game_state.ledger_capacity;
    }
  in
  let header_bytes = Snapshot_format.encode_header header in
  let fd =
    Unix.openfile path [ Unix.O_WRONLY; Unix.O_CREAT; Unix.O_TRUNC ] 0o600
  in
  try
    let hash =
      Checksum.bytes Checksum.empty header_bytes 0
        (Bytes.length header_bytes)
    in
    write_all fd header_bytes 0 (Bytes.length header_bytes);
    crash_point "snapshot-partial-temp";
    let hash = write_words fd hash copy.revisions 0 Game_state.board_count in
    let hash =
      write_words fd hash copy.ledger_moves 0 Game_state.ledger_capacity
    in
    let hash =
      write_words fd hash copy.ledger_metadata 0 Game_state.ledger_capacity
    in
    let board_words = Game_state.board_count * 64 in
    let hash = write_words fd hash (Board.raw_words copy.board) 0 board_words in
    let footer = Bytes.make Snapshot_format.footer_bytes '\000' in
    Bytes.blit_string Snapshot_format.end_magic 0 footer 0 4;
    Bytes.set_int64_be footer 4 hash;
    write_all fd footer 0 (Bytes.length footer);
    Unix.fsync fd;
    Unix.close fd;
    crash_point "snapshot-temp-fsynced"
  with exn ->
    (try Unix.close fd with _ -> ());
    raise exn

let load_snapshot (state : Game_state.t) path ~expected_sequence =
  let size = file_size path in
  let fd = Unix.openfile path [ Unix.O_RDONLY ] 0 in
  let result =
    try
      let header_bytes = Bytes.create Snapshot_format.header_bytes in
      if not (read_exact fd header_bytes 0 Snapshot_format.header_bytes) then
        Error "snapshot header is truncated"
      else
        match Snapshot_format.decode_header header_bytes with
        | Error message -> Error message
        | Ok header ->
          if not (Int64.equal header.sequence expected_sequence) then
            Error "snapshot header sequence does not match its file name"
          else if header.board_count <> Game_state.board_count then
            Error "snapshot board count does not match this server"
          else if header.ledger_capacity <> Game_state.ledger_capacity then
            Error "snapshot ledger capacity does not match this server"
          else if
            not (Int64.equal header.ledger_head (Int64.succ header.sequence))
          then Error "snapshot ledger head does not follow its sequence"
          else if size <> Snapshot_format.file_bytes header then
            Error "snapshot length does not match its header"
          else begin
            let hash =
              Checksum.bytes Checksum.empty header_bytes 0
                (Bytes.length header_bytes)
            in
            let hash =
              read_words fd hash (Game_state.raw_revisions state) 0
                header.board_count
            in
            let hash =
              read_words fd hash (Game_state.raw_ledger_moves state) 0
                header.ledger_capacity
            in
            let hash =
              read_words fd hash (Game_state.raw_ledger_metadata state) 0
                header.ledger_capacity
            in
            let board_words = header.board_count * 64 in
            let hash =
              read_words fd hash (Game_state.raw_board state) 0 board_words
            in
            let footer = Bytes.create Snapshot_format.footer_bytes in
            if not (read_exact fd footer 0 (Bytes.length footer)) then
              Error "snapshot footer is truncated"
            else if Bytes.sub_string footer 0 4 <> Snapshot_format.end_magic then
              Error "snapshot footer magic does not match"
            else
              let expected = Bytes.get_int64_be footer 4 in
              if not (Int64.equal expected hash) then
                Error "snapshot checksum does not match"
              else begin
                Game_state.restore_sequence state header.sequence;
                Game_state.restore_ledger_bounds state ~head:header.ledger_head
                  ~oldest:header.ledger_oldest;
                Game_state.mark_initialised state;
                Ok header.sequence
              end
          end
    with exn -> Error (Printexc.to_string exn)
  in
  (try Unix.close fd with _ -> ());
  result

(* ------------------------------------------------------------------------- *)
(* WAL I/O                                                                   *)
(* ------------------------------------------------------------------------- *)

let open_wal_segment path first_sequence ~sync =
  let fd =
    match
      Unix.openfile path
        [ Unix.O_RDWR; Unix.O_CREAT; Unix.O_EXCL ]
        0o600
    with
    | fd -> fd
    | exception Unix.Unix_error (Unix.EEXIST, _, _) ->
      (* A crash can leave a segment that was created but never written. *)
      let fd = Unix.openfile path [ Unix.O_RDWR ] 0o600 in
      let size = (Unix.fstat fd).Unix.st_size in
      if size = 0 then fd
      else begin
        let header = Bytes.create Wal_format.segment_header_bytes in
        if not (read_exact fd header 0 (Bytes.length header)) then begin
          Unix.close fd;
          failwith "Persistence: empty WAL segment has no header"
        end
        else
          match Wal_format.decode_segment_header header with
          | Error message ->
            Unix.close fd;
            failwith ("Persistence: " ^ message)
          | Ok existing when not (Int64.equal existing first_sequence) ->
            Unix.close fd;
            failwith "Persistence: WAL segment header does not match its name"
          | Ok _ ->
            if size <> Wal_format.segment_header_bytes then begin
              Unix.close fd;
              failwith "Persistence: cannot reuse a non-empty WAL segment"
            end;
            fd
      end
  in
  let size = (Unix.fstat fd).Unix.st_size in
  if size = 0 then begin
    let header = Wal_format.encode_segment_header ~first_sequence in
    write_all fd header 0 (Bytes.length header);
    if sync then Unix.fsync fd;
    fsync_dir (Filename.dirname path)
  end
  else Unix.lseek fd 0 Unix.SEEK_END |> ignore;
  fd

type read_result = {
  records : Wal_format.transition list;
  last_record_sequence : int64;
  truncated : bool;
}

let read_wal_segment path ~first_sequence ~last_segment =
  let fd = Unix.openfile path [ Unix.O_RDWR ] 0o600 in
  let close () = try Unix.close fd with _ -> () in
  try
    let header = Bytes.create Wal_format.segment_header_bytes in
    let header_read =
      read_up_to fd header 0 (Bytes.length header)
    in
    if header_read < Bytes.length header then begin
      if not last_segment then begin
        close ();
        failwith "WAL segment header is truncated before the last segment"
      end
      else begin
        (* A crash during segment creation can leave a zero-length or partial
           header. It contains no records, so reset it for reuse. *)
        Unix.ftruncate fd 0;
        Unix.fsync fd;
        close ();
        {
          records = [];
          last_record_sequence = Int64.pred first_sequence;
          truncated = true;
        }
      end
    end
    else
      match Wal_format.decode_segment_header header with
      | Error message ->
        close ();
        failwith ("WAL segment header is invalid: " ^ message)
      | Ok header_first ->
        if not (Int64.equal header_first first_sequence) then begin
          close ();
          failwith "WAL segment header does not match its file name"
        end;
        let records = ref [] in
        let last_sequence = ref (Int64.pred first_sequence) in
        let truncated = ref false in
        let offset = ref Wal_format.segment_header_bytes in
        let stop = ref false in
        while not !stop do
          let frame_header = Bytes.create Wal_format.record_header_bytes in
          let start = !offset in
          let header_read =
            read_up_to fd frame_header 0 (Bytes.length frame_header)
          in
          if header_read = 0 then stop := true
          else if header_read < Bytes.length frame_header then begin
            if last_segment then begin
              truncated := true;
              Unix.ftruncate fd start;
              Unix.fsync fd;
              stop := true
            end
            else begin
              close ();
              failwith "WAL record header is truncated before the last segment"
            end
          end
          else begin
            let payload_length =
              Int32.to_int (Bytes.get_int32_be frame_header 8)
            in
            if payload_length < 0 || payload_length > Wal_format.max_payload then
              begin
                close ();
                failwith "WAL record length is out of range"
              end
            else
              let rest =
                Bytes.create (payload_length + Wal_format.checksum_bytes)
              in
              let rest_read = read_up_to fd rest 0 (Bytes.length rest) in
              if rest_read < Bytes.length rest then begin
                if last_segment then begin
                  truncated := true;
                  Unix.ftruncate fd start;
                  Unix.fsync fd;
                  stop := true
                end
                else begin
                  close ();
                  failwith "WAL record is truncated before the last segment"
                end
              end
              else begin
                let frame =
                  Bytes.create (Bytes.length frame_header + Bytes.length rest)
                in
                Bytes.blit frame_header 0 frame 0 (Bytes.length frame_header);
                Bytes.blit rest 0 frame (Bytes.length frame_header)
                  (Bytes.length rest);
                offset := !offset + Bytes.length frame;
                match Wal_format.decode_record frame with
                | Error message ->
                  close ();
                  failwith ("WAL record is invalid: " ^ message)
                | Ok record ->
                  last_sequence := record.sequence;
                  records := record :: !records
              end
          end
        done;
        close ();
        {
          records = List.rev !records;
          last_record_sequence = !last_sequence;
          truncated = !truncated;
        }
  with exn ->
    close ();
    raise exn

(* ------------------------------------------------------------------------- *)
(* Recovery                                                                  *)
(* ------------------------------------------------------------------------- *)

let replay_transition (state : Game_state.t) (record : Wal_format.transition) =
  let boards =
    List.map
      (fun (board : Wal_format.board_change) ->
        {
          Game_state.board_x = board.board_x;
          board_y = board.board_y;
          revision = board.revision;
          changes = board.changes;
        })
      record.boards
  in
  Game_state.replay_transition state ~sequence:record.sequence ~boards
    ~ledger_move:record.ledger_move
    ~ledger_moved_id:record.ledger_moved_id
    ~ledger_captured_id:record.ledger_captured_id
    ~ledger_flags:record.ledger_flags

let recover (config : config) (state : Game_state.t) =
  let started = now_ms () in
  try
    ensure_dir config.data_dir;
    remove_stale_temps config.data_dir;
    let snapshots = list_snapshots config.data_dir in
    let snapshot_sequence = ref None in
    let loaded_snapshot = ref None in
    let initialised_world = ref false in
    List.iter
      (fun (snapshot : snapshot_info) ->
        if !snapshot_sequence = None then
          match load_snapshot state snapshot.path ~expected_sequence:snapshot.sequence with
          | Ok sequence ->
            snapshot_sequence := Some sequence;
            loaded_snapshot := Some snapshot;
            log "loaded snapshot %s at sequence %Ld" snapshot.path sequence
          | Error message ->
            log "rejected snapshot %s: %s" snapshot.path message;
            Game_state.reset state)
      snapshots;
    (* Keep only the snapshot that actually loaded. Corrupt newer files and
       unvalidated older files must not influence WAL cleanup decisions. *)
    List.iter
      (fun (snapshot : snapshot_info) ->
        match !loaded_snapshot with
        | Some loaded when loaded.path = snapshot.path -> ()
        | _ ->
          (try
             Unix.unlink snapshot.path;
             log "removed unusable snapshot %s" snapshot.path
           with Unix.Unix_error (error, _, _) ->
             log "could not remove %s: %s" snapshot.path
               (Unix.error_message error)))
      snapshots;
    let valid_snapshots =
      match !loaded_snapshot with
      | None -> []
      | Some loaded -> [ loaded ]
    in
    if !snapshot_sequence = None then begin
      Game_state.reset state;
      Game_state.initialise state;
      initialised_world := true
    end;
    let base = match !snapshot_sequence with Some s -> s | None -> 0L in
    let expected = ref (Int64.succ base) in
    let replayed = ref 0 in
    let truncated = ref false in
    let wal_paths = list_wal_paths config.data_dir in
    let segments = ref [] in
    List.iteri
      (fun index (first, path) ->
        let last_segment = index = List.length wal_paths - 1 in
        match
          read_wal_segment path ~first_sequence:first ~last_segment
        with
        | exception Failure message ->
          failwith (Printf.sprintf "%s (%s)" message path)
        | result ->
          if result.truncated then truncated := true;
          segments :=
            {
              path;
              first_sequence = first;
              last_sequence = result.last_record_sequence;
              bytes = Int64.of_int (file_size path);
            }
            :: !segments;
          List.iter
            (fun (record : Wal_format.transition) ->
              if Int64.compare record.sequence base <= 0 then ()
              else if not (Int64.equal record.sequence !expected) then
                failwith
                  (Printf.sprintf
                     "WAL sequence gap: expected %Ld, found %Ld"
                     !expected record.sequence)
              else begin
                replay_transition state record;
                incr replayed;
                expected := Int64.succ !expected
              end)
            result.records)
      wal_paths;
    let last_sequence = Game_state.sequence state in
    if not (Int64.equal !expected (Int64.succ last_sequence)) then
      failwith "recovery did not consume every WAL record";
    let segments = List.rev !segments in
    let next = Int64.succ last_sequence in
    let active_path = Filename.concat config.data_dir (wal_name next) in
    let fd = open_wal_segment active_path next ~sync:config.sync in
    let active =
      {
        path = active_path;
        first_sequence = next;
        last_sequence;
        bytes = Int64.of_int Wal_format.segment_header_bytes;
      }
    in
    let t =
      {
        config;
        snapshot_condition = Lwt_condition.create ();
        dir = config.data_dir;
        fd;
        active;
        segments =
          List.filter
            (fun (segment : segment) -> segment.path <> active.path)
            segments
          @ [ active ];
        last_sequence;
        snapshots = valid_snapshots;
        commits_since_snapshot = 0;
        last_snapshot_time = Unix.gettimeofday ();
        last_snapshot_sequence = !snapshot_sequence;
        snapshot_pending = false;
        snapshot_in_progress = false;
        snapshot_write_ms = 0.;
        truncated_wal = !truncated;
        closed = false;
      }
    in
    let duration_ms = now_ms () -. started in
    log
      "recovered sequence=%Ld snapshot=%s replayed=%d torn_tail=%b initialised=%b in %.1fms"
      last_sequence
      (match !snapshot_sequence with
       | None -> "none"
       | Some sequence -> Printf.sprintf "%Ld" sequence)
      !replayed !truncated !initialised_world duration_ms;
    Ok
      ( t,
        {
          snapshot_sequence = !snapshot_sequence;
          replayed_transitions = !replayed;
          truncated_wal = !truncated;
          initialised_world = !initialised_world;
          duration_ms;
        } )
  with
  | Failure message -> Error message
  | Invalid_argument message -> Error message
  | Unix.Unix_error (error, function_name, argument) ->
    Error
      (Printf.sprintf "Persistence: %s(%s): %s" function_name argument
         (Unix.error_message error))
  | exn -> Error (Printexc.to_string exn)

(* ------------------------------------------------------------------------- *)
(* WAL append and snapshots                                                  *)
(* ------------------------------------------------------------------------- *)

let append_bytes (t : t) bytes =
  write_all t.fd bytes 0 (Bytes.length bytes);
  if t.config.sync then Unix.fsync t.fd;
  t.active.bytes <- Int64.add t.active.bytes (Int64.of_int (Bytes.length bytes))

let before_commit (t : t) (state : Game_state.t) (commit : Move_engine.commit) =
  let groups : (int, int * int * (int * Piece.t) list ref) Hashtbl.t =
    Hashtbl.create 2
  in
  List.iter
    (fun ((position : Board.position), piece) ->
      let board_x = position.board.board_x
      and board_y = position.board.board_y in
      let key = (board_y * 1000) + board_x in
      let square = (position.square.y * 8) + position.square.x in
      match Hashtbl.find_opt groups key with
      | Some (_, _, changes) -> changes := (square, piece) :: !changes
      | None ->
        Hashtbl.add groups key (board_x, board_y, ref [ (square, piece) ]))
    commit.changes;
  let boards =
    Hashtbl.fold
      (fun _ (board_x, board_y, changes) acc ->
        {
          Wal_format.board_x;
          board_y;
          revision = Game_state.next_board_revision state ~board_x ~board_y;
          changes = List.rev !changes;
        }
        :: acc)
      groups []
  in
  if boards = [] then
    failwith "Persistence.before_commit: transition has no boards";
  let transition : Wal_format.transition =
    {
      sequence = commit.sequence;
      request_id = commit.request_id;
      boards;
      ledger_move = commit.ledger_move;
      ledger_moved_id = commit.ledger_moved_id;
      ledger_captured_id = commit.ledger_captured_id;
      ledger_flags = commit.ledger_flags;
    }
  in
  if not (Int64.equal commit.sequence (Int64.succ t.last_sequence)) then
    failwith "Persistence.before_commit: sequence is not contiguous";
  let frame = Wal_format.encode_transition transition in
  crash_point "wal-before-write";
  (* A torn record is written deliberately for the crash-recovery test. *)
  (match Sys.getenv_opt "SIM_MAP_CRASH_POINT" with
   | Some "wal-partial-write" ->
     let half = Bytes.length frame / 2 in
     ignore (Unix.write t.fd frame 0 half);
     crash_point "wal-partial-write"
   | _ -> ());
  append_bytes t frame;
  crash_point "wal-after-fsync";
  t.last_sequence <- commit.sequence;
  t.active.last_sequence <- commit.sequence

let rotate_wal (t : t) ~sequence =
  if not (Int64.equal sequence t.last_sequence) then
    failwith "Persistence.rotate_wal: snapshot boundary is not current";
  if Int64.compare t.active.last_sequence t.active.first_sequence >= 0 then begin
    (try Unix.fsync t.fd with Unix.Unix_error _ -> ());
    (try Unix.close t.fd with Unix.Unix_error _ -> ());
    let next = Int64.succ sequence in
    let path = Filename.concat t.dir (wal_name next) in
    let fd = open_wal_segment path next ~sync:t.config.sync in
    let segment =
      {
        path;
        first_sequence = next;
        last_sequence = sequence;
        bytes = Int64.of_int Wal_format.segment_header_bytes;
      }
    in
    t.fd <- fd;
    t.active <- segment;
    t.segments <-
      List.filter
        (fun (existing : segment) -> existing.path <> segment.path)
        t.segments
      @ [ segment ]
  end

let delete_wal_segments (t : t) ~before =
  let kept = ref [] in
  List.iter
    (fun (segment : segment) ->
      if
        segment.path <> t.active.path
        && Int64.compare segment.last_sequence before <= 0
      then
        (try
           Unix.unlink segment.path;
           log "removed WAL segment %s" segment.path
         with Unix.Unix_error (error, _, _) ->
           log "could not remove %s: %s" segment.path
             (Unix.error_message error))
      else kept := segment :: !kept)
    t.segments;
  t.segments <- List.rev !kept

let prune_snapshots (t : t) =
  match t.snapshots with
  | _newest :: _previous :: rest ->
    List.iter
      (fun snapshot ->
        try
          Unix.unlink snapshot.path;
          log "removed old snapshot %s" snapshot.path
        with Unix.Unix_error (error, _, _) ->
          log "could not remove %s: %s" snapshot.path
            (Unix.error_message error))
      rest;
    t.snapshots <- List.filteri (fun index _ -> index < 2) t.snapshots
  | _ -> ()

let finish_snapshot (t : t) (copy : world_copy) path duration_ms =
  let snapshot : snapshot_info = { path; sequence = copy.sequence } in
  let snapshots : snapshot_info list =
    snapshot :: List.filter (fun (s : snapshot_info) -> s.path <> path) t.snapshots
  in
  t.snapshots <-
    List.sort
      (fun (a : snapshot_info) (b : snapshot_info) ->
        Int64.compare b.sequence a.sequence)
      snapshots;
  t.snapshot_write_ms <- duration_ms;
  t.last_snapshot_sequence <- Some copy.sequence;
  t.last_snapshot_time <- Unix.gettimeofday ();
  t.commits_since_snapshot <- 0;
  t.snapshot_pending <- false;
  t.snapshot_in_progress <- false;
  Lwt_condition.broadcast t.snapshot_condition ();
  crash_point "snapshot-renamed";
  (match t.snapshots with
   | _newest :: previous :: _ ->
     delete_wal_segments t ~before:previous.sequence
   | _ -> ());
  prune_snapshots t;
  crash_point "snapshot-cleaned";
  log "wrote snapshot %s at sequence %Ld in %.1fms" path copy.sequence
    duration_ms

let write_snapshot (t : t) (copy : world_copy) =
  let path =
    Filename.concat t.dir (snapshot_name copy.sequence)
  in
  let temp =
    Printf.sprintf "%s.tmp.%d" path (Unix.getpid ())
  in
  let started = now_ms () in
  write_snapshot_file temp copy;
  crash_point "snapshot-temp-fsynced";
  Unix.rename temp path;
  fsync_dir t.dir;
  finish_snapshot t copy path (now_ms () -. started)

let snapshot_failed (t : t) exn =
  t.snapshot_pending <- false;
  t.snapshot_in_progress <- false;
  Lwt_condition.broadcast t.snapshot_condition ();
  log "snapshot failed: %s" (Printexc.to_string exn)

let capture (t : t) (state : Game_state.t) =
  if t.snapshot_in_progress then ()
  else begin
    t.snapshot_pending <- true;
    t.snapshot_in_progress <- true;
    try
      rotate_wal t ~sequence:(Game_state.sequence state);
      let copy = capture_copy state in
      Lwt.async (fun () ->
          Lwt.catch
            (fun () ->
              Lwt_preemptive.detach (fun () -> write_snapshot t copy) ()
              >|= fun () -> ())
            (fun exn ->
              snapshot_failed t exn;
              Lwt.return_unit))
    with exn ->
      snapshot_failed t exn
  end

let note_commit (t : t) = t.commits_since_snapshot <- t.commits_since_snapshot + 1

let move_snapshot_due (t : t) =
  (not t.snapshot_pending)
  && t.config.snapshot_every_moves > 0
  && t.commits_since_snapshot >= t.config.snapshot_every_moves

let time_snapshot_due (t : t) =
  (not t.snapshot_pending)
  && t.commits_since_snapshot > 0
  && t.config.snapshot_every_seconds > 0.
  && Unix.gettimeofday () -. t.last_snapshot_time
     >= t.config.snapshot_every_seconds

let request_started (t : t) = t.snapshot_pending <- true
let request_failed (t : t) = t.snapshot_pending <- false
let rec wait_for_snapshot (t : t) =
  if not t.snapshot_in_progress then Lwt.return_unit
  else Lwt_condition.wait t.snapshot_condition >>= fun () -> wait_for_snapshot t

let last_sequence (t : t) = t.last_sequence

let state_digest (state : Game_state.t) =
  let hash = ref Checksum.empty in
  hash := Checksum.int64 !hash (Game_state.sequence state);
  hash :=
    Checksum.words !hash (Game_state.raw_revisions state) 0
      Game_state.board_count;
  hash := Checksum.int64 !hash (Game_state.ledger_head state);
  hash := Checksum.int64 !hash (Game_state.ledger_oldest state);
  hash :=
    Checksum.words !hash (Game_state.raw_ledger_moves state) 0
      Game_state.ledger_capacity;
  hash :=
    Checksum.words !hash (Game_state.raw_ledger_metadata state) 0
      Game_state.ledger_capacity;
  hash :=
    Checksum.words !hash (Game_state.raw_board state) 0
      (Game_state.board_count * 64);
  Checksum.to_hex !hash

let metrics_json (t : t) =
  `Assoc
    [
      ("data_dir", `String t.dir);
      ("sequence", `String (Int64.to_string t.last_sequence));
      ("wal_segments", `Int (List.length t.segments));
      ( "wal_bytes",
        `String
          (Int64.to_string
             (List.fold_left
                (fun total segment -> Int64.add total segment.bytes)
                0L t.segments)) );
      ("snapshots", `Int (List.length t.snapshots));
      ( "last_snapshot_sequence",
        match t.last_snapshot_sequence with
        | None -> `Null
        | Some sequence -> `String (Int64.to_string sequence) );
      ("snapshot_pending", `Bool t.snapshot_pending);
      ("snapshot_write_ms", `Float t.snapshot_write_ms);
      ("commits_since_snapshot", `Int t.commits_since_snapshot);
      ("sync", `Bool t.config.sync);
      ("truncated_wal", `Bool t.truncated_wal);
    ]

let close (t : t) =
  if not t.closed then begin
    t.closed <- true;
    (try Unix.fsync t.fd with Unix.Unix_error _ -> ());
    (try Unix.close t.fd with Unix.Unix_error _ -> ())
  end
