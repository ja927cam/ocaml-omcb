type metrics = {
  move_rate : float;
  pending_moves : int;
  fsync_p50_us : float;
  fsync_p95_us : float;
  broadcast_backlog : int;
  event_lag_p95_ms : float;
  recipients_per_event : float;
  snapshot_active : bool;
}

type policy = { max_batch_size : int; max_batch_delay_us : int }

type classification =
  | Quiet
  | Moderate
  | Heavy
  | Storage_bound
  | Broadcast_bound
  | Snapshot_active

type config = {
  min_batch_size : int;
  max_batch_size : int;
  min_delay_us : int;
  max_delay_us : int;
  hysteresis_samples : int;
  smoothing : float;
}

let default_config =
  {
    min_batch_size = 1;
    max_batch_size = 256;
    min_delay_us = 0;
    max_delay_us = 2_000;
    hysteresis_samples = 3;
    smoothing = 0.35;
  }

type t = {
  config : config;
  mutable policy : policy;
  mutable candidate : policy;
  mutable candidate_streak : int;
  mutable samples : int;
  mutable changes : int;
  mutable move_rate : float;
  mutable ema_pending : float;
  mutable pending_moves : int;
  mutable fsync_p50_us : float;
  mutable fsync_p95_us : float;
  mutable broadcast_backlog : float;
  mutable event_lag_p95_ms : float;
  mutable recipients_per_event : float;
  mutable snapshot_active : bool;
  mutable classification : classification;
  mutable boost_streak : int;
}

type state = {
  policy : policy;
  classification : classification;
  samples : int;
  changes : int;
  move_rate : float;
  pending_moves : int;
  fsync_p50_us : float;
  fsync_p95_us : float;
  broadcast_backlog : float;
  event_lag_p95_ms : float;
  recipients_per_event : float;
  snapshot_active : bool;
}

let clamp lo hi value = max lo (min hi value)

let clamp_policy (config : config) (policy : policy) =
  {
    max_batch_size =
      clamp config.min_batch_size config.max_batch_size policy.max_batch_size;
    max_batch_delay_us =
      clamp config.min_delay_us config.max_delay_us policy.max_batch_delay_us;
  }

let create ?(config = default_config) () =
  if config.min_batch_size < 1 then
    invalid_arg "Adaptive_commit.create: min_batch_size must be positive";
  if config.max_batch_size < config.min_batch_size then
    invalid_arg "Adaptive_commit.create: max_batch_size is below the minimum";
  if config.min_delay_us < 0 || config.max_delay_us < config.min_delay_us then
    invalid_arg "Adaptive_commit.create: invalid delay bounds";
  if config.hysteresis_samples < 1 then
    invalid_arg "Adaptive_commit.create: hysteresis_samples must be positive";
  if config.smoothing <= 0. || config.smoothing > 1. then
    invalid_arg "Adaptive_commit.create: smoothing must be in (0, 1]";
  let policy =
    clamp_policy config { max_batch_size = 16; max_batch_delay_us = 1_000 }
  in
  {
    config;
    policy;
    candidate = policy;
    candidate_streak = 0;
    samples = 0;
    changes = 0;
    move_rate = 0.;
    ema_pending = 0.;
    pending_moves = 0;
    fsync_p50_us = 0.;
    fsync_p95_us = 0.;
    broadcast_backlog = 0.;
    event_lag_p95_ms = 0.;
    recipients_per_event = 0.;
    snapshot_active = false;
    classification = Quiet;
    boost_streak = 0;
  }

let ema (t : t) previous value =
  if t.samples = 0 then value
  else previous +. (t.config.smoothing *. (value -. previous))

let classify (t : t) =
  let broadcast_pressure =
    t.broadcast_backlog >= 32.
    || (t.event_lag_p95_ms >= 50. && t.recipients_per_event >= 16.)
    || t.event_lag_p95_ms >= 250.
  in
  (* A high median fsync latency is a storage bottleneck. Tail outliers alone
     are not: btrfs can stall an occasional commit for 100 ms while the median
     stays near 3 ms, and treating that as storage-bound would cap batching for
     the rest of the run. Keep enough batching to amortise a slow disk, but do
     not grow into hundreds of queued moves while every commit is expensive. *)
  let storage_pressure = t.fsync_p50_us >= 8_000. in
  if t.snapshot_active then
    ( Snapshot_active,
      { max_batch_size = min 32 t.policy.max_batch_size; max_batch_delay_us = 0 }
    )
  else if broadcast_pressure then
    (* Delivery is the bottleneck, so hold batching instead of growing it. A
       lagging event stream alone is not a reason to shrink below 16: that only
       adds fsyncs and event-loop work. Shrink further only when client outboxes
       are actually filling. *)
    let batch = if t.broadcast_backlog >= 512. then 8 else 16 in
    (Broadcast_bound, { max_batch_size = batch; max_batch_delay_us = 0 })
  else if storage_pressure then
    let batch =
      if t.fsync_p50_us >= 20_000. || t.fsync_p95_us >= 100_000. then 32
      else 64
    in
    (Storage_bound, { max_batch_size = batch; max_batch_delay_us = 0 })
  else if int_of_float (t.ema_pending +. 0.5) >= 32 && t.move_rate >= 2_000. then
    (Heavy, { max_batch_size = 256; max_batch_delay_us = 0 })
  else if t.move_rate >= 2_000. then
    (Heavy, { max_batch_size = 128; max_batch_delay_us = 0 })
  else if int_of_float (t.ema_pending +. 0.5) >= 16 && t.move_rate >= 1_000. then
    (Heavy, { max_batch_size = 128; max_batch_delay_us = 0 })
  else if int_of_float (t.ema_pending +. 0.5) >= 8 || t.move_rate >= 1_000. then
    (Heavy, { max_batch_size = 64; max_batch_delay_us = 0 })
  else if t.move_rate >= 300. then
    (Moderate, { max_batch_size = 32; max_batch_delay_us = 250 })
  else if t.move_rate >= 100. then
    (Moderate, { max_batch_size = 16; max_batch_delay_us = 250 })
  else if t.move_rate >= 30. then
    (Moderate, { max_batch_size = 8; max_batch_delay_us = 250 })
  else (Quiet, { max_batch_size = 16; max_batch_delay_us = 0 })

let step_batch current target =
  if target > current then min target (max (current + 1) (current * 2))
  else if target < current then max target (current / 2)
  else current

let step_delay current target =
  if target > current then min target (current + 500)
  else if target < current then max target (current - 500)
  else current

let sample (t : t) (metrics : metrics) =
  let lag_before = t.event_lag_p95_ms in
  t.move_rate <- ema t t.move_rate metrics.move_rate;
  t.ema_pending <- ema t t.ema_pending (float_of_int metrics.pending_moves);
  t.pending_moves <- int_of_float (t.ema_pending +. 0.5);
  t.fsync_p50_us <- ema t t.fsync_p50_us metrics.fsync_p50_us;
  t.fsync_p95_us <- ema t t.fsync_p95_us metrics.fsync_p95_us;
  t.broadcast_backlog <-
    ema t t.broadcast_backlog (float_of_int metrics.broadcast_backlog);
  t.event_lag_p95_ms <-
    ema t t.event_lag_p95_ms metrics.event_lag_p95_ms;
  t.recipients_per_event <-
    ema t t.recipients_per_event metrics.recipients_per_event;
  t.snapshot_active <- metrics.snapshot_active;
  t.samples <- t.samples + 1;

  let classification, target = classify t in
  t.classification <- classification;
  let pending = int_of_float (t.ema_pending +. 0.5) in
  let broadcast_pressure =
    t.broadcast_backlog >= 32.
    || (t.event_lag_p95_ms >= 50. && t.recipients_per_event >= 16.)
    || t.event_lag_p95_ms >= 250.
  in
  let delivery_deteriorating =
    metrics.event_lag_p95_ms > lag_before +. 2.
    && t.event_lag_p95_ms >= 15.
  in
  let target = clamp_policy t.config target in
  (* Batching must never rise while client delivery is falling further behind;
     a lower target (a decrease) is still allowed. *)
  let target =
    if delivery_deteriorating then
      {
        max_batch_size = min target.max_batch_size t.policy.max_batch_size;
        max_batch_delay_us =
          min target.max_batch_delay_us t.policy.max_batch_delay_us;
      }
    else target
  in
  let backlog_boost =
    classification = Heavy && (not broadcast_pressure)
    && (not t.snapshot_active) && (not delivery_deteriorating)
    && pending >= 8
  in
  let target =
    if backlog_boost then
      {
        max_batch_size =
          clamp t.config.min_batch_size t.config.max_batch_size
            (max target.max_batch_size (pending * 2));
        max_batch_delay_us = target.max_batch_delay_us;
      }
    else target
  in
  if backlog_boost && target.max_batch_size > t.policy.max_batch_size then begin
    (* A real queue backlog is strong evidence, but require two consecutive
       samples so a single transient spike cannot jump the policy. *)
    t.boost_streak <- t.boost_streak + 1;
    if t.boost_streak >= 2 then begin
      t.policy <- target;
      t.candidate <- target;
      t.candidate_streak <- 0;
      t.boost_streak <- 0;
      t.changes <- t.changes + 1
    end;
    t.policy
  end
  else begin
    t.boost_streak <- 0;
    let candidate =
      clamp_policy t.config
        {
          max_batch_size =
            step_batch t.policy.max_batch_size target.max_batch_size;
          max_batch_delay_us =
            step_delay t.policy.max_batch_delay_us target.max_batch_delay_us;
        }
    in
    if candidate = t.policy then t.candidate_streak <- 0
    else if candidate = t.candidate then
      t.candidate_streak <- t.candidate_streak + 1
    else begin
      t.candidate <- candidate;
      t.candidate_streak <- 1
    end;
    let decreasing =
      candidate.max_batch_size < t.policy.max_batch_size
      || candidate.max_batch_delay_us < t.policy.max_batch_delay_us
    in
    let needed =
      if decreasing then min 2 t.config.hysteresis_samples
      else t.config.hysteresis_samples
    in
    if candidate <> t.policy && t.candidate_streak >= needed then begin
      t.policy <- candidate;
      t.changes <- t.changes + 1;
      t.candidate_streak <- 0
    end;
    t.policy
  end

let policy (t : t) = t.policy

let state (t : t) =
  {
    policy = t.policy;
    classification = t.classification;
    samples = t.samples;
    changes = t.changes;
    move_rate = t.move_rate;
    pending_moves = t.pending_moves;
    fsync_p50_us = t.fsync_p50_us;
    fsync_p95_us = t.fsync_p95_us;
    broadcast_backlog = t.broadcast_backlog;
    event_lag_p95_ms = t.event_lag_p95_ms;
    recipients_per_event = t.recipients_per_event;
    snapshot_active = t.snapshot_active;
  }

let classification_name = function
  | Quiet -> "quiet"
  | Moderate -> "moderate"
  | Heavy -> "heavy"
  | Storage_bound -> "storage_bound"
  | Broadcast_bound -> "broadcast_bound"
  | Snapshot_active -> "snapshot"
