(* Aggregate, low-overhead metrics for the move broadcast pipeline.

   Per-event logging is deliberately avoided: every stage records into a fixed
   ring buffer and a few monotonic counters. The /metrics endpoint formats a
   snapshot on demand. The server is single-domain, so plain mutation is safe. *)

type stage =
  | Receive_to_submit
  | Worker_queue_wait
  | Move_processing
  | Commit_to_broadcast
  | Broadcast_wait
  | Broadcast_dispatch
  | Encoding
  | Outbox_enqueue
  | Websocket_write
  | End_to_end_broadcast

let stage_names =
  [|
    "receive_to_submit";
    "worker_queue_wait";
    "move_processing";
    "commit_to_broadcast";
    "broadcast_wait";
    "broadcast_dispatch";
    "encoding";
    "outbox_enqueue";
    "websocket_write";
    "end_to_end_broadcast";
  |]

let stage_count = Array.length stage_names
let sample_capacity = 32768

type series = {
  mutable count : int;
  mutable total_ns : int64;
  mutable min_ns : int64;
  mutable max_ns : int64;
  samples : int64 array;
  mutable next : int;
  mutable filled : int;
}

let create_series () =
  {
    count = 0;
    total_ns = 0L;
    min_ns = Int64.max_int;
    max_ns = 0L;
    samples = Array.make sample_capacity 0L;
    next = 0;
    filled = 0;
  }

let record_series series value =
  let value = if Int64.compare value 0L < 0 then 0L else value in
  series.count <- series.count + 1;
  series.total_ns <- Int64.add series.total_ns value;
  if Int64.compare value series.min_ns < 0 then series.min_ns <- value;
  if Int64.compare value series.max_ns > 0 then series.max_ns <- value;
  series.samples.(series.next) <- value;
  series.next <- (series.next + 1) mod sample_capacity;
  if series.filled < sample_capacity then series.filled <- series.filled + 1

let percentile sorted p =
  let n = Array.length sorted in
  if n = 0 then 0L
  else
    let index = min (n - 1) (max 0 ((p * n) / 100)) in
    sorted.(index)

let series_percentiles series =
  let n = series.filled in
  if n = 0 then (0L, 0L, 0L)
  else begin
    let samples = Array.sub series.samples 0 n in
    Array.sort Int64.compare samples;
    (percentile samples 50, percentile samples 95, percentile samples 99)
  end

let series_mean_ns series =
  if series.count = 0 then 0L
  else Int64.div series.total_ns (Int64.of_int series.count)

type counters = {
  mutable events_broadcast : int64;
  mutable recipients : int64;
  mutable outbox_enqueues : int64;
  mutable outbox_dropped : int64;
  mutable send_failures : int64;
  mutable outbox_full_unregisters : int64;
  mutable events_without_recipients : int64;
  mutable max_outbox_depth : int;
  mutable max_recipients : int;
}

let create_counters () =
  {
    events_broadcast = 0L;
    recipients = 0L;
    outbox_enqueues = 0L;
    outbox_dropped = 0L;
    send_failures = 0L;
    outbox_full_unregisters = 0L;
    events_without_recipients = 0L;
    max_outbox_depth = 0;
    max_recipients = 0;
  }

type t = {
  started_ns : int64;
  series : series array;
  counters : counters;
}

let create () =
  {
    started_ns = Mtime_clock.now_ns ();
    series = Array.init stage_count (fun _ -> create_series ());
    counters = create_counters ();
  }

let global = create ()
let now () = Mtime_clock.now_ns ()

let stage_index = function
  | Receive_to_submit -> 0
  | Worker_queue_wait -> 1
  | Move_processing -> 2
  | Commit_to_broadcast -> 3
  | Broadcast_wait -> 4
  | Broadcast_dispatch -> 5
  | Encoding -> 6
  | Outbox_enqueue -> 7
  | Websocket_write -> 8
  | End_to_end_broadcast -> 9

let record stage value = record_series global.series.(stage_index stage) value

let record_between stage start_ns end_ns =
  if Int64.compare start_ns 0L > 0 && Int64.compare end_ns start_ns >= 0 then
    record stage (Int64.sub end_ns start_ns)

let recent_p95_ms stage ~window =
  let series = global.series.(stage_index stage) in
  let n = min window series.filled in
  if n = 0 then 0.
  else begin
    let samples =
      Array.init n (fun i ->
          let index =
            (series.next - n + i + sample_capacity) mod sample_capacity
          in
          series.samples.(index))
    in
    Array.sort Int64.compare samples;
    Int64.to_float (percentile samples 95) /. 1_000_000.
  end

type move_timing = {
  origin_conn_id : int;
  received_ns : int64;
  mutable submitted_ns : int64;
  mutable worker_start_ns : int64;
  mutable committed_ns : int64;
  mutable broadcast_ns : int64;
  mutable broadcast_started_ns : int64;
  mutable recipients_ns : int64;
  mutable encoded_ns : int64;
  mutable enqueued_ns : int64;
}

let start_move ?(origin_conn_id = 0) received_ns =
  {
    origin_conn_id;
    received_ns;
    submitted_ns = 0L;
    worker_start_ns = 0L;
    committed_ns = 0L;
    broadcast_ns = 0L;
    broadcast_started_ns = 0L;
    recipients_ns = 0L;
    encoded_ns = 0L;
    enqueued_ns = 0L;
  }

let mark_submitted timing =
  if timing.submitted_ns = 0L then begin
    timing.submitted_ns <- now ();
    record_between Receive_to_submit timing.received_ns timing.submitted_ns
  end

let mark_worker_start timing started_ns =
  if timing.worker_start_ns = 0L then begin
    timing.worker_start_ns <- started_ns;
    record_between Worker_queue_wait timing.submitted_ns started_ns
  end

let mark_committed timing committed_ns =
  if timing.committed_ns = 0L then begin
    timing.committed_ns <- committed_ns;
    record_between Move_processing timing.worker_start_ns committed_ns
  end

let mark_broadcast timing =
  if timing.broadcast_ns = 0L then begin
    timing.broadcast_ns <- now ();
    record_between Commit_to_broadcast timing.committed_ns timing.broadcast_ns
  end

let mark_broadcast_started timing =
  if timing.broadcast_started_ns = 0L then begin
    timing.broadcast_started_ns <- now ();
    record_between Broadcast_wait timing.broadcast_ns
      timing.broadcast_started_ns
  end

let mark_recipients timing =
  if timing.recipients_ns = 0L then begin
    timing.recipients_ns <- now ();
    record_between Broadcast_dispatch timing.broadcast_started_ns
      timing.recipients_ns
  end

let mark_encoded timing =
  if timing.encoded_ns = 0L then begin
    timing.encoded_ns <- now ();
    record_between Encoding timing.recipients_ns timing.encoded_ns
  end

let mark_enqueued timing =
  if timing.enqueued_ns = 0L then begin
    timing.enqueued_ns <- now ();
    record_between Outbox_enqueue timing.encoded_ns timing.enqueued_ns
  end

let mark_complete timing =
  if timing.enqueued_ns <> 0L then
    record_between End_to_end_broadcast timing.received_ns (now ())

let note_event recipients =
  let counters = global.counters in
  counters.events_broadcast <- Int64.succ counters.events_broadcast;
  counters.recipients <- Int64.add counters.recipients (Int64.of_int recipients);
  if recipients > counters.max_recipients then
    counters.max_recipients <- recipients;
  if recipients = 0 then
    counters.events_without_recipients <-
      Int64.succ counters.events_without_recipients

let note_outbox_enqueue depth =
  let counters = global.counters in
  counters.outbox_enqueues <- Int64.succ counters.outbox_enqueues;
  if depth > counters.max_outbox_depth then
    counters.max_outbox_depth <- depth

let note_outbox_drop count =
  global.counters.outbox_dropped <-
    Int64.add global.counters.outbox_dropped (Int64.of_int count)

let note_send_failure () =
  global.counters.send_failures <- Int64.succ global.counters.send_failures

let note_outbox_full_unregister () =
  global.counters.outbox_full_unregisters <-
    Int64.succ global.counters.outbox_full_unregisters

let ns_to_ms value = Int64.to_float value /. 1_000_000.

let series_json series =
  let p50, p95, p99 = series_percentiles series in
  let max_ns = if series.count = 0 then 0L else series.max_ns in
  `Assoc
    [
      ("n", `Int series.count);
      ("mean_ms", `Float (ns_to_ms (series_mean_ns series)));
      ("p50_ms", `Float (ns_to_ms p50));
      ("p95_ms", `Float (ns_to_ms p95));
      ("p99_ms", `Float (ns_to_ms p99));
      ("max_ms", `Float (ns_to_ms max_ns));
      ("total_ms", `Float (ns_to_ms series.total_ns));
    ]

let counters_json () =
  let counters = global.counters in
  `Assoc
    [
      ("events_broadcast", `Intlit (Int64.to_string counters.events_broadcast));
      ("recipients", `Intlit (Int64.to_string counters.recipients));
      ("outbox_enqueues", `Intlit (Int64.to_string counters.outbox_enqueues));
      ("outbox_dropped", `Intlit (Int64.to_string counters.outbox_dropped));
      ("send_failures", `Intlit (Int64.to_string counters.send_failures));
      ( "outbox_full_unregisters",
        `Intlit (Int64.to_string counters.outbox_full_unregisters) );
      ( "events_without_recipients",
        `Intlit (Int64.to_string counters.events_without_recipients) );
      ("max_outbox_depth", `Int counters.max_outbox_depth);
      ("max_recipients", `Int counters.max_recipients);
    ]

let json ?(extra = []) () =
  let _, p95, _ = series_percentiles global.series.(stage_index End_to_end_broadcast) in
  `Assoc
    ([
       ("started_ns", `Intlit (Int64.to_string global.started_ns));
       ("uptime_ms", `Float (ns_to_ms (Int64.sub (now ()) global.started_ns)));
       ("stages", `Assoc (Array.to_list (Array.mapi (fun i name ->
            (name, series_json global.series.(i))) stage_names)));
       ("counters", counters_json ());
       ("end_to_end_p95_ms", `Float (ns_to_ms p95));
     ]
    @ extra)
