open Brr
open Brr_canvas

let board_px = 168.
let cell_px = board_px /. 8.
let max_coord = 999
let empty = '\000'

(* ------------------------------------------------------------------------- *)
(* Client state                                                              *)
(* ------------------------------------------------------------------------- *)

type board_state = {
  bx : int;
  by : int;
  mutable pieces : Bytes.t;
  mutable ids : int32 array;
  mutable loaded : bool;
  mutable pending_request : int32 option;
}

type drag = {
  state : board_state;
  from : int;
  piece : char;
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
  state : board_state;
  src : int;
  dst : int;
  src_piece : char;
  dst_piece : char;
  src_id : int32;
  dst_id : int32;
}

type castle_info = {
  state : board_state;
  king_src : int;
  king_dst : int;
  rook_src : int;
  rook_dst : int;
  king_piece : char;
  rook_piece : char;
  king_id : int32;
  rook_id : int32;
}

type en_passant_info = {
  state : board_state;
  src : int;
  dst : int;
  captured : int;
  pawn_piece : char;
  pawn_id : int32;
}

type special_action =
  | Castle of castle_info
  | En_passant of en_passant_info

type pending_action =
  | Normal of normal_undo
  | Special of special_action

type pending = { request_id : int32; action : pending_action }

let board_key bx by = (by * 1000) + bx
let clamp_int v lo hi = max lo (min hi v)
let clamp_float v lo hi = max lo (min hi v)

let empty_board () = Bytes.make 64 empty
let empty_ids () = Array.make 64 0l

let decode_piece value =
  if Int64.equal value 0L then (empty, 0l)
  else
    let id = Int64.logand value 0x1FFFFFFL |> Int64.to_int32 in
    let code =
      Int64.logand (Int64.shift_right_logical value 25) 0xFL |> Int64.to_int
    in
    let white = Int64.logand value (Int64.shift_left 1L 29) <> 0L in
    let glyph =
      match code with
      | 1 -> 'P'
      | 2 -> 'N'
      | 3 -> 'B'
      | 4 -> 'R'
      | 5 -> 'Q'
      | 6 -> 'K'
      | 7 -> 'Q' (* promoted pawn *)
      | _ -> '?'
    in
    ((if white then glyph else Char.lowercase_ascii glyph), id)

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
  let next_request_id = ref 0l in

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
          ids = empty_ids ();
          loaded = false;
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

    (* Board squares first. *)
    for by = y_first to y_last do
      for bx = x_first to x_last do
        let ox = (float bx -. !view_left) *. board_px in
        let oy = (float by -. !view_top) *. board_px in
        for row = 0 to 7 do
          for col = 0 to 7 do
            C2d.set_fill_style ctx
              (if (row + col) land 1 = 0 then light else dark);
            C2d.fill_rect ctx
              ~x:(ox +. (float col *. cell_px))
              ~y:(oy +. (float row *. cell_px))
              ~w:cell_px ~h:cell_px
          done
        done
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
        | Some (bx, by, col, row)
          when bx = d.state.bx && by = d.state.by ->
          let ox = (float bx -. !view_left) *. board_px in
          let oy = (float by -. !view_top) *. board_px in
          if (row * 8) + col <> d.from then begin
            C2d.set_fill_style ctx dst_hl;
            C2d.fill_rect ctx
              ~x:(ox +. (float col *. cell_px))
              ~y:(oy +. (float row *. cell_px))
              ~w:cell_px ~h:cell_px
          end
        | _ -> ()));

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
                  draw_piece ctx atlas piece
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

  let send_move ~request_id ~expected_piece_id ~bx ~by src dst =
    let position sq =
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
          { Protocol.Types.src = position src; dst = position dst };
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
    Bytes.unsafe_set u.state.pieces u.src u.src_piece;
    Bytes.unsafe_set u.state.pieces u.dst u.dst_piece;
    u.state.ids.(u.src) <- u.src_id;
    u.state.ids.(u.dst) <- u.dst_id
  in

  let apply_castle (c : castle_info) =
    Bytes.unsafe_set c.state.pieces c.king_src empty;
    Bytes.unsafe_set c.state.pieces c.rook_src empty;
    Bytes.unsafe_set c.state.pieces c.king_dst c.king_piece;
    Bytes.unsafe_set c.state.pieces c.rook_dst c.rook_piece;
    c.state.ids.(c.king_src) <- 0l;
    c.state.ids.(c.rook_src) <- 0l;
    c.state.ids.(c.king_dst) <- c.king_id;
    c.state.ids.(c.rook_dst) <- c.rook_id
  in

  let apply_en_passant (e : en_passant_info) =
    Bytes.unsafe_set e.state.pieces e.src empty;
    Bytes.unsafe_set e.state.pieces e.captured empty;
    Bytes.unsafe_set e.state.pieces e.dst e.pawn_piece;
    e.state.ids.(e.src) <- 0l;
    e.state.ids.(e.captured) <- 0l;
    e.state.ids.(e.dst) <- e.pawn_id
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
            Some (state, sq, Bytes.unsafe_get state.pieces sq)
          else None
      in
      match drag_state with
      | Some (state, sq, piece) when button = 0 ->
        drag := Some { state; from = sq; piece; x = cx; y = cy }
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
           | Some (bx, by, col, row)
             when bx = d.state.bx && by = d.state.by && d.state.loaded ->
             let dst = (row * 8) + col in
             if dst <> d.from then begin
               let request_id = alloc_request_id () in
               let expected_piece_id = d.state.ids.(d.from) in
               let dx = (dst mod 8) - (d.from mod 8) in
               let dy = (dst / 8) - (d.from / 8) in
               let castle_rook_positions =
                 let row = d.from / 8 in
                 let src_x = d.from mod 8 and dst_x = dst mod 8 in
                 let rook_src_x = src_x + if dx = 2 then 3 else -4 in
                 let rook_dst_x = dst_x + if dx = 2 then -1 else 1 in
                 if
                   rook_src_x >= 0 && rook_src_x < 8 && rook_dst_x >= 0
                   && rook_dst_x < 8
                 then Some (row, rook_src_x, rook_dst_x)
                 else None
               in
               let is_castle =
                 (d.piece = 'k' || d.piece = 'K') && abs dx = 2 && dy = 0
                 && castle_rook_positions <> None
               in
               let is_en_passant =
                 (d.piece = 'p' || d.piece = 'P') && abs dx = 1
                 && Bytes.unsafe_get d.state.pieces dst = empty
               in
               let action =
                 if is_castle then begin
                   let row, rook_src_x, rook_dst_x =
                     match castle_rook_positions with
                     | Some p -> p
                     | None -> assert false
                   in
                   Some
                     (Special
                        (Castle
                           {
                             state = d.state;
                             king_src = d.from;
                             king_dst = dst;
                             rook_src = (row * 8) + rook_src_x;
                             rook_dst = (row * 8) + rook_dst_x;
                             king_piece = d.piece;
                             rook_piece =
                               Bytes.unsafe_get d.state.pieces
                                 ((row * 8) + rook_src_x);
                             king_id = expected_piece_id;
                             rook_id = d.state.ids.((row * 8) + rook_src_x);
                           }))
                 end
                 else if is_en_passant then
                   Some
                     (Special
                        (En_passant
                           {
                             state = d.state;
                             src = d.from;
                             dst;
                             captured = ((d.from / 8) * 8) + (dst mod 8);
                             pawn_piece = d.piece;
                             pawn_id = expected_piece_id;
                           }))
                 else begin
                   let undo =
                     {
                       state = d.state;
                       src = d.from;
                       dst;
                       src_piece = d.piece;
                       dst_piece = Bytes.unsafe_get d.state.pieces dst;
                       src_id = d.state.ids.(d.from);
                       dst_id = d.state.ids.(dst);
                     }
                   in
                   Bytes.unsafe_set d.state.pieces d.from empty;
                   Bytes.unsafe_set d.state.pieces dst d.piece;
                   d.state.ids.(dst) <- expected_piece_id;
                   d.state.ids.(d.from) <- 0l;
                   Some (Normal undo)
                 end
               in
               match action with
               | None -> ()
               | Some action ->
                 pending := Some { request_id; action };
                 set_move_pending true;
                 if
                   not
                     (send_move ~request_id ~expected_piece_id
                        ~bx:d.state.bx ~by:d.state.by d.from dst)
                 then begin
                   (match action with
                    | Normal undo -> restore_normal undo
                    | Special _ -> ());
                   pending := None;
                   set_move_pending false
                 end
             end
           | _ -> ());
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
                    let pieces = empty_board () and ids = empty_ids () in
                    Array.iteri
                      (fun i packed ->
                        let glyph, id = decode_piece packed in
                        Bytes.unsafe_set pieces i glyph;
                        ids.(i) <- id)
                      response.board;
                    state.pieces <- pieces;
                    state.ids <- ids;
                    state.loaded <- true
                  end
                  else state.loaded <- false;
                  request_draw ()
                | _ -> ());
               pump_snapshots ()
             | Some (Protocol.Types.Wire_move response) ->
               Metrics.received ();
               (match !pending with
                | Some p when p.request_id = response.request_id ->
                  pending := None;
                  set_move_pending false;
                  let accepted =
                    response.status = Protocol.Types.Accepted
                  in
                  if accepted then
                    (match p.action with
                     | Normal _ -> ()
                     | Special (Castle c) -> apply_castle c
                     | Special (En_passant e) -> apply_en_passant e)
                  else
                    (match p.action with
                     | Normal undo -> restore_normal undo
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
