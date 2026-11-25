open Brr
open Brr_canvas
open Sim_map_client_core

(* 216 px boards are a comfortable zoom: three fit vertically in a 700 px
   window, while larger screens show more context. *)
let base_board_px = 216.
let device_pixel_ratio = ref 1.
let zoom = ref 1.
let board_px () = base_board_px *. !device_pixel_ratio *. !zoom
let cell_px () = board_px () /. 8.
let max_coord = 999
let empty = '\000'
(* At the widest zoom-out, never show more than this many boards along either
   axis. On a rectangular viewport the larger axis reaches the limit and the
   other shows fewer. *)
let max_view_boards = 10.

(* ------------------------------------------------------------------------- *)
(* Client state                                                              *)
(* ------------------------------------------------------------------------- *)

type board_state = Board_cache.board_state = {
  bx : int;
  by : int;
  mutable pieces : Bytes.t; (* 64 one-byte client pieces *)
  mutable revision : int64;
  mutable loaded : bool;
  mutable stale : bool;
}

let cache_capacity = 900
let window_radius = 12
let prefetch_margin = 2
let max_inflight_batches = 1
let batch_timeout_ms = 1_000.
let reconcile_interval_ms = 40.

type drag = {
  state : board_state;
  from : int;
  piece_byte : char;
  piece : char; (* glyph for the floating piece *)
  x : float;
  y : float;
}

type pan = {
  start_cx : float;
  start_cy : float;
  start_left : float;
  start_top : float;
}

type normal_undo = {
  src_state : board_state;
  dst_state : board_state;
  src : int;
  dst : int;
  src_piece : char;
  dst_piece : char;
}

type castle_info = {
  king_src_state : board_state;
  king_dst_state : board_state;
  rook_src_state : board_state;
  rook_dst_state : board_state;
  king_src : int;
  king_dst : int;
  rook_src : int;
  rook_dst : int;
  king_piece : char;
  rook_piece : char;
}

type en_passant_info = {
  src_state : board_state;
  dst_state : board_state;
  captured_state : board_state;
  src : int;
  dst : int;
  captured : int;
  pawn_piece : char;
}

type special_action =
  | Castle of castle_info
  | En_passant of en_passant_info

type pending_action =
  | Normal of normal_undo
  | Special of special_action

type pending = {
  request_id : int32;
  action : pending_action;
  mutable event_applied : bool;
  sent_at : float;
  mutable last_probe : float;
}

type piece_info_request_state = {
  request_id : int32;
  pi_bx : int;
  pi_by : int;
  pi_sq : int;
  sent_at : float;
}

type click_streak = {
  cs_bx : int;
  cs_by : int;
  cs_sq : int;
  cs_last : float;
  cs_count : int;
}

let board_key bx by = (by * 1000) + bx
let clamp_int v lo hi = max lo (min hi v)
let clamp_float v lo hi = max lo (min hi v)


let glyph_of_byte byte =
  if byte = empty then empty
  else
    let code = (Char.code byte lsr 1) land 7 in
    let glyph =
      match code with
      | 1 -> 'P'
      | 2 -> 'B'
      | 3 -> 'N'
      | 4 -> 'R'
      | 5 -> 'Q'
      | 6 -> 'K'
      | _ -> '?'
    in
    if Char.code byte land 1 = 1 then glyph
    else Char.lowercase_ascii glyph

let on_original_board byte = Char.code byte land 0x10 <> 0
let en_passantable byte = Char.code byte land 0x20 <> 0
let piece_type_code byte = (Char.code byte lsr 1) land 7
let white_byte byte = Char.code byte land 1 = 1

let piece_glyphs =
  [| "\xe2\x99\x9f"; "\xe2\x99\x9e"; "\xe2\x99\x9d";
     "\xe2\x99\x9c"; "\xe2\x99\x9b"; "\xe2\x99\x9a" |]

let piece_index = function
  | 'p' | 'P' -> 0
  | 'n' | 'N' -> 1
  | 'b' | 'B' -> 2
  | 'r' | 'R' -> 3
  | 'q' | 'Q' -> 4
  | _ -> 5

let atlas_cell_px = 512

let draw_piece ctx atlas piece x y size =
  let i = piece_index piece in
  let row = if Char.uppercase_ascii piece = piece then 0 else 1 in
  let cell = float atlas_cell_px in
  C2d.draw_sub_image_in_rect ctx atlas
    ~sx:(float (i * atlas_cell_px)) ~sy:(float (row * atlas_cell_px))
    ~sw:cell ~sh:cell ~x ~y ~w:size ~h:size

(* ------------------------------------------------------------------------- *)
(* Persistent player colour                                                  *)
(* ------------------------------------------------------------------------- *)

type player_colour = White | Black

let colour_key = "sim-map.player-colour"
let colour_cookie = "sim-map-colour"
let colour_name = function White -> "white" | Black -> "black"

let colour_of_string = function
  | "white" -> Some White
  | "black" -> Some Black
  | _ -> None

let random_colour () =
  let math = Jv.get Jv.global "Math" in
  let value = Jv.call' math (Jstr.v "random") [||] in
  if Jv.to_float value < 0.5 then White else Black

let storage_get key =
  try
    let storage = Jv.get Jv.global "localStorage" in
    let value : Jv.t =
      Jv.call' storage (Jstr.v "getItem") [| Jv.of_string key |]
    in
    if Jv.is_none value then None else Some (Jv.to_string value)
  with _ -> None

let storage_set key value =
  try
    let storage = Jv.get Jv.global "localStorage" in
    ignore
      (Jv.call' storage (Jstr.v "setItem")
         [| Jv.of_string key; Jv.of_string value |])
  with _ -> ()

let cookie_get name =
  try
    let document = Jv.get Jv.global "document" in
    let cookie = Jv.to_string (Jv.get document "cookie") in
    let prefix = name ^ "=" in
    let rec find = function
      | [] -> None
      | part :: rest ->
        let part = String.trim part in
        if
          String.length part >= String.length prefix
          && String.sub part 0 (String.length prefix) = prefix
        then
          Some
            (String.sub part (String.length prefix)
               (String.length part - String.length prefix))
        else find rest
    in
    find (String.split_on_char ';' cookie)
  with _ -> None

let cookie_set name value =
  try
    let document = Jv.get Jv.global "document" in
    let cookie =
      Printf.sprintf "%s=%s; Max-Age=315360000; Path=/; SameSite=Lax" name
        value
    in
    Jv.set document "cookie" (Jv.of_string cookie)
  with _ -> ()

(* Assign once and never re-roll. The first valid value in local storage wins;
   the cookie is the backup so clearing one store does not change the colour.
   Both stores are reconciled to the chosen value. *)
let assigned_colour () =
  let from_storage =
    match storage_get colour_key with
    | Some value -> colour_of_string value
    | None -> None
  in
  let stored =
    match from_storage with
    | Some _ -> from_storage
    | None ->
      (match cookie_get colour_cookie with
       | Some value -> colour_of_string value
       | None -> None)
  in
  let colour =
    match stored with Some colour -> colour | None -> random_colour ()
  in
  (match storage_get colour_key with
   | Some value when colour_of_string value = Some colour -> ()
   | _ -> storage_set colour_key (colour_name colour));
  (match cookie_get colour_cookie with
   | Some value when colour_of_string value = Some colour -> ()
   | _ -> cookie_set colour_cookie (colour_name colour));
  colour

(* ------------------------------------------------------------------------- *)
(* Main                                                                      *)
(* ------------------------------------------------------------------------- *)

let random_request_id () =
  let math = Jv.get Jv.global "Math" in
  let value : Jv.t = Jv.call' math (Jstr.v "random") [||] in
  let r = Jv.to_float value in
  Int32.of_float (1. +. (r *. 2_147_483_646.))

let main () =
  let canvas_el =
    match Document.find_el_by_id G.document (Jstr.v "game") with
    | Some el -> el
    | None -> failwith "Could not find #game canvas"
  in
  let canvas = Canvas.of_el canvas_el in
  let ctx = C2d.get_context canvas in
  let canvas_w = ref 1 and canvas_h = ref 1 in
  let visible_w () = float !canvas_w /. board_px () in
  let visible_h () = float !canvas_h /. board_px () in
  let max_left () = max 0. (1000. -. visible_w ()) in
  let max_top () = max 0. (1000. -. visible_h ()) in
  let set_canvas_size () =
    let ratio = max 1. (Window.device_pixel_ratio G.window) in
    device_pixel_ratio := ratio;
    let w =
      max 1
        (int_of_float (float (Window.inner_width G.window) *. ratio))
    in
    let h =
      max 1
        (int_of_float (float (Window.inner_height G.window) *. ratio))
    in
    if w <> !canvas_w || h <> !canvas_h then begin
      canvas_w := w;
      canvas_h := h;
      Canvas.set_w canvas w;
      Canvas.set_h canvas h
    end
  in
  set_canvas_size ();
  (* Zoom may never fall below the level that fits [max_view_boards] across
     the longer viewport axis. This also lifts the initial zoom on very large
     screens, where zoom 1 would already show more than ten boards. *)
  let min_zoom () =
    let ratio = max 1. !device_pixel_ratio in
    max 0.35
      (max (float !canvas_w) (float !canvas_h)
      /. (max_view_boards *. base_board_px *. ratio))
  in
  zoom := max !zoom (min_zoom ());
  let body_el = Document.body G.document in
  let find_el id =
    match Document.find_el_by_id G.document (Jstr.v id) with
    | Some el -> el
    | None -> failwith ("Could not find #" ^ id)
  in
  let colour_el = find_el "colour" in
  let coords_el = find_el "coords" in
  let status_el = find_el "status" in
  let piece_info_el = find_el "piece-info" in
  let piece_info_title_el = find_el "piece-info-title" in
  let piece_info_body_el = find_el "piece-info-body" in
  let piece_info_close_el = find_el "piece-info-close" in
  let colour = assigned_colour () in
  let colour_label =
    match colour with White -> "White" | Black -> "Black"
  in
  let owns_piece byte =
    match colour with
    | White -> white_byte byte
    | Black -> not (white_byte byte)
  in
  El.set_children colour_el [ El.txt (Jstr.v colour_label) ];
  El.set_at (Jstr.v "data-colour")
    (Some (Jstr.v (colour_name colour)))
    colour_el;
  El.set_at (Jstr.v "data-colour")
    (Some (Jstr.v (colour_name colour)))
    body_el;
  let set_status label kind =
    El.set_children status_el [ El.txt (Jstr.v label) ];
    El.set_at (Jstr.v "data-status") (Some (Jstr.v kind)) status_el
  in
  let set_move_pending pending =
    El.set_at (Jstr.v "data-move-pending")
      (if pending then Some (Jstr.v "true") else None)
      body_el
  in

  let query_coord name default =
    let location = Jv.get Jv.global "location" in
    let search = Jstr.to_string (Jv.Jstr.get location "search") in
    let body =
      if String.length search > 0 && search.[0] = '?' then
        String.sub search 1 (String.length search - 1)
      else search
    in
    let rec find = function
      | [] -> default
      | part :: rest ->
        (match String.index_opt part '=' with
         | Some i when String.sub part 0 i = name ->
           let value =
             String.sub part (i + 1) (String.length part - i - 1)
           in
           (match int_of_string_opt value with
            | Some n -> clamp_int n 0 max_coord
            | None -> default)
         | _ -> find rest)
    in
    find (String.split_on_char '&' body)
  in


  let light = C2d.color (Jstr.v "#f0d9b5") in
  let dark = C2d.color (Jstr.v "#b58863") in
  let page_bg = C2d.color (Jstr.v "#1b1b1b") in
  let src_hl = C2d.color (Jstr.v "rgba(255, 235, 59, 0.45)") in
  let dst_hl = C2d.color (Jstr.v "rgba(20, 85, 30, 0.45)") in

  (* One board tile blit replaces 64 per-square fills on every frame. Render
     the tile at 3x so it stays crisp when the user zooms in. *)
  let tile_px = int_of_float (base_board_px *. 3.) in
  let tile_cell = float tile_px /. 8. in
  let board_canvas = Canvas.create ~w:tile_px ~h:tile_px [] in
  let board_ctx = C2d.get_context board_canvas in
  C2d.set_image_smoothing_enabled board_ctx true;
  C2d.set_image_smoothing_quality board_ctx
    C2d.Image_smoothing_quality.high;
  for row = 0 to 7 do
    for col = 0 to 7 do
      C2d.set_fill_style board_ctx
        (if (row + col) land 1 = 0 then light else dark);
      C2d.fill_rect board_ctx
        ~x:(float col *. tile_cell) ~y:(float row *. tile_cell)
        ~w:tile_cell ~h:tile_cell
    done
  done;
  (* A 3-pixel inner border becomes one CSS pixel at the default zoom. *)
  let border = C2d.color (Jstr.v "rgba(25, 18, 12, 0.72)") in
  C2d.set_fill_style board_ctx border;
  let edge = float tile_px in
  C2d.fill_rect board_ctx ~x:0. ~y:0. ~w:edge ~h:3.;
  C2d.fill_rect board_ctx ~x:0. ~y:(edge -. 3.) ~w:edge ~h:3.;
  C2d.fill_rect board_ctx ~x:0. ~y:0. ~w:3. ~h:edge;
  C2d.fill_rect board_ctx ~x:(edge -. 3.) ~y:0. ~w:3. ~h:edge;
  let board_tile = C2d.image_src_of_el (Canvas.to_el board_canvas) in

  let atlas_canvas =
    Canvas.create ~w:(6 * atlas_cell_px) ~h:(2 * atlas_cell_px) []
  in
  let atlas_ctx = C2d.get_context atlas_canvas in
  C2d.set_image_smoothing_enabled atlas_ctx true;
  C2d.set_image_smoothing_quality atlas_ctx
    C2d.Image_smoothing_quality.high;
  C2d.set_text_align atlas_ctx C2d.Text_align.center;
  C2d.set_text_baseline atlas_ctx C2d.Text_baseline.alphabetic;
  C2d.set_font atlas_ctx
    (Jstr.v
       "400px 'Noto Sans Symbols 2', 'DejaVu Sans', 'Segoe UI Symbol', serif");
  let white_fill = C2d.color (Jstr.v "#ffffff") in
  let black_fill = C2d.color (Jstr.v "#101114") in
  let white_stroke = C2d.color (Jstr.v "#24262b") in
  let black_stroke = C2d.color (Jstr.v "#f4f4f4") in
  let draw_glyph row glyph i =
    let m = C2d.measure_text atlas_ctx (Jstr.v glyph) in
    let ascent =
      max 0. (C2d.Text_metrics.actual_bounding_box_ascent m)
    and descent =
      max 0. (C2d.Text_metrics.actual_bounding_box_descent m)
    in
    let cx = (float (i * atlas_cell_px)) +. (float atlas_cell_px /. 2.)
    and cy = (float (row * atlas_cell_px)) +. (float atlas_cell_px /. 2.) in
    let y = cy +. ((ascent -. descent) /. 2.) +. (float atlas_cell_px *. 0.03) in
    let key = Jstr.v glyph in
    if row = 0 then begin
      C2d.set_fill_style atlas_ctx white_fill;
      C2d.set_stroke_style atlas_ctx white_stroke;
      C2d.set_line_width atlas_ctx 14.;
      C2d.fill_text atlas_ctx key ~x:cx ~y;
      C2d.stroke_text atlas_ctx key ~x:cx ~y
    end
    else begin
      C2d.set_fill_style atlas_ctx black_fill;
      C2d.set_stroke_style atlas_ctx black_stroke;
      C2d.set_line_width atlas_ctx 6.;
      C2d.fill_text atlas_ctx key ~x:cx ~y;
      C2d.stroke_text atlas_ctx key ~x:cx ~y
    end
  in
  Array.iteri (fun i glyph -> draw_glyph 0 glyph i) piece_glyphs;
  Array.iteri (fun i glyph -> draw_glyph 1 glyph i) piece_glyphs;
  let fallback_atlas = C2d.image_src_of_el (Canvas.to_el atlas_canvas) in
  let atlas = ref fallback_atlas in
  let atlas_image =
    El.img ~at:[ At.src (Jstr.v "/static/pieces.png") ] ()
  in

  let cache = Board_cache.create ~capacity:cache_capacity () in
  let tracker = Request_tracker.create ~max_inflight:max_inflight_batches () in
  let pending_piece_info : piece_info_request_state option ref = ref None in
  let piece_info_target : (int * int * int) option ref = ref None in
  let piece_info_data : Protocol.Types.piece_info option ref = ref None in
  let click_streak : click_streak option ref = ref None in
  let pointer_down_at : (float * float) option ref = ref None in
  (* Load telemetry. The browser tests assert the board count, batch count and
     bytes transferred, and the new panning test reads the cache counters. *)
  let snapshot_batches = ref 0 in
  let snapshot_bytes = ref 0 in
  let load_started = ref 0. in
  let load_finished = ref 0. in
  let initial_load_area = ref 0 in
  let batch_failures = ref 0 in
  let subscription_adds = ref 0 in
  let subscription_removes = ref 0 in
  let subscription_windows = ref 0 in

  let view_left = ref 0. and view_top = ref 0. in
  let drag : drag option ref = ref None in
  let panning : pan option ref = ref None in
  let pending : pending option ref = ref None in
  let ws = ref None in
  let connected = ref false in
  let ever_connected = ref false in
  let next_request_id = ref (random_request_id ()) in
  let expire_move_hook = ref (fun () -> ()) in
  let visible_rect = ref Viewport.empty in
  let useful_rect = ref Viewport.empty in
  let last_reconcile = ref 0. in
  let reconcile_timer_pending = ref false in
  let retry_at = ref 0. in
  let batch_backoff = ref 250. in
  let window_batch_supported = ref true in
  let window_batch_success = ref false in
  let window_batch_failures = ref 0 in

  let centre_of_view () =
    ( clamp_int
        (int_of_float (floor (!view_left +. (visible_w () /. 2.))))
        0 max_coord,
      clamp_int
        (int_of_float (floor (!view_top +. (visible_h () /. 2.))))
        0 max_coord )
  in

  let needs_draw = ref true in
  let frame_pending = ref false in
  let last_coords = ref "" in
  let last_loading = ref "" in

  let origin_x = ref 0. and origin_y = ref 0. in
  let scale_x = ref 1. and scale_y = ref 1. in
  let update_layout () =
    origin_x := El.bound_x canvas_el;
    origin_y := El.bound_y canvas_el;
    scale_x := float !canvas_w /. max 1. (El.bound_w canvas_el);
    scale_y := float !canvas_h /. max 1. (El.bound_h canvas_el)
  in
  update_layout ();

  let to_canvas_of_mouse m =
    ( (Ev.Mouse.client_x m -. !origin_x) *. !scale_x,
      (Ev.Mouse.client_y m -. !origin_y) *. !scale_y )
  in

  let to_canvas ev =
    to_canvas_of_mouse (Ev.as_type ev |> Ev.Pointer.as_mouse)
  in

  let alloc_request_id () =
    let request_id = !next_request_id in
    next_request_id := Int32.succ request_id;
    request_id
  in

  let send_binary data =
    match !ws with
    | Some socket
      when Brr_io.Websocket.ready_state socket
           = Brr_io.Websocket.Ready_state.open' ->
      let len = Bytes.length data in
      let buffer = Tarray.Buffer.create len in
      let bytes = Tarray.uint8_of_buffer buffer |> Tarray.to_bigarray1 in
      for i = 0 to len - 1 do
        Bigarray.Array1.unsafe_set bytes i
          (Char.code (Bytes.unsafe_get data i))
      done;
      Brr_io.Websocket.send_array_buffer socket buffer;
      true
    | _ -> false
  in

  let bytes_of_buffer data =
    let length = Tarray.Buffer.byte_length data in
    let view = Tarray.Data_view.of_buffer data in
    let bytes = Bytes.create length in
    for i = 0 to length - 1 do
      Bytes.set bytes i (Char.chr (Tarray.Data_view.get_uint8 view i))
    done;
    bytes
  in

  let current_visible () =
    Viewport.of_view ~left:!view_left ~top:!view_top
      ~visible_w:(visible_w ()) ~visible_h:(visible_h ())
  in

  let current_useful () =
    let center_x, center_y = centre_of_view () in
    Viewport.expand
      (Viewport.around ~center_x ~center_y ~radius:window_radius)
      ~margin:prefetch_margin
  in

  let is_visible_key key =
    let bx = key mod 1000 and by = key / 1000 in
    Viewport.contains !visible_rect ~bx ~by
  in

  (* Visible boards are never evicted. Prefetch and old-window boards are
     ordinary LRU candidates even while their request is in flight; dropping a
     prefetched response is safe because it is re-fetched if it becomes
     useful. *)
  let protected_key key = is_visible_key key in

  let make_room needed =
    let target = max 0 (cache_capacity - max 0 needed) in
    if Board_cache.length cache > target then
      ignore (Board_cache.evict_to cache ~target ~protected:protected_key)
  in

  let state_of bx by =
    let key = board_key bx by in
    match Board_cache.find cache key with
    | Some state -> state
    | None ->
      make_room 1;
      if Board_cache.length cache >= cache_capacity then
        (* All remaining entries are visible. This cannot happen with the
           configured viewport bounds, but keep the cache hard-bounded. *)
        {
          bx;
          by;
          pieces = Bytes.make 64 '\000';
          revision = 0L;
          loaded = false;
          stale = true;
        }
      else Board_cache.get_or_create cache ~bx ~by
  in

  let update_stats () =
    let vis = !visible_rect in
    let use = !useful_rect in
    let visible_loaded, visible_total, visible_missing =
      Snapshot_plan.progress cache vis
    in
    let _, _, prefetch_missing = Snapshot_plan.progress cache use in
    let set name value =
      El.set_at (Jstr.v name) (Some (Jstr.v (string_of_int value))) body_el
    in
    set "data-loaded-boards" (Board_cache.loaded_count cache);
    set "data-cache-occupancy" (Board_cache.length cache);
    set "data-cache-peak" (Board_cache.peak cache);
    set "data-cache-capacity" (Board_cache.capacity cache);
    set "data-cache-hits" (Board_cache.hits cache);
    set "data-cache-misses" (Board_cache.misses cache);
    set "data-cache-evictions" (Board_cache.evictions cache);
    set "data-visible-boards" visible_total;
    set "data-visible-loaded" visible_loaded;
    set "data-visible-missing" visible_missing;
    set "data-prefetch-boards" (Viewport.area use);
    set "data-prefetch-missing" prefetch_missing;
    set "data-inflight-batches" (Request_tracker.batch_count tracker);
    set "data-inflight-boards" (Request_tracker.board_count tracker);
    set "data-subscription-adds" !subscription_adds;
    set "data-subscription-removes" !subscription_removes;
    set "data-subscription-windows" !subscription_windows;
    set "data-batch-failures" !batch_failures;
    set "data-window-batch-supported"
      (if !window_batch_supported then 1 else 0);
    if
      !load_started > 0. && !load_finished = 0. && !initial_load_area > 0
    then begin
      let loaded_useful, _, _ = Snapshot_plan.progress cache use in
      if loaded_useful >= !initial_load_area then begin
        load_finished := Performance.now_ms G.performance;
        El.set_at (Jstr.v "data-load-ms")
          (Some (Jstr.of_float (!load_finished -. !load_started)))
          body_el
      end
    end
  in

  let send_batch_rect rect =
    let keys =
      Viewport.to_list rect
      |> List.map (fun (bx, by) -> (by * 1000) + bx)
    in
    if keys = [] then false
    else
      let request_id = alloc_request_id () in
      let now = Performance.now_ms G.performance in
      let reset = !window_batch_supported in
      if
        Request_tracker.begin_batch ~reset tracker ~id:request_id ~rect
          ~keys ~sent_at:now
      then begin
        let center_x, center_y = centre_of_view () in
        let request : Protocol.Types.snapshot_batch_window_request =
          {
            request_id;
            x0 = rect.x0;
            y0 = rect.y0;
            x1 = rect.x1;
            y1 = rect.y1;
            center_x;
            center_y;
            radius = window_radius + prefetch_margin;
          }
        in
        let bytes =
          if reset then
            Protocol.Types.snapshot_batch_window_request_to_bytes request
          else
            Protocol.Types.snapshot_batch_request_to_bytes
              Protocol.Types.
                {
                  request_id;
                  x0 = rect.x0;
                  y0 = rect.y0;
                  x1 = rect.x1;
                  y1 = rect.y1;
                }
        in
        if send_binary bytes then begin
          if !load_started = 0. then load_started := now;
          if reset then begin
            incr subscription_windows;
            (* The server atomically replaced the subscription set with the
               current useful window. Boards cached outside it will no longer
               receive live events, so mark them stale; they are re-requested
               (and re-subscribed) if they become useful again. *)
            Board_cache.iter
              (fun key _state ->
                let bx = key mod 1000 and by = key / 1000 in
                if
                  not
                    (Viewport.contains !useful_rect ~bx ~by)
                then Board_cache.mark_stale cache key)
              cache
          end;
          true
        end
        else begin
          ignore (Request_tracker.fail tracker request_id);
          false
        end
      end
      else false
  in

  let plan_priority vis rect =
    match Viewport.intersect vis rect with
    | None -> 0
    | Some overlap -> Viewport.area overlap
  in

  let reconcile ?(force = false) () =
    let now = Performance.now_ms G.performance in
    if force || now -. !last_reconcile >= reconcile_interval_ms then begin
      last_reconcile := now;
      let vis = current_visible () in
      let use = current_useful () in
      visible_rect := vis;
      useful_rect := use;
      (* Maintain recency for currently useful boards and account for cache
         hits and misses once per reconciliation. *)
      Viewport.iter use (fun bx by ->
          let key = board_key bx by in
          if Board_cache.find_loaded cache key <> None then
            Board_cache.note_hit cache
          else Board_cache.note_miss cache;
          Board_cache.touch cache key);
      make_room 0;
      let slots =
        Request_tracker.max_inflight tracker
        - Request_tracker.batch_count tracker
      in
      if slots > 0 && now >= !retry_at && !pending = None then begin
        let is_inflight = Request_tracker.is_in_flight tracker in
        let rects = Snapshot_plan.rectangles cache use ~is_inflight in
        let rects =
          List.sort
            (fun a b ->
              let pa = plan_priority vis a and pb = plan_priority vis b in
              if pa <> pb then compare pb pa
              else compare (Viewport.area b) (Viewport.area a))
            rects
        in
        if !initial_load_area = 0 && not (Viewport.is_empty use) then
          initial_load_area := Viewport.area use;
        let sent = ref 0 in
        List.iter
          (fun rect ->
            if !sent < slots && send_batch_rect rect then incr sent)
          rects
      end;
      update_stats ()
    end
  in

  let schedule_reconcile () =
    if not !reconcile_timer_pending then begin
      reconcile_timer_pending := true;
      ignore
        (G.set_timeout ~ms:(int_of_float reconcile_interval_ms) (fun () ->
             reconcile_timer_pending := false;
             reconcile ~force:true ()))
    end
  in

  (* Some Chromium builds defer dispatching a WebSocket message until the page
     sends again. A move leaves the client with no other traffic, so use a
     harmless snapshot request as a liveness probe: request id 0 is reserved
     for probes, and refreshing the centre board is useful even when the probe
     is not needed for liveness. *)
  let send_probe () =
    let board_x, board_y = centre_of_view () in
    let request : Protocol.Types.snapshot_request =
      { request_id = 0l; board_x; board_y }
    in
    ignore (send_binary (Protocol.Types.snapshot_request_to_bytes request))
  in
  ignore
    (G.set_interval ~ms:250 (fun () ->
         let now = Performance.now_ms G.performance in
         (match !pending_piece_info with
          | Some pending when now -. pending.sent_at > 3_000. ->
            pending_piece_info := None;
            (match !piece_info_target with
             | Some _ ->
               El.set_children piece_info_body_el
                 [ El.txt (Jstr.v "Piece information request timed out.") ]
             | None -> ())
          | _ -> ());
         let due =
           Request_tracker.due tracker ~now ~timeout:batch_timeout_ms
         in
         if due <> [] then begin
           List.iter
             (fun (batch : Request_tracker.batch) ->
               if batch.reset then incr window_batch_failures;
               ignore (Request_tracker.fail tracker batch.id);
               incr batch_failures)
             due;
           if
             (not !window_batch_success)
             && !window_batch_failures >= 3
           then begin
             (* An older server does not understand the 18-byte window batch.
                Fall back to the compatible 13-byte request so a stale cached
                client cannot leave the viewport blank indefinitely. *)
             window_batch_supported := false;
             Console.(
               log
                 [ Jstr.v
                     "server does not support atomic window batches; falling back" ])
           end;
           batch_backoff := min 2_000. (!batch_backoff *. 2.);
           retry_at := now +. !batch_backoff;
           reconcile ~force:true ()
         end;
         (* Recover from a failed/empty batch after its backoff, or from any
            other missed planning turn. This is the watchdog that guarantees
            every visible missing board has a completion path. *)
         if now >= !retry_at then reconcile ();
         (match !pending with
          | Some p when now -. p.sent_at > 2000. -> !expire_move_hook ()
          | Some p when now -. p.last_probe > 250. ->
            (* Probe a pending move so a browser that defers message dispatch
               releases the response/event instead of holding it until the
               next unrelated send. *)
            p.last_probe <- now;
            send_probe ()
          | _ -> ())));

  let board_at_canvas x y =
    let wx = !view_left +. (x /. board_px ()) in
    let wy = !view_top +. (y /. board_px ()) in
    if wx < 0. || wy < 0. || wx >= 1000. || wy >= 1000. then None
    else
      let bx = int_of_float (floor wx) in
      let by = int_of_float (floor wy) in
      let col =
        clamp_int (int_of_float ((wx -. float bx) *. 8.)) 0 7
      in
      let row =
        clamp_int (int_of_float ((wy -. float by) *. 8.)) 0 7
      in
      Some (bx, by, col, row)
  in

  let rec request_draw () =
    needs_draw := true;
    if not !frame_pending then begin
      frame_pending := true;
      ignore
        (G.request_animation_frame (fun _ ->
           frame_pending := false;
           if !needs_draw then begin
             needs_draw := false;
             draw ()
           end))
    end

  and draw () =
    let centre_x, centre_y = centre_of_view () in
    let coords = Printf.sprintf "(%d, %d)" centre_x centre_y in
    if coords <> !last_coords then begin
      last_coords := coords;
      El.set_children coords_el [ El.txt (Jstr.v coords) ]
    end;
    let vis = if Viewport.is_empty !visible_rect then current_visible () else !visible_rect in
    let _, _, visible_missing = Snapshot_plan.progress cache vis in
    if visible_missing > 0 && !connected then begin
      let label = Printf.sprintf "Loading %d" visible_missing in
      if label <> !last_loading then begin
        last_loading := label;
        set_status label "connecting"
      end
    end
    else if !last_loading <> "" && !connected then begin
      last_loading := "";
      set_status "Live" "live"
    end;
    El.set_at (Jstr.v "data-view-left")
      (Some (Jstr.of_float !view_left)) body_el;
    El.set_at (Jstr.v "data-view-top")
      (Some (Jstr.of_float !view_top)) body_el;
    El.set_at (Jstr.v "data-zoom")
      (Some (Jstr.of_float !zoom)) body_el;
    El.set_at (Jstr.v "data-widest-boards")
      (Some
         (Jstr.of_float (max (visible_w ()) (visible_h ()))))
      body_el;
    C2d.set_fill_style ctx page_bg;
    C2d.fill_rect ctx ~x:0. ~y:0. ~w:(float !canvas_w)
      ~h:(float !canvas_h);

    let x_first = max 0 (int_of_float (floor !view_left)) in
    let x_last =
      min max_coord
        (int_of_float (floor (!view_left +. visible_w ())))
    in
    let y_first = max 0 (int_of_float (floor !view_top)) in
    let y_last =
      min max_coord
        (int_of_float (floor (!view_top +. visible_h ())))
    in

    (* Board tiles first: one blit per board. *)
    for by = y_first to y_last do
      for bx = x_first to x_last do
        let ox = (float bx -. !view_left) *. board_px () in
        let oy = (float by -. !view_top) *. board_px () in
        C2d.draw_image_in_rect ctx board_tile ~x:ox ~y:oy
          ~w:(board_px ()) ~h:(board_px ())
      done
    done;

    (* Drag highlights. *)
    (match !drag with
     | None -> ()
     | Some d ->
       let ox = (float d.state.bx -. !view_left) *. board_px () in
       let oy = (float d.state.by -. !view_top) *. board_px () in
       let col = d.from mod 8 and row = d.from / 8 in
       C2d.set_fill_style ctx src_hl;
       C2d.fill_rect ctx
         ~x:(ox +. (float col *. cell_px ()))
         ~y:(oy +. (float row *. cell_px ()))
         ~w:(cell_px ()) ~h:(cell_px ());
       (match board_at_canvas d.x d.y with
        | Some (bx, by, col, row) ->
          let target = state_of bx by in
          let dst = (row * 8) + col in
          if
            target.loaded
            && (bx <> d.state.bx || by <> d.state.by || dst <> d.from)
          then begin
            let ox = (float bx -. !view_left) *. board_px () in
            let oy = (float by -. !view_top) *. board_px () in
            C2d.set_fill_style ctx dst_hl;
            C2d.fill_rect ctx
              ~x:(ox +. (float col *. cell_px ()))
              ~y:(oy +. (float row *. cell_px ()))
              ~w:(cell_px ()) ~h:(cell_px ())
          end
        | None -> ()));

    (* Pieces. *)
    for by = y_first to y_last do
      for bx = x_first to x_last do
        match Board_cache.find cache (board_key bx by) with
        | None -> ()
        | Some state ->
          if state.loaded then begin
            let ox = (float bx -. !view_left) *. board_px () in
            let oy = (float by -. !view_top) *. board_px () in
            for i = 0 to 63 do
              let piece = Bytes.unsafe_get state.pieces i in
              if piece <> empty then
                match !drag with
                | Some d when d.state == state && d.from = i -> ()
                | _ ->
                  draw_piece ctx !atlas (glyph_of_byte piece)
                    (ox +. (float (i mod 8) *. cell_px ()))
                    (oy +. (float (i / 8) *. cell_px ()))
                    (cell_px ())
            done
          end
      done
    done;

    match !drag with
    | None -> ()
    | Some d ->
      draw_piece ctx !atlas d.piece (d.x -. (cell_px () /. 2.))
        (d.y -. (cell_px () /. 2.)) (cell_px ());
    update_stats ()
  in

  ignore
    (Ev.listen Ev.load
       (fun _ ->
         atlas := C2d.image_src_of_el atlas_image;
         request_draw ())
       (El.as_target atlas_image));

  let select_center bx by =
    let left =
      clamp_float
        (float bx +. 0.5 -. (visible_w () /. 2.))
        0. (max_left ())
    in
    let top =
      clamp_float
        (float by +. 0.5 -. (visible_h () /. 2.))
        0. (max_top ())
    in
    view_left := left;
    view_top := top;
    visible_rect := current_visible ();
    reconcile ~force:true ();
    request_draw ()
  in

  let on_resize _ =
    let cx, cy = centre_of_view () in
    set_canvas_size ();
    zoom := max !zoom (min_zoom ());
    update_layout ();
    select_center cx cy
  in
  ignore (Ev.listen Ev.resize on_resize (Window.as_target G.window));

  let insert_snapshot ~bx ~by ~revision ~pieces =
    let key = board_key bx by in
    match Board_cache.find cache key with
    | Some state ->
      if Int64.compare revision state.revision >= 0 then begin
        state.pieces <- pieces;
        state.revision <- revision;
        state.loaded <- true;
        state.stale <- false;
        Board_cache.touch cache key
      end
    | None ->
      let useful = Viewport.contains !useful_rect ~bx ~by in
      if useful || Board_cache.length cache < cache_capacity then begin
        if Board_cache.length cache >= cache_capacity then make_room 1;
        if Board_cache.length cache < cache_capacity then begin
          let state = Board_cache.get_or_create cache ~bx ~by in
          if Int64.compare revision state.revision >= 0 then begin
            state.pieces <- pieces;
            state.revision <- revision;
            state.loaded <- true;
            state.stale <- false;
            Board_cache.touch cache key
          end
        end
      end
  in

  let apply_snapshot_batch ~bytes (batch : Protocol.Types.snapshot_batch) =
    incr snapshot_batches;
    snapshot_bytes := !snapshot_bytes + bytes;
    let count = Array.length batch.boards in
    if batch.width > 0 && batch.height > 0 && count = batch.width * batch.height
    then
      for index = 0 to count - 1 do
        let bx = batch.x0 + (index mod batch.width) in
        let by = batch.y0 + (index / batch.width) in
        let board = batch.boards.(index) in
        insert_snapshot ~bx ~by ~revision:board.revision
          ~pieces:board.pieces
      done;
    El.set_at (Jstr.v "data-snapshot-batches")
      (Some (Jstr.v (string_of_int !snapshot_batches)))
      body_el;
    El.set_at (Jstr.v "data-snapshot-bytes")
      (Some (Jstr.v (string_of_int !snapshot_bytes)))
      body_el;
    request_draw ()
  in

  let square_label square =
    let file = Char.chr (Char.code 'a' + (square mod 8)) in
    let rank = 8 - (square / 8) in
    Printf.sprintf "%c%d" file rank
  in

  let piece_type_name = function
    | 1 -> "Pawn"
    | 2 -> "Knight"
    | 3 -> "Bishop"
    | 4 -> "Rook"
    | 5 -> "Queen"
    | 6 -> "King"
    | 7 -> "Promoted pawn"
    | _ -> "Empty"
  in

  let yes_no value = if value then "yes" else "no" in
  let flag flags bit = flags land (1 lsl bit) <> 0 in

  let render_piece_info (info : Protocol.Types.piece_info) =
    let square = square_label info.square in
    let title =
      Printf.sprintf "Piece at (%d, %d) · %s" info.board_x info.board_y
        square
    in
    El.set_children piece_info_title_el [ El.txt (Jstr.v title) ];
    let body =
      match info.status with
      | Protocol.Types.Piece_absent ->
        Printf.sprintf "No piece on %s." square
      | Protocol.Types.Piece_found ->
        let flags = info.flags in
        let colour = if info.is_white then "White" else "Black" in
        let kind = piece_type_name info.type_code in
        let en_passant =
          if info.type_code = 1 then yes_no (flag flags 0) else "n/a"
        in
        let castling =
          if info.type_code = 4 || info.type_code = 6 then
            yes_no (info.move_count = 0)
          else "n/a"
        in
        let pad label value =
          Printf.sprintf "%-15s %s" label value
        in
        String.concat "\n"
          [
            pad "Position"
              (Printf.sprintf "board (%d, %d), %s" info.board_x
                 info.board_y square);
            (let original = (Int32.to_int info.id - 1) / 32 in
             pad "Original board"
               (Printf.sprintf "(%d, %d)" (original mod 1000)
                  (original / 1000)));
            pad "Colour" colour;
            pad "Type" kind;
            pad "Piece ID" (Int32.to_string info.id);
            pad "Moves" (string_of_int info.move_count);
            pad "Captures" (string_of_int info.capture_count);
            pad "On original" (yes_no (flag flags 7));
            pad "En passant" en_passant;
            pad "Castling" castling;
            pad "Adopted" (yes_no info.adopted);
            pad "Captured other" (yes_no (flag flags 6));
            pad "Killer flags"
              (Printf.sprintf "king=%s queen=%s adopted=%s"
                 (yes_no (flag flags 1 || flag flags 2))
                 (yes_no (flag flags 3 || flag flags 4))
                 (yes_no (flag flags 5)));
            pad "Revision" (Int64.to_string info.revision);
            pad "Raw" (Printf.sprintf "0x%Lx" info.raw);
          ]
    in
    El.set_children piece_info_body_el [ El.txt (Jstr.v body) ];
    El.set_at (Jstr.v "hidden") None piece_info_el
  in

  let request_piece_info bx by sq =
    let already_pending =
      match !pending_piece_info with
      | Some pending ->
        pending.pi_bx = bx && pending.pi_by = by && pending.pi_sq = sq
      | None -> false
    in
    if not already_pending then begin
      let request_id = alloc_request_id () in
      let request : Protocol.Types.piece_info_request =
        { request_id; board_x = bx; board_y = by; square = sq }
      in
      if send_binary (Protocol.Types.piece_info_request_to_bytes request) then
        pending_piece_info :=
          Some
            {
              request_id;
              pi_bx = bx;
              pi_by = by;
              pi_sq = sq;
              sent_at = Performance.now_ms G.performance;
            }
    end
  in

  let open_piece_info bx by sq =
    piece_info_target := Some (bx, by, sq);
    match !piece_info_data with
    | Some info
      when info.board_x = bx && info.board_y = by && info.square = sq ->
      render_piece_info info
    | _ ->
      El.set_children piece_info_title_el [ El.txt (Jstr.v "Piece") ];
      El.set_children piece_info_body_el
        [ El.txt (Jstr.v "Loading piece information...") ];
      El.set_at (Jstr.v "hidden") None piece_info_el;
      request_piece_info bx by sq
  in

  let close_piece_info () =
    piece_info_target := None;
    El.set_at (Jstr.v "hidden") (Some (Jstr.v "")) piece_info_el
  in

  ignore
    (Ev.listen Ev.click
       (fun ev ->
         let mouse = Ev.as_type ev in
         let cx, cy = to_canvas_of_mouse mouse in
         let moved =
           match !pointer_down_at with
           | Some (px, py) ->
             abs_float (cx -. px) > 4. || abs_float (cy -. py) > 4.
           | None -> false
         in
         pointer_down_at := None;
         if not moved then
           match board_at_canvas cx cy with
           | None -> ()
           | Some (bx, by, col, row) ->
             let sq = (row * 8) + col in
             let state = state_of bx by in
             if
               state.loaded
               && Bytes.unsafe_get state.pieces sq <> empty
             then begin
               let now = Performance.now_ms G.performance in
               let count =
                 match !click_streak with
                 | Some streak
                   when streak.cs_bx = bx && streak.cs_by = by
                        && streak.cs_sq = sq
                        && now -. streak.cs_last < 700. ->
                   streak.cs_count + 1
                 | _ -> 1
               in
               click_streak :=
                 Some
                   {
                     cs_bx = bx;
                     cs_by = by;
                     cs_sq = sq;
                     cs_last = now;
                     cs_count = count;
                   };
               if count = 2 then request_piece_info bx by sq;
               if count >= 3 then begin
                 open_piece_info bx by sq;
                 click_streak := None
               end
             end
             else click_streak := None)
       (El.as_target canvas_el));
  ignore
    (Ev.listen Ev.click
       (fun _ -> close_piece_info ())
       (El.as_target piece_info_close_el));
  ignore
    (Ev.listen Ev.keydown
       (fun ev ->
         if
           Jstr.equal
             (Ev.Keyboard.key (Ev.as_type ev))
             (Jstr.v "Escape")
         then close_piece_info ())
       (Window.as_target G.window));

  let apply_move_event (event : Protocol.Types.move_event) =
    let resync = ref false in
    let changed = ref false in
    List.iter
      (fun (board : Protocol.Types.event_board) ->
        let key = board_key board.board_x board.board_y in
        match Board_cache.find cache key with
        | Some state when state.loaded && not state.stale ->
          let revision = board.revision in
          let cmp = Int64.compare revision state.revision in
          if cmp <= 0 then
            (* Duplicate or older than the current cache. *)
            ()
          else if Int64.equal revision (Int64.succ state.revision) then begin
            List.iter
              (fun (change : Protocol.Types.event_change) ->
                if
                  change.square >= 0 && change.square < 64
                  && change.piece >= 0 && change.piece <= 255
                then
                  Bytes.unsafe_set state.pieces change.square
                    (Char.chr change.piece))
              board.changes;
            state.revision <- revision;
            Board_cache.touch cache key;
            changed := true
          end
          else begin
            (* A revision was skipped: discard the cache and re-snapshot. *)
            state.loaded <- false;
            state.stale <- true;
            resync := true
          end
        | _ -> ())
      event.boards;
    (match !pending with
     | Some p when p.request_id = event.request_id ->
       (* The server broadcasts events only for accepted moves, so our own
          event is authoritative. Release the optimistic lock even if the
          direct move response is delayed in the browser. *)
       p.event_applied <- true;
       pending := None;
       set_move_pending false
     | _ -> ());
    if !changed then request_draw ();
    if !resync then reconcile ~force:true ()
  in

  let send_move ~request_id ~expected_piece_id ~src_board ~dst_board src dst =
    let position (bx, by) sq =
      {
        Protocol.Types.board_x = bx;
        board_y = by;
        x = sq mod 8;
        y = sq / 8;
      }
    in
    let request =
      {
        Protocol.Types.request_id;
        expected_piece_id;
        move =
          {
            Protocol.Types.src = position src_board src;
            dst = position dst_board dst;
          };
      }
    in
    let data = Protocol.Types.move_request_to_bytes request in
    if send_binary data then begin
      Metrics.sent ();
      true
    end
    else false
  in

  let restore_normal (u : normal_undo) =
    Bytes.unsafe_set u.src_state.pieces u.src u.src_piece;
    Bytes.unsafe_set u.dst_state.pieces u.dst u.dst_piece
  in

  (* If neither the move response nor the move event arrives (a stalled
     connection, or a browser that delays message dispatch), roll the
     optimistic move back so the board does not stay locked. *)
  expire_move_hook :=
    (fun () ->
      match !pending with
      | Some p when Performance.now_ms G.performance -. p.sent_at > 2000. ->
        pending := None;
        set_move_pending false;
        if not p.event_applied then
          (match p.action with
           | Normal undo -> restore_normal undo
           | Special _ -> ());
        request_draw ()
      | _ -> ());

  let apply_castle (c : castle_info) =
    Bytes.unsafe_set c.king_src_state.pieces c.king_src empty;
    Bytes.unsafe_set c.rook_src_state.pieces c.rook_src empty;
    Bytes.unsafe_set c.king_dst_state.pieces c.king_dst c.king_piece;
    Bytes.unsafe_set c.rook_dst_state.pieces c.rook_dst c.rook_piece
  in

  let apply_en_passant (e : en_passant_info) =
    Bytes.unsafe_set e.src_state.pieces e.src empty;
    Bytes.unsafe_set e.captured_state.pieces e.captured empty;
    Bytes.unsafe_set e.dst_state.pieces e.dst e.pawn_piece
  in

  let on_pointer_down ev =
    update_layout ();
    if !pending = None then begin
      let cx, cy = to_canvas ev in
      pointer_down_at := Some (cx, cy);
      let button =
        Ev.as_type ev |> Ev.Pointer.as_mouse |> Ev.Mouse.button
      in
      let target = board_at_canvas cx cy in
      let drag_state =
        match target with
        | None -> None
        | Some (bx, by, col, row) ->
          let state = state_of bx by in
          let sq = (row * 8) + col in
          if
            state.loaded && Bytes.unsafe_get state.pieces sq <> empty
            && owns_piece (Bytes.unsafe_get state.pieces sq)
          then
            let byte = Bytes.unsafe_get state.pieces sq in
            Some (state, sq, byte)
          else None
      in
      match drag_state with
      | Some (state, sq, byte) when button = 0 ->
        drag :=
          Some
            {
              state;
              from = sq;
              piece_byte = byte;
              piece = glyph_of_byte byte;
              x = cx;
              y = cy;
            }
      | _ ->
        panning :=
          Some
            {
              start_cx = cx;
              start_cy = cy;
              start_left = !view_left;
              start_top = !view_top;
            }
    end
  in

  let on_pointer_move ev =
    match !panning with
    | Some p ->
      let cx, cy = to_canvas ev in
      let dx = (cx -. p.start_cx) /. board_px () in
      let dy = (cy -. p.start_cy) /. board_px () in
      view_left := clamp_float (p.start_left -. dx) 0. (max_left ());
      view_top := clamp_float (p.start_top -. dy) 0. (max_top ());
      visible_rect := current_visible ();
      schedule_reconcile ();
      request_draw ()
    | None ->
      (match !drag with
       | None -> ()
       | Some d ->
         let cx, cy = to_canvas ev in
         drag := Some { d with x = cx; y = cy };
         request_draw ())
  in

  let on_pointer_up ev =
    match !panning with
    | Some _ ->
      panning := None;
      reconcile ~force:true ();
      request_draw ()
    | None ->
      (match !drag with
       | None -> ()
       | Some d ->
         let cx, cy = to_canvas ev in
         (match board_at_canvas cx cy with
          | Some (bx, by, col, row) ->
            let dst_state = state_of bx by in
            let dst = (row * 8) + col in
            if dst_state.loaded && dst <> d.from then begin
              let src_bx = d.state.bx and src_by = d.state.by in
              let same_board = bx = src_bx && by = src_by in
              let dst_piece = Bytes.unsafe_get dst_state.pieces dst in
              let dx =
                ((bx - src_bx) * 8) + ((dst mod 8) - (d.from mod 8))
              in
              let dy =
                ((by - src_by) * 8) + ((dst / 8) - (d.from / 8))
              in
              let pawn = piece_type_code d.piece_byte = 1 in
              let king = piece_type_code d.piece_byte = 6 in
              (* Captures are only allowed on the mover's original board. If
                 it is off that board, or the target is on another board, the
                 drag snaps back without sending a request. *)
              let en_passant_capture =
                if pawn && abs dx = 1 && dst_piece = empty then begin
                  let captured_world_x =
                    (src_bx * 8) + (d.from mod 8) + dx
                  in
                  let captured_world_y =
                    (src_by * 8) + (d.from / 8)
                  in
                  if
                    captured_world_x >= 0 && captured_world_x < 8000
                    && captured_world_y >= 0 && captured_world_y < 8000
                  then begin
                    let cbx = captured_world_x / 8 in
                    let cby = captured_world_y / 8 in
                    let captured =
                      ((captured_world_y mod 8) * 8)
                      + (captured_world_x mod 8)
                    in
                    let captured_state = state_of cbx cby in
                    if captured_state.loaded then begin
                      let captured_piece =
                        Bytes.unsafe_get captured_state.pieces captured
                      in
                      if
                        captured_piece <> empty
                        && en_passantable captured_piece
                        && white_byte captured_piece
                           <> white_byte d.piece_byte
                      then
                        Some (captured_state, captured)
                      else None
                    end
                    else None
                  end
                  else None
                end
                else None
              in
              let is_capture =
                dst_piece <> empty
                || (match en_passant_capture with
                    | Some _ -> true
                    | None -> false)
              in
              let capture_blocked =
                is_capture
                && ((not same_board)
                   || not (on_original_board d.piece_byte))
              in
              let within_limit = abs dx <= 36 && abs dy <= 36 in
              if within_limit && not capture_blocked then begin
                let request_id = alloc_request_id () in
                let expected_piece_id =
                  Int32.of_int
                    ((d.from lsl 8) lor Char.code d.piece_byte)
                in
                let castle =
                  if king && abs dx = 2 && dy = 0 then begin
                    let src_world_x = (src_bx * 8) + (d.from mod 8) in
                    let src_world_y = (src_by * 8) + (d.from / 8) in
                    let dst_world_x = (bx * 8) + (dst mod 8) in
                    let dst_world_y = (by * 8) + (dst / 8) in
                    let rook_src_world_x =
                      src_world_x + if dx = 2 then 3 else -4
                    in
                    let rook_dst_world_x =
                      dst_world_x + if dx = 2 then -1 else 1
                    in
                    if
                      rook_src_world_x >= 0 && rook_src_world_x < 8000
                      && rook_dst_world_x >= 0 && rook_dst_world_x < 8000
                    then begin
                      let rook_src_bx = rook_src_world_x / 8 in
                      let rook_src_by = src_world_y / 8 in
                      let rook_dst_bx = rook_dst_world_x / 8 in
                      let rook_dst_by = dst_world_y / 8 in
                      let rook_src =
                        ((src_world_y mod 8) * 8)
                        + (rook_src_world_x mod 8)
                      in
                      let rook_dst =
                        ((dst_world_y mod 8) * 8)
                        + (rook_dst_world_x mod 8)
                      in
                      let rook_src_state = state_of rook_src_bx rook_src_by in
                      if rook_src_state.loaded then
                        Some
                          {
                            king_src_state = d.state;
                            king_dst_state = dst_state;
                            rook_src_state;
                            rook_dst_state = state_of rook_dst_bx rook_dst_by;
                            king_src = d.from;
                            king_dst = dst;
                            rook_src;
                            rook_dst;
                            king_piece = d.piece_byte;
                            rook_piece =
                              Bytes.unsafe_get rook_src_state.pieces rook_src;
                          }
                      else None
                    end
                    else None
                  end
                  else None
                in
                let action =
                  match castle with
                  | Some castle -> Some (Special (Castle castle))
                  | None ->
                    match en_passant_capture with
                    | Some (captured_state, captured) ->
                      Some
                        (Special
                           (En_passant
                              {
                                src_state = d.state;
                                dst_state;
                                captured_state;
                                src = d.from;
                                dst;
                                captured;
                                pawn_piece = d.piece_byte;
                              }))
                    | None ->
                      let undo =
                        {
                          src_state = d.state;
                          dst_state;
                          src = d.from;
                          dst;
                          src_piece = d.piece_byte;
                          dst_piece;
                        }
                      in
                      Bytes.unsafe_set d.state.pieces d.from empty;
                      Bytes.unsafe_set dst_state.pieces dst d.piece_byte;
                      Some (Normal undo)
                in
                match action with
                | None -> ()
                | Some action ->
                  let sent_at = Performance.now_ms G.performance in
                  pending :=
                   Some
                     {
                       request_id;
                       action;
                       event_applied = false;
                       sent_at;
                       last_probe = sent_at;
                     };
                  set_move_pending true;
                  if
                    not
                      (send_move ~request_id ~expected_piece_id
                         ~src_board:(src_bx, src_by) ~dst_board:(bx, by)
                         d.from dst)
                  then begin
                    (match action with
                     | Normal undo -> restore_normal undo
                     | Special _ -> ());
                    pending := None;
                    set_move_pending false
                  end
              end
            end
          | None -> ());
         drag := None;
         request_draw ())
  in

  let on_pointer_cancel _ =
    drag := None;
    panning := None;
    request_draw ()
  in

  let on_wheel ev =
    let wheel = Ev.as_type ev in
    let dy =
      match Ev.Wheel.delta_mode wheel with
      | mode when mode = Ev.Wheel.Delta_mode.line ->
        Ev.Wheel.delta_y wheel *. 16.
      | mode when mode = Ev.Wheel.Delta_mode.page ->
        Ev.Wheel.delta_y wheel *. 100.
      | _ -> Ev.Wheel.delta_y wheel
    in
    if dy <> 0. then begin
      Ev.prevent_default ev;
      update_layout ();
      let cx, cy = to_canvas_of_mouse (Ev.Wheel.as_mouse wheel) in
      let wx = !view_left +. (cx /. board_px ()) in
      let wy = !view_top +. (cy /. board_px ()) in
      let factor = clamp_float (exp (-.dy /. 420.)) 0.78 1.28 in
      zoom := clamp_float (!zoom *. factor) (min_zoom ()) 3.5;
      view_left :=
        clamp_float (wx -. (cx /. board_px ())) 0. (max_left ());
      view_top :=
        clamp_float (wy -. (cy /. board_px ())) 0. (max_top ());
      visible_rect := current_visible ();
      reconcile ~force:true ();
      request_draw ()
    end
  in

  ignore (Ev.listen Ev.pointerdown on_pointer_down (El.as_target canvas_el));
  let window = Window.as_target G.window in
  ignore (Ev.listen Ev.pointermove on_pointer_move window);
  ignore (Ev.listen Ev.pointerup on_pointer_up window);
  ignore (Ev.listen Ev.pointercancel on_pointer_cancel window);
  ignore
    (Ev.listen
       ~opts:(Ev.listen_opts ~passive:false ())
       Ev.wheel on_wheel (El.as_target canvas_el));

  let connect_ws () =
    let location = Jv.get Jv.global "location" in
    let secure = Jstr.equal (Jv.Jstr.get location "protocol") (Jstr.v "https:") in
    let scheme = if secure then "wss" else "ws" in
    let url =
      Jstr.v
        (scheme ^ "://" ^ Jstr.to_string (Jv.Jstr.get location "host") ^ "/ws")
    in
    useful_rect := Viewport.empty;
    let socket = Brr_io.Websocket.create url in
    Brr_io.Websocket.set_binary_type socket
      Brr_io.Websocket.Binary_type.arraybuffer;
    let target = Brr_io.Websocket.as_target socket in
    ignore
      (Ev.listen Brr_io.Message.Ev.message
         (fun ev ->
           let data : Tarray.Buffer.t =
             Ev.as_type ev |> Brr_io.Message.Ev.data
           in
           let length = Tarray.Buffer.byte_length data in
           if length >= Protocol.Types.snapshot_batch_header_bytes then begin
             let copy_started = Performance.now_ms G.performance in
             let bytes = bytes_of_buffer data in
             let copy_finished = Performance.now_ms G.performance in
             let kind = Char.code (Bytes.unsafe_get bytes 0) in
             if
               kind = Protocol.Types.wire_kind_snapshot_batch
               || kind = Protocol.Types.wire_kind_compact_snapshot_batch
             then
               (match Protocol.Types.snapshot_batch_of_wire_bytes bytes with
                | None -> ()
                | Some batch ->
                  let reset =
                    match Request_tracker.find tracker batch.request_id with
                    | Some request -> request.reset
                    | None -> false
                  in
                  ignore
                    (Request_tracker.complete tracker batch.request_id);
                  let count = Array.length batch.boards in
                  if
                    batch.width <= 0 || batch.height <= 0 || count = 0
                    || count <> batch.width * batch.height
                  then begin
                    incr batch_failures;
                    batch_backoff := min 2_000. (!batch_backoff *. 2.);
                    retry_at :=
                      Performance.now_ms G.performance +. !batch_backoff
                  end
                  else begin
                    batch_backoff := 250.;
                    retry_at := 0.;
                    if reset then begin
                      window_batch_success := true;
                      window_batch_failures := 0
                    end
                  end;
                  let decode_finished = Performance.now_ms G.performance in
                  apply_snapshot_batch ~bytes:(Bytes.length bytes) batch;
                  let applied = Performance.now_ms G.performance in
                  El.set_at (Jstr.v "data-copy-ms")
                    (Some (Jstr.of_float (copy_finished -. copy_started)))
                    body_el;
                  El.set_at (Jstr.v "data-decode-ms")
                    (Some (Jstr.of_float (decode_finished -. copy_finished)))
                    body_el;
                  El.set_at (Jstr.v "data-apply-ms")
                    (Some (Jstr.of_float (applied -. decode_finished)))
                    body_el;
                  (* The response may have populated boards for a window the
                     camera has already left; reconcile requests anything
                     still missing in the current window. *)
                  reconcile ~force:true ())
             else if length = Protocol.Types.wire_response_bytes then begin
             if
               Char.code (Bytes.get bytes 0)
               = Protocol.Types.wire_kind_event_batch
             then
               (match Protocol.Types.move_events_of_bytes bytes with
                | None -> ()
                | Some events -> List.iter apply_move_event events)
             else
             match Protocol.Types.wire_response_of_bytes bytes with
             | None -> ()
             | Some (Protocol.Types.Wire_snapshot response) ->
               (match response.status with
                | Protocol.Types.Snapshot_ok ->
                  insert_snapshot ~bx:response.board_x ~by:response.board_y
                    ~revision:response.revision ~pieces:response.board
                | Protocol.Types.Snapshot_failed -> ());
               request_draw ()
             | Some (Protocol.Types.Wire_piece_info info) ->
               (match !pending_piece_info with
                | Some pending
                  when pending.request_id = info.request_id ->
                  pending_piece_info := None
                | _ -> ());
               piece_info_data := Some info;
               (match !piece_info_target with
                | Some (bx, by, sq)
                  when bx = info.board_x && by = info.board_y
                       && sq = info.square ->
                  render_piece_info info
                | _ -> ())
             | Some (Protocol.Types.Wire_event event) ->
               apply_move_event event
             | Some (Protocol.Types.Wire_move response) ->
               Metrics.received ();
               (* An older server rejects the 18-byte window batch as an
                  invalid request with request id 0. Fall back immediately
                  instead of waiting for three batch timeouts. *)
               if
                 Int32.equal response.request_id 0l
                 && Request_tracker.batch_count tracker > 0
                 && List.exists
                      (fun (batch : Request_tracker.batch) -> batch.reset)
                      (Request_tracker.batches tracker)
               then begin
                 window_batch_supported := false;
                 window_batch_success := false;
                 window_batch_failures := 0;
                 Request_tracker.clear tracker;
                 reconcile ~force:true ()
               end;
               (match !pending with
                | Some p when p.request_id = response.request_id ->
                  pending := None;
                  set_move_pending false;
                  let accepted =
                    response.status = Protocol.Types.Accepted
                  in
                  if accepted then begin
                    if not p.event_applied then begin
                      let moved_byte =
                        Char.chr
                          (Protocol.Types.client_byte_of_packed
                             response.moved_piece)
                      in
                      match p.action with
                      | Normal undo ->
                        Bytes.unsafe_set undo.dst_state.pieces undo.dst
                          moved_byte
                      | Special (Castle c) ->
                        apply_castle c;
                        Bytes.unsafe_set c.king_dst_state.pieces c.king_dst
                          moved_byte;
                        let same_rook_board =
                          c.rook_src_state.bx = c.rook_dst_state.bx
                          && c.rook_src_state.by = c.rook_dst_state.by
                        in
                        let rook_byte =
                          (Char.code c.rook_piece land 0xCF)
                          lor (if same_rook_board then 0x10 else 0)
                        in
                        Bytes.unsafe_set c.rook_dst_state.pieces c.rook_dst
                          (Char.chr rook_byte)
                      | Special (En_passant e) ->
                        apply_en_passant e;
                        Bytes.unsafe_set e.dst_state.pieces e.dst moved_byte
                    end
                  end
                  else
                    (match p.action with
                     | Normal undo ->
                       if not p.event_applied then restore_normal undo
                     | Special _ -> ());
                  request_draw ();
                  Console.(
                    log
                      [ Jstr.v
                          (if accepted then "ws: move accepted"
                           else "ws: move rejected") ])
                | _ -> ())
             end
           end)
         target);
    ignore
      (Ev.listen Ev.open'
         (fun _ ->
           Console.(log [ Jstr.v "ws: connected" ]);
           connected := true;
           Request_tracker.clear tracker;
           window_batch_supported := true;
           window_batch_success := false;
           window_batch_failures := 0;
           if !ever_connected then Board_cache.mark_all_stale cache;
           ever_connected := true;
           set_status "Live" "live";
           reconcile ~force:true ())
         target);
    ignore
      (Ev.listen Ev.error
         (fun _ ->
           Console.(log [ Jstr.v "ws: connection error" ]);
           connected := false;
           Request_tracker.clear tracker;
           set_status "Connection error" "error")
         target);
    ignore
      (Ev.listen Ev.close
         (fun _ ->
           Console.(log [ Jstr.v "ws: disconnected" ]);
           connected := false;
           Request_tracker.clear tracker;
           useful_rect := Viewport.empty;
           set_status "Disconnected" "offline")
         target);
    ignore
      (Ev.listen Ev.beforeunload
         (fun _ -> Brr_io.Websocket.close socket)
         (Window.as_target G.window));
    ws := Some socket
  in

  select_center (query_coord "x" 0) (query_coord "y" 0);
  Metrics.init ();
  connect_ws ();
  request_draw ()

let () = main ()
