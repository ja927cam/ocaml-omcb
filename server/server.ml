let cross_origin_isolation inner request =
  let%lwt response = inner request in
  Dream.set_header response "Cross-Origin-Opener-Policy" "same-origin";
  Dream.set_header response "Cross-Origin-Embedder-Policy" "require-corp";
  Lwt.return response

let () =
  Dream.run ~port:8080
  @@ Dream.logger
  @@ cross_origin_isolation
  @@ Dream.router [
    (* 1. Serve index.html at the root *)
    Dream.get "/" (fun req -> Dream.from_filesystem "server/static" "index.html" req);

    (* 2. Serve the compiled Wasm/JS assets *)
    Dream.scope "/static" [] [
      Dream.get "/**" (Dream.static "_build/default/client");
    ];

    (* 3. WebSocket endpoint for game packets (binary moves: 8 bytes) *)
    Dream.get "/ws" (fun _req ->
      (* [~close:false]: Dream 1.0.0~alpha8 busy-loops when it closes a
         WebSocket whose peer has already gone away. The peer's close frame
         is sufficient, so we don't ask Dream to close it again. *)
      Dream.websocket ~close:false (fun socket ->
        let rec loop () =
          match%lwt Dream.receive socket with
          | Some data ->
              let move =
                if String.length data = 8
                then Some (Protocol.Types.move_of_bytes (Bytes.of_string data))
                else None
              in
              let accepted =
                match move with
                | Some m -> m.src <> m.dst
                | None -> false
              in
              (match move with
               | Some m when accepted ->
                   Printf.printf
                     "move board(%d,%d) (%d,%d) -> (%d,%d)\n%!"
                     m.src.board_x m.src.board_y m.src.x m.src.y m.dst.x m.dst.y
               | _ -> Printf.printf "move rejected\n%!");
              (* One byte: 1 = accepted, 0 = rejected. No state changes. *)
              let%lwt () =
                Dream.send ~text_or_binary:`Binary socket
                  (if accepted then "\001" else "\000")
              in
              loop ()
          | None -> Lwt.return_unit
        in
        loop ()
      ));
  ]
