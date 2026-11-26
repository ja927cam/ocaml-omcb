(* Counts captured kings by colour.

   Piece IDs are stable and the standard initial position assigns each board
   32 consecutive IDs in a fixed back-rank/pawn order. A king therefore always
   keeps an ID whose zero-based slot within its original board is 4 (black) or
   28 (white), even after promotion or adoption. The bounded ledger retains
   recent captures, so scanning it at startup gives a durable-looking tally
   without adding state to the snapshot format. *)

type t = {
  mutable white : int;
  mutable black : int;
}

let create () = { white = 0; black = 0 }

let king_slot = function
  | 4 -> Some false
  | 28 -> Some true
  | _ -> None

let note_capture t id =
  if Int32.compare id 0l > 0 then begin
    let slot = (Int32.to_int id - 1) land 31 in
    match king_slot slot with
    | Some true -> t.white <- t.white + 1
    | Some false -> t.black <- t.black + 1
    | None -> ()
  end

let scan_ledger t (ledger : Ledger.t) =
  let rec loop sequence head =
    if Int64.compare sequence head >= 0 then ()
    else begin
      (match Ledger.get_event ledger sequence with
       | Some event -> note_capture t event.captured_piece_id
       | None -> ());
      loop (Int64.succ sequence) head
    end
  in
  loop (Ledger.oldest_seq ledger) (Ledger.next_seq ledger)

let white t = t.white
let black t = t.black

let json t =
  `Assoc [ ("white", `Int t.white); ("black", `Int t.black) ]
