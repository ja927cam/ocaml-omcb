let () =
  Dream.run ~port:8080
  @@ Dream.logger
  @@ Dream.router [
    (* 1. Serve index.html at the root *)
    Dream.get "/" (fun req -> Dream.from_filesystem "server/static" "index.html" req);

    (* 2. Serve the compiled Wasm/JS assets *)
    Dream.get "/static/**" (Dream.static "_build/default/client");

    (* 3. WebSocket endpoint for game packets *)
    Dream.get "/ws" (fun _req ->
      Dream.websocket (fun socket ->
        let rec loop () =
          match%lwt Dream.receive socket with
          | Some raw_json ->
              (match Protocol.Types.client_msg_of_yojson (Yojson.Safe.from_string raw_json) with
               | Ok (Move { x; y }) -> 
                   Printf.printf "Player moved to %f, %f\n%!" x y;
                   loop ()
               | _ -> loop ())
          | None -> Dream.close_websocket socket
        in
        loop ()
      ));
  ]
