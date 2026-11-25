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
    Bytes.init 64 (fun i -> if i mod 7 = 0 then '\000' else Char.chr (i + 1))
  in
  let snap_response =
    {
      Protocol.Types.request_id = 92l;
      board_x = 999;
      board_y = 999;
      status = Protocol.Types.Snapshot_ok;
      revision = 7L;
      board;
    }
  in
  let rb = Protocol.Types.snapshot_response_to_bytes snap_response in
  check "snapshot response length" (Bytes.length rb = 81);
  (match Protocol.Types.snapshot_response_of_bytes rb with
   | None -> failwith "snapshot response decoded to None"
   | Some r ->
     check "snapshot response status"
       (r.status = Protocol.Types.Snapshot_ok);
     check "snapshot response id" (r.request_id = 92l);
     check "snapshot response x" (r.board_x = 999);
     check "snapshot response y" (r.board_y = 999);
     check "snapshot response revision" (r.revision = 7L);
     check "snapshot response board length" (Bytes.length r.board = 64);
     check "snapshot response empty square" (Bytes.get r.board 0 = '\000');
     check "snapshot response piece" (Bytes.get r.board 1 = Char.chr 2));

  let failed =
    {
      snap_response with
      status = Protocol.Types.Snapshot_failed;
      board = Bytes.make 64 '\001';
    }
  in
  (match Protocol.Types.snapshot_response_of_bytes
           (Protocol.Types.snapshot_response_to_bytes failed) with
   | None -> failwith "failed snapshot decoded to None"
   | Some r ->
     check "failed snapshot status" (r.status = Protocol.Types.Snapshot_failed);
     check "failed snapshot revision" (r.revision = 0L);
     check "failed snapshot board is zero"
       (Bytes.for_all (fun c -> c = '\000') r.board));

  expect_invalid "snapshot response wrong board size" (fun () ->
      Protocol.Types.snapshot_response_to_bytes
        { snap_response with board = Bytes.make 63 '\000' });
  check "snapshot response wrong length"
    (Protocol.Types.snapshot_response_of_bytes (Bytes.create 80) = None);

  (* Packed-to-client-byte projection used by move acknowledgements. *)
  let packed ?(white = false) ?(moves = 0) ?(double = false)
      ?(on_original = false) type_code =
    let base = Int64.shift_left (Int64.of_int type_code) 25 in
    let base =
      if white then Int64.logor base (Int64.shift_left 1L 29) else base
    in
    let base =
      if moves = 0 then base
      else Int64.logor base (Int64.shift_left (Int64.of_int moves) 40)
    in
    let base =
      if double then Int64.logor base (Int64.shift_left 1L 30) else base
    in
    if on_original then Int64.logor base (Int64.shift_left 1L 38)
    else base
  in
  check "client byte white pawn"
    (Protocol.Types.client_byte_of_packed
       (packed ~white:true ~on_original:true 1) = 19);
  check "client byte black bishop"
    (Protocol.Types.client_byte_of_packed
       (packed ~on_original:true 3) = 20);
  check "client byte white knight"
    (Protocol.Types.client_byte_of_packed
       (packed ~white:true ~on_original:true 2) = 23);
  check "client byte moved rook"
    (Protocol.Types.client_byte_of_packed
       (packed ~white:true ~moves:1 4) = 9);
  check "client byte rook back home"
    (Protocol.Types.client_byte_of_packed
       (packed ~white:true ~moves:1 ~on_original:true 4) = 25);
  check "client byte double-moved pawn"
    (Protocol.Types.client_byte_of_packed
       (packed ~white:true ~moves:1 ~double:true 1) = 35);
  check "client byte promoted pawn"
    (Protocol.Types.client_byte_of_packed (packed ~moves:1 7) = 10);

  (* Subscription messages. *)
  let sub = Protocol.Types.board_subscription_to_bytes Subscribe 12 34 in
  check "subscribe length" (Bytes.length sub = 5);
  (match Protocol.Types.board_subscription_of_bytes sub with
   | Some (Protocol.Types.Subscribe, x, y) ->
     check "subscribe x" (x = 12);
     check "subscribe y" (y = 34)
   | _ -> failwith "subscribe decoded incorrectly");
  let unsub = Protocol.Types.board_subscription_to_bytes Unsubscribe 12 34 in
  (match Protocol.Types.board_subscription_of_bytes unsub with
   | Some (Protocol.Types.Unsubscribe, x, y) ->
     check "unsubscribe x" (x = 12);
     check "unsubscribe y" (y = 34)
   | _ -> failwith "unsubscribe decoded incorrectly");
  check "subscription wrong length"
    (Protocol.Types.board_subscription_of_bytes (Bytes.create 4) = None);
  let window =
    Protocol.Types.{ center_x = 500; center_y = 600; radius = 12 }
  in
  let wb = Protocol.Types.subscription_window_to_bytes window in
  check "window length" (Bytes.length wb = 6);
  (match Protocol.Types.subscription_window_of_bytes wb with
   | Some decoded ->
     check "window x" (decoded.center_x = 500);
     check "window y" (decoded.center_y = 600);
     check "window radius" (decoded.radius = 12)
   | None -> failwith "window decoded incorrectly");
  expect_invalid "window radius" (fun () ->
      Protocol.Types.subscription_window_to_bytes
        { window with radius = 101 });

  (* Live move event framing. *)
  let change square piece = Protocol.Types.{ square; piece } in
  let event =
    Protocol.Types.
      {
        sequence = 99L;
        request_id = 123l;
        boards =
          [
            {
              board_x = 500;
              board_y = 400;
              revision = 8L;
              changes = [ change 52 0; change 36 51 ];
            };
            {
              board_x = 501;
              board_y = 400;
              revision = 3L;
              changes = [ change 0 0; change 7 25 ];
            };
          ];
      }
  in
  let eb = Protocol.Types.wire_response_to_bytes (Protocol.Types.Wire_event event) in
  check "event frame length"
    (Bytes.length eb = Protocol.Types.wire_response_bytes);
  check "event kind"
    (Char.code (Bytes.get eb 0) = Protocol.Types.wire_kind_event);
  (match Protocol.Types.wire_response_of_bytes eb with
   | Some (Protocol.Types.Wire_event decoded) ->
     check "event sequence" (decoded.sequence = 99L);
     check "event request" (decoded.request_id = 123l);
     check "event board count" (List.length decoded.boards = 2);
     let first = List.hd decoded.boards in
     check "event board x" (first.board_x = 500);
     check "event board y" (first.board_y = 400);
     check "event board revision" (first.revision = 8L);
     check "event change count" (List.length first.changes = 2);
     check "event change square" ((List.hd first.changes).square = 52);
     check "event change piece" ((List.hd first.changes).piece = 0)
   | _ -> failwith "event decoded incorrectly");

  (* Batched event framing. *)
  let second_event =
    Protocol.Types.
      {
        sequence = 100L;
        request_id = 124l;
        boards =
          [
            {
              board_x = 501;
              board_y = 400;
              revision = 4L;
              changes = [ change 0 0; change 7 25 ];
            };
          ];
      }
  in
  let payload1 = Protocol.Types.move_event_payload_to_bytes event in
  let payload2 = Protocol.Types.move_event_payload_to_bytes second_event in
  let batch = Bytes.make Protocol.Types.wire_response_bytes '\000' in
  Bytes.set batch 0 (Char.chr Protocol.Types.wire_kind_event_batch);
  Bytes.set batch 1 (Char.chr 2);
  Bytes.blit payload1 0 batch 2 (Bytes.length payload1);
  Bytes.blit payload2 0 batch (2 + Bytes.length payload1) (Bytes.length payload2);
  (match Protocol.Types.move_events_of_bytes batch with
   | Some [ first; second ] ->
     check "batch first sequence" (first.sequence = 99L);
     check "batch second sequence" (second.sequence = 100L);
     check "batch second request" (second.request_id = 124l);
     check "batch second board" ((List.hd second.boards).board_x = 501)
   | _ -> failwith "batch decoded incorrectly");

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
     check "wire snapshot board" (Bytes.get r.board 1 = Bytes.get snap_response.board 1)
   | _ -> failwith "wire snapshot decoded incorrectly");
  check "wire short frame rejected"
    (Protocol.Types.wire_response_of_bytes (Bytes.create 4095) = None);
  check "wire wrong kind rejected"
    (let b = Bytes.copy wire_move in
     Bytes.set b 0 (Char.chr 99);
     Protocol.Types.wire_response_of_bytes b = None);

  (* Batched snapshot codec. *)
  let batch_request =
    { request_id = 991l; x0 = 3; y0 = 4; x1 = 27; y1 = 28 }
  in
  let request_bytes =
    Protocol.Types.snapshot_batch_request_to_bytes batch_request
  in
  check "batch request length"
    (Bytes.length request_bytes
    = Protocol.Types.snapshot_batch_request_bytes);
  (match Protocol.Types.snapshot_batch_request_of_bytes request_bytes with
   | Some decoded ->
     check "batch request id" (decoded.request_id = 991l);
     check "batch request x0" (decoded.x0 = 3);
     check "batch request y1" (decoded.y1 = 28)
   | None -> failwith "batch request decoded to None");
  expect_invalid "batch request empty region" (fun () ->
      Protocol.Types.snapshot_batch_request_to_bytes
        { batch_request with x0 = 5; x1 = 4 });
  expect_invalid "batch request oversized region" (fun () ->
      Protocol.Types.snapshot_batch_request_to_bytes
        { batch_request with x0 = 0; y0 = 0; x1 = 999; y1 = 999 });

  let batch_window =
    {
      Protocol.Types.request_id = 992l;
      x0 = 486;
      y0 = 486;
      x1 = 514;
      y1 = 514;
      center_x = 500;
      center_y = 500;
      radius = 14;
    }
  in
  let window_bytes =
    Protocol.Types.snapshot_batch_window_request_to_bytes batch_window
  in
  check "batch window request length"
    (Bytes.length window_bytes
    = Protocol.Types.snapshot_batch_window_request_bytes);
  (match
     Protocol.Types.snapshot_batch_window_request_of_bytes window_bytes
   with
   | Some decoded ->
     check "batch window request id" (decoded.request_id = 992l);
     check "batch window center" (decoded.center_x = 500);
     check "batch window radius" (decoded.radius = 14);
     check "batch window region" (decoded.x0 = 486 && decoded.y1 = 514)
   | None -> failwith "batch window request decoded to None");
  check "batch window wrong length rejected"
    (Protocol.Types.snapshot_batch_window_request_of_bytes
       (Bytes.create 17) = None);
  check "batch window wrong kind rejected"
    (let b = Bytes.copy window_bytes in
     Bytes.set b 0 (Char.chr 6);
     Protocol.Types.snapshot_batch_window_request_of_bytes b = None);
  expect_invalid "batch window invalid region" (fun () ->
      Protocol.Types.snapshot_batch_window_request_to_bytes
        { batch_window with x0 = 5; x1 = 4 });
  expect_invalid "batch window invalid radius" (fun () ->
      Protocol.Types.snapshot_batch_window_request_to_bytes
        { batch_window with radius = 101 });

  let board_of pieces =
    let bytes = Bytes.make 64 '\000' in
    List.iter (fun (square, piece) -> Bytes.set bytes square (Char.chr piece)) pieces;
    bytes
  in
  let batch =
    {
      Protocol.Types.request_id = 991l;
      x0 = 3;
      y0 = 4;
      width = 3;
      height = 2;
      boards =
        [|
          { Protocol.Types.revision = 0L; pieces = board_of [] };
          { Protocol.Types.revision = 7L;
            pieces = board_of [ (0, 1); (5, 33); (63, 255) ] };
          { Protocol.Types.revision = 1L;
            pieces =
              board_of
                (List.init 64 (fun i -> (i, ((i * 3) + 1) land 0xff))) };
          { Protocol.Types.revision = 2L; pieces = board_of [] };
          { Protocol.Types.revision = 3L; pieces = board_of [ (31, 17) ] };
          { Protocol.Types.revision = Int64.max_int;
            pieces = board_of [ (0, 2); (1, 3) ] };
        |];
    }
  in
  let encoded = Protocol.Types.snapshot_batch_to_bytes batch in
  check "batch kind"
    (Char.code (Bytes.get encoded 0) = Protocol.Types.wire_kind_snapshot_batch);
  (* 13-byte header + two empty boards (16 each) + three piece bytes + 64
     bytes + one byte + two bytes. *)
  check "batch compact length"
    (Bytes.length encoded
    = 13 + 16 + 16 + 16 + 3 + 16 + 64 + 16 + 1 + 16 + 2);
  (match Protocol.Types.snapshot_batch_of_bytes encoded with
   | None -> failwith "batch decoded to None"
   | Some decoded ->
     check "batch width" (decoded.width = 3);
     check "batch height" (decoded.height = 2);
     check "batch board count" (Array.length decoded.boards = 6);
     check "batch first revision" (decoded.boards.(0).revision = 0L);
     check "batch second revision" (decoded.boards.(1).revision = 7L);
     check "batch second pieces"
       (Bytes.get decoded.boards.(1).pieces 0 = Char.chr 1
       && Bytes.get decoded.boards.(1).pieces 5 = Char.chr 33
       && Bytes.get decoded.boards.(1).pieces 63 = Char.chr 255
       && Bytes.get decoded.boards.(1).pieces 6 = '\000');
     for index = 0 to 5 do
       check ("batch pieces " ^ string_of_int index)
         (Bytes.equal decoded.boards.(index).pieces
            batch.boards.(index).pieces);
       check ("batch revision " ^ string_of_int index)
         (decoded.boards.(index).revision
         = batch.boards.(index).revision)
     done);
  check "batch truncated frame rejected"
    (Protocol.Types.snapshot_batch_of_bytes
       (Bytes.sub encoded 0 (Bytes.length encoded - 1))
    = None);
  check "batch oversized frame rejected"
    (Protocol.Types.snapshot_batch_of_bytes
       (Bytes.cat encoded (Bytes.make 1 '\000'))
    = None);

  (* A full 25 x 25 cache of standard starting boards must stay far below the
     625 x 4096 = 2.56 MiB fixed-frame baseline. Each board has 32 occupied
     squares. *)
  let standard =
    let pieces = Bytes.make 64 '\000' in
    for i = 0 to 15 do
      Bytes.set pieces i (Char.chr 4);
      Bytes.set pieces (48 + i) (Char.chr 5)
    done;
    pieces
  in
  let full =
    {
      Protocol.Types.request_id = 1l;
      x0 = 0;
      y0 = 0;
      width = 25;
      height = 25;
      boards =
        Array.init 625 (fun _ ->
            { Protocol.Types.revision = 0L; pieces = standard });
    }
  in
  let full_encoded = Protocol.Types.snapshot_batch_to_bytes full in
  check "batch 25x25 under 32 KiB"
    (Bytes.length full_encoded < 32 * 1024);

  (* Compact batch codec: empty, standard, bitmap and full board tags,
     including multi-byte revisions. *)
  let compact_standard = Bytes.copy Protocol.Types.standard_board_bytes in
  let compact_empty = Bytes.make 64 '\000' in
  let compact_bitmap = board_of [ (0, 4); (31, 77); (63, 255) ] in
  let compact_full =
    board_of (List.init 64 (fun i -> (i, ((i * 7) + 1) land 0xff)))
  in
  let compact =
    {
      Protocol.Types.request_id = 4242l;
      x0 = 10;
      y0 = 20;
      width = 2;
      height = 2;
      boards =
        [|
          { Protocol.Types.revision = 0L; pieces = compact_empty };
          { Protocol.Types.revision = 127L; pieces = compact_standard };
          { Protocol.Types.revision = 128L; pieces = compact_bitmap };
          { Protocol.Types.revision = Int64.max_int; pieces = compact_full };
        |];
    }
  in
  let compact_bytes = Protocol.Types.compact_snapshot_batch_to_bytes compact in
  check "compact kind"
    (Char.code (Bytes.get compact_bytes 0)
    = Protocol.Types.wire_kind_compact_snapshot_batch);
  (match Protocol.Types.compact_snapshot_batch_of_bytes compact_bytes with
   | None -> failwith "compact batch decoded to None"
   | Some decoded ->
     check "compact board count" (Array.length decoded.boards = 4);
     for index = 0 to 3 do
       check ("compact revision " ^ string_of_int index)
         (decoded.boards.(index).revision = compact.boards.(index).revision);
       check ("compact pieces " ^ string_of_int index)
         (Bytes.equal decoded.boards.(index).pieces
            compact.boards.(index).pieces)
     done);
  check "compact wire dispatch"
    (match Protocol.Types.snapshot_batch_of_wire_bytes compact_bytes with
     | Some batch -> Bool.equal true (batch.request_id = 4242l)
     | None -> false);
  check "compact truncated frame rejected"
    (Protocol.Types.compact_snapshot_batch_of_bytes
       (Bytes.sub compact_bytes 0 (Bytes.length compact_bytes - 1))
    = None);
  check "compact bad tag rejected"
    (let bad = Bytes.copy compact_bytes in
     (* The first board tag is the byte immediately after the header. *)
     Bytes.set bad 13 (Char.chr 99);
     Protocol.Types.compact_snapshot_batch_of_bytes bad = None);

  let compact_standard_full =
    {
      Protocol.Types.request_id = 7l;
      x0 = 0;
      y0 = 0;
      width = 25;
      height = 25;
      boards =
        Array.init 625 (fun _ ->
            { Protocol.Types.revision = 0L; pieces = compact_standard });
    }
  in
  let compact_full_bytes =
    Protocol.Types.compact_snapshot_batch_to_bytes compact_standard_full
  in
  check "compact 25x25 standard under 2 KiB"
    (Bytes.length compact_full_bytes < 2048);

  (* Piece information request and response. *)
  let piece_request =
    Protocol.Types.
      { request_id = 5150l; board_x = 12; board_y = 34; square = 52 }
  in
  let piece_request_bytes =
    Protocol.Types.piece_info_request_to_bytes piece_request
  in
  check "piece info request length"
    (Bytes.length piece_request_bytes
    = Protocol.Types.piece_info_request_bytes);
  (match Protocol.Types.piece_info_request_of_bytes piece_request_bytes with
   | Some decoded ->
     check "piece info request id" (decoded.request_id = 5150l);
     check "piece info request square" (decoded.square = 52)
   | None -> failwith "piece info request decoded to None");
  expect_invalid "piece info square out of range" (fun () ->
      Protocol.Types.piece_info_request_to_bytes
        { piece_request with square = 64 });
  check "piece info bad square rejected"
    (let bad = Bytes.copy piece_request_bytes in
     Bytes.set bad 9 (Char.chr 64);
     Protocol.Types.piece_info_request_of_bytes bad = None);

  let piece_info =
    Protocol.Types.
      {
        request_id = 5150l;
        board_x = 12;
        board_y = 34;
        square = 52;
        status = Piece_found;
        revision = 9L;
        id = 123456l;
        type_code = 1;
        is_white = true;
        flags = 0b1000_0001;
        adopted = false;
        move_count = 3;
        capture_count = 2;
        raw = 0x1234_5678_9abcL;
      }
  in
  let info_bytes =
    Protocol.Types.wire_response_to_bytes
      (Protocol.Types.Wire_piece_info piece_info)
  in
  check "piece info wire length"
    (Bytes.length info_bytes = Protocol.Types.wire_response_bytes);
  check "piece info wire kind"
    (Char.code (Bytes.get info_bytes 0)
    = Protocol.Types.wire_kind_piece_info);
  (match Protocol.Types.wire_response_of_bytes info_bytes with
   | Some (Protocol.Types.Wire_piece_info decoded) ->
     check "piece info id" (decoded.id = piece_info.id);
     check "piece info colour" (decoded.is_white = piece_info.is_white);
     check "piece info moves" (decoded.move_count = piece_info.move_count);
     check "piece info captures"
       (decoded.capture_count = piece_info.capture_count);
     check "piece info flags" (decoded.flags = piece_info.flags);
     check "piece info raw" (decoded.raw = piece_info.raw);
     check "piece info revision"
       (decoded.revision = piece_info.revision)
   | _ -> failwith "piece info decoded incorrectly");
  let absent =
    { piece_info with status = Piece_absent; id = 0l; raw = 0L;
      type_code = 0; is_white = false; flags = 0; move_count = 0;
      capture_count = 0 }
  in
  (match
     Protocol.Types.piece_info_of_bytes
       (Protocol.Types.wire_response_to_bytes
          (Protocol.Types.Wire_piece_info absent))
   with
   | Some decoded -> check "absent piece status"
       (decoded.status = Protocol.Types.Piece_absent)
   | None -> failwith "absent piece info decoded to None");

  Printf.printf "All protocol move codec tests passed.\n"
