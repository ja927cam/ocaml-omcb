window.LOAD_RESULTS = window.LOAD_RESULTS || {};
window.LOAD_RESULTS["strict40_tmpfs"] = {
  "generated": "2026-11-26T23:55:06.108Z",
  "label": "strict40_tmpfs",
  "profile": {
    "clients": 40,
    "silent_clients": 4,
    "snapshots_per_client": 10,
    "moves": 100,
    "drivers": 20,
    "block": 10,
    "window_radius": 12,
    "distribution": "high"
  },
  "totals": {
    "connections": 44,
    "subscriptions": 44,
    "snapshots": 408,
    "moves": 100,
    "requests": 596
  },
  "duration_ms": 317.07127900000006,
  "throughput_requests_per_second": 1879.7035224373,
  "snapshot_rtt": {
    "n": 400,
    "mean_ms": 2.383387894999999,
    "p50_ms": 1.776299999999992,
    "p95_ms": 7.458745000000022,
    "p99_ms": 8.550220000000024,
    "max_ms": 8.807435999999996
  },
  "silent_snapshot_rtt": {
    "n": 8,
    "mean_ms": 0.1593437499999979,
    "p50_ms": 0.17880800000000363,
    "p95_ms": 0.23139699999998697,
    "p99_ms": 0.23139699999998697,
    "max_ms": 0.23139699999998697
  },
  "move_rtt": {
    "n": 100,
    "mean_ms": 2.5290055399999987,
    "p50_ms": 2.224166000000025,
    "p95_ms": 4.157392000000016,
    "p99_ms": 5.951184000000012,
    "max_ms": 5.951184000000012
  },
  "event_delivery_lag": {
    "n": 4000,
    "mean_ms": 3.920094674000001,
    "p50_ms": 4.014260999999976,
    "p95_ms": 6.150531999999998,
    "p99_ms": 6.573601999999994,
    "max_ms": 6.898325
  },
  "accuracy": {
    "snapshots_ok": 400,
    "snapshot_errors": 0,
    "silent_snapshots_ok": 8,
    "silent_snapshot_errors": 0,
    "moves_accepted": 100,
    "moves_rejected": 0,
    "move_request_id_mismatches": 0,
    "duplicate_move_sequences": 0,
    "events": {
      "expected_total": 4000,
      "min_expected": 100,
      "max_expected": 100,
      "min_events": 100,
      "max_events": 100,
      "clients_with_events": 40,
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
    "rss_baseline_kb": 546112,
    "rss_before_kb": 547248,
    "rss_peak_kb": 555024,
    "fds_baseline": 8,
    "fds_before": 52,
    "fds_peak": 52,
    "cpu_average_percent": 9.461594911597148,
    "cpu_peak_percent": 19.092443559276333,
    "cpu_peak_window_ms": 100,
    "fds_after_close_requests": 53,
    "rss_after_close_requests_kb": 555168,
    "cpu_idle_ticks_per_second": 0,
    "rss_after_exit_kb": 555176,
    "fds_after_exit": 7,
    "cpu_idle_after_exit_ticks_per_second": 0
  },
  "server_metrics": {
    "started_ns": 9341533430753,
    "uptime_ms": 1076.813184,
    "stages": {
      "receive_to_submit": {
        "n": 100,
        "mean_ms": 0.000276,
        "p50_ms": 0.000171,
        "p95_ms": 0.000861,
        "p99_ms": 0.002134,
        "max_ms": 0.002134,
        "total_ms": 0.027689
      },
      "worker_queue_wait": {
        "n": 100,
        "mean_ms": 0.049343,
        "p50_ms": 0.049303,
        "p95_ms": 0.111711,
        "p99_ms": 0.124586,
        "max_ms": 0.124586,
        "total_ms": 4.934367
      },
      "move_processing": {
        "n": 100,
        "mean_ms": 0.004512,
        "p50_ms": 0.003427,
        "p95_ms": 0.012233,
        "p99_ms": 0.021661,
        "max_ms": 0.021661,
        "total_ms": 0.451226
      },
      "commit_to_broadcast": {
        "n": 100,
        "mean_ms": 0.000664,
        "p50_ms": 0.000411,
        "p95_ms": 0.002154,
        "p99_ms": 0.011422,
        "max_ms": 0.011422,
        "total_ms": 0.066418
      },
      "broadcast_wait": {
        "n": 100,
        "mean_ms": 0.12618,
        "p50_ms": 0.11076,
        "p95_ms": 0.332118,
        "p99_ms": 0.419042,
        "max_ms": 0.419042,
        "total_ms": 12.61803
      },
      "broadcast_dispatch": {
        "n": 100,
        "mean_ms": 0.003628,
        "p50_ms": 0.003346,
        "p95_ms": 0.006152,
        "p99_ms": 0.008777,
        "max_ms": 0.008777,
        "total_ms": 0.362873
      },
      "encoding": {
        "n": 100,
        "mean_ms": 0.000375,
        "p50_ms": 0.000321,
        "p95_ms": 0.000782,
        "p99_ms": 0.001553,
        "max_ms": 0.001553,
        "total_ms": 0.037572
      },
      "outbox_enqueue": {
        "n": 100,
        "mean_ms": 0.002546,
        "p50_ms": 0.002194,
        "p95_ms": 0.006122,
        "p99_ms": 0.01048,
        "max_ms": 0.01048,
        "total_ms": 0.254694
      },
      "websocket_write": {
        "n": 334,
        "mean_ms": 0.013512,
        "p50_ms": 0.010309,
        "p95_ms": 0.022863,
        "p99_ms": 0.042922,
        "max_ms": 0.371953,
        "total_ms": 4.51327
      },
      "end_to_end_broadcast": {
        "n": 100,
        "mean_ms": 2.050868,
        "p50_ms": 2.113287,
        "p95_ms": 3.229618,
        "p99_ms": 3.259324,
        "max_ms": 3.259324,
        "total_ms": 205.086873
      }
    },
    "counters": {
      "events_broadcast": 100,
      "recipients": 4000,
      "outbox_enqueues": 942,
      "outbox_dropped": 0,
      "send_failures": 0,
      "outbox_full_unregisters": 0,
      "events_without_recipients": 0,
      "max_outbox_depth": 1,
      "max_recipients": 40
    },
    "end_to_end_p95_ms": 3.229618,
    "worker": {
      "queue_depth": 0,
      "queue_capacity": 4096,
      "move_queue_depth": 0,
      "requests_processed": 608,
      "moves_processed": 100,
      "moves_submitted": 100,
      "requests_rejected": 0,
      "avg_queue_wait_ms": 0.129496,
      "max_queue_wait_ms": 4.022727,
      "avg_processing_ms": 0.003262,
      "max_processing_ms": 1.329995
    },
    "connections": {
      "clients": 44,
      "subscriptions": 27500,
      "max_outbox_depth": 0,
      "total_outbox_depth": 0,
      "pending_event_count": 0,
      "outbox_capacity": 256,
      "event_batching": true
    },
    "persistence": {
      "data_dir": "/tmp/omcb-load-strict40_tmpfs-iXrs5X",
      "sequence": "100",
      "wal_segments": 1,
      "wal_bytes": "8416",
      "snapshots": 0,
      "last_snapshot_sequence": null,
      "snapshot_pending": false,
      "snapshot_write_ms": 0,
      "commits_since_snapshot": 100,
      "sync": true,
      "group_size": 1,
      "sync_count": 100,
      "group_count": 100,
      "batched_moves": 100,
      "last_group_size": 1,
      "average_group_size": 1,
      "last_sync_ms": 0.0009765625,
      "fsync_p50_us": 0.9765625,
      "fsync_p95_us": 1.220703125,
      "snapshot_active": false,
      "snapshot_writing": false,
      "snapshot_buffer": false,
      "snapshot_copy_live": 0,
      "snapshot_copy_live_bytes": 0,
      "dirty": false,
      "truncated_wal": false
    },
    "memory": {
      "rss_kb": 555040,
      "smaps_rollup_kb": {
        "Rss": 555032,
        "Pss": 546668,
        "Shared_Clean": 10796,
        "Shared_Dirty": 0,
        "Private_Clean": 0,
        "Private_Dirty": 544236,
        "Anonymous": 544236,
        "Swap": 0,
        "Locked": 0
      },
      "gc": {
        "heap_words": 1481699,
        "live_words": 1387187,
        "free_words": 89736,
        "top_heap_words": 1481699,
        "major_words": 1484843,
        "minor_words": 216753929,
        "promoted_words": 634021,
        "compactions": 0,
        "major_collections": 10,
        "minor_collections": 836
      },
      "snapshot_copy_live": 0,
      "snapshot_copy_live_bytes": 0
    },
    "adaptive": {
      "enabled": false,
      "fixed_group_size": 1,
      "fixed_delay_us": 0
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
  "post_exit_measured_at": "2026-11-26T23:55:11.654Z"
};
