open Protocol.Types

let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let pos bx by x y = { board_x = bx; board_y = by; x; y }
let move src dst = { src; dst }

let same_position a b =
  a.board_x = b.board_x && a.board_y = b.board_y && a.x = b.x && a.y = b.y

let roundtrip name m =
  let bytes = move_to_bytes m in
  check (name ^ " length") (Bytes.length bytes = 5);
  match move_of_bytes bytes with
  | None -> failwith ("FAIL: " ^ name ^ " decoded to None")
  | Some decoded ->
    check (name ^ " src") (same_position decoded.src m.src);
    check (name ^ " dst") (same_position decoded.dst m.dst)

let expect_invalid name f =
  match f () with
  | exception Invalid_argument _ -> ()
  | _ -> failwith ("FAIL: " ^ name ^ " did not raise Invalid_argument")

let () =
  let p = pos 999 999 7 7 in
  check "position roundtrip"
    (same_position (position_of_int (position_to_int p)) p);

  roundtrip "same board" (move (pos 0 0 4 6) (pos 0 0 4 4));
  roundtrip "positive max delta" (move (pos 0 0 0 0) (pos 4 0 4 0));
  roundtrip "negative max delta" (move (pos 4 0 4 0) (pos 0 0 0 0));
  roundtrip "diagonal max delta" (move (pos 0 0 0 0) (pos 4 0 4 4));
  roundtrip "cross-board" (move (pos 7 3 5 2) (pos 7 4 1 6));
  roundtrip "world edge" (move (pos 998 999 7 7) (pos 999 999 5 3));

  expect_invalid "delta over 36" (fun () ->
      move_to_bytes (move (pos 0 0 0 0) (pos 4 0 5 0)));
  expect_invalid "negative delta over 36" (fun () ->
      move_to_bytes (move (pos 4 0 5 0) (pos 0 0 0 0)));
  expect_invalid "board outside world" (fun () ->
      move_to_bytes (move (pos 1000 0 0 0) (pos 1000 0 0 1)));

  check "short frame rejected" (move_of_bytes (Bytes.create 4) = None);
  check "long frame rejected" (move_of_bytes (Bytes.create 6) = None);

  Printf.printf "All protocol move codec tests passed.\n"
