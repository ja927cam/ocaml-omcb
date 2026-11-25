let failures = ref 0

let check name condition =
  if not condition then begin
    incr failures;
    Printf.eprintf "FAIL: %s\n%!" name
  end

let close a b = abs_float (a -. b) < 1e-9

let () =
  let t = Board_load_metrics.create () in
  List.iter
    (fun (ms, ok) ->
      Board_load_metrics.record t ~region_x:0 ~region_y:0 ~boards:10
        ~elapsed_ms:ms ~success:ok)
    [ (10., true); (20., true); (30., true); (40., true); (50., true) ];
  let s = Board_load_metrics.overall t in
  check "sample count" (s.samples = 5);
  check "request count" (Int64.equal s.requests 5L);
  check "board count" (Int64.equal s.boards 50L);
  check "failure count" (Int64.equal s.failures 0L);
  check "p50" (close s.p50_ms 30.);
  check "p95" (close s.p95_ms 50.);
  check "mean" (close s.mean_ms 30.);
  check "last" (close s.last_ms 50.);
  check "last boards" (s.last_boards = 10);

  Board_load_metrics.record t ~region_x:1 ~region_y:2 ~boards:7
    ~elapsed_ms:5. ~success:false;
  let failed = Board_load_metrics.region t ~x:1 ~y:2 in
  check "region request count" (Int64.equal failed.requests 1L);
  check "region failure count" (Int64.equal failed.failures 1L);
  check "region failure has no latency sample" (failed.samples = 0);

  Board_load_metrics.record t ~region_x:(-3) ~region_y:99 ~boards:1
    ~elapsed_ms:1. ~success:true;
  check "region coordinates are clamped"
    (Int64.equal
       (Board_load_metrics.region t ~x:0 ~y:9).requests 1L);

  let json = Board_load_metrics.json t in
  let overall =
    Yojson.Safe.Util.(json |> member "overall" |> member "samples" |> to_int)
  in
  check "json overall samples" (overall = 6);
  check "json regions present"
    (Yojson.Safe.Util.(json |> member "regions" |> to_list |> List.length) >= 2);

  if !failures = 0 then Printf.printf "board load metrics tests: OK\n%!"
  else begin
    Printf.eprintf "board load metrics tests: %d failure(s)\n%!" !failures;
    exit 1
  end
