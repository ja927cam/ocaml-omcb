open Lwt.Infix

let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let settle () =
  Lwt_main.run (Lwt.pause () >>= fun () -> Lwt.pause ())

let event_board ~x ~y ~revision changes =
  State_worker.{ board_x = x; board_y = y; revision; changes }

let committed ?(sequence = 1L) ?(request_id = 7l) boards =
  State_worker.{ sequence; request_id; boards }

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
  let board = event_board ~x:500 ~y:500 ~revision:1l [ (52, changed_piece ()) ] in
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
       ((List.hd event.boards).revision = 1l)
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
  let left = event_board ~x:500 ~y:500 ~revision:2l [ (52, Piece.empty) ] in
  let right = event_board ~x:501 ~y:500 ~revision:1l [ (36, changed_piece ()) ] in
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
  let board = event_board ~x:500 ~y:500 ~revision:3l [ (52, changed_piece ()) ] in
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
  let board = event_board ~x:500 ~y:500 ~revision:4l [ (52, changed_piece ()) ] in
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
  let board = event_board ~x:700 ~y:700 ~revision:1l [ (0, changed_piece ()) ] in
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
  let inside = event_board ~x:502 ~y:500 ~revision:1l [ (0, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ inside ]);
  settle ();
  check "window inside" (List.length (sent_events sent) = 1);
  sent := [];
  let outside = event_board ~x:503 ~y:500 ~revision:1l [ (0, changed_piece ()) ] in
  Connection_manager.enqueue_move manager (committed [ outside ]);
  settle ();
  check "window outside" (sent_events sent = []);

  Printf.printf "All connection manager tests passed.\n"
