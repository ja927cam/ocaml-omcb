open Brr
open Brr_canvas

(* 216 px boards are a comfortable zoom: three fit vertically in a 700 px
   window, while larger screens show more context. *)
let board_px = 216.
let cell_px = board_px /. 8.
let max_coord = 999
let empty = '\000'

(* ------------------------------------------------------------------------- *)
(* Client state                                                              *)
(* ------------------------------------------------------------------------- *)

type board_state = {
  bx : int;
  by : int;
  mutable pieces : Bytes.t; (* 64 one-byte client pieces *)
  mutable revision : int64;
  mutable loaded : bool;
  mutable stale : bool;
  mutable pending_request : int32 option;
}

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
}

let board_key bx by = (by * 1000) + bx
let clamp_int v lo hi = max lo (min hi v)
let clamp_float v lo hi = max lo (min hi v)

let empty_board () = Bytes.make 64 empty

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

let draw_piece ctx atlas piece x y size =
  let i = piece_index piece in
  let row = if Char.uppercase_ascii piece = piece then 0 else 1 in
  C2d.draw_sub_image_in_rect ctx atlas
    ~sx:(float (i * 64)) ~sy:(float (row * 64))
    ~sw:64. ~sh:64. ~x ~y ~w:size ~h:size

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
  let visible_w () = float !canvas_w /. board_px in
  let visible_h () = float !canvas_h /. board_px in
  let max_left () = max 0. (1000. -. visible_w ()) in
  let max_top () = max 0. (1000. -. visible_h ()) in
  let set_canvas_size () =
    let w = max 1 (Window.inner_width G.window) in
    let h = max 1 (Window.inner_height G.window) in
    if w <> !canvas_w || h <> !canvas_h then begin
      canvas_w := w;
      canvas_h := h;
      Canvas.set_w canvas w;
      Canvas.set_h canvas h
    end
  in
  set_canvas_size ();
  let body_el = Document.body G.document in
  let find_el id =
    match Document.find_el_by_id G.document (Jstr.v id) with
    | Some el -> el
    | None -> failwith ("Could not find #" ^ id)
  in
  let coords_el = find_el "coords" in
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

  (* One board tile blit replaces 64 per-square fills on every frame. *)
  let board_canvas =
    Canvas.create ~w:(int_of_float board_px) ~h:(int_of_float board_px) []
  in
  let board_ctx = C2d.get_context board_canvas in
  for row = 0 to 7 do
    for col = 0 to 7 do
      C2d.set_fill_style board_ctx
        (if (row + col) land 1 = 0 then light else dark);
      C2d.fill_rect board_ctx
        ~x:(float col *. cell_px) ~y:(float row *. cell_px)
        ~w:cell_px ~h:cell_px
    done
  done;
  (* A one-pixel inner border makes adjacent boards visually distinct. *)
  let border = C2d.color (Jstr.v "rgba(25, 18, 12, 0.65)") in
  C2d.set_fill_style board_ctx border;
  let edge = float (int_of_float board_px) in
  C2d.fill_rect board_ctx ~x:0. ~y:0. ~w:edge ~h:1.;
  C2d.fill_rect board_ctx ~x:0. ~y:(edge -. 1.) ~w:edge ~h:1.;
  C2d.fill_rect board_ctx ~x:0. ~y:0. ~w:1. ~h:edge;
  C2d.fill_rect board_ctx ~x:(edge -. 1.) ~y:0. ~w:1. ~h:edge;
  let board_tile = C2d.image_src_of_el (Canvas.to_el board_canvas) in

  let atlas_canvas = Canvas.create ~w:(6 * 64) ~h:(2 * 64) [] in
  let atlas_ctx = C2d.get_context atlas_canvas in
  C2d.set_text_align atlas_ctx C2d.Text_align.center;
  C2d.set_text_baseline atlas_ctx C2d.Text_baseline.middle;
  C2d.set_font atlas_ctx
    (Jstr.v "50px 'Noto Sans Symbols 2', 'DejaVu Sans', sans-serif");
  C2d.set_line_width atlas_ctx 2.;
  let white_fill = C2d.color (Jstr.v "#ffffff") in
  let black_fill = C2d.color (Jstr.v "#141414") in
  let white_stroke = C2d.color (Jstr.v "#2b2b2b") in
  Array.iteri
    (fun i glyph ->
      let x = float ((i * 64) + 32) and y = 32. in
      let glyph = Jstr.v glyph in
      C2d.set_fill_style atlas_ctx white_fill;
      C2d.set_stroke_style atlas_ctx white_stroke;
      C2d.fill_text atlas_ctx glyph ~x ~y;
      C2d.stroke_text atlas_ctx glyph ~x ~y;
      C2d.set_fill_style atlas_ctx black_fill;
      C2d.fill_text atlas_ctx glyph ~x ~y:(y +. 64.))
    piece_glyphs;
  let atlas = C2d.image_src_of_el (Canvas.to_el atlas_canvas) in

  let boards : (int, board_state) Hashtbl.t = Hashtbl.create 1024 in
  let pending_snapshots : (int32, int) Hashtbl.t = Hashtbl.create 1024 in
  let snapshot_queue = Queue.create () in
  (* Dream's stream pipe can lose a write acknowledgement when many responses
     are queued. One snapshot at a time is still fast over loopback and keeps
     the request/response path deterministic. *)
  let max_snapshot_outstanding = 1 in

  let view_left = ref 0. and view_top = ref 0. in
  let drag : drag option ref = ref None in
  let panning : pan option ref = ref None in
  let pending : pending option ref = ref None in
  let ws = ref None in
  let next_request_id = ref (random_request_id ()) in
  let last_subscription = ref None in

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

  let origin_x = ref 0. and origin_y = ref 0. in
  let scale_x = ref 1. and scale_y = ref 1. in
  let update_layout () =
    origin_x := El.bound_x canvas_el;
    origin_y := El.bound_y canvas_el;
    scale_x := float !canvas_w /. max 1. (El.bound_w canvas_el);
    scale_y := float !canvas_h /. max 1. (El.bound_h canvas_el)
  in

  let to_canvas ev =
    let m = Ev.as_type ev |> Ev.Pointer.as_mouse in
    ( (Ev.Mouse.client_x m -. !origin_x) *. !scale_x,
      (Ev.Mouse.client_y m -. !origin_y) *. !scale_y )
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

  let state_of bx by =
    let key = board_key bx by in
    match Hashtbl.find_opt boards key with
    | Some state -> state
    | None ->
      let state =
        {
          bx;
          by;
          pieces = empty_board ();
          revision = 0L;
          loaded = false;
          stale = false;
          pending_request = None;
        }
      in
      Hashtbl.add boards key state;
      state
  in

  let forget_pending state =
    match state.pending_request with
    | None -> ()
    | Some request_id ->
      Hashtbl.remove pending_snapshots request_id;
      state.pending_request <- None
  in

  let send_snapshot_request state =
    if (not state.loaded) && state.pending_request = None then begin
      let request_id = alloc_request_id () in
      state.pending_request <- Some request_id;
      Hashtbl.replace pending_snapshots request_id
        (board_key state.bx state.by);
      let request : Protocol.Types.snapshot_request =
        {
          Protocol.Types.request_id;
          board_x = state.bx;
          board_y = state.by;
        }
      in
      if send_binary (Protocol.Types.snapshot_request_to_bytes request) then
        true
      else begin
        forget_pending state;
        false
      end
    end
    else false
  in

  let rec pump_snapshots () =
    if
      Hashtbl.length pending_snapshots < max_snapshot_outstanding
      && not (Queue.is_empty snapshot_queue)
    then begin
      let key = Queue.take snapshot_queue in
      match Hashtbl.find_opt boards key with
      | None -> pump_snapshots ()
      | Some state ->
        if (not state.loaded) && state.pending_request = None then begin
          if send_snapshot_request state then pump_snapshots ()
        end
        else pump_snapshots ()
    end
  in

  let ensure_window () =
    let center_x, center_y = centre_of_view () in
    (match !last_subscription with
     | Some (x, y) when x = center_x && y = center_y -> ()
     | _ ->
       let window : Protocol.Types.subscription_window =
         { center_x; center_y; radius = 12 }
       in
       if
         send_binary
           (Protocol.Types.subscription_window_to_bytes window)
       then last_subscription := Some (center_x, center_y));
    let x0 = max 0 (center_x - 12) and x1 = min max_coord (center_x + 12) in
    let y0 = max 0 (center_y - 12) and y1 = min max_coord (center_y + 12) in
    let out_of_window =
      Hashtbl.fold
        (fun key state acc ->
          if state.bx < x0 || state.bx > x1 || state.by < y0
             || state.by > y1
          then key :: acc
          else acc)
        boards []
    in
    List.iter
      (fun key ->
        match Hashtbl.find_opt boards key with
        | None -> ()
        | Some state ->
          forget_pending state;
          Hashtbl.remove boards key)
      out_of_window;

    Queue.clear snapshot_queue;
    let enqueue bx by =
      let state = state_of bx by in
      if (not state.loaded) && state.pending_request = None then
        Queue.add (board_key bx by) snapshot_queue
    in
    (* Visible boards are requested first; the rest of the 25 x 25 window is
       background-loaded with bounded concurrency so moves are not stuck behind
       hundreds of snapshot requests. *)
    let visible_x0 = max 0 (int_of_float (floor !view_left)) in
    let visible_x1 =
      min max_coord
        (int_of_float (floor (!view_left +. visible_w ())))
    in
    let visible_y0 = max 0 (int_of_float (floor !view_top)) in
    let visible_y1 =
      min max_coord
        (int_of_float (floor (!view_top +. visible_h ())))
    in
    (* Eagerly load the visible boards plus a one-board margin. The cache
       window is 25 x 25 around the centre, so panning reuses nearby snapshots
       without loading the entire world or flooding the worker with hundreds
       of requests before the first move. *)
    let load_x0 = max x0 (visible_x0 - 1) in
    let load_x1 = min x1 (visible_x1 + 1) in
    let load_y0 = max y0 (visible_y0 - 1) in
    let load_y1 = min y1 (visible_y1 + 1) in
    for by = load_y0 to load_y1 do
      for bx = load_x0 to load_x1 do enqueue bx by done
    done;
    pump_snapshots ()
  in

  let board_at_canvas x y =
    let wx = !view_left +. (x /. board_px) in
    let wy = !view_top +. (y /. board_px) in
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
    El.set_at (Jstr.v "data-view-left")
      (Some (Jstr.of_float !view_left)) body_el;
    El.set_at (Jstr.v "data-view-top")
      (Some (Jstr.of_float !view_top)) body_el;
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
        let ox = (float bx -. !view_left) *. board_px in
        let oy = (float by -. !view_top) *. board_px in
        C2d.draw_image ctx board_tile ~x:ox ~y:oy
      done
    done;

    (* Drag highlights. *)
    (match !drag with
     | None -> ()
     | Some d ->
       let ox = (float d.state.bx -. !view_left) *. board_px in
       let oy = (float d.state.by -. !view_top) *. board_px in
       let col = d.from mod 8 and row = d.from / 8 in
       C2d.set_fill_style ctx src_hl;
       C2d.fill_rect ctx
         ~x:(ox +. (float col *. cell_px))
         ~y:(oy +. (float row *. cell_px))
         ~w:cell_px ~h:cell_px;
       (match board_at_canvas d.x d.y with
        | Some (bx, by, col, row) ->
          let target = state_of bx by in
          let dst = (row * 8) + col in
          if
            target.loaded
            && (bx <> d.state.bx || by <> d.state.by || dst <> d.from)
          then begin
            let ox = (float bx -. !view_left) *. board_px in
            let oy = (float by -. !view_top) *. board_px in
            C2d.set_fill_style ctx dst_hl;
            C2d.fill_rect ctx
              ~x:(ox +. (float col *. cell_px))
              ~y:(oy +. (float row *. cell_px))
              ~w:cell_px ~h:cell_px
          end
        | None -> ()));

    (* Pieces. *)
    for by = y_first to y_last do
      for bx = x_first to x_last do
        match Hashtbl.find_opt boards (board_key bx by) with
        | None -> ()
        | Some state ->
          if state.loaded then begin
            let ox = (float bx -. !view_left) *. board_px in
            let oy = (float by -. !view_top) *. board_px in
            for i = 0 to 63 do
              let piece = Bytes.unsafe_get state.pieces i in
              if piece <> empty then
                match !drag with
                | Some d when d.state == state && d.from = i -> ()
                | _ ->
                  draw_piece ctx atlas (glyph_of_byte piece)
                    (ox +. (float (i mod 8) *. cell_px))
                    (oy +. (float (i / 8) *. cell_px))
                    cell_px
            done
          end
      done
    done;

    match !drag with
    | None -> ()
    | Some d ->
      draw_piece ctx atlas d.piece (d.x -. (cell_px /. 2.))
        (d.y -. (cell_px /. 2.)) cell_px
  in

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
    ensure_window ();
    request_draw ()
  in

  let on_resize _ =
    let cx, cy = centre_of_view () in
    set_canvas_size ();
    update_layout ();
    select_center cx cy
  in
  ignore (Ev.listen Ev.resize on_resize (Window.as_target G.window));

  let apply_move_event (event : Protocol.Types.move_event) =
    let resync = ref false in
    let changed = ref false in
    List.iter
      (fun (board : Protocol.Types.event_board) ->
        let key = board_key board.board_x board.board_y in
        match Hashtbl.find_opt boards key with
        | Some state when state.loaded && not state.stale ->
          let revision = board.revision in
          let cmp = Int64.compare revision state.revision in
          if cmp <= 0 then begin
            (* Duplicate or older than the current cache. *)
            (match !pending with
             | Some p when p.request_id = event.request_id ->
               p.event_applied <- true
             | _ -> ())
          end
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
            changed := true;
            (match !pending with
             | Some p when p.request_id = event.request_id ->
               p.event_applied <- true
             | _ -> ())
          end
          else begin
            (* A revision was skipped: discard the cache and re-snapshot. *)
            state.loaded <- false;
            state.stale <- true;
            forget_pending state;
            resync := true
          end
        | _ -> ())
      event.boards;
    if !changed then request_draw ();
    if !resync then ensure_window ()
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
          if state.loaded && Bytes.unsafe_get state.pieces sq <> empty then
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
      let dx = (cx -. p.start_cx) /. board_px in
      let dy = (cy -. p.start_cy) /. board_px in
      view_left := clamp_float (p.start_left -. dx) 0. (max_left ());
      view_top := clamp_float (p.start_top -. dy) 0. (max_top ());
      ensure_window ();
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
      ensure_window ();
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
                  pending :=
                   Some { request_id; action; event_applied = false };
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

  ignore (Ev.listen Ev.pointerdown on_pointer_down (El.as_target canvas_el));
  let window = Window.as_target G.window in
  ignore (Ev.listen Ev.pointermove on_pointer_move window);
  ignore (Ev.listen Ev.pointerup on_pointer_up window);
  ignore (Ev.listen Ev.pointercancel on_pointer_cancel window);

  let connect_ws () =
    let location = Jv.get Jv.global "location" in
    let secure = Jstr.equal (Jv.Jstr.get location "protocol") (Jstr.v "https:") in
    let scheme = if secure then "wss" else "ws" in
    let url =
      Jstr.v
        (scheme ^ "://" ^ Jstr.to_string (Jv.Jstr.get location "host") ^ "/ws")
    in
    last_subscription := None;
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
           if length = Protocol.Types.wire_response_bytes then begin
             let bytes = bytes_of_buffer data in
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
               let key = board_key response.board_x response.board_y in
               Hashtbl.remove pending_snapshots response.request_id;
               (match Hashtbl.find_opt boards key with
                | Some state
                  when state.pending_request = Some response.request_id ->
                  state.pending_request <- None;
                  if response.status = Protocol.Types.Snapshot_ok then begin
                    if
                      Int64.compare response.revision state.revision >= 0
                    then begin
                      state.pieces <- response.board;
                      state.revision <- response.revision;
                      state.loaded <- true;
                      state.stale <- false
                    end
                    else if not state.loaded then
                      (* A resync snapshot was superseded by an event. *)
                      ensure_window ()
                  end
                  else begin
                    state.loaded <- false;
                    state.stale <- true;
                    ensure_window ()
                  end;
                  request_draw ()
                | _ -> ());
               pump_snapshots ()
             | Some (Protocol.Types.Wire_event event) ->
               apply_move_event event
             | Some (Protocol.Types.Wire_move response) ->
               Metrics.received ();
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
           end)
         target);
    ignore
      (Ev.listen Ev.open'
         (fun _ ->
           Console.(log [ Jstr.v "ws: connected" ]);
           ensure_window ())
         target);
    ignore
      (Ev.listen Ev.error
         (fun _ -> Console.(log [ Jstr.v "ws: connection error" ]))
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
