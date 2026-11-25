(* Low-overhead server-side metrics for board snapshot loading, grouped by
   100 x 100 board regions on the 1000 x 1000 world. *)

let region_size = 100
let region_count = 10
let ring_capacity = 128

type ring = {
  samples : float array;
  mutable next : int;
  mutable filled : int;
  mutable requests : int64;
  mutable boards : int64;
  mutable failures : int64;
  mutable total_ms : float;
  mutable max_ms : float;
  mutable last_ms : float;
  mutable last_boards : int;
}

type t = { regions : ring array; overall : ring }

type summary = {
  samples : int;
  requests : int64;
  boards : int64;
  failures : int64;
  p50_ms : float;
  p95_ms : float;
  max_ms : float;
  mean_ms : float;
  last_ms : float;
  last_boards : int;
}

let create_ring () =
  {
    samples = Array.make ring_capacity 0.;
    next = 0;
    filled = 0;
    requests = 0L;
    boards = 0L;
    failures = 0L;
    total_ms = 0.;
    max_ms = 0.;
    last_ms = 0.;
    last_boards = 0;
  }

let create () =
  {
    regions =
      Array.init (region_count * region_count) (fun _ -> create_ring ());
    overall = create_ring ();
  }

let clamp_region value =
  if value < 0 then 0 else if value >= region_count then region_count - 1 else value

let sanitize_ms value =
  if Float.is_nan value || Float.is_infinite value || value < 0. then 0.
  else if value > 60_000. then 60_000.
  else value

let record_ring (ring : ring) ~boards ~elapsed_ms ~success =
  ring.requests <- Int64.succ ring.requests;
  ring.boards <- Int64.add ring.boards (Int64.of_int (max 0 boards));
  if not success then ring.failures <- Int64.succ ring.failures;
  let elapsed_ms = sanitize_ms elapsed_ms in
  ring.last_ms <- elapsed_ms;
  ring.last_boards <- max 0 boards;
  if success then begin
    ring.samples.(ring.next) <- elapsed_ms;
    ring.next <- (ring.next + 1) mod ring_capacity;
    if ring.filled < ring_capacity then ring.filled <- ring.filled + 1;
    ring.total_ms <- ring.total_ms +. elapsed_ms;
    if elapsed_ms > ring.max_ms then ring.max_ms <- elapsed_ms
  end

let record t ~region_x ~region_y ~boards ~elapsed_ms ~success =
  let region_x = clamp_region region_x and region_y = clamp_region region_y in
  record_ring t.regions.((region_y * region_count) + region_x) ~boards
    ~elapsed_ms ~success;
  record_ring t.overall ~boards ~elapsed_ms ~success

let percentile sorted p =
  let n = Array.length sorted in
  if n = 0 then 0.
  else sorted.(min (n - 1) (max 0 ((p * n) / 100)))

let summarize (ring : ring) =
  let samples = Array.sub ring.samples 0 ring.filled in
  Array.sort Float.compare samples;
  let count = ring.filled in
  {
    samples = count;
    requests = ring.requests;
    boards = ring.boards;
    failures = ring.failures;
    p50_ms = percentile samples 50;
    p95_ms = percentile samples 95;
    max_ms = ring.max_ms;
    mean_ms =
      (if count = 0 then 0.
       else Array.fold_left ( +. ) 0. samples /. float_of_int count);
    last_ms = ring.last_ms;
    last_boards = ring.last_boards;
  }

let summary_json (s : summary) =
  `Assoc
    [
      ("samples", `Int s.samples);
      ("requests", `Intlit (Int64.to_string s.requests));
      ("boards", `Intlit (Int64.to_string s.boards));
      ("failures", `Intlit (Int64.to_string s.failures));
      ("p50_ms", `Float s.p50_ms);
      ("p95_ms", `Float s.p95_ms);
      ("max_ms", `Float s.max_ms);
      ("mean_ms", `Float s.mean_ms);
      ("last_ms", `Float s.last_ms);
      ("last_boards", `Int s.last_boards);
    ]

let json t =
  let regions = ref [] in
  for y = 0 to region_count - 1 do
    for x = 0 to region_count - 1 do
      let summary = summarize t.regions.((y * region_count) + x) in
      if summary.requests > 0L then
        regions :=
          `Assoc
            [
              ("x", `Int x);
              ("y", `Int y);
              ("metrics", summary_json summary);
            ]
          :: !regions
    done
  done;
  `Assoc
    [
      ("overall", summary_json (summarize t.overall));
      ("regions", `List (List.rev !regions));
    ]

let overall t = summarize t.overall

let region t ~x ~y =
  let x = clamp_region x and y = clamp_region y in
  summarize t.regions.((y * region_count) + x)

let region_count = region_count
let region_size = region_size

let iter_regions t f =
  for y = 0 to region_count - 1 do
    for x = 0 to region_count - 1 do
      f x y (summarize t.regions.((y * region_count) + x))
    done
  done
