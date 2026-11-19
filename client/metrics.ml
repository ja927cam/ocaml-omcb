open Brr

(* Temporary round-trip metrics for moves.
   Flip [enabled] to false to turn measuring and UI updates off. *)

let enabled = true

let display = ref None
let pending = Queue.create ()
let count = ref 0
let total_ns = ref 0.
let min_ns = ref infinity
let max_ns = ref 0.
let resolution_ns = ref 0.

(* [performance.now] is a float in milliseconds; scale it to nanoseconds.
   The browser quantises the clock (100 µs normally, 5 µs when the page is
   cross-origin isolated), so the useful precision is the measured
   [resolution_ns], not the nanosecond conversion. *)
let now_ns () = Performance.now_ms G.performance *. 1e6

let measure_resolution () =
  let best = ref infinity in
  for _ = 1 to 20 do
    let start = now_ns () in
    let rec wait () =
      let t = now_ns () in
      if t = start then wait () else t -. start
    in
    let delta = wait () in
    if delta < !best then best := delta
  done;
  !best

let init () =
  if enabled then begin
    display := Document.find_el_by_id G.document (Jstr.v "rtt");
    resolution_ns := measure_resolution ()
  end

let sent () =
  if enabled then Queue.add (now_ns ()) pending

let received () =
  if enabled && not (Queue.is_empty pending) then begin
    let start = Queue.take pending in
    let ns = now_ns () -. start in
    incr count;
    total_ns := !total_ns +. ns;
    if ns < !min_ns then min_ns := ns;
    if ns > !max_ns then max_ns := ns;
    let avg = !total_ns /. float !count in
    let line =
      Printf.sprintf
        "rtt %.0f ns   avg %.0f ns   min %.0f ns   max %.0f ns   n=%d   res %.0f ns"
        ns avg !min_ns !max_ns !count !resolution_ns
    in
    (match !display with
     | Some el -> El.set_children el [ El.txt (Jstr.v line) ]
     | None -> ());
    Console.log [ Jstr.v line ]
  end
