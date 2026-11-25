(* Turn a rectangle of desired boards into a small set of rectangles that
   contain only boards which are missing or stale.  Requesting these
   rectangles avoids re-sending boards already cached. *)

open Viewport

let is_satisfied cache ~is_inflight key =
  Board_cache.find_loaded cache key <> None || is_inflight key

(* Row-wise maximal runs of missing boards, merged vertically into rectangles. *)
let rectangles cache rect ~is_inflight =
  if is_empty rect then []
  else begin
    let active : ((int * int), int) Hashtbl.t = Hashtbl.create 16 in
    let finished = ref [] in
    let flush_run x0 x1 y start_y =
      finished := make ~x0 ~y0:start_y ~x1 ~y1:y :: !finished
    in
    for y = rect.y0 to rect.y1 do
      let seen : ((int * int), unit) Hashtbl.t = Hashtbl.create 8 in
      let run_start = ref None in
      let close_run x =
        match !run_start with
        | None -> ()
        | Some start_x ->
          run_start := None;
          let run = (start_x, x - 1) in
          Hashtbl.replace seen run ();
          (match Hashtbl.find_opt active run with
           | Some start_y -> Hashtbl.replace active run start_y
           | None -> Hashtbl.add active run y)
      in
      for x = rect.x0 to rect.x1 do
        let key = (y * 1000) + x in
        if is_satisfied cache ~is_inflight key then close_run x
        else if !run_start = None then run_start := Some x
      done;
      (match !run_start with Some _ -> close_run (rect.x1 + 1) | None -> ());
      let expired =
        Hashtbl.fold
          (fun run start_y acc ->
            if Hashtbl.mem seen run then acc else (run, start_y) :: acc)
          active []
      in
      List.iter
        (fun (run, start_y) ->
          Hashtbl.remove active run;
          let x0, x1 = run in
          flush_run x0 x1 (y - 1) start_y)
        expired
    done;
    Hashtbl.iter
      (fun (x0, x1) start_y ->
        flush_run x0 x1 rect.y1 start_y)
      active;
    List.sort
      (fun a b ->
        let by_area = compare (area b) (area a) in
        if by_area <> 0 then by_area
        else if a.y0 <> b.y0 then compare a.y0 b.y0
        else compare a.x0 b.x0)
      !finished
  end

let count_missing cache rect ~is_inflight =
  fold rect
    (fun x y total ->
      let key = (y * 1000) + x in
      if is_satisfied cache ~is_inflight key then total else total + 1)
    0

let progress cache rect =
  let total = area rect in
  let loaded =
    fold rect
      (fun x y count ->
        let key = (y * 1000) + x in
        match Board_cache.find_loaded cache key with
        | Some _ -> count + 1
        | None -> count)
      0
  in
  (loaded, total, total - loaded)
