(* Pure rectangle arithmetic for the client viewport and board windows. *)

type rect = { x0 : int; y0 : int; x1 : int; y1 : int }

let min_coord = 0
let max_coord = 999

let empty = { x0 = 1; y0 = 1; x1 = 0; y1 = 0 }
let is_empty rect = rect.x0 > rect.x1 || rect.y0 > rect.y1
let width rect = if is_empty rect then 0 else rect.x1 - rect.x0 + 1
let height rect = if is_empty rect then 0 else rect.y1 - rect.y0 + 1
let area rect = width rect * height rect

let clamp_coord value = max min_coord (min max_coord value)

let make ~x0 ~y0 ~x1 ~y1 =
  let x0 = clamp_coord x0 and y0 = clamp_coord y0 in
  let x1 = clamp_coord x1 and y1 = clamp_coord y1 in
  if x0 > x1 || y0 > y1 then empty else { x0; y0; x1; y1 }

let equal a b =
  (is_empty a && is_empty b)
  || (a.x0 = b.x0 && a.y0 = b.y0 && a.x1 = b.x1 && a.y1 = b.y1)

let contains rect ~bx ~by =
  (not (is_empty rect))
  && bx >= rect.x0 && bx <= rect.x1 && by >= rect.y0 && by <= rect.y1

let intersect a b =
  if is_empty a || is_empty b then None
  else
    let x0 = max a.x0 b.x0 and y0 = max a.y0 b.y0 in
    let x1 = min a.x1 b.x1 and y1 = min a.y1 b.y1 in
    if x0 > x1 || y0 > y1 then None else Some { x0; y0; x1; y1 }

let union a b =
  if is_empty a then b
  else if is_empty b then a
  else
    {
      x0 = min a.x0 b.x0;
      y0 = min a.y0 b.y0;
      x1 = max a.x1 b.x1;
      y1 = max a.y1 b.y1;
    }

let around ~center_x ~center_y ~radius =
  let radius = max 0 radius in
  make ~x0:(center_x - radius) ~y0:(center_y - radius)
    ~x1:(center_x + radius) ~y1:(center_y + radius)

let expand rect ~margin =
  if is_empty rect then empty
  else
    let margin = max 0 margin in
    make ~x0:(rect.x0 - margin) ~y0:(rect.y0 - margin)
      ~x1:(rect.x1 + margin) ~y1:(rect.y1 + margin)

(* Boards that overlap a viewport starting at (left, top) and spanning
   [visible_w] x [visible_h] boards. A board counts as visible if any part of
   it is on screen. *)
let of_view ~left ~top ~visible_w ~visible_h =
  if visible_w <= 0. || visible_h <= 0. then empty
  else
    let x0 = int_of_float (floor left) in
    let y0 = int_of_float (floor top) in
    let x1 = int_of_float (ceil (left +. visible_w)) - 1 in
    let y1 = int_of_float (ceil (top +. visible_h)) - 1 in
    make ~x0 ~y0 ~x1 ~y1

let iter rect f =
  if not (is_empty rect) then
    for y = rect.y0 to rect.y1 do
      for x = rect.x0 to rect.x1 do
        f x y
      done
    done

let fold rect f init =
  if is_empty rect then init
  else begin
    let acc = ref init in
    for y = rect.y0 to rect.y1 do
      for x = rect.x0 to rect.x1 do
        acc := f x y !acc
      done
    done;
    !acc
  end

let to_list rect =
  fold rect (fun x y acc -> (x, y) :: acc) [] |> List.rev

(* [a] minus [b], decomposed into at most four rectangles. *)
let diff a b =
  if is_empty a then []
  else
    match intersect a b with
    | None -> [ a ]
    | Some i ->
      let out = ref [] in
      let add rect = if not (is_empty rect) then out := rect :: !out in
      if a.y0 < i.y0 then
        add (make ~x0:a.x0 ~y0:a.y0 ~x1:a.x1 ~y1:(i.y0 - 1));
      if a.y1 > i.y1 then
        add (make ~x0:a.x0 ~y0:(i.y1 + 1) ~x1:a.x1 ~y1:a.y1);
      if a.x0 < i.x0 then
        add (make ~x0:a.x0 ~y0:i.y0 ~x1:(i.x0 - 1) ~y1:i.y1);
      if a.x1 > i.x1 then
        add (make ~x0:(i.x1 + 1) ~y0:i.y0 ~x1:a.x1 ~y1:i.y1);
      List.rev !out
