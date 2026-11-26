(* Client-side possible-move hints for tap-to-move interactions.

   This is deliberately a hint generator, not the authority: the server still
   validates every move, including check, pins, castling rights and en
   passant. The generator covers the visible geometry, path blocking and the
   same-board capture rule used by the client. *)

type target = { bx : int; by : int; square : int; capture : bool }

let empty = 0
let type_code byte = (byte lsr 1) land 7
let is_white byte = byte land 1 = 1
let on_original byte = byte land 0x10 <> 0
let unmoved byte = byte land 0x20 <> 0

let board_key bx by = (by * 1000) + bx
let max_world = 8000

let targets ~get ~bx ~by ~square ~piece =
  let seen = Hashtbl.create 64 in
  let out = ref [] in
  let add ?(capture = false) bx by square =
    if bx >= 0 && bx < 1000 && by >= 0 && by < 1000 then
      let key = (by * 1000) + bx * 64 + square in
      if not (Hashtbl.mem seen key) then begin
        Hashtbl.add seen key ();
        out := { bx; by; square; capture } :: !out
      end
  in
  let src_white = is_white piece in
  let source_original = on_original piece in
  let piece_type = type_code piece in
  let src_x = (bx * 8) + (square mod 8) in
  let src_y = (by * 8) + (square / 8) in
  let at wx wy =
    if wx < 0 || wy < 0 || wx >= max_world || wy >= max_world then None
    else
      let tx = wx / 8 and ty = wy / 8 in
      match get tx ty with
      | None -> None
      | Some board ->
        Some (tx, ty, (wy mod 8) * 8 + (wx mod 8),
              Char.code (Bytes.unsafe_get board ((wy mod 8) * 8 + (wx mod 8))))
  in
  let can_capture tx ty byte =
    let same_board = tx = bx && ty = by in
    same_board && source_original && byte <> empty
    && is_white byte <> src_white
  in
  let try_step ?(capture_only = false) dx dy =
    let wx = src_x + dx and wy = src_y + dy in
    if abs dx <= 36 && abs dy <= 36 then
      match at wx wy with
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
          match at wx wy with
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
     (match at src_x (src_y + dir) with
      | Some (tx, ty, square, 0) ->
        add tx ty square;
        if on_original piece && (src_y mod 8) = start_rank then
          (match at src_x (src_y + (2 * dir)) with
           | Some (tx2, ty2, square2, 0) -> add tx2 ty2 square2
           | _ -> ())
      | _ -> ());
     List.iter
       (fun dx ->
         match at (src_x + dx) (src_y + dir) with
         | Some (tx, ty, square, byte) when can_capture tx ty byte ->
           add ~capture:true tx ty square
         | Some (tx, ty, square, 0)
           when tx = bx && ty = by && source_original ->
           (* En passant: an adjacent enemy pawn that just advanced two
              squares is capturable diagonally. *)
           (match at (src_x + dx) src_y with
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
     if unmoved piece then begin
       let rank = src_y mod 8 in
       let file = src_x mod 8 in
       if file = 4 then begin
         let can_castle king_file rook_file =
           match at ((bx * 8) + king_file) src_y with
           | Some (_, _, _, 0) ->
             (match at ((bx * 8) + rook_file) src_y with
              | Some (_, _, _, rook) when rook <> empty && unmoved rook ->
                let lo = min king_file rook_file + 1 in
                let hi = max king_file rook_file - 1 in
                let clear = ref true in
                for x = lo to hi do
                  match at ((bx * 8) + x) src_y with
                  | Some (_, _, _, 0) -> ()
                  | _ -> clear := false
                done;
                if !clear then
                  add bx by (rank * 8 + (if rook_file > 4 then 6 else 2))
              | _ -> ())
           | _ -> ()
         in
         can_castle 5 7;
         can_castle 3 0
       end
     end
   | _ -> ());
  List.rev !out
