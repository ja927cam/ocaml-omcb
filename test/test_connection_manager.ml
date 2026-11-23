open Lwt.Infix

let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let settle () =
  Lwt_main.run (Lwt.pause () >>= fun () -> Lwt.pause ())

let event_board ~x ~y ~revision changes =
  State_worker.{ board_x = x; board_y = y; revision; changes }

let committed ?(sequence = 1L) ?(request_id = 7l) ?timing boards =
  State_worker.{ sequence; request_id; boards; timing }

let changed_piece () =
  Piece.create ~id:1l ~piece_type:Piece.Pawn ~is_white:true

let sent_events sent =
  List.filter_map
    (fun bytes ->
      match Protocol.Types.wire_response_of_bytes bytes with
      | Some (Protocol.Types.Wire_event event) -> Some event
      | _ -> None)
    !sent

let () =
  let manager = Connection_manager.create () in
  let sent_a = ref [] and sent_b = ref [] and sent_c = ref [] in
  let make sent =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  let a = make sent_a and b = make sent_b and c = make sent_c in
  Connection_manager.subscribe a 500 500;
  Connection_manager.subscribe b 500 500;
  Connection_manager.subscribe c 600 600;
  let board = event_board ~x:500 ~y:500 ~revision:1L [ (52, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ board ]);
  settle ();
  check "same board A" (List.length (sent_events sent_a) = 1);
  check "same board B" (List.length (sent_events sent_b) = 1);
  check "unrelated C" (sent_events sent_c = []);
  (match sent_events sent_a with
   | [ event ] ->
     check "event sequence" (event.sequence = 1L);
     check "event request" (event.request_id = 7l);
     check "event board revision"
       ((List.hd event.boards).revision = 1L)
   | _ -> failwith "expected one event");

  (* A subscribed to both boards gets one event; B only sees one board. *)
  let manager = Connection_manager.create () in
  let sent_a = ref [] and sent_b = ref [] in
  let make sent =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  let a = make sent_a and b = make sent_b in
  Connection_manager.subscribe a 500 500;
  Connection_manager.subscribe a 501 500;
  Connection_manager.subscribe b 500 500;
  let left = event_board ~x:500 ~y:500 ~revision:2L [ (52, Piece.empty) ] in
  let right = event_board ~x:501 ~y:500 ~revision:1L [ (36, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ left; right ]);
  settle ();
  check "cross-board A one event" (List.length (sent_events sent_a) = 1);
  check "cross-board B one event" (List.length (sent_events sent_b) = 1);
  (match sent_events sent_a with
   | [ event ] -> check "cross-board two boards" (List.length event.boards = 2)
   | _ -> failwith "expected one cross-board event");

  (* A failing send removes only that connection. *)
  let manager = Connection_manager.create () in
  let sent_a = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent_a := bytes :: !sent_a;
        Lwt.return_unit)
  in
  let b =
    Connection_manager.register manager ~send_raw:(fun _ ->
        Lwt.fail (Failure "simulated send failure"))
  in
  Connection_manager.subscribe a 500 500;
  Connection_manager.subscribe b 500 500;
  let board = event_board ~x:500 ~y:500 ~revision:3L [ (52, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ board ]);
  settle ();
  check "failed client isolated" (List.length (sent_events sent_a) = 1);
  check "failed client removed" (Connection_manager.client_count manager = 1);

  (* Unregister removes subscriptions. *)
  let manager = Connection_manager.create () in
  let sent = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  Connection_manager.subscribe a 500 500;
  Connection_manager.unregister manager a;
  let board = event_board ~x:500 ~y:500 ~revision:4L [ (52, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ board ]);
  settle ();
  check "disconnected client gets nothing" (!sent = []);
  check "disconnected client removed" (Connection_manager.client_count manager = 0);

  (* Explicit unsubscription stops events for that board. *)
  let manager = Connection_manager.create () in
  let sent = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  Connection_manager.subscribe a 700 700;
  Connection_manager.unsubscribe a 700 700;
  let board = event_board ~x:700 ~y:700 ~revision:1L [ (0, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ board ]);
  settle ();
  check "unsubscribed client gets nothing" (sent_events sent = []);

  (* Window subscription replaces the old set. *)
  let manager = Connection_manager.create () in
  let sent = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  Connection_manager.set_window a ~center_x:500 ~center_y:500 ~radius:2;
  let inside = event_board ~x:502 ~y:500 ~revision:1L [ (0, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ inside ]);
  settle ();
  check "window inside" (List.length (sent_events sent) = 1);
  sent := [];
  let outside = event_board ~x:503 ~y:500 ~revision:1L [ (0, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ outside ]);
  settle ();
  check "window outside" (sent_events sent = []);

  (* Outbox overflow drops oldest events and keeps other clients healthy. *)
  let manager = Connection_manager.create ~max_outbox:2 () in
  let release, release_u = Lwt.wait () in
  let slow =
    Connection_manager.register manager ~send_raw:(fun _ -> release)
  in
  let sent_fast = ref [] in
  let fast =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent_fast := bytes :: !sent_fast;
        Lwt.return_unit)
  in
  Connection_manager.subscribe slow 800 800;
  Connection_manager.subscribe fast 800 800;
  for i = 1 to 5 do
    let board =
      event_board ~x:800 ~y:800 ~revision:(Int64.of_int i)
        [ (52, changed_piece ()) ]
    in
    Connection_manager.enqueue_move manager
      (committed ~sequence:(Int64.of_int i) [ board ])
  done;
  settle ();
  check "overflow: fast client gets all events"
    (List.length (sent_events sent_fast) = 5);
  let metrics = Connection_manager.metrics manager in
  check "overflow: outbox stays bounded"
    (metrics.max_outbox_depth <= metrics.outbox_capacity);
  check "overflow: fast client still registered"
    (Connection_manager.client_count manager = 2);
  Lwt.wakeup_later release_u ();
  settle ();
  Connection_manager.unregister manager slow;
  check "overflow: unregister cleanup"
    (Connection_manager.client_count manager = 1);

  (* Batched event frames carry multiple compact event records. *)
  let manager = Connection_manager.create ~event_batching:true () in
  let sent = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  Connection_manager.subscribe a 900 900;
  for i = 1 to 3 do
    let board =
      event_board ~x:900 ~y:900 ~revision:(Int64.of_int i)
        [ (52, changed_piece ()) ]
    in
    Connection_manager.enqueue_move manager
      (committed ~sequence:(Int64.of_int i) [ board ])
  done;
  settle ();
  Connection_manager.flush_all_event_buffers manager;
  settle ();
  check "batch: one frame" (List.length !sent = 1);
  (match !sent with
   | [ frame ] ->
     check "batch: kind" (Char.code (Bytes.get frame 0) = 4);
     check "batch: count" (Char.code (Bytes.get frame 1) = 3)
   | _ -> failwith "expected one batch frame");

  (* Snapshot pending buffers events until the snapshot is delivered. *)
  let manager = Connection_manager.create () in
  let sent = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  Connection_manager.subscribe a 950 950;
  let token = Connection_manager.begin_snapshot a ~board_x:950 ~board_y:950 in
  let board = event_board ~x:950 ~y:950 ~revision:1L [ (52, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ board ]);
  settle ();
  check "snapshot pending buffers event" (sent_events sent = []);
  let released =
    match
      Connection_manager.complete_snapshot a ~board_x:950 ~board_y:950
        ~token ~revision:0L
    with
    | Some events -> events
    | None -> failwith "snapshot token was not current"
  in
  check "snapshot releases one event" (List.length released = 1);
  Connection_manager.release_snapshot_events a released;
  settle ();
  check "snapshot buffered event delivered" (List.length (sent_events sent) = 1);

  (* A snapshot that already contains the move discards the buffered event. *)
  let manager = Connection_manager.create () in
  let sent = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  Connection_manager.subscribe a 951 951;
  let token = Connection_manager.begin_snapshot a ~board_x:951 ~board_y:951 in
  let board = event_board ~x:951 ~y:951 ~revision:1L [ (36, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ board ]);
  settle ();
  let released =
    match
      Connection_manager.complete_snapshot a ~board_x:951 ~board_y:951
        ~token ~revision:1L
    with
    | Some events -> events
    | None -> failwith "snapshot token was not current"
  in
  check "snapshot discards represented event" (released = []);
  Connection_manager.release_snapshot_events a released;
  settle ();
  check "represented event not sent" (sent_events sent = []);

  (* Multiple buffered moves are released in revision order. *)
  let manager = Connection_manager.create () in
  let sent = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  Connection_manager.subscribe a 952 952;
  let token = Connection_manager.begin_snapshot a ~board_x:952 ~board_y:952 in
  for revision = 1 to 3 do
    let board =
      event_board ~x:952 ~y:952 ~revision:(Int64.of_int revision)
        [ (52, changed_piece ()) ]
    in
    Connection_manager.enqueue_move manager
      (committed ~sequence:(Int64.of_int revision) [ board ])
  done;
  settle ();
  let released =
    match
      Connection_manager.complete_snapshot a ~board_x:952 ~board_y:952
        ~token ~revision:1L
    with
    | Some events -> events
    | None -> failwith "snapshot token was not current"
  in
  check "multiple buffered events released"
    (List.map (fun (e : Protocol.Types.move_event) ->
         (List.hd e.boards).revision) released
     = [ 2L; 3L ]);
  Connection_manager.release_snapshot_events a released;
  settle ();
  check "multiple events delivered"
    (List.map (fun (e : Protocol.Types.move_event) -> (List.hd e.boards).revision)
       (List.rev (sent_events sent))
     = [ 2L; 3L ]);

  (* A cross-board move with one pending board delivers the other immediately. *)
  let manager = Connection_manager.create () in
  let sent = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  Connection_manager.subscribe a 953 953;
  Connection_manager.subscribe a 954 953;
  let token = Connection_manager.begin_snapshot a ~board_x:953 ~board_y:953 in
  let first = event_board ~x:953 ~y:953 ~revision:2L [ (52, Piece.empty) ] in
  let second = event_board ~x:954 ~y:953 ~revision:1L [ (36, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ first; second ]);
  settle ();
  (match sent_events sent with
   | [ event ] ->
     check "cross-board immediate board" (List.length event.boards = 1);
     check "cross-board immediate x" ((List.hd event.boards).board_x = 954)
   | _ -> failwith "expected the non-pending board immediately");
  let released =
    match
      Connection_manager.complete_snapshot a ~board_x:953 ~board_y:953
        ~token ~revision:1L
    with
    | Some events -> events
    | None -> failwith "snapshot token was not current"
  in
  Connection_manager.release_snapshot_events a released;
  settle ();
  check "cross-board buffered board delivered"
    (List.exists
       (fun (e : Protocol.Types.move_event) -> (List.hd e.boards).board_x = 953)
       (sent_events sent));

  (* A superseded snapshot token cannot release the newer buffer. *)
  let manager = Connection_manager.create () in
  let sent = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  Connection_manager.subscribe a 955 955;
  let first_token = Connection_manager.begin_snapshot a ~board_x:955 ~board_y:955 in
  let second_token = Connection_manager.begin_snapshot a ~board_x:955 ~board_y:955 in
  check "old snapshot token ignored"
    (Connection_manager.complete_snapshot a ~board_x:955 ~board_y:955
       ~token:first_token ~revision:0L
     = None);
  check "new snapshot token current"
    (match
       Connection_manager.complete_snapshot a ~board_x:955 ~board_y:955
         ~token:second_token ~revision:0L
     with
     | Some events -> events = []
     | None -> false);

  (* A released snapshot event batches correctly. *)
  let manager = Connection_manager.create ~event_batching:true () in
  let sent = ref [] in
  let a =
    Connection_manager.register manager ~send_raw:(fun bytes ->
        sent := bytes :: !sent;
        Lwt.return_unit)
  in
  Connection_manager.subscribe a 956 956;
  let token = Connection_manager.begin_snapshot a ~board_x:956 ~board_y:956 in
  let board = event_board ~x:956 ~y:956 ~revision:1L [ (52, Piece.empty) ] in
  Connection_manager.enqueue_move manager (committed [ board ]);
  settle ();
  let released =
    match
      Connection_manager.complete_snapshot a ~board_x:956 ~board_y:956
        ~token ~revision:0L
    with
    | Some events -> events
    | None -> failwith "snapshot token was not current"
  in
  Connection_manager.release_snapshot_events a released;
  Connection_manager.flush_all_event_buffers manager;
  settle ();
  (match !sent with
   | [ frame ] ->
     check "batched snapshot release kind" (Char.code (Bytes.get frame 0) = 4);
     check "batched snapshot release count" (Char.code (Bytes.get frame 1) = 1)
   | _ -> failwith "expected one released batch frame");

  Printf.printf "All connection manager tests passed.\n"
