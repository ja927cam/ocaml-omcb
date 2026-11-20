open Protocol.Types

let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let pos bx by x y = { board_x = bx; board_y = by; x; y }
let move src dst = { src; dst }

let same_position (a : position) (b : position) =
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

  (* Snapshot codecs. *)
  let snap_request =
    { Protocol.Types.request_id = 91l; board_x = 999; board_y = 0 }
  in
  let sb = Protocol.Types.snapshot_request_to_bytes snap_request in
  check "snapshot request length" (Bytes.length sb = 9);
  (match Protocol.Types.snapshot_request_of_bytes sb with
   | None -> failwith "snapshot request decoded to None"
   | Some r ->
     check "snapshot request id" (r.request_id = 91l);
     check "snapshot request x" (r.board_x = 999);
     check "snapshot request y" (r.board_y = 0));

  expect_invalid "snapshot request invalid coordinates" (fun () ->
      Protocol.Types.snapshot_request_to_bytes
        { snap_request with board_x = 1000 });

  let bad_coord = Bytes.copy sb in
  Bytes.set bad_coord 5 (Char.chr 0xE8);
  Bytes.set bad_coord 6 (Char.chr 0x03);
  check "snapshot request coordinate validation"
    (Protocol.Types.snapshot_request_of_bytes bad_coord = None);
  check "snapshot request wrong type"
    (let b = Bytes.copy sb in
     Bytes.set b 0 (Char.chr 1);
     Protocol.Types.snapshot_request_of_bytes b = None);
  check "snapshot request wrong length"
    (Protocol.Types.snapshot_request_of_bytes (Bytes.create 8) = None);

  let board =
    Array.init 64 (fun i ->
        if i mod 7 = 0 then 0L else Int64.of_int ((i * 1000) + 1))
  in
  let snap_response =
    {
      Protocol.Types.request_id = 92l;
      board_x = 999;
      board_y = 999;
      status = Protocol.Types.Snapshot_ok;
      board;
    }
  in
  let rb = Protocol.Types.snapshot_response_to_bytes snap_response in
  check "snapshot response length" (Bytes.length rb = 521);
  (match Protocol.Types.snapshot_response_of_bytes rb with
   | None -> failwith "snapshot response decoded to None"
   | Some r ->
     check "snapshot response status"
       (r.status = Protocol.Types.Snapshot_ok);
     check "snapshot response id" (r.request_id = 92l);
     check "snapshot response x" (r.board_x = 999);
     check "snapshot response y" (r.board_y = 999);
     check "snapshot response board length" (Array.length r.board = 64);
     check "snapshot response empty square" (r.board.(0) = 0L);
     check "snapshot response piece"
       (r.board.(1) = Int64.of_int 1001));

  let failed =
    {
      snap_response with
      status = Protocol.Types.Snapshot_failed;
      board = Array.make 64 1L;
    }
  in
  (match Protocol.Types.snapshot_response_of_bytes
           (Protocol.Types.snapshot_response_to_bytes failed) with
   | None -> failwith "failed snapshot decoded to None"
   | Some r ->
     check "failed snapshot status" (r.status = Protocol.Types.Snapshot_failed);
     check "failed snapshot board is zero"
       (Array.for_all (Int64.equal 0L) r.board));

  expect_invalid "snapshot response wrong board size" (fun () ->
      Protocol.Types.snapshot_response_to_bytes
        { snap_response with board = Array.make 63 0L });
  check "snapshot response wrong length"
    (Protocol.Types.snapshot_response_of_bytes (Bytes.create 520) = None);

  (* Wire framing: every response is padded to 4096 bytes so Dream flushes. *)
  let wire_move =
    Protocol.Types.wire_response_to_bytes
      (Protocol.Types.Wire_move accepted_response)
  in
  check "wire move length"
    (Bytes.length wire_move = Protocol.Types.wire_response_bytes);
  check "wire move kind"
    (Char.code (Bytes.get wire_move 0) = Protocol.Types.wire_kind_move);
  (match Protocol.Types.wire_response_of_bytes wire_move with
   | Some (Protocol.Types.Wire_move r) ->
     check "wire move id" (r.request_id = accepted_response.request_id);
     check "wire move sequence" (r.sequence = accepted_response.sequence)
   | _ -> failwith "wire move decoded incorrectly");
  let wire_snapshot =
    Protocol.Types.wire_response_to_bytes
      (Protocol.Types.Wire_snapshot snap_response)
  in
  check "wire snapshot length"
    (Bytes.length wire_snapshot = Protocol.Types.wire_response_bytes);
  (match Protocol.Types.wire_response_of_bytes wire_snapshot with
   | Some (Protocol.Types.Wire_snapshot r) ->
     check "wire snapshot id" (r.request_id = snap_response.request_id);
     check "wire snapshot board" (r.board.(1) = snap_response.board.(1))
   | _ -> failwith "wire snapshot decoded incorrectly");
  check "wire short frame rejected"
    (Protocol.Types.wire_response_of_bytes (Bytes.create 4095) = None);
  check "wire wrong kind rejected"
    (let b = Bytes.copy wire_move in
     Bytes.set b 0 (Char.chr 99);
     Protocol.Types.wire_response_of_bytes b = None);

  Printf.printf "All protocol move codec tests passed.\n"
