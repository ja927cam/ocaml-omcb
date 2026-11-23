let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let () =
  let wsd = Httpun_ws__Wsd.create `Server in
  let payload = Bigstringaf.of_string ~off:0 ~len:1 "x" in
  Httpun_ws__Wsd.schedule wsd ~kind:`Binary payload ~off:0 ~len:1;
  (match Httpun_ws__Wsd.next wsd with
   | `Write _ -> ()
   | _ -> failwith "FAIL: expected pending write");
  (* Simulate a failed socket write. The writer must discard the pending frame
     and report Close, otherwise Gluten retries it forever. *)
  Httpun_ws__Wsd.report_result wsd `Closed;
  (match Httpun_ws__Wsd.next wsd with
   | `Close 0 -> ()
   | _ -> failwith "FAIL: failed write did not close the writer");
  check "writer is closed" (Httpun_ws__Wsd.is_closed wsd);
  check "error recorded" (Httpun_ws__Wsd.error_code wsd <> None);
  (* A second close must not resurrect a pending frame or raise. *)
  Httpun_ws__Wsd.close wsd;
  (match Httpun_ws__Wsd.next wsd with
   | `Close 0 -> ()
   | _ -> failwith "FAIL: close resurrected a pending write");
  Printf.printf "WebSocket failed-write cleanup test passed.\n"
