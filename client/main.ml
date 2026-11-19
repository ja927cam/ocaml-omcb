open Brr
open Brr_canvas

let board_px = 512
let cell_px = 64
let max_coord = 999
let empty = '\000'

type drag = { from : int; piece : char; x : float; y : float }

type normal_undo = {
  src : int;
  dst : int;
  src_piece : char;
  dst_piece : char;
  src_id : int32;
  dst_id : int32;
}

type castle_info = {
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

(* Glyphs for pawn, knight, bishop, rook, queen, king. *)
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

(* A board is 64 bytes, one per square (row-major from a8). Empty is 0.
   For now every board shows the standard starting position; the coordinate
   pair already travels with each move so the backend can supply the real
   position later. *)
let make_board _board_x _board_y =
  let board = Bytes.make 64 empty in
  let back = [| 'r'; 'n'; 'b'; 'q'; 'k'; 'b'; 'n'; 'r' |] in
  for f = 0 to 7 do
    Bytes.unsafe_set board (8 + f) 'p';
    Bytes.unsafe_set board (48 + f) 'P';
    Bytes.unsafe_set board f back.(f);
    Bytes.unsafe_set board (56 + f) (Char.uppercase_ascii back.(f))
  done;
  board

(* Piece IDs must match Board.initialise_standard_position on the server:
   black back rank, black pawns, white pawns, white back rank. *)
let make_piece_ids board_x board_y =
  let base = (((board_y * 1000) + board_x) * 32) + 1 in
  let ids = Array.make 64 0l in
  let slot = ref 0 in
  let put x y =
    ids.((y * 8) + x) <- Int32.of_int (base + !slot);
    incr slot
  in
  for x = 0 to 7 do put x 0 done;
  for x = 0 to 7 do put x 1 done;
  for x = 0 to 7 do put x 6 done;
  for x = 0 to 7 do put x 7 done;
  ids

let square_at x y =
  if x < 0. || y < 0. || x >= float board_px || y >= float board_px
  then None
  else
    let c = int_of_float (x /. float cell_px) in
    let r = int_of_float (y /. float cell_px) in
    Some ((r * 8) + c)

let draw_piece ctx atlas piece x y =
  let i = piece_index piece in
  let row = if Char.uppercase_ascii piece = piece then 0 else 1 in
  C2d.draw_sub_image_in_rect ctx atlas
    ~sx:(float (i * cell_px)) ~sy:(float (row * cell_px))
    ~sw:(float cell_px) ~sh:(float cell_px)
    ~x ~y ~w:(float cell_px) ~h:(float cell_px)

let main () =
  let canvas_el =
    match Document.find_el_by_id G.document (Jstr.v "game") with
    | Some el -> el
    | None -> failwith "Could not find #game canvas"
  in
  let canvas = Canvas.of_el canvas_el in
  Canvas.set_w canvas board_px;
  Canvas.set_h canvas board_px;
  let ctx = C2d.get_context canvas in

  let light = C2d.color (Jstr.v "#f0d9b5") in
  let dark = C2d.color (Jstr.v "#b58863") in
  let src_hl = C2d.color (Jstr.v "rgba(255, 235, 59, 0.45)") in
  let dst_hl = C2d.color (Jstr.v "rgba(20, 85, 30, 0.45)") in

  (* The board background never changes: draw it once into an offscreen
     canvas, then it costs one drawImage per frame. *)
  let bg_canvas = Canvas.create ~w:board_px ~h:board_px [] in
  let bg_ctx = C2d.get_context bg_canvas in
  for r = 0 to 7 do
    for c = 0 to 7 do
      C2d.set_fill_style bg_ctx (if (r + c) land 1 = 0 then light else dark);
      C2d.fill_rect bg_ctx
        ~x:(float (c * cell_px)) ~y:(float (r * cell_px))
        ~w:(float cell_px) ~h:(float cell_px)
    done
  done;
  let bg = C2d.image_src_of_el (Canvas.to_el bg_canvas) in

  (* Piece glyphs only depend on the piece type and colour: rasterise them
     once into a 6x2 atlas instead of shaping text on every frame. *)
  let atlas_canvas = Canvas.create ~w:(6 * cell_px) ~h:(2 * cell_px) [] in
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
      let x = float (i * cell_px) +. (float cell_px /. 2.) in
      let y = float cell_px /. 2. in
      let glyph = Jstr.v glyph in
      C2d.set_fill_style atlas_ctx white_fill;
      C2d.set_stroke_style atlas_ctx white_stroke;
      C2d.fill_text atlas_ctx glyph ~x ~y;
      C2d.stroke_text atlas_ctx glyph ~x ~y;
      C2d.set_fill_style atlas_ctx black_fill;
      C2d.fill_text atlas_ctx glyph ~x ~y:(y +. float cell_px))
    piece_glyphs;
  let atlas = C2d.image_src_of_el (Canvas.to_el atlas_canvas) in

  let board = ref (make_board 0 0) in
  let piece_ids = ref (make_piece_ids 0 0) in
  let board_x = ref 0 in
  let board_y = ref 0 in
  let drag = ref None in
  let pending : pending option ref = ref None in
  let ws = ref None in
  let next_request_id = ref 0l in
  let needs_draw = ref true in
  let frame_pending = ref false in

  let draw () =
    C2d.draw_image ctx bg ~x:0. ~y:0.;

    (match !drag with
     | Some d ->
       let c = d.from mod 8 and r = d.from / 8 in
       C2d.set_fill_style ctx src_hl;
       C2d.fill_rect ctx
         ~x:(float (c * cell_px)) ~y:(float (r * cell_px))
         ~w:(float cell_px) ~h:(float cell_px);
       (match square_at d.x d.y with
        | Some sq when sq <> d.from ->
          let c = sq mod 8 and r = sq / 8 in
          C2d.set_fill_style ctx dst_hl;
          C2d.fill_rect ctx
            ~x:(float (c * cell_px)) ~y:(float (r * cell_px))
            ~w:(float cell_px) ~h:(float cell_px)
        | _ -> ())
     | None -> ());

    let b = !board in
    for i = 0 to 63 do
      let piece = Bytes.unsafe_get b i in
      if piece <> empty then
        match !drag with
        | Some d when d.from = i -> ()
        | _ ->
          draw_piece ctx atlas piece
            (float ((i mod 8) * cell_px))
            (float ((i / 8) * cell_px))
    done;

    match !drag with
    | Some d ->
      let half = float cell_px /. 2. in
      draw_piece ctx atlas d.piece (d.x -. half) (d.y -. half)
    | None -> ()
  in

  let request_draw () =
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
  in

  let origin_x = ref 0. and origin_y = ref 0. in
  let scale_x = ref 1. and scale_y = ref 1. in
  let update_layout () =
    origin_x := El.bound_x canvas_el;
    origin_y := El.bound_y canvas_el;
    scale_x := float board_px /. El.bound_w canvas_el;
    scale_y := float board_px /. El.bound_h canvas_el
  in

  let to_board ev =
    let m = Ev.as_type ev |> Ev.Pointer.as_mouse in
    ( (Ev.Mouse.client_x m -. !origin_x) *. !scale_x,
      (Ev.Mouse.client_y m -. !origin_y) *. !scale_y )
  in

  let send_move ~request_id ~expected_piece_id src dst =
    match !ws with
    | Some socket
      when Brr_io.Websocket.ready_state socket
           = Brr_io.Websocket.Ready_state.open' ->
      let position sq =
        {
          Protocol.Types.board_x = !board_x;
          board_y = !board_y;
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
      let len = Bytes.length data in
      let buffer = Tarray.Buffer.create len in
      let bytes = Tarray.uint8_of_buffer buffer |> Tarray.to_bigarray1 in
      for i = 0 to len - 1 do
        Bigarray.Array1.unsafe_set bytes i
          (Char.code (Bytes.unsafe_get data i))
      done;
      Metrics.sent ();
      Brr_io.Websocket.send_array_buffer socket buffer;
      true
    | _ -> false
  in

  let restore_normal (u : normal_undo) =
    let b = !board and ids = !piece_ids in
    Bytes.unsafe_set b u.src u.src_piece;
    Bytes.unsafe_set b u.dst u.dst_piece;
    ids.(u.src) <- u.src_id;
    ids.(u.dst) <- u.dst_id
  in

  let apply_castle (c : castle_info) =
    let in_range i = i >= 0 && i < 64 in
    if in_range c.king_src && in_range c.king_dst
       && in_range c.rook_src && in_range c.rook_dst
    then begin
      let b = !board and ids = !piece_ids in
      Bytes.unsafe_set b c.king_src empty;
      Bytes.unsafe_set b c.rook_src empty;
      Bytes.unsafe_set b c.king_dst c.king_piece;
      Bytes.unsafe_set b c.rook_dst c.rook_piece;
      ids.(c.king_src) <- 0l;
      ids.(c.rook_src) <- 0l;
      ids.(c.king_dst) <- c.king_id;
      ids.(c.rook_dst) <- c.rook_id
    end
  in

  let apply_en_passant (e : en_passant_info) =
    let b = !board and ids = !piece_ids in
    Bytes.unsafe_set b e.src empty;
    Bytes.unsafe_set b e.captured empty;
    Bytes.unsafe_set b e.dst e.pawn_piece;
    ids.(e.src) <- 0l;
    ids.(e.captured) <- 0l;
    ids.(e.dst) <- e.pawn_id
  in

  let load_board x y =
    board := make_board x y;
    piece_ids := make_piece_ids x y;
    board_x := x;
    board_y := y;
    drag := None;
    pending := None;
    request_draw ()
  in

  let on_pointer_down ev =
    if !pending = None then begin
      update_layout ();
      let x, y = to_board ev in
      match square_at x y with
      | Some sq ->
        let piece = Bytes.unsafe_get !board sq in
        if piece <> empty then begin
          drag := Some { from = sq; piece; x; y };
          request_draw ()
        end
      | None -> ()
    end
  in

  let on_pointer_move ev =
    match !drag with
    | None -> ()
    | Some d ->
      let x, y = to_board ev in
      drag := Some { d with x; y };
      request_draw ()
  in

  let on_pointer_up ev =
    match !drag with
    | None -> ()
    | Some d ->
      let x, y = to_board ev in
      (match square_at x y with
       | Some sq when sq <> d.from ->
         let b = !board and ids = !piece_ids in
         let dx = (sq mod 8) - (d.from mod 8) in
         let dy = (sq / 8) - (d.from / 8) in
         let request_id = !next_request_id in
         next_request_id := Int32.succ request_id;
         let expected_piece_id = ids.(d.from) in
         let is_castle =
           (d.piece = 'k' || d.piece = 'K') && abs dx = 2 && dy = 0
         in
         let is_en_passant =
           (d.piece = 'p' || d.piece = 'P') && abs dx = 1
           && Bytes.unsafe_get b sq = empty
         in
         let action =
           if is_castle then begin
             let row = d.from / 8 in
             let src_x = d.from mod 8 and dst_x = sq mod 8 in
             let rook_src_x = src_x + if dx = 2 then 3 else -4 in
             let rook_dst_x = dst_x + if dx = 2 then -1 else 1 in
             let rook_src = (row * 8) + rook_src_x in
             let rook_dst = (row * 8) + rook_dst_x in
             let in_range i = i >= 0 && i < 64 in
             Some
               (Special
                  (Castle
                     {
                       king_src = d.from;
                       king_dst = sq;
                       rook_src;
                       rook_dst;
                       king_piece = d.piece;
                       rook_piece =
                         (if in_range rook_src then Bytes.unsafe_get b rook_src
                          else empty);
                       king_id = expected_piece_id;
                       rook_id = if in_range rook_src then ids.(rook_src) else 0l;
                     }))
           end
           else if is_en_passant then begin
             let captured = ((d.from / 8) * 8) + (sq mod 8) in
             Some
               (Special
                  (En_passant
                     {
                       src = d.from;
                       dst = sq;
                       captured;
                       pawn_piece = d.piece;
                       pawn_id = expected_piece_id;
                     }))
           end
           else begin
             let undo =
               {
                 src = d.from;
                 dst = sq;
                 src_piece = d.piece;
                 dst_piece = Bytes.unsafe_get b sq;
                 src_id = ids.(d.from);
                 dst_id = ids.(sq);
               }
             in
             Bytes.unsafe_set b d.from empty;
             Bytes.unsafe_set b sq d.piece;
             ids.(sq) <- expected_piece_id;
             ids.(d.from) <- 0l;
             Some (Normal undo)
           end
         in
         (match action with
          | None -> ()
          | Some action ->
            pending := Some { request_id; action };
            if
              not
                (send_move ~request_id ~expected_piece_id d.from sq)
            then begin
              (match action with
               | Normal undo -> restore_normal undo
               | Special _ -> ());
              pending := None
            end)
       | _ -> ());
      drag := None;
      request_draw ()
  in

  let on_pointer_cancel _ =
    drag := None;
    request_draw ()
  in

  ignore (Ev.listen Ev.pointerdown on_pointer_down (El.as_target canvas_el));
  let window = Window.as_target G.window in
  ignore (Ev.listen Ev.pointermove on_pointer_move window);
  ignore (Ev.listen Ev.pointerup on_pointer_up window);
  ignore (Ev.listen Ev.pointercancel on_pointer_cancel window);

  let find_el id =
    match Document.find_el_by_id G.document (Jstr.v id) with
    | Some el -> el
    | None -> failwith ("Could not find #" ^ id)
  in
  let x_el = find_el "board-x" in
  let y_el = find_el "board-y" in

  let coord el =
    match Jstr.to_int (El.prop El.Prop.value el) with
    | Some n -> max 0 (min max_coord n)
    | None -> 0
  in

  let on_input _ =
    match
      ( Jstr.to_int (El.prop El.Prop.value x_el),
        Jstr.to_int (El.prop El.Prop.value y_el) )
    with
    | Some x, Some y when x >= 0 && x <= max_coord && y >= 0 && y <= max_coord ->
        load_board x y
    | _ -> ()
  in

  let on_change _ =
    let x = coord x_el and y = coord y_el in
    El.set_prop El.Prop.value (Jstr.of_int x) x_el;
    El.set_prop El.Prop.value (Jstr.of_int y) y_el;
    load_board x y
  in

  ignore (Ev.listen Ev.input on_input (El.as_target x_el));
  ignore (Ev.listen Ev.input on_input (El.as_target y_el));
  ignore (Ev.listen Ev.change on_change (El.as_target x_el));
  ignore (Ev.listen Ev.change on_change (El.as_target y_el));

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
           if Tarray.Buffer.byte_length data > 0 then begin
             let view = Tarray.Data_view.of_buffer data in
             let accepted = Tarray.Data_view.get_uint8 view 0 <> 0 in
             (match !pending with
              | None -> ()
              | Some p ->
                ignore p.request_id;
                pending := None;
                if accepted then
                  (match p.action with
                   | Normal _ -> ()
                   | Special (Castle c) -> apply_castle c
                   | Special (En_passant e) -> apply_en_passant e)
                else
                  (match p.action with
                   | Normal undo -> restore_normal undo
                   | Special _ -> ());
                request_draw ());
             Metrics.received ();
             Console.(
               log
                 [ Jstr.v
                     (if accepted then "ws: move accepted"
                      else "ws: move rejected") ])
           end)
         target);
    ignore
      (Ev.listen Ev.open'
         (fun _ -> Console.(log [ Jstr.v "ws: connected" ]))
         target);
    ignore
      (Ev.listen Ev.error
         (fun _ -> Console.(log [ Jstr.v "ws: connection error" ]))
         target);
    ws := Some socket
  in

  connect_ws ();
  Metrics.init ();
  request_draw ()

let () = main ()
