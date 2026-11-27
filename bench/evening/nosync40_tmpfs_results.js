window.LOAD_RESULTS = window.LOAD_RESULTS || {};
window.LOAD_RESULTS["nosync40_tmpfs"] = {
  "generated": "2026-11-26T23:55:13.252Z",
  "label": "nosync40_tmpfs",
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
  "duration_ms": 318.486126,
  "throughput_requests_per_second": 1871.3531025210182,
  "snapshot_rtt": {
    "n": 400,
    "mean_ms": 2.4999654650000007,
    "p50_ms": 1.964946000000026,
    "p95_ms": 6.315222000000006,
    "p99_ms": 7.449248000000011,
    "max_ms": 7.573482000000013
  },
  "silent_snapshot_rtt": {
    "n": 8,
    "mean_ms": 0.1582314999999923,
    "p50_ms": 0.1745599999999854,
    "p95_ms": 0.22664899999998056,
    "p99_ms": 0.22664899999998056,
    "max_ms": 0.22664899999998056
  },
  "move_rtt": {
    "n": 100,
    "mean_ms": 2.526222479999998,
    "p50_ms": 2.4034750000000145,
    "p95_ms": 4.57493199999999,
    "p99_ms": 6.570765999999992,
    "max_ms": 6.570765999999992
  },
  "event_delivery_lag": {
    "n": 4000,
    "mean_ms": 4.140854094499994,
    "p50_ms": 4.154656999999986,
    "p95_ms": 7.034792999999979,
    "p99_ms": 8.27903699999996,
    "max_ms": 8.976675999999998
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
    "rss_baseline_kb": 545992,
    "rss_before_kb": 547120,
    "rss_peak_kb": 555096,
    "fds_baseline": 8,
    "fds_before": 52,
    "fds_peak": 52,
    "cpu_average_percent": 9.419562596582306,
    "cpu_peak_percent": 19.704762363226042,
    "cpu_peak_window_ms": 100,
    "fds_after_close_requests": 53,
    "rss_after_close_requests_kb": 555144,
    "cpu_idle_ticks_per_second": 0,
    "rss_after_exit_kb": 555164,
    "fds_after_exit": 7,
    "cpu_idle_after_exit_ticks_per_second": 0
  },
  "server_metrics": {
    "started_ns": 9348680886760,
    "uptime_ms": 1072.820774,
    "stages": {
      "receive_to_submit": {
        "n": 100,
        "mean_ms": 0.000258,
        "p50_ms": 0.000171,
        "p95_ms": 0.001102,
        "p99_ms": 0.001643,
        "max_ms": 0.001643,
        "total_ms": 0.025843
      },
      "worker_queue_wait": {
        "n": 100,
        "mean_ms": 0.035808,
        "p50_ms": 0.035286,
        "p95_ms": 0.083037,
        "p99_ms": 0.113344,
        "max_ms": 0.113344,
        "total_ms": 3.580891
      },
      "move_processing": {
        "n": 100,
        "mean_ms": 0.00332,
        "p50_ms": 0.002434,
        "p95_ms": 0.008135,
        "p99_ms": 0.017302,
        "max_ms": 0.017302,
        "total_ms": 0.332054
      },
      "commit_to_broadcast": {
        "n": 100,
        "mean_ms": 0.010581,
        "p50_ms": 0.008987,
        "p95_ms": 0.029266,
        "p99_ms": 0.03687,
        "max_ms": 0.03687,
        "total_ms": 1.058156
      },
      "broadcast_wait": {
        "n": 100,
        "mean_ms": 0.100418,
        "p50_ms": 0.072548,
        "p95_ms": 0.297663,
        "p99_ms": 0.651562,
        "max_ms": 0.651562,
        "total_ms": 10.041873
      },
      "broadcast_dispatch": {
        "n": 100,
        "mean_ms": 0.003397,
        "p50_ms": 0.003376,
        "p95_ms": 0.00542,
        "p99_ms": 0.007544,
        "max_ms": 0.007544,
        "total_ms": 0.339735
      },
      "encoding": {
        "n": 100,
        "mean_ms": 0.00039,
        "p50_ms": 0.000321,
        "p95_ms": 0.000771,
        "p99_ms": 0.001392,
        "max_ms": 0.001392,
        "total_ms": 0.03909
      },
      "outbox_enqueue": {
        "n": 100,
        "mean_ms": 0.002483,
        "p50_ms": 0.002104,
        "p95_ms": 0.005249,
        "p99_ms": 0.01069,
        "max_ms": 0.01069,
        "total_ms": 0.248379
      },
      "websocket_write": {
        "n": 334,
        "mean_ms": 0.012771,
        "p50_ms": 0.009448,
        "p95_ms": 0.016031,
        "p99_ms": 0.028945,
        "max_ms": 0.404475,
        "total_ms": 4.26573
      },
      "end_to_end_broadcast": {
        "n": 100,
        "mean_ms": 1.96421,
        "p50_ms": 2.067159,
        "p95_ms": 3.03501,
        "p99_ms": 3.070266,
        "max_ms": 3.070266,
        "total_ms": 196.421027
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
    "end_to_end_p95_ms": 3.03501,
    "worker": {
      "queue_depth": 0,
      "queue_capacity": 4096,
      "move_queue_depth": 0,
      "requests_processed": 608,
      "moves_processed": 100,
      "moves_submitted": 100,
      "requests_rejected": 0,
      "avg_queue_wait_ms": 0.097576,
      "max_queue_wait_ms": 3.446067,
      "avg_processing_ms": 0.000874,
      "max_processing_ms": 0.017302
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
      "data_dir": "/tmp/omcb-load-nosync40_tmpfs-18mAGb",
      "sequence": "100",
      "wal_segments": 1,
      "wal_bytes": "8416",
      "snapshots": 0,
      "last_snapshot_sequence": null,
      "snapshot_pending": false,
      "snapshot_write_ms": 0,
      "commits_since_snapshot": 100,
      "sync": false,
      "group_size": 64,
      "sync_count": 0,
      "group_count": 34,
      "batched_moves": 100,
      "last_group_size": 12,
      "average_group_size": 2.9411764705882355,
      "last_sync_ms": 0,
      "fsync_p50_us": 0,
      "fsync_p95_us": 0,
      "snapshot_active": false,
      "snapshot_writing": false,
      "snapshot_buffer": false,
      "snapshot_copy_live": 0,
      "snapshot_copy_live_bytes": 0,
      "dirty": true,
      "truncated_wal": false
    },
    "memory": {
      "rss_kb": 555108,
      "smaps_rollup_kb": {
        "Rss": 555104,
        "Pss": 546802,
        "Shared_Clean": 10728,
        "Shared_Dirty": 0,
        "Private_Clean": 0,
        "Private_Dirty": 544376,
        "Anonymous": 544376,
        "Swap": 0,
        "Locked": 0
      },
      "gc": {
        "heap_words": 1505727,
        "live_words": 1401396,
        "free_words": 99297,
        "top_heap_words": 1505727,
        "major_words": 1511136,
        "minor_words": 216772014,
        "promoted_words": 661342,
        "compactions": 0,
        "major_collections": 11,
        "minor_collections": 837
      },
      "snapshot_copy_live": 0,
      "snapshot_copy_live_bytes": 0
    },
    "adaptive": {
      "enabled": true,
      "max_batch_size": 16,
      "max_batch_delay_us": 0,
      "classification": "moderate",
      "samples": 6,
      "changes": 2,
      "move_rate": 224.48534923058463,
      "pending_moves": 0,
      "fsync_p50_us": 0,
      "fsync_p95_us": 0,
      "broadcast_backlog": 0,
      "event_lag_p95_ms": 1.7527182749999999,
      "recipients_per_event": 9.100000000000001,
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
  "post_exit_measured_at": "2026-11-26T23:55:18.796Z"
};
