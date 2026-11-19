open Protocol.Types

let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let pos bx by x y = { board_x = bx; board_y = by; x; y }
let move src dst = { src; dst }

let same_position a b =
  a.board_x = b.board_x && a.board_y = b.board_y && a.x = b.x && a.y = b.y

let roundtrip name m =
  let bytes = move_to_bytes m in
  check (name ^ " length") (Bytes.length bytes = 6);
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
  roundtrip "positive max delta" (move (pos 0 0 0 0) (pos 16 0 0 0));
  roundtrip "negative max delta" (move (pos 16 0 0 0) (pos 0 0 0 0));
  roundtrip "diagonal max delta" (move (pos 0 0 0 0) (pos 16 16 0 0));
  roundtrip "cross-board" (move (pos 7 3 5 2) (pos 7 4 1 6));
  roundtrip "world edge" (move (pos 998 999 7 7) (pos 999 999 5 3));

  expect_invalid "delta over 128" (fun () ->
      move_to_bytes (move (pos 0 0 0 0) (pos 16 0 1 0)));
  expect_invalid "negative delta over 128" (fun () ->
      move_to_bytes (move (pos 16 0 1 0) (pos 0 0 0 0)));
  expect_invalid "board outside world" (fun () ->
      move_to_bytes (move (pos 1000 0 0 0) (pos 1000 0 0 1)));

  check "short frame rejected" (move_of_bytes (Bytes.create 4) = None);
  check "long frame rejected" (move_of_bytes (Bytes.create 7) = None);

  let request =
    {
      request_id = 77l;
      expected_piece_id = 12345l;
      move = move (pos 3 4 2 5) (pos 3 4 2 3);
    }
  in
  let request_bytes = move_request_to_bytes request in
  check "request length" (Bytes.length request_bytes = 14);
  (match move_request_of_bytes request_bytes with
   | None -> failwith "request decoded to None"
   | Some decoded ->
     check "request id" (decoded.request_id = request.request_id);
     check "expected id" (decoded.expected_piece_id = request.expected_piece_id);
     check "request move src" (same_position decoded.move.src request.move.src);
     check "request move dst" (same_position decoded.move.dst request.move.dst));

  expect_invalid "invalid request piece id" (fun () ->
      move_request_to_bytes { request with expected_piece_id = 0l });

  let accepted_response =
    {
      request_id = 77l;
      status = Accepted;
      sequence = 42L;
      moved_piece = 0x1234567890L;
      captured_piece_id = 99l;
      rejection = 0;
    }
  in
  let rb = response_to_bytes accepted_response in
  check "response length" (Bytes.length rb = 26);
  (match response_of_bytes rb with
   | None -> failwith "response decoded to None"
   | Some r ->
     check "response status" (r.status = Accepted);
     check "response request" (r.request_id = 77l);
     check "response sequence" (r.sequence = 42L);
     check "response moved piece" (r.moved_piece = 0x1234567890L);
     check "response captured" (r.captured_piece_id = 99l);
     check "response rejection" (r.rejection = 0));

  let rejected_response =
    { accepted_response with status = Rejected; sequence = 0L;
      moved_piece = 0L; captured_piece_id = 0l;
      rejection = rejection_blocked_path }
  in
  (match response_of_bytes (response_to_bytes rejected_response) with
   | None -> failwith "rejected response decoded to None"
   | Some r ->
     check "rejected status" (r.status = Rejected);
     check "rejected code" (r.rejection = rejection_blocked_path));

  check "short response rejected" (response_of_bytes (Bytes.create 25) = None);

  Printf.printf "All protocol move codec tests passed.\n"
