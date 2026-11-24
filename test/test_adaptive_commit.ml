let check name condition =
  if not condition then failwith ("FAIL: " ^ name)

let metrics ?(move_rate = 0.) ?(pending_moves = 0) ?(fsync_p50_us = 1_000.)
    ?(fsync_p95_us = 2_000.) ?(broadcast_backlog = 0)
    ?(event_lag_p95_ms = 5.) ?(recipients_per_event = 8.)
    ?(snapshot_active = false) () =
  Adaptive_commit.
    {
      move_rate;
      pending_moves;
      fsync_p50_us;
      fsync_p95_us;
      broadcast_backlog;
      event_lag_p95_ms;
      recipients_per_event;
      snapshot_active;
    }

let quiet = metrics ~move_rate:5. ~fsync_p50_us:1_000. ~fsync_p95_us:2_000. ()
let heavy =
  metrics ~move_rate:5_000. ~pending_moves:64 ~fsync_p50_us:2_000.
    ~fsync_p95_us:8_000. ~broadcast_backlog:2 ~event_lag_p95_ms:12. ()
let broadcast =
  metrics ~move_rate:1_500. ~pending_moves:32 ~fsync_p50_us:2_000.
    ~fsync_p95_us:8_000. ~broadcast_backlog:200 ~event_lag_p95_ms:120.
    ~recipients_per_event:80. ()
let storage =
  metrics ~move_rate:1_500. ~pending_moves:40 ~fsync_p50_us:18_000.
    ~fsync_p95_us:45_000. ~broadcast_backlog:1 ~event_lag_p95_ms:12. ()

let sample_many controller metrics count =
  let policy = ref (Adaptive_commit.policy controller) in
  for _ = 1 to count do
    policy := Adaptive_commit.sample controller metrics
  done;
  !policy

let () =
  let controller = Adaptive_commit.create () in
  let quiet_policy = sample_many controller quiet 12 in
  check "quiet batch stays small" (quiet_policy.max_batch_size <= 16);
  check "quiet delay is zero" (quiet_policy.max_batch_delay_us = 0);

  let heavy_policy = sample_many controller heavy 30 in
  check "heavy batch grows" (heavy_policy.max_batch_size >= 64);
  check "heavy delay is bounded" (heavy_policy.max_batch_delay_us >= 0);

  let broadcast_policy = sample_many controller broadcast 14 in
  check "broadcast pressure holds the batch at 16"
    (broadcast_policy.max_batch_size = 16);

  (* A small subscriber set with high delivery latency is load-bound, not
     fan-out-bound; it must not pin the batch at the broadcast floor. *)
  let small_fanout =
    metrics ~move_rate:4_000. ~pending_moves:64 ~fsync_p50_us:2_000.
      ~fsync_p95_us:8_000. ~event_lag_p95_ms:120.
      ~recipients_per_event:8. ()
  in
  let small = Adaptive_commit.create () in
  let small_policy = sample_many small small_fanout 30 in
  check "small-fanout latency does not cap batching"
    (small_policy.max_batch_size >= 64);
  check "broadcast pressure removes the delay"
    (broadcast_policy.max_batch_delay_us = 0);

  let storage_controller = Adaptive_commit.create () in
  ignore (sample_many storage_controller heavy 20);
  let storage_policy = sample_many storage_controller storage 20 in
  check "storage pressure caps the batch" (storage_policy.max_batch_size <= 64);
  check "storage pressure removes the delay"
    (storage_policy.max_batch_delay_us = 0);
  check "storage pressure is classified"
    (Adaptive_commit.(classification_name (state storage_controller).classification)
    = "storage_bound");
  let tail_only =
    metrics ~move_rate:1_500. ~pending_moves:16 ~fsync_p50_us:3_000.
      ~fsync_p95_us:150_000. ~event_lag_p95_ms:12. ()
  in
  let tail_controller = Adaptive_commit.create () in
  ignore (sample_many tail_controller tail_only 12);
  check "an fsync tail outlier is not storage bound"
    (Adaptive_commit.(classification_name (state tail_controller).classification)
    <> "storage_bound");

  let snapshot_policy =
    sample_many controller
      (metrics ~move_rate:5_000. ~pending_moves:64 ~snapshot_active:true ())
      12
  in
  check "snapshot activity prevents a large batch"
    (snapshot_policy.max_batch_size <= 32);

  (* Even a heavy queue must not raise batching while delivery is worsening. *)
  let rising = Adaptive_commit.create () in
  ignore (sample_many rising quiet 3);
  for step = 1 to 12 do
    ignore
      (Adaptive_commit.sample rising
         (metrics ~move_rate:5_000. ~pending_moves:64
            ~fsync_p50_us:2_000. ~fsync_p95_us:8_000.
            ~event_lag_p95_ms:(15. +. (float_of_int step *. 5.)) ()))
  done;
  check "batching does not rise while delivery degrades"
    ((Adaptive_commit.policy rising).max_batch_size <= 16);

  (* Hysteresis: one noisy heavy sample must not jump the policy. *)
  let fresh = Adaptive_commit.create () in
  let before = Adaptive_commit.policy fresh in
  ignore (Adaptive_commit.sample fresh heavy);
  let after = Adaptive_commit.policy fresh in
  check "one sample does not change policy" (before = after);

  (* Bounds are enforced. *)
  let bounded =
    Adaptive_commit.create
      ~config:
        {
          Adaptive_commit.default_config with
          min_batch_size = 4;
          max_batch_size = 128;
          min_delay_us = 100;
          max_delay_us = 750;
        }
      ()
  in
  let small = sample_many bounded quiet 20 in
  check "minimum batch is enforced" (small.max_batch_size >= 4);
  check "minimum delay is enforced" (small.max_batch_delay_us >= 100);
  let large = sample_many bounded heavy 30 in
  check "maximum batch is enforced" (large.max_batch_size <= 128);
  check "maximum delay is enforced" (large.max_batch_delay_us <= 750);

  let state = Adaptive_commit.state controller in
  check "controller recorded samples" (state.samples > 0);
  check "classification is available"
    (Adaptive_commit.classification_name state.classification <> "");

  Printf.printf "All adaptive commit tests passed.\n%!"
