let check_int name expected actual =
  if expected <> actual then
    failwith (Printf.sprintf "FAIL: %s (expected %d, got %d)" name expected actual)

let check_near name expected actual =
  if abs_float (expected -. actual) > 1. then
    failwith
      (Printf.sprintf "FAIL: %s (expected %.2f, got %.2f)" name expected actual)

let test_kings_captured () =
  let tally = Kings_captured.create () in
  Kings_captured.note_capture tally 5l;
  Kings_captured.note_capture tally 29l;
  Kings_captured.note_capture tally 1l;
  Kings_captured.note_capture tally 0l;
  Kings_captured.note_capture tally 229l;
  Kings_captured.note_capture tally 60l;
  check_int "black kings noted" 2 (Kings_captured.black tally);
  check_int "white kings noted" 1 (Kings_captured.white tally);
  let ledger = Ledger.create 8 in
  let pos = Ledger.pack_position 10 20 in
  let move = Ledger.pack_move pos pos in
  ignore (Ledger.append ledger move 5l 5l 0);
  ignore (Ledger.append ledger move 29l 29l 0);
  ignore (Ledger.append ledger move 12l 12l 0);
  let scanned = Kings_captured.create () in
  Kings_captured.scan_ledger scanned ledger;
  check_int "ledger black kings" 1 (Kings_captured.black scanned);
  check_int "ledger white kings" 1 (Kings_captured.white scanned)

let test_activity_map () =
  let activity = Activity_map.create () in
  Activity_map.note activity ~bx:120 ~by:340 ~now:1000.;
  Activity_map.note activity ~bx:126 ~by:346 ~now:1001.;
  (match Activity_map.suggest activity ~now:1001. with
   | Some hotspot ->
     check_int "hotspot x" 123 hotspot.Activity_map.x;
     check_int "hotspot y" 343 hotspot.Activity_map.y;
     check_near "hotspot weight" 2.0 hotspot.Activity_map.weight
   | None -> failwith "FAIL: expected a recent activity hotspot");
  (* After two half-lives the suggestion has decayed away. *)
  (match Activity_map.suggest activity ~now:1601. with
   | None -> ()
   | Some _ -> failwith "FAIL: stale activity still suggested");
  Activity_map.note activity ~bx:800 ~by:100 ~now:1601.;
  (match Activity_map.suggest activity ~now:1601. with
   | Some hotspot ->
     check_int "fresh hotspot x" 800 hotspot.Activity_map.x;
     check_int "fresh hotspot y" 100 hotspot.Activity_map.y
   | None -> failwith "FAIL: fresh activity was not suggested")

let () =
  test_kings_captured ();
  test_activity_map ();
  print_endline "world stats tests: OK"
