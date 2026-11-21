open Lwt.Infix
type send = Bytes.t -> unit Lwt.t

type conn = {
  id : int;
  manager : t;
  send_raw : send;
  outbox : (Bytes.t * unit Lwt.u option) Queue.t;
  subscriptions : (int, unit) Hashtbl.t;
  mutable closed : bool;
  mutable sending : bool;
}

and t = {
  mutable next_id : int;
  clients : (int, conn) Hashtbl.t;
  board_subscribers : (int, (int, unit) Hashtbl.t) Hashtbl.t;
  pending_events : State_worker.committed Queue.t;
  mutable event_flush_scheduled : bool;
}

let max_outbox = 256

let create () =
  {
    next_id = 1;
    clients = Hashtbl.create 32;
    board_subscribers = Hashtbl.create 1024;
    pending_events = Queue.create ();
    event_flush_scheduled = false;
  }

let board_key board_x board_y = (board_y * 1000) + board_x
let valid_board board_x board_y =
  board_x >= 0 && board_x < 1000 && board_y >= 0 && board_y < 1000

let remove_subscription conn board_x board_y =
  let key = board_key board_x board_y in
  if Hashtbl.mem conn.subscriptions key then begin
    Hashtbl.remove conn.subscriptions key;
    match Hashtbl.find_opt conn.manager.board_subscribers key with
    | None -> ()
    | Some subscribers ->
      Hashtbl.remove subscribers conn.id;
      if Hashtbl.length subscribers = 0 then
        Hashtbl.remove conn.manager.board_subscribers key
  end

let add_subscription conn board_x board_y =
  let key = board_key board_x board_y in
  if not (Hashtbl.mem conn.subscriptions key) then begin
    Hashtbl.add conn.subscriptions key ();
    let subscribers =
      match Hashtbl.find_opt conn.manager.board_subscribers key with
      | Some subscribers -> subscribers
      | None ->
        let subscribers = Hashtbl.create 4 in
        Hashtbl.add conn.manager.board_subscribers key subscribers;
        subscribers
    in
    Hashtbl.replace subscribers conn.id ()
  end

let clear_subscriptions conn =
  let keys = Hashtbl.fold (fun key () acc -> key :: acc) conn.subscriptions [] in
  List.iter
    (fun key -> remove_subscription conn (key mod 1000) (key / 1000))
    keys

let fail_queued conn exn =
  Queue.iter
    (fun (_, resolver) ->
      match resolver with
      | Some resolver -> Lwt.wakeup_later_exn resolver exn
      | None -> ())
    conn.outbox;
  Queue.clear conn.outbox

let unregister t conn =
  if not conn.closed then begin
    conn.closed <- true;
    clear_subscriptions conn;
    Hashtbl.remove t.clients conn.id;
    fail_queued conn (Failure "websocket connection closed")
  end

let rec drain conn =
  if conn.closed then Lwt.return_unit
  else if Queue.is_empty conn.outbox then begin
    conn.sending <- false;
    Lwt.return_unit
  end
  else
    let bytes, resolver = Queue.take conn.outbox in
    Lwt.catch
      (fun () ->
        conn.send_raw bytes >>= fun () ->
        (match resolver with
         | Some resolver -> Lwt.wakeup_later resolver ()
         | None -> ());
        drain conn)
      (fun exn ->
        Printf.eprintf "connection %d send failed: %s\n%!" conn.id
          (Printexc.to_string exn);
        (match resolver with
         | Some resolver -> Lwt.wakeup_later_exn resolver exn
         | None -> ());
        unregister conn.manager conn;
        Lwt.return_unit)

let start_sender conn =
  if (not conn.sending) && not conn.closed then begin
    conn.sending <- true;
    Lwt.async (fun () -> drain conn)
  end

let enqueue_item conn bytes resolver =
  if conn.closed then begin
    match resolver with
    | Some resolver ->
      Lwt.wakeup_later_exn resolver (Failure "websocket connection closed")
    | None -> ()
  end
  else if Queue.length conn.outbox >= max_outbox then begin
    unregister conn.manager conn;
    match resolver with
    | Some resolver ->
      Lwt.wakeup_later_exn resolver (Failure "websocket outbox full")
    | None -> ()
  end
  else begin
    Queue.add (bytes, resolver) conn.outbox;
    start_sender conn
  end

let enqueue conn bytes = enqueue_item conn bytes None

let send conn bytes =
  let promise, resolver = Lwt.wait () in
  enqueue_item conn bytes (Some resolver);
  promise

let register t ~send_raw =
  let id = t.next_id in
  t.next_id <- id + 1;
  let conn =
    {
      id;
      manager = t;
      send_raw;
      outbox = Queue.create ();
      subscriptions = Hashtbl.create 1024;
      closed = false;
      sending = false;
    }
  in
  Hashtbl.add t.clients id conn;
  conn

let subscribe conn board_x board_y =
  if (not conn.closed) && valid_board board_x board_y then
    add_subscription conn board_x board_y

let unsubscribe conn board_x board_y =
  if (not conn.closed) && valid_board board_x board_y then
    remove_subscription conn board_x board_y

let set_window conn ~center_x ~center_y ~radius =
  if not conn.closed then begin
    let center_x = max 0 (min 999 center_x) in
    let center_y = max 0 (min 999 center_y) in
    let radius = max 0 (min 100 radius) in
    clear_subscriptions conn;
    let x0 = max 0 (center_x - radius) in
    let x1 = min 999 (center_x + radius) in
    let y0 = max 0 (center_y - radius) in
    let y1 = min 999 (center_y + radius) in
    for board_y = y0 to y1 do
      for board_x = x0 to x1 do
        add_subscription conn board_x board_y
      done
    done
  end

let client_count t = Hashtbl.length t.clients

let broadcast_event t (event : State_worker.committed) =
  let recipients = Hashtbl.create 16 in
  List.iter
    (fun (board : State_worker.event_board) ->
      let key = board_key board.board_x board.board_y in
      match Hashtbl.find_opt t.board_subscribers key with
      | None -> ()
      | Some subscribers ->
        Hashtbl.iter
          (fun id () -> Hashtbl.replace recipients id ())
          subscribers)
    event.boards;
  if Hashtbl.length recipients > 0 then begin
    let boards =
      List.map
        (fun (board : State_worker.event_board) ->
          let changes =
            List.map
              (fun (square, piece) ->
                Protocol.Types.
                  {
                    square;
                    piece =
                      Piece.client_byte_at ~board_x:board.board_x
                        ~board_y:board.board_y piece;
                  })
              board.changes
          in
          Protocol.Types.
            {
              board_x = board.board_x;
              board_y = board.board_y;
              revision = board.revision;
              changes;
            })
        event.boards
    in
    let event =
      Protocol.Types.
        {
          sequence = event.sequence;
          request_id = event.request_id;
          boards;
        }
    in
    let bytes =
      Protocol.Types.wire_response_to_bytes
        (Protocol.Types.Wire_event event)
    in
    Hashtbl.iter
      (fun id () ->
        match Hashtbl.find_opt t.clients id with
        | Some conn -> enqueue conn bytes
        | None -> ())
      recipients
  end

let rec flush_through t sequence =
  if not (Queue.is_empty t.pending_events) then begin
    let event = Queue.peek t.pending_events in
    if Int64.compare event.State_worker.sequence sequence <= 0 then begin
      ignore (Queue.take t.pending_events);
      broadcast_event t event;
      flush_through t sequence
    end
  end

let enqueue_move t (event : State_worker.committed) =
  Queue.add event t.pending_events;
  if not t.event_flush_scheduled then begin
    t.event_flush_scheduled <- true;
    Lwt.async (fun () ->
        Lwt.pause () >>= fun () ->
        t.event_flush_scheduled <- false;
        flush_through t Int64.max_int;
        Lwt.return_unit)
  end
