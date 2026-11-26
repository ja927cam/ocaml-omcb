(* Decaying heat map of recent move destinations, grouped into the same
   100 x 100 board regions as the load metrics. Used only to suggest where a
   new visitor should start when nobody else is currently connected. *)

let region_size = 100
let region_count = 10
let half_life_s = 300.

type cell = {
  mutable weight : float;
  mutable mean_x : float;
  mutable mean_y : float;
  mutable at : float;
}

type t = { cells : cell array }

type hotspot = { x : int; y : int; weight : float }

let create () =
  {
    cells =
      Array.init (region_count * region_count) (fun _ ->
          { weight = 0.; mean_x = 0.; mean_y = 0.; at = 0. });
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
  cell.at <- now

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
