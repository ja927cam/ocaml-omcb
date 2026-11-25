open Sim_map_client_core

module C = Board_cache
module V = Viewport
module P = Snapshot_plan
module R = Request_tracker

let failures = ref 0

let check name condition =
  if not condition then begin
    incr failures;
    Printf.eprintf "FAIL: %s\n%!" name
  end

let check_int name expected actual =
  check
    (Printf.sprintf "%s (expected %d, got %d)" name expected actual)
    (expected = actual)

let check_int64 name expected actual =
  check
    (Printf.sprintf "%s (expected %Ld, got %Ld)" name expected actual)
    (Int64.equal expected actual)

let key bx by = (by * 1000) + bx

let load cache bx by revision =
  let state = C.get_or_create cache ~bx ~by in
  state.pieces <- Bytes.make 64 (Char.chr 19);
  state.revision <- revision;
  state.loaded <- true;
  state.stale <- false;
  state

let loaded cache bx by =
  match C.find_loaded cache (key bx by) with Some _ -> true | None -> false

let test_cache_lru () =
  let cache = C.create ~capacity:2 () in
  ignore (load cache 0 0 1L);
  ignore (load cache 1 0 1L);
  C.touch cache (key 0 0);
  let evicted = C.evict_to cache ~target:1 ~protected:(fun _ -> false) in
  check_int "LRU evicts one entry" 1 (List.length evicted);
  check "LRU keeps recently used" (C.mem cache (key 0 0));
  check "LRU evicts oldest" (not (C.mem cache (key 1 0)));
  check_int "LRU capacity" 1 (C.length cache)

let test_cache_capacity () =
  let cache = C.create ~capacity:10 () in
  for i = 0 to 49 do
    if C.length cache >= C.capacity cache then
      ignore (C.evict_to cache ~target:(C.capacity cache - 1)
                ~protected:(fun _ -> false));
    ignore (load cache (i mod 10) (i / 10) 1L)
  done;
  check "cache never exceeds capacity" (C.length cache <= 10);
  check "peak never exceeds capacity" (C.peak cache <= 10)

let test_cache_visible_protection () =
  let cache = C.create ~capacity:3 () in
  ignore (load cache 0 0 1L);
  ignore (load cache 1 0 1L);
  ignore (load cache 2 0 1L);
  let visible k = k = key 0 0 || k = key 1 0 in
  let evicted = C.evict_to cache ~target:1 ~protected:visible in
  check_int "protected eviction removes only unprotected" 1 (List.length evicted);
  check "visible board 0 protected" (C.mem cache (key 0 0));
  check "visible board 1 protected" (C.mem cache (key 1 0));
  check "unprotected board evicted" (not (C.mem cache (key 2 0)));
  let all_protected _ = true in
  let evicted = C.evict_to cache ~target:0 ~protected:all_protected in
  check_int "no safe candidate leaves cache intact" 0 (List.length evicted);
  check_int "all protected entries remain" 2 (C.length cache)

let test_cache_snapshot_revisions () =
  let cache = C.create ~capacity:2 () in
  let state = load cache 4 4 5L in
  state.pieces <- Bytes.make 64 (Char.chr 7);
  check "older snapshot ignored"
    (not (C.apply_snapshot cache (key 4 4) ~revision:4L
            ~pieces:(Bytes.make 64 (Char.chr 9))));
  check "older snapshot did not overwrite pieces"
    (Char.code (Bytes.get state.pieces 0) = 7);
  check "newer snapshot applied"
    (C.apply_snapshot cache (key 4 4) ~revision:6L
       ~pieces:(Bytes.make 64 (Char.chr 9)));
  check_int64 "new revision stored" 6L state.revision;
  check "equal revision applied"
    (C.apply_snapshot cache (key 4 4) ~revision:6L
       ~pieces:(Bytes.make 64 (Char.chr 11)));
  check "missing board snapshot is not inserted"
    (not (C.apply_snapshot cache (key 9 9) ~revision:1L
            ~pieces:(Bytes.make 64 (Char.chr 1))))

let test_cache_stats () =
  let cache = C.create ~capacity:2 () in
  ignore (load cache 0 0 1L);
  C.note_hit cache;
  C.note_hit cache;
  C.note_miss cache;
  check_int "cache hits" 2 (C.hits cache);
  check_int "cache misses" 1 (C.misses cache);
  check_int "cache loaded count" 1 (C.loaded_count cache);
  C.mark_all_stale cache;
  check_int "stale boards are not loaded" 0 (C.loaded_count cache)

let test_viewport_rects () =
  let view = V.of_view ~left:0. ~top:0. ~visible_w:3.61 ~visible_h:2.28 in
  check_int "visible x0" 0 view.x0;
  check_int "visible x1" 3 view.x1;
  check_int "visible y0" 0 view.y0;
  check_int "visible y1" 2 view.y1;
  let window = V.around ~center_x:500 ~center_y:500 ~radius:12 in
  check_int "window width" 25 (V.width window);
  check_int "window height" 25 (V.height window);
  let expanded = V.expand window ~margin:1 in
  check_int "expanded width" 27 (V.width expanded);
  check_int "expanded height" 27 (V.height expanded);
  let edge = V.expand (V.around ~center_x:0 ~center_y:999 ~radius:2) ~margin:2 in
  check_int "edge clamp x0" 0 edge.x0;
  check_int "edge clamp y1" 999 edge.y1

let test_viewport_diff_pan () =
  let old = V.around ~center_x:500 ~center_y:500 ~radius:12 in
  let east = V.around ~center_x:501 ~center_y:500 ~radius:12 in
  let leaving = V.diff old east in
  let entering = V.diff east old in
  check_int "one-board pan leaves one rectangle" 1 (List.length leaving);
  check_int "one-board pan enters one rectangle" 1 (List.length entering);
  check_int "leaving strip area" 25 (V.area (List.hd leaving));
  check_int "entering strip area" 25 (V.area (List.hd entering));
  let north = V.around ~center_x:500 ~center_y:499 ~radius:12 in
  check_int "vertical pan leaves one rectangle" 1
    (List.length (V.diff old north));
  let diagonal = V.around ~center_x:501 ~center_y:501 ~radius:12 in
  check_int "diagonal pan leaves two rectangles" 2
    (List.length (V.diff old diagonal));
  let far = V.around ~center_x:700 ~center_y:700 ~radius:12 in
  check_int "large jump leaves whole window" 1 (List.length (V.diff old far))

let test_viewport_rapid_pan () =
  let rects =
    List.init 20 (fun i -> V.around ~center_x:(100 + i) ~center_y:200 ~radius:12)
  in
  let rec loop = function
    | [] | [ _ ] -> ()
    | old :: (new_ :: _ as rest) ->
      let leaving = V.diff old new_ and entering = V.diff new_ old in
      check "rapid pan leaves at most two strips" (List.length leaving <= 2);
      check "rapid pan enters at most two strips" (List.length entering <= 2);
      List.iter
        (fun rect -> check "rapid pan strip is one column or less" (V.width rect <= 1))
        (leaving @ entering);
      loop rest
  in
  loop rects

let test_plan_initial_and_cached () =
  let cache = C.create ~capacity:900 () in
  let window = V.around ~center_x:500 ~center_y:500 ~radius:12 in
  let plan = P.rectangles cache window ~is_inflight:(fun _ -> false) in
  check_int "initial plan is one rectangle" 1 (List.length plan);
  check "initial plan covers the window" (V.equal window (List.hd plan));
  V.iter window (fun x y -> ignore (load cache x y 1L));
  let plan = P.rectangles cache window ~is_inflight:(fun _ -> false) in
  check_int "fully cached window needs no request" 0 (List.length plan);
  let east = V.around ~center_x:501 ~center_y:500 ~radius:12 in
  let plan = P.rectangles cache east ~is_inflight:(fun _ -> false) in
  check_int "one-board pan needs one strip" 1 (List.length plan);
  let strip = List.hd plan in
  check_int "one-board pan strip width" 1 (V.width strip)

let test_plan_sparse () =
  let cache = C.create ~capacity:900 () in
  let window = V.around ~center_x:500 ~center_y:500 ~radius:2 in
  V.iter window (fun x y ->
      if (x + y) mod 2 = 0 then ignore (load cache x y 1L));
  let plan = P.rectangles cache window ~is_inflight:(fun _ -> false) in
  let covered = Hashtbl.create 32 in
  List.iter
    (fun rect ->
      V.iter rect (fun x y -> Hashtbl.replace covered (key x y) ()))
    plan;
  V.iter window (fun x y ->
      let k = key x y in
      if loaded cache x y then check "cached board not re-requested" (not (Hashtbl.mem covered k))
      else check "missing board covered by a request" (Hashtbl.mem covered k));
  check_int "sparse progress loaded" 13 (let a, _, _ = P.progress cache window in a);
  check_int "sparse progress missing" 12 (let _, _, c = P.progress cache window in c)

let test_plan_inflight_and_stale () =
  let cache = C.create ~capacity:900 () in
  let window = V.around ~center_x:0 ~center_y:0 ~radius:2 in
  let plan = P.rectangles cache window ~is_inflight:(fun k -> k = key 0 0) in
  let covered = Hashtbl.create 32 in
  List.iter (fun rect -> V.iter rect (fun x y -> Hashtbl.replace covered (key x y) ())) plan;
  check "in-flight board is not requested again" (not (Hashtbl.mem covered (key 0 0)));
  let state = load cache 1 0 5L in
  state.loaded <- false;
  state.stale <- true;
  let plan = P.rectangles cache window ~is_inflight:(fun _ -> false) in
  let covered = Hashtbl.create 32 in
  List.iter (fun rect -> V.iter rect (fun x y -> Hashtbl.replace covered (key x y) ())) plan;
  check "stale board is re-requested" (Hashtbl.mem covered (key 1 0))

let test_tracker_lifecycle () =
  let tracker = R.create ~max_inflight:2 () in
  let rect = V.around ~center_x:500 ~center_y:500 ~radius:1 in
  check "tracker accepts first batch"
    (R.begin_batch tracker ~id:1l ~rect ~keys:[ 1; 2 ] ~sent_at:0.);
  check "tracker deduplicates boards"
    (R.begin_batch tracker ~id:2l ~rect ~keys:[ 2; 3 ] ~sent_at:0.);
  check_int "tracker board count" 3 (R.board_count tracker);
  check "tracker respects the in-flight limit"
    (not (R.begin_batch tracker ~id:3l ~rect ~keys:[ 4 ] ~sent_at:0.));
  check "tracker reports in-flight boards" (R.is_in_flight tracker 2);
  ignore (R.complete tracker 1l);
  check "completed batch releases its boards" (not (R.is_in_flight tracker 1));
  check "other batch keeps its board" (R.is_in_flight tracker 3);
  check "unknown completion is harmless" (R.complete tracker 99l = None);
  ignore (R.complete tracker 2l);
  check "all boards released" (R.board_count tracker = 0)

let test_tracker_stale_completion () =
  let tracker = R.create ~max_inflight:2 () in
  let rect = V.around ~center_x:0 ~center_y:0 ~radius:1 in
  check "begin old" (R.begin_batch tracker ~id:10l ~rect ~keys:[ 7 ] ~sent_at:0.);
  ignore (R.complete tracker 10l);
  check "begin new" (R.begin_batch tracker ~id:11l ~rect ~keys:[ 7 ] ~sent_at:0.);
  ignore (R.complete tracker 10l);
  check "old completion does not clear the new request" (R.is_in_flight tracker 7);
  ignore (R.complete tracker 11l);
  check "new completion releases the board" (not (R.is_in_flight tracker 7));
  check "due reports timed-out batches"
    (R.begin_batch tracker ~id:12l ~rect ~keys:[ 8 ] ~sent_at:0.
     && List.length (R.due tracker ~now:5000. ~timeout:3000.) = 1);
  R.clear tracker;
  check_int "clear removes all batches" 0 (R.batch_count tracker)

let test_live_update_race () =
  let cache = C.create ~capacity:4 () in
  let state = load cache 10 10 5L in
  state.pieces <- Bytes.make 64 (Char.chr 21);
  check "live revision survives an older snapshot"
    (not (C.apply_snapshot cache (key 10 10) ~revision:4L
            ~pieces:(Bytes.make 64 (Char.chr 3))));
  check "live pieces survive an older snapshot"
    (Char.code (Bytes.get state.pieces 0) = 21);
  check "newer snapshot wins over live revision"
    (C.apply_snapshot cache (key 10 10) ~revision:7L
       ~pieces:(Bytes.make 64 (Char.chr 4)));
  check "newer pieces stored" (Char.code (Bytes.get state.pieces 0) = 4)

let test_evicted_board_reloads () =
  let cache = C.create ~capacity:2 () in
  ignore (load cache 0 0 1L);
  ignore (load cache 1 0 1L);
  let window = V.make ~x0:0 ~y0:0 ~x1:1 ~y1:0 in
  check_int "window fully cached" 2 (let a, _, _ = P.progress cache window in a);
  ignore (C.evict_to cache ~target:1 ~protected:(fun _ -> false));
  let plan = P.rectangles cache window ~is_inflight:(fun _ -> false) in
  check "evicted board is requested again"
    (List.exists (fun rect -> V.contains rect ~bx:0 ~by:0 || V.contains rect ~bx:1 ~by:0) plan);
  ignore (load cache 0 0 1L);
  check_int "reloaded board counts again" 2
    (let a, _, _ = P.progress cache window in a)

let test_sustained_pan_bound () =
  let cache = C.create ~capacity:30 () in
  for i = 0 to 200 do
    let window = V.make ~x0:i ~y0:0 ~x1:(i + 4) ~y1:4 in
    let protected k =
      let bx = k mod 1000 in
      bx >= window.x0 && bx <= window.x1
    in
    V.iter window (fun x y ->
        if C.length cache >= C.capacity cache then
          ignore (C.evict_to cache ~target:(C.capacity cache - 1)
                    ~protected);
        if C.length cache < C.capacity cache then ignore (load cache x y 1L));
    check "sustained pan stays within capacity" (C.length cache <= 30)
  done;
  let final_window = V.make ~x0:200 ~y0:0 ~x1:204 ~y1:4 in
  V.iter final_window (fun x y ->
      check "final visible board retained" (C.mem cache (key x y)))

let () =
  test_cache_lru ();
  test_cache_capacity ();
  test_cache_visible_protection ();
  test_cache_snapshot_revisions ();
  test_cache_stats ();
  test_viewport_rects ();
  test_viewport_diff_pan ();
  test_viewport_rapid_pan ();
  test_plan_initial_and_cached ();
  test_plan_sparse ();
  test_plan_inflight_and_stale ();
  test_tracker_lifecycle ();
  test_tracker_stale_completion ();
  test_live_update_race ();
  test_evicted_board_reloads ();
  test_sustained_pan_bound ();
  if !failures = 0 then Printf.printf "client core tests: OK\n%!"
  else begin
    Printf.eprintf "client core tests: %d failure(s)\n%!" !failures;
    exit 1
  end
