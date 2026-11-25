(* Bookkeeping for in-flight batch snapshot requests.

   Every request is keyed by its unique request id and owns a set of board
   keys.  Completing or failing a request removes only the board->request
   mappings that still point at that request, so a delayed response can never
   clear the tracking state of a newer request for the same board. *)

type batch = {
  id : int32;
  rect : Viewport.rect;
  keys : int list;
  sent_at : float;
  reset : bool;
}

type t = {
  batches : (int32, batch) Hashtbl.t;
  board_request : (int, int32) Hashtbl.t;
  max_inflight : int;
}

let create ?(max_inflight = 4) () =
  if max_inflight < 1 then
    invalid_arg "Request_tracker.create: max_inflight must be > 0";
  {
    batches = Hashtbl.create (max_inflight * 2);
    board_request = Hashtbl.create 1024;
    max_inflight;
  }

let max_inflight t = t.max_inflight
let batch_count t = Hashtbl.length t.batches
let board_count t = Hashtbl.length t.board_request
let is_in_flight t key = Hashtbl.mem t.board_request key

let keys t =
  Hashtbl.fold (fun key _ acc -> key :: acc) t.board_request []

let batches t =
  Hashtbl.fold (fun _ batch acc -> batch :: acc) t.batches []

let find t id = Hashtbl.find_opt t.batches id

let remove_keys t id keys =
  List.iter
    (fun key ->
      match Hashtbl.find_opt t.board_request key with
      | Some current when Int32.equal current id ->
        Hashtbl.remove t.board_request key
      | _ -> ())
    keys

let begin_batch ?(reset = false) t ~id ~rect ~keys ~sent_at =
  if Hashtbl.length t.batches >= t.max_inflight then false
  else
    let keys =
      List.filter (fun key -> not (Hashtbl.mem t.board_request key)) keys
    in
    if keys = [] then false
    else begin
      Hashtbl.add t.batches id { id; rect; keys; sent_at; reset };
      List.iter (fun key -> Hashtbl.replace t.board_request key id) keys;
      true
    end

let complete t id =
  match Hashtbl.find_opt t.batches id with
  | None -> None
  | Some batch ->
    Hashtbl.remove t.batches id;
    remove_keys t id batch.keys;
    Some batch

let fail = complete

let due t ~now ~timeout =
  Hashtbl.fold
    (fun _ batch acc ->
      if now -. batch.sent_at > timeout then batch :: acc else acc)
    t.batches []

let clear t =
  Hashtbl.clear t.batches;
  Hashtbl.clear t.board_request
