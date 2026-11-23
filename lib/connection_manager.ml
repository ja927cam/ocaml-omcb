open Lwt.Infix
type send = Bytes.t -> unit Lwt.t

type write_result =
  [ `Written
  | `Send_failed of exn
  | `Outbox_dropped ]

type outbox_item = {
  bytes : Bytes.t;
  resolver : unit Lwt.u option;
  on_written : write_result -> unit;
  is_event : bool;
  enqueued_ns : int64;
}

type buffered_event = {
  sequence : int64;
  request_id : int32;
  board : Protocol.Types.event_board;
}

type conn = {
  id : int;
  manager : t;
  send_raw : send;
  mutable outbox : outbox_item Queue.t;
  mutable event_buffer : Buffer.t;
  mutable event_callbacks : (write_result -> unit) list;
  mutable event_count : int;
  snapshot_pending : (int, int) Hashtbl.t;
  snapshot_buffers : (int, buffered_event list ref) Hashtbl.t;
  mutable next_snapshot_token : int;
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
  mutable event_batch_timer_scheduled : bool;
  max_outbox : int;
  event_batching : bool;
  batch_window_s : float;
}

type metrics = {
  client_count : int;
  subscription_count : int;
  max_outbox_depth : int;
  outbox_capacity : int;
  event_batching : bool;
}

let create ?(max_outbox = 256) ?(event_batching = false)
    ?(batch_window_s = 0.001) () =
  {
    next_id = 1;
    clients = Hashtbl.create 32;
    board_subscribers = Hashtbl.create 1024;
    pending_events = Queue.create ();
    event_flush_scheduled = false;
    event_batch_timer_scheduled = false;
    max_outbox;
    event_batching;
    batch_window_s;
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
    (fun item ->
      (match item.resolver with
       | Some resolver -> Lwt.wakeup_later_exn resolver exn
       | None -> ());
      if item.is_event then item.on_written `Outbox_dropped)
    conn.outbox;
  Queue.clear conn.outbox

let fail_event_buffer conn =
  List.iter (fun callback -> callback `Outbox_dropped) conn.event_callbacks;
  conn.event_callbacks <- [];
  Buffer.clear conn.event_buffer;
  conn.event_count <- 0;
  Hashtbl.iter (fun _ buffer -> buffer := []) conn.snapshot_buffers;
  Hashtbl.clear conn.snapshot_pending;
  Hashtbl.clear conn.snapshot_buffers

let unregister t conn =
  if not conn.closed then begin
    conn.closed <- true;
    clear_subscriptions conn;
    Hashtbl.remove t.clients conn.id;
    fail_event_buffer conn;
    fail_queued conn (Failure "websocket connection closed")
  end

let rec drain conn =
  if conn.closed then Lwt.return_unit
  else if Queue.is_empty conn.outbox then begin
    conn.sending <- false;
    Lwt.return_unit
  end
  else
    let item = Queue.take conn.outbox in
    Lwt.catch
      (fun () ->
        conn.send_raw item.bytes >>= fun () ->
        (match item.resolver with
         | Some resolver -> Lwt.wakeup_later resolver ()
         | None -> ());
        if item.is_event then
          Metrics.record Metrics.Websocket_write
            (Int64.sub (Metrics.now ()) item.enqueued_ns);
        item.on_written `Written;
        drain conn)
      (fun exn ->
        Printf.eprintf "connection %d send failed: %s\n%!" conn.id
          (Printexc.to_string exn);
        (match item.resolver with
         | Some resolver -> Lwt.wakeup_later_exn resolver exn
         | None -> ());
        item.on_written (`Send_failed exn);
        unregister conn.manager conn;
        Lwt.return_unit)

let start_sender conn =
  if (not conn.sending) && not conn.closed then begin
    conn.sending <- true;
    Lwt.async (fun () -> drain conn)
  end

(* A slow client must not grow the outbox without bound and must not make the
   broadcaster wait. When the queue is full we drop the oldest event frames,
   keeping response frames (and their promises) intact. The client then sees a
   revision gap and can repair it with a fresh snapshot. *)
let drop_oldest_events conn needed =
  if needed <= 0 then 0
  else begin
    let kept = Queue.create () in
    let dropped = ref 0 in
    Queue.iter
      (fun item ->
        if !dropped < needed && item.is_event then begin
          incr dropped;
          item.on_written `Outbox_dropped
        end
        else Queue.add item kept)
      conn.outbox;
    if !dropped > 0 then conn.outbox <- kept;
    !dropped
  end

let enqueue_item conn ?(is_event = false) ?(on_written = fun _ -> ()) bytes
    resolver =
  if conn.closed then begin
    (match resolver with
     | Some resolver ->
       Lwt.wakeup_later_exn resolver (Failure "websocket connection closed")
     | None -> ());
    if is_event then on_written `Outbox_dropped
  end
  else begin
    let length = Queue.length conn.outbox in
    if length >= conn.manager.max_outbox then begin
      let needed = length - conn.manager.max_outbox + 1 in
      let dropped = drop_oldest_events conn needed in
      if dropped = 0 then begin
        Metrics.note_outbox_full_unregister ();
        unregister conn.manager conn;
        (match resolver with
         | Some resolver ->
           Lwt.wakeup_later_exn resolver (Failure "websocket outbox full")
         | None -> ());
        if is_event then on_written `Outbox_dropped
      end
      else begin
        let item =
          {
            bytes;
            resolver;
            on_written;
            is_event;
            enqueued_ns = Metrics.now ();
          }
        in
        Queue.add item conn.outbox;
        Metrics.note_outbox_enqueue (Queue.length conn.outbox);
        start_sender conn
      end
    end
    else begin
      let item =
        {
          bytes;
          resolver;
          on_written;
          is_event;
          enqueued_ns = Metrics.now ();
        }
      in
      Queue.add item conn.outbox;
      Metrics.note_outbox_enqueue (Queue.length conn.outbox);
      start_sender conn
    end
  end

let enqueue conn bytes = enqueue_item conn bytes None

let send conn bytes =
  let promise, resolver = Lwt.wait () in
  enqueue_item conn bytes (Some resolver);
  promise

let enqueue_event conn bytes on_written =
  enqueue_item conn ~is_event:true ~on_written bytes None

let max_batch_payload = 4096 - 2

let flush_event_buffer conn =
  if Buffer.length conn.event_buffer > 0 then begin
    let payload = Buffer.contents conn.event_buffer in
    let count = conn.event_count in
    let callbacks = List.rev conn.event_callbacks in
    Buffer.clear conn.event_buffer;
    conn.event_callbacks <- [];
    conn.event_count <- 0;
    let frame = Bytes.make 4096 '\000' in
    Bytes.set frame 0 (Char.chr 4);
    Bytes.set frame 1 (Char.chr count);
    Bytes.blit_string payload 0 frame 2 (String.length payload);
    enqueue_item conn ~is_event:true
      ~on_written:(fun result -> List.iter (fun callback -> callback result) callbacks)
      frame None
  end

let flush_all_event_buffers (t : t) =
  let conns = Hashtbl.fold (fun _ conn acc -> conn :: acc) t.clients [] in
  List.iter flush_event_buffer conns

let schedule_event_batch_flush (t : t) =
  if t.event_batching && not t.event_batch_timer_scheduled then begin
    t.event_batch_timer_scheduled <- true;
    Lwt.async (fun () ->
        Lwt_unix.sleep t.batch_window_s >>= fun () ->
        t.event_batch_timer_scheduled <- false;
        flush_all_event_buffers t;
        Lwt.return_unit)
  end

let flush_conn_events conn =
  if conn.manager.event_batching then flush_event_buffer conn

let append_event conn payload callback =
  if conn.closed then callback `Outbox_dropped
  else begin
    if
      conn.event_count >= 255
      || Buffer.length conn.event_buffer + Bytes.length payload > max_batch_payload
    then flush_event_buffer conn;
    if conn.closed then callback `Outbox_dropped
    else begin
      Buffer.add_bytes conn.event_buffer payload;
      conn.event_count <- conn.event_count + 1;
      conn.event_callbacks <- callback :: conn.event_callbacks;
      if Buffer.length conn.event_buffer >= max_batch_payload then
        flush_event_buffer conn
      else schedule_event_batch_flush conn.manager
    end
  end

let register t ~send_raw =
  let id = t.next_id in
  t.next_id <- id + 1;
  let conn =
    {
      id;
      manager = t;
      send_raw;
      outbox = Queue.create ();
      event_buffer = Buffer.create 4096;
      event_callbacks = [];
      event_count = 0;
      snapshot_pending = Hashtbl.create 8;
      snapshot_buffers = Hashtbl.create 8;
      next_snapshot_token = 0;
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

let begin_snapshot conn ~board_x ~board_y =
  if conn.closed then 0
  else begin
    add_subscription conn board_x board_y;
    let key = board_key board_x board_y in
    let token = conn.next_snapshot_token + 1 in
    conn.next_snapshot_token <- token;
    Hashtbl.replace conn.snapshot_pending key token;
    Hashtbl.replace conn.snapshot_buffers key (ref []);
    token
  end

let abort_snapshot conn ~board_x ~board_y token =
  let key = board_key board_x board_y in
  match Hashtbl.find_opt conn.snapshot_pending key with
  | Some current when current = token ->
    Hashtbl.remove conn.snapshot_pending key;
    Hashtbl.remove conn.snapshot_buffers key
  | _ -> ()

let complete_snapshot conn ~board_x ~board_y ~token ~revision =
  let key = board_key board_x board_y in
  match Hashtbl.find_opt conn.snapshot_pending key with
  | Some current when current = token ->
    Hashtbl.remove conn.snapshot_pending key;
    let buffer =
      match Hashtbl.find_opt conn.snapshot_buffers key with
      | Some buffer ->
        Hashtbl.remove conn.snapshot_buffers key;
        !buffer
      | None -> []
    in
    let kept =
      List.filter
        (fun (event : buffered_event) ->
          Int64.compare event.board.revision revision > 0)
        buffer
    in
    let kept =
      List.sort
        (fun (a : buffered_event) (b : buffered_event) ->
          Int64.compare a.board.revision b.board.revision)
        kept
    in
    Some
      (List.map
         (fun (event : buffered_event) ->
           Protocol.Types.
             {
               sequence = event.sequence;
               request_id = event.request_id;
               boards = [ event.board ];
             })
         kept)
  | _ -> None

let release_snapshot_events conn events =
  if conn.manager.event_batching then
    List.iter
      (fun (event : Protocol.Types.move_event) ->
        append_event conn
          (Protocol.Types.move_event_payload_to_bytes event)
          (fun _ -> ()))
      events
  else
    List.iter
      (fun (event : Protocol.Types.move_event) ->
        enqueue_event conn
          (Protocol.Types.wire_response_to_bytes
             (Protocol.Types.Wire_event event))
          (fun _ -> ()))
      events

let buffer_snapshot_event conn event =
  let key = board_key event.board.board_x event.board.board_y in
  match Hashtbl.find_opt conn.snapshot_buffers key with
  | Some buffer -> buffer := event :: !buffer
  | None -> ()

let metrics t =
  let subscription_count = ref 0 in
  let max_outbox_depth = ref 0 in
  Hashtbl.iter
    (fun _ conn ->
      subscription_count := !subscription_count + Hashtbl.length conn.subscriptions;
      let depth = Queue.length conn.outbox in
      if depth > !max_outbox_depth then max_outbox_depth := depth)
    t.clients;
  {
    client_count = Hashtbl.length t.clients;
    subscription_count = !subscription_count;
    max_outbox_depth = !max_outbox_depth;
    outbox_capacity = t.max_outbox;
    event_batching = t.event_batching;
  }

type delivery = {
  mutable remaining : int;
  timing : Metrics.move_timing option;
}

let note_delivery delivery result =
  (match result with
   | `Written -> ()
   | `Send_failed _ -> Metrics.note_send_failure ()
   | `Outbox_dropped -> Metrics.note_outbox_drop 1);
  if delivery.remaining > 0 then begin
    delivery.remaining <- delivery.remaining - 1;
    if delivery.remaining = 0 then
      match delivery.timing with
      | Some timing -> Metrics.mark_complete timing
      | None -> ()
  end

let broadcast_event t (event : State_worker.committed) =
  let timing = event.timing in
  (match timing with
   | Some timing -> Metrics.mark_broadcast_started timing
   | None -> ());
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
  let recipient_count = Hashtbl.length recipients in
  (match timing with
   | Some timing -> Metrics.mark_recipients timing
   | None -> ());
  Metrics.note_event recipient_count;
  if recipient_count = 0 then begin
    (match timing with
     | Some timing ->
       Metrics.mark_enqueued timing;
       Metrics.mark_complete timing
     | None -> ())
  end
  else begin
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
    let delivery = { remaining = recipient_count; timing } in
    let enqueue_protocol_event conn (event : Protocol.Types.move_event) =
      if t.event_batching then
        append_event conn
          (Protocol.Types.move_event_payload_to_bytes event)
          (fun _ -> ())
      else
        enqueue_event conn
          (Protocol.Types.wire_response_to_bytes
             (Protocol.Types.Wire_event event))
          (fun _ -> ())
    in
    let all_event =
      Protocol.Types.
        { sequence = event.sequence; request_id = event.request_id; boards }
    in
    let all_payload =
      if t.event_batching then
        Some (Protocol.Types.move_event_payload_to_bytes all_event)
      else None
    in
    let all_bytes =
      match all_payload with
      | Some _ -> None
      | None ->
        Some
          (Protocol.Types.wire_response_to_bytes
             (Protocol.Types.Wire_event all_event))
    in
    (match timing with
     | Some timing -> Metrics.mark_encoded timing
     | None -> ());
    Hashtbl.iter
      (fun id () ->
        match Hashtbl.find_opt t.clients id with
        | None -> note_delivery delivery `Outbox_dropped
        | Some conn ->
          if Hashtbl.length conn.snapshot_pending = 0 then begin
            (match all_payload with
             | Some payload ->
               append_event conn payload
                 (fun result -> note_delivery delivery result)
             | None ->
               (match all_bytes with
                | Some bytes -> enqueue_event conn bytes (note_delivery delivery)
                | None -> note_delivery delivery `Outbox_dropped))
          end
          else begin
            let pending, immediate =
              List.partition
                (fun (board : Protocol.Types.event_board) ->
                  Hashtbl.mem conn.snapshot_pending
                    (board_key board.board_x board.board_y))
                boards
            in
            if immediate <> [] then
              enqueue_protocol_event conn
                Protocol.Types.
                  {
                    sequence = event.sequence;
                    request_id = event.request_id;
                    boards = immediate;
                  };
            List.iter
              (fun (board : Protocol.Types.event_board) ->
                buffer_snapshot_event conn
                  { sequence = event.sequence; request_id = event.request_id; board })
              pending;
            note_delivery delivery `Written
          end)
      recipients;
    (match timing with
     | Some timing ->
       Metrics.mark_enqueued timing;
       if delivery.remaining = 0 then Metrics.mark_complete timing
     | None -> ())
  end

let rec flush_pending t sequence =
  if not (Queue.is_empty t.pending_events) then begin
    let event = Queue.peek t.pending_events in
    if Int64.compare event.State_worker.sequence sequence <= 0 then begin
      ignore (Queue.take t.pending_events);
      broadcast_event t event;
      (match event.State_worker.timing with
       | Some timing when timing.Metrics.origin_conn_id > 0 ->
         (match Hashtbl.find_opt t.clients timing.origin_conn_id with
          | Some conn -> flush_conn_events conn
          | None -> ())
       | _ -> ());
      flush_pending t sequence
    end
  end

let flush_through t sequence =
  flush_pending t sequence

let enqueue_move t (event : State_worker.committed) =
  (match event.timing with
   | Some timing -> Metrics.mark_broadcast timing
   | None -> ());
  Queue.add event t.pending_events;
  if not t.event_flush_scheduled then begin
    t.event_flush_scheduled <- true;
    Lwt.async (fun () ->
        Lwt.pause () >>= fun () ->
        t.event_flush_scheduled <- false;
        flush_through t Int64.max_int;
        Lwt.return_unit)
  end
