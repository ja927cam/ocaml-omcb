(* Bounded LRU cache for client-side board snapshots.

   The cache owns the single canonical [board_state] for each board key.  It
   never retains duplicate representations: callers update the state in place
   and all other users of the board observe the same record.

   Recency is maintained with a lazy queue of (key, stamp) entries.  Touching
   a key pushes a new stamp; stale stamps are discarded when evicting.  The
   queue is periodically compacted so a long-lived client cannot accumulate
   an unbounded activity log. *)

type board_state = {
  bx : int;
  by : int;
  mutable pieces : Bytes.t; (* 64 one-byte client pieces *)
  mutable revision : int64;
  mutable loaded : bool;
  mutable stale : bool;
}

type entry = { mutable state : board_state; mutable stamp : int64 }

type t = {
  capacity : int;
  table : (int, entry) Hashtbl.t;
  mutable order : (int * int64) Queue.t;
  mutable clock : int64;
  mutable peak : int;
  mutable hits : int;
  mutable misses : int;
  mutable evictions : int;
}

let create ?(capacity = 900) () =
  if capacity < 1 then invalid_arg "Board_cache.create: capacity must be > 0";
  {
    capacity;
    table = Hashtbl.create (capacity * 2);
    order = Queue.create ();
    clock = 0L;
    peak = 0;
    hits = 0;
    misses = 0;
    evictions = 0;
  }

let capacity t = t.capacity
let length t = Hashtbl.length t.table
let peak t = t.peak
let hits t = t.hits
let misses t = t.misses
let evictions t = t.evictions
let note_hit t = t.hits <- t.hits + 1
let note_miss t = t.misses <- t.misses + 1

let stamp t =
  t.clock <- Int64.succ t.clock;
  t.clock

let enqueue t key stamp = Queue.add (key, stamp) t.order

let touch_entry t key entry =
  let stamp = stamp t in
  entry.stamp <- stamp;
  enqueue t key stamp

let compact_order t =
  let limit = max 16 (t.capacity * 4) in
  if Queue.length t.order > limit then begin
    let entries =
      Hashtbl.fold (fun key entry acc -> (entry.stamp, key) :: acc) t.table []
    in
    let entries =
      List.sort (fun (a, _) (b, _) -> Int64.compare a b) entries
    in
    t.order <- Queue.create ();
    List.iter (fun (stamp, key) -> Queue.add (key, stamp) t.order) entries
  end

let find t key =
  match Hashtbl.find_opt t.table key with
  | None -> None
  | Some entry -> Some entry.state

let find_loaded t key =
  match find t key with
  | Some state when state.loaded && not state.stale -> Some state
  | _ -> None

let mem t key = Hashtbl.mem t.table key

let touch t key =
  match Hashtbl.find_opt t.table key with
  | None -> ()
  | Some entry -> touch_entry t key entry

let add t state =
  let key = (state.by * 1000) + state.bx in
  let entry =
    match Hashtbl.find_opt t.table key with
    | Some entry -> entry
    | None ->
      let entry = { state; stamp = 0L } in
      Hashtbl.add t.table key entry;
      entry
  in
  entry.state <- state;
  touch_entry t key entry;
  let occupancy = Hashtbl.length t.table in
  if occupancy > t.peak then t.peak <- occupancy;
  compact_order t

let get_or_create t ~bx ~by =
  let key = (by * 1000) + bx in
  match Hashtbl.find_opt t.table key with
  | Some entry -> entry.state
  | None ->
    let state =
      {
        bx;
        by;
        pieces = Bytes.make 64 '\000';
        revision = 0L;
        loaded = false;
        stale = false;
      }
    in
    add t state;
    state

let remove t key =
  (match Hashtbl.find_opt t.table key with
   | Some _ ->
     Hashtbl.remove t.table key;
     t.evictions <- t.evictions + 1
   | None -> ());
  ()

let apply_snapshot t key ~revision ~pieces =
  match Hashtbl.find_opt t.table key with
  | None -> false
  | Some entry ->
    let state = entry.state in
    if Int64.compare revision state.revision < 0 then false
    else begin
      state.pieces <- pieces;
      state.revision <- revision;
      state.loaded <- true;
      state.stale <- false;
      touch_entry t key entry;
      true
    end

let mark_stale t key =
  match Hashtbl.find_opt t.table key with
  | None -> ()
  | Some entry ->
    entry.state.loaded <- false;
    entry.state.stale <- true

let mark_all_stale t =
  Hashtbl.iter
    (fun _ entry ->
      entry.state.loaded <- false;
      entry.state.stale <- true)
    t.table

let clear t = Hashtbl.clear t.table
let iter f t = Hashtbl.iter (fun key entry -> f key entry.state) t.table
let fold f t init =
  Hashtbl.fold (fun key entry acc -> f key entry.state acc) t.table init

let loaded_count t =
  Hashtbl.fold
    (fun _ entry total -> if entry.state.loaded then total + 1 else total)
    t.table 0

(* Evict least-recently-used unprotected entries until [length <= target].
   Protected keys are skipped without losing their recency; when every
   remaining candidate is protected, eviction stops and reports what was
   removed. *)
let evict_to t ~target ~protected =
  let target = max 0 target in
  let evicted = ref [] in
  let held = ref [] in
  let attempts = ref (Queue.length t.order) in
  while Hashtbl.length t.table > target && !attempts > 0 do
    decr attempts;
    match Queue.take_opt t.order with
    | None -> attempts := 0
    | Some (key, queued_stamp) ->
      (match Hashtbl.find_opt t.table key with
       | None -> ()
       | Some entry when not (Int64.equal entry.stamp queued_stamp) -> ()
       | Some _ when protected key -> held := (key, queued_stamp) :: !held
       | Some _ ->
         Hashtbl.remove t.table key;
         t.evictions <- t.evictions + 1;
         evicted := key :: !evicted)
  done;
  List.iter (fun (key, queued_stamp) -> Queue.add (key, queued_stamp) t.order)
    (List.rev !held);
  List.rev !evicted
