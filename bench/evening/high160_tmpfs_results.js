window.LOAD_RESULTS = window.LOAD_RESULTS || {};
window.LOAD_RESULTS["high160_tmpfs"] = {
  "generated": "2026-11-26T23:54:42.039Z",
  "label": "high160_tmpfs",
  "profile": {
    "clients": 160,
    "silent_clients": 4,
    "snapshots_per_client": 10,
    "moves": 400,
    "drivers": 80,
    "block": 20,
    "window_radius": 12,
    "distribution": "high"
  },
  "totals": {
    "connections": 164,
    "subscriptions": 164,
    "snapshots": 1608,
    "moves": 400,
    "requests": 2336
  },
  "duration_ms": 507.159993,
  "throughput_requests_per_second": 4606.0415494958015,
  "snapshot_rtt": {
    "n": 1600,
    "mean_ms": 9.33791759875003,
    "p50_ms": 7.002573999999981,
    "p95_ms": 33.730433000000005,
    "p99_ms": 38.13955099999998,
    "max_ms": 40.593841999999995
  },
  "silent_snapshot_rtt": {
    "n": 8,
    "mean_ms": 0.186323625,
    "p50_ms": 0.21230200000002242,
    "p95_ms": 0.30047799999999825,
    "p99_ms": 0.30047799999999825,
    "max_ms": 0.30047799999999825
  },
  "move_rtt": {
    "n": 400,
    "mean_ms": 27.931719332499988,
    "p50_ms": 31.234471999999982,
    "p95_ms": 51.69988699999999,
    "p99_ms": 73.06629600000002,
    "max_ms": 73.91471999999999
  },
  "event_delivery_lag": {
    "n": 64000,
    "mean_ms": 25.80248420306228,
    "p50_ms": 22.309612999999956,
    "p95_ms": 57.465101000000004,
    "p99_ms": 69.30505299999999,
    "max_ms": 79.34321799999998
  },
  "accuracy": {
    "snapshots_ok": 1600,
    "snapshot_errors": 0,
    "silent_snapshots_ok": 8,
    "silent_snapshot_errors": 0,
    "moves_accepted": 400,
    "moves_rejected": 0,
    "move_request_id_mismatches": 0,
    "duplicate_move_sequences": 0,
    "events": {
      "expected_total": 64000,
      "min_expected": 400,
      "max_expected": 400,
      "min_events": 400,
      "max_events": 400,
      "clients_with_events": 160,
      "missing_clients": 0,
      "duplicate_clients": 0,
      "extra_clients": 0,
      "missing_events": 0,
      "extra_events": 0,
      "duplicate_events": 0,
      "wrong_board_events": 0,
      "wrong_revision_events": 0,
      "wrong_change_events": 0,
      "wrong_request_id_events": 0,
      "wrong_board_count_events": 0,
      "silent_events": 0,
      "unexpected_closes": 0
    }
  },
  "resources": {
    "rss_baseline_kb": 547268,
    "rss_before_kb": 552816,
    "rss_peak_kb": 592552,
    "fds_baseline": 8,
    "fds_before": 172,
    "fds_peak": 172,
    "cpu_average_percent": 39.43528723883392,
    "cpu_peak_percent": 96.629906395576,
    "cpu_peak_window_ms": 100,
    "fds_after_close_requests": 173,
    "rss_after_close_requests_kb": 592648,
    "cpu_idle_ticks_per_second": 1,
    "rss_after_exit_kb": 592668,
    "fds_after_exit": 7,
    "cpu_idle_after_exit_ticks_per_second": 0
  },
  "server_metrics": {
    "started_ns": 9317145738353,
    "uptime_ms": 1352.42241,
    "stages": {
      "receive_to_submit": {
        "n": 400,
        "mean_ms": 0.00038,
        "p50_ms": 0.00017,
        "p95_ms": 0.001603,
        "p99_ms": 0.003136,
        "max_ms": 0.012824,
        "total_ms": 0.152289
      },
      "worker_queue_wait": {
        "n": 400,
        "mean_ms": 0.209019,
        "p50_ms": 0.114797,
        "p95_ms": 0.687591,
        "p99_ms": 0.785475,
        "max_ms": 0.800704,
        "total_ms": 83.607934
      },
      "move_processing": {
        "n": 400,
        "mean_ms": 0.004767,
        "p50_ms": 0.002385,
        "p95_ms": 0.01572,
        "p99_ms": 0.02627,
        "max_ms": 0.298955,
        "total_ms": 1.906858
      },
      "commit_to_broadcast": {
        "n": 400,
        "mean_ms": 0.019573,
        "p50_ms": 0.015971,
        "p95_ms": 0.042811,
        "p99_ms": 0.048923,
        "max_ms": 0.353128,
        "total_ms": 7.829474
      },
      "broadcast_wait": {
        "n": 400,
        "mean_ms": 0.805838,
        "p50_ms": 0.420154,
        "p95_ms": 3.117837,
        "p99_ms": 4.465856,
        "max_ms": 4.680432,
        "total_ms": 322.33542
      },
      "broadcast_dispatch": {
        "n": 400,
        "mean_ms": 0.019721,
        "p50_ms": 0.014558,
        "p95_ms": 0.032301,
        "p99_ms": 0.203775,
        "max_ms": 0.575398,
        "total_ms": 7.888638
      },
      "encoding": {
        "n": 400,
        "mean_ms": 0.000454,
        "p50_ms": 0.000351,
        "p95_ms": 0.001183,
        "p99_ms": 0.001814,
        "max_ms": 0.002866,
        "total_ms": 0.181943
      },
      "outbox_enqueue": {
        "n": 400,
        "mean_ms": 0.015098,
        "p50_ms": 0.009788,
        "p95_ms": 0.037491,
        "p99_ms": 0.127481,
        "max_ms": 0.321808,
        "total_ms": 6.039565
      },
      "websocket_write": {
        "n": 4693,
        "mean_ms": 0.013211,
        "p50_ms": 0.010931,
        "p95_ms": 0.022072,
        "p99_ms": 0.03692,
        "max_ms": 0.495858,
        "total_ms": 62.000911
      },
      "end_to_end_broadcast": {
        "n": 400,
        "mean_ms": 5.109322,
        "p50_ms": 4.706962,
        "p95_ms": 8.799001,
        "p99_ms": 8.959685,
        "max_ms": 8.990764,
        "total_ms": 2043.728805
      }
    },
    "counters": {
      "events_broadcast": 400,
      "recipients": 64000,
      "outbox_enqueues": 7101,
      "outbox_dropped": 0,
      "send_failures": 0,
      "outbox_full_unregisters": 0,
      "events_without_recipients": 0,
      "max_outbox_depth": 1,
      "max_recipients": 160
    },
    "end_to_end_p95_ms": 8.799001,
    "worker": {
      "queue_depth": 0,
      "queue_capacity": 4096,
      "move_queue_depth": 0,
      "requests_processed": 2408,
      "moves_processed": 400,
      "moves_submitted": 400,
      "requests_rejected": 0,
      "avg_queue_wait_ms": 2.587143,
      "max_queue_wait_ms": 17.143583,
      "avg_processing_ms": 0.002748,
      "max_processing_ms": 1.115399
    },
    "connections": {
      "clients": 164,
      "subscriptions": 102500,
      "max_outbox_depth": 0,
      "total_outbox_depth": 0,
      "pending_event_count": 0,
      "outbox_capacity": 256,
      "event_batching": true
    },
    "persistence": {
      "data_dir": "/tmp/omcb-load-high160_tmpfs-E0faXN",
      "sequence": "400",
      "wal_segments": 1,
      "wal_bytes": "33616",
      "snapshots": 0,
      "last_snapshot_sequence": null,
      "snapshot_pending": false,
      "snapshot_write_ms": 0,
      "commits_since_snapshot": 400,
      "sync": true,
      "group_size": 64,
      "sync_count": 71,
      "group_count": 71,
      "batched_moves": 400,
      "last_group_size": 11,
      "average_group_size": 5.633802816901408,
      "last_sync_ms": 0.001953125,
      "fsync_p50_us": 0.9765625,
      "fsync_p95_us": 1.953125,
      "snapshot_active": false,
      "snapshot_writing": false,
      "snapshot_buffer": false,
      "snapshot_copy_live": 0,
      "snapshot_copy_live_bytes": 0,
      "dirty": false,
      "truncated_wal": false
    },
    "memory": {
      "rss_kb": 592564,
      "smaps_rollup_kb": {
        "Rss": 592560,
        "Pss": 584276,
        "Shared_Clean": 10636,
        "Shared_Dirty": 0,
        "Private_Clean": 0,
        "Private_Dirty": 581924,
        "Anonymous": 581924,
        "Swap": 0,
        "Locked": 0
      },
      "gc": {
        "heap_words": 5452626,
        "live_words": 4989358,
        "free_words": 445898,
        "top_heap_words": 6005586,
        "major_words": 7946158,
        "minor_words": 227376429,
        "promoted_words": 3759263,
        "compactions": 0,
        "major_collections": 17,
        "minor_collections": 881
      },
      "snapshot_copy_live": 0,
      "snapshot_copy_live_bytes": 0
    },
    "adaptive": {
      "enabled": true,
      "max_batch_size": 16,
      "max_batch_delay_us": 0,
      "classification": "moderate",
      "samples": 9,
      "changes": 2,
      "move_rate": 476.6128907017084,
      "pending_moves": 0,
      "fsync_p50_us": 0.802239990234375,
      "fsync_p95_us": 1.6279464721679688,
      "broadcast_backlog": 0,
      "event_lag_p95_ms": 5.4554911800375,
      "recipients_per_event": 39.039,
      "snapshot_active": false
    },
    "board_load": {
      "overall": {
        "samples": 0,
        "requests": 0,
        "boards": 0,
        "failures": 0,
        "p50_ms": 0,
        "p95_ms": 0,
        "max_ms": 0,
        "mean_ms": 0,
        "last_ms": 0,
        "last_boards": 0
      },
      "regions": []
    },
    "kings_captured": {
      "white": 0,
      "black": 0
    }
  },
  "metrics_error": null,
  "post_exit_measured_at": "2026-11-26T23:54:47.654Z"
};
