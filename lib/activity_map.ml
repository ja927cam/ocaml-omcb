(* Decaying heat map of recent move destinations, grouped into the same
   100 x 100 board regions as the load metrics. The region map is used to
   suggest where a new visitor should start; the small recent-move ring is
   used by the live world minimap. *)

let region_size = 100
let region_count = 10
let half_life_s = 300.
let recent_capacity = 512
let recent_window_s = 300.

type cell = {
  mutable weight : float;
  mutable mean_x : float;
  mutable mean_y : float;
  mutable at : float;
}

type move = { x : int; y : int; at : float }

type t = {
  cells : cell array;
  recent : move array;
  mutable recent_next : int;
  mutable recent_count : int;
}

type hotspot = { x : int; y : int; weight : float }

let create () =
  {
    cells =
      Array.init (region_count * region_count) (fun _ ->
          { weight = 0.; mean_x = 0.; mean_y = 0.; at = 0. });
    recent =
      Array.init recent_capacity (fun _ -> { x = 0; y = 0; at = 0. });
    recent_next = 0;
    recent_count = 0;
  }

let clamp_coord value =
  if value < 0 then 0 else if value > 999 then 999 else value

let region_of value = clamp_coord value / region_size

let decayed (cell : cell) now =
  if cell.weight <= 0. || cell.at <= 0. then 0.
  else
    let age = max 0. (now -. cell.at) in
    cell.weight *. exp (-.age /. half_life_s)

let note t ~bx ~by ~now =
  let bx = clamp_coord bx and by = clamp_coord by in
  let index = (region_of by * region_count) + region_of bx in
  let cell = Array.unsafe_get t.cells index in
  let old = decayed cell now in
  let weight = old +. 1. in
  cell.mean_x <- ((cell.mean_x *. old) +. float bx) /. weight;
  cell.mean_y <- ((cell.mean_y *. old) +. float by) /. weight;
  cell.weight <- weight;
  cell.at <- now;
  Array.unsafe_set t.recent t.recent_next { x = bx; y = by; at = now };
  t.recent_next <- (t.recent_next + 1) mod recent_capacity;
  if t.recent_count < recent_capacity then t.recent_count <- t.recent_count + 1

let suggest t ~now =
  let best = ref None in
  Array.iter
    (fun cell ->
      let weight = decayed cell now in
      if weight >= 0.5 then
        match !best with
        | Some current when current.weight >= weight -> ()
        | _ ->
          best :=
            Some
              {
                x = clamp_coord (int_of_float (Float.round cell.mean_x));
                y = clamp_coord (int_of_float (Float.round cell.mean_y));
                weight;
              })
    t.cells;
  !best

let recent t ~now =
  let cutoff = now -. recent_window_s in
  let points = ref [] in
  for index = 0 to t.recent_count - 1 do
    let move = Array.unsafe_get t.recent index in
    if move.at >= cutoff then points := move :: !points
  done;
  List.sort (fun left right -> Float.compare right.at left.at) !points
  |> List.filteri (fun index _ -> index < 200)
