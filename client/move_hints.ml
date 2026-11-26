(* Client-side possible-move hints for tap-to-move interactions.

   This is deliberately a hint generator, not the authority: the server still
   validates every move, including check, pins, extended castling rights and
   en passant. The generator covers the visible geometry, path blocking and
   the same-board capture rule used by the client. *)

type castle = {
  king_bx : int;
  king_by : int;
  king_square : int;
  rook_bx : int;
  rook_by : int;
  rook_square : int;
  rook_dst_bx : int;
  rook_dst_by : int;
  rook_dst_square : int;
}

type target = {
  bx : int;
  by : int;
  square : int;
  capture : bool;
  castle : castle option;
}

let empty = 0
let type_code byte = (byte lsr 1) land 7
let is_white byte = byte land 1 = 1
let on_original byte = byte land 0x10 <> 0
let unmoved byte = byte land 0x20 <> 0

let board_key bx by = (by * 1000) + bx
let max_world = 8000
let max_distance = 36

let world_in_bounds x y =
  x >= 0 && y >= 0 && x < max_world && y < max_world

let at ~get wx wy =
  if not (world_in_bounds wx wy) then None
  else
    let tx = wx / 8 and ty = wy / 8 in
    match get tx ty with
    | None -> None
    | Some board ->
      Some
        ( tx,
          ty,
          ((wy mod 8) * 8) + (wx mod 8),
          Char.code (Bytes.unsafe_get board ((wy mod 8) * 8 + (wx mod 8))) )

let castling ~get ~bx ~by ~square ~piece =
  if type_code piece <> 6 || not (unmoved piece) then []
  else
    let src_x = (bx * 8) + (square mod 8) in
    let src_y = (by * 8) + (square / 8) in
    let scan direction =
      let rec go x blocked =
        if not (world_in_bounds x src_y) || abs (x - src_x) > max_distance
        then None
        else
          match at ~get x src_y with
          | None -> None
          | Some (_, _, _, byte) when byte = empty -> go (x + direction) blocked
          | Some (tx, ty, rook_square, byte)
            when type_code byte = 4
                 && is_white byte = is_white piece
                 && unmoved byte ->
            if blocked then None
            else Some (x, tx, ty, rook_square)
          | Some _ -> go (x + direction) true
      in
      go (src_x + direction) false
    in
    List.filter_map
      (fun direction ->
        match scan direction with
        | None -> None
        | Some (rook_x, rook_bx, rook_by, rook_square) ->
          let lo = min src_x rook_x and hi = max src_x rook_x in
          let distance = hi - lo in
          if distance < 3 then None
          else
            let mid_lo = (lo + hi) / 2 in
            let mid_hi = mid_lo + 1 in
            let king_x = if rook_x > src_x then mid_hi else mid_lo in
            let rook_dst_x = if rook_x > src_x then mid_lo else mid_hi in
            let king_bx = king_x / 8 and king_by = src_y / 8 in
            let rook_dst_bx = rook_dst_x / 8 and rook_dst_by = src_y / 8 in
            Some
              {
                king_bx;
                king_by;
                king_square = ((src_y mod 8) * 8) + (king_x mod 8);
                rook_bx;
                rook_by;
                rook_square;
                rook_dst_bx;
                rook_dst_by;
                rook_dst_square =
                  ((src_y mod 8) * 8) + (rook_dst_x mod 8);
              })
      [ -1; 1 ]

let targets ~get ~bx ~by ~square ~piece =
  let seen = Hashtbl.create 64 in
  let out = ref [] in
  let add ?(capture = false) ?(castle = None) bx by square =
    if bx >= 0 && bx < 1000 && by >= 0 && by < 1000 then
      let key = (by * 1000) + bx * 64 + square in
      if not (Hashtbl.mem seen key) then begin
        Hashtbl.add seen key ();
        out := { bx; by; square; capture; castle } :: !out
      end
  in
  let src_white = is_white piece in
  let source_original = on_original piece in
  let piece_type = type_code piece in
  let src_x = (bx * 8) + (square mod 8) in
  let src_y = (by * 8) + (square / 8) in
  let can_capture tx ty byte =
    let same_board = tx = bx && ty = by in
    same_board && source_original && byte <> empty
    && is_white byte <> src_white
  in
  let try_step ?(capture_only = false) dx dy =
    let wx = src_x + dx and wy = src_y + dy in
    if abs dx <= max_distance && abs dy <= max_distance then
      match at ~get wx wy with
      | None -> ()
      | Some (tx, ty, square, byte) ->
        if byte = empty then begin
          if not capture_only then add tx ty square
        end
        else if can_capture tx ty byte then add ~capture:true tx ty square
  in
  let slide steps =
    List.iter
      (fun (dx, dy) ->
        let rec go wx wy =
          let ddx = abs (wx - src_x) and ddy = abs (wy - src_y) in
          if ddx > max_distance || ddy > max_distance then ()
          else
            match at ~get wx wy with
            | None -> ()
            | Some (tx, ty, square, byte) ->
              if byte = empty then begin
                add tx ty square;
                go (wx + dx) (wy + dy)
              end
              else if can_capture tx ty byte then add ~capture:true tx ty square
        in
        go (src_x + dx) (src_y + dy))
      steps
  in
  (match piece_type with
   | 1 ->
     let dir = if src_white then -1 else 1 in
     let start_rank = if src_white then 6 else 1 in
     (match at ~get src_x (src_y + dir) with
      | Some (tx, ty, square, 0) ->
        add tx ty square;
        if on_original piece && (src_y mod 8) = start_rank then
          (match at ~get src_x (src_y + (2 * dir)) with
           | Some (tx2, ty2, square2, 0) -> add tx2 ty2 square2
           | _ -> ())
      | _ -> ());
     List.iter
       (fun dx ->
         match at ~get (src_x + dx) (src_y + dir) with
         | Some (tx, ty, square, byte) when can_capture tx ty byte ->
           add ~capture:true tx ty square
         | Some (tx, ty, square, 0)
           when tx = bx && ty = by && source_original ->
           (* En passant: an adjacent enemy pawn that just advanced two
              squares is capturable diagonally. *)
           (match at ~get (src_x + dx) src_y with
            | Some (_, _, _, adjacent)
              when adjacent <> empty && type_code adjacent = 1
                   && Int64.logand (Int64.of_int adjacent) 0x20L <> 0L
                   && is_white adjacent <> src_white ->
              add ~capture:true tx ty square
            | _ -> ())
         | _ -> ())
       [ -1; 1 ]
   | 2 -> slide [ (-1, -1); (-1, 1); (1, -1); (1, 1) ]
   | 3 ->
     List.iter
       (fun (dx, dy) -> try_step dx dy)
       [ (-2, -1); (-2, 1); (-1, -2); (-1, 2);
         (1, -2); (1, 2); (2, -1); (2, 1) ]
   | 4 -> slide [ (-1, 0); (1, 0); (0, -1); (0, 1) ]
   | 5 ->
     slide
       [ (-1, -1); (-1, 1); (1, -1); (1, 1);
         (-1, 0); (1, 0); (0, -1); (0, 1) ]
   | 6 ->
     List.iter
       (fun (dx, dy) -> try_step dx dy)
       [ (-1, -1); (-1, 0); (-1, 1); (0, -1);
         (0, 1); (1, -1); (1, 0); (1, 1) ];
     List.iter
       (fun castle ->
         add ~castle:(Some castle) castle.king_bx castle.king_by
           castle.king_square)
       (castling ~get ~bx ~by ~square ~piece)
   | _ -> ());
  List.rev !out
