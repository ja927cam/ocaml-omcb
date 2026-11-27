window.LOAD_RESULTS = window.LOAD_RESULTS || {};
window.LOAD_RESULTS["high320_tmpfs"] = {
  "generated": "2026-11-26T23:54:49.986Z",
  "label": "high320_tmpfs",
  "profile": {
    "clients": 320,
    "silent_clients": 4,
    "snapshots_per_client": 5,
    "moves": 600,
    "drivers": 160,
    "block": 25,
    "window_radius": 12,
    "distribution": "high"
  },
  "totals": {
    "connections": 324,
    "subscriptions": 324,
    "snapshots": 1608,
    "moves": 600,
    "requests": 2856
  },
  "duration_ms": 788.387746,
  "throughput_requests_per_second": 3622.582941566928,
  "snapshot_rtt": {
    "n": 1600,
    "mean_ms": 26.56339462750001,
    "p50_ms": 17.138904000000025,
    "p95_ms": 74.33742799999999,
    "p99_ms": 78.817881,
    "max_ms": 86.34129000000001
  },
  "silent_snapshot_rtt": {
    "n": 8,
    "mean_ms": 0.20642650000000629,
    "p50_ms": 0.22747000000003936,
    "p95_ms": 0.3537589999999682,
    "p99_ms": 0.3537589999999682,
    "max_ms": 0.3537589999999682
  },
  "move_rtt": {
    "n": 600,
    "mean_ms": 93.63255739000006,
    "p50_ms": 98.78285900000003,
    "p95_ms": 152.43994700000007,
    "p99_ms": 232.576231,
    "max_ms": 237.56825199999992
  },
  "event_delivery_lag": {
    "n": 192000,
    "mean_ms": 85.37297424705298,
    "p50_ms": 78.08333200000004,
    "p95_ms": 181.28136099999995,
    "p99_ms": 222.78082600000005,
    "max_ms": 289.44120399999997
  },
  "accuracy": {
    "snapshots_ok": 1600,
    "snapshot_errors": 0,
    "silent_snapshots_ok": 8,
    "silent_snapshot_errors": 0,
    "moves_accepted": 600,
    "moves_rejected": 0,
    "move_request_id_mismatches": 0,
    "duplicate_move_sequences": 0,
    "events": {
      "expected_total": 192000,
      "min_expected": 600,
      "max_expected": 600,
      "min_events": 600,
      "max_events": 600,
      "clients_with_events": 320,
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
    "rss_baseline_kb": 548604,
    "rss_before_kb": 559700,
    "rss_peak_kb": 629036,
    "fds_baseline": 8,
    "fds_before": 332,
    "fds_peak": 332,
    "cpu_average_percent": 52.00486715834876,
    "cpu_peak_percent": 104.7864247853045,
    "cpu_peak_window_ms": 100,
    "fds_after_close_requests": 333,
    "rss_after_close_requests_kb": 629648,
    "cpu_idle_ticks_per_second": 0,
    "rss_after_exit_kb": 629704,
    "fds_after_exit": 7,
    "cpu_idle_after_exit_ticks_per_second": 1
  },
  "server_metrics": {
    "started_ns": 9324698543672,
    "uptime_ms": 1712.385324,
    "stages": {
      "receive_to_submit": {
        "n": 600,
        "mean_ms": 0.000778,
        "p50_ms": 0.00024,
        "p95_ms": 0.001583,
        "p99_ms": 0.003327,
        "max_ms": 0.23767,
        "total_ms": 0.466913
      },
      "worker_queue_wait": {
        "n": 600,
        "mean_ms": 8.075004,
        "p50_ms": 0.417439,
        "p95_ms": 26.974955,
        "p99_ms": 27.385521,
        "max_ms": 27.427401,
        "total_ms": 4845.002542
      },
      "move_processing": {
        "n": 600,
        "mean_ms": 0.005192,
        "p50_ms": 0.002545,
        "p95_ms": 0.018525,
        "p99_ms": 0.025839,
        "max_ms": 0.766669,
        "total_ms": 3.115626
      },
      "commit_to_broadcast": {
        "n": 600,
        "mean_ms": 0.030467,
        "p50_ms": 0.022062,
        "p95_ms": 0.050606,
        "p99_ms": 0.076855,
        "max_ms": 0.818949,
        "total_ms": 18.280438
      },
      "broadcast_wait": {
        "n": 600,
        "mean_ms": 2.812257,
        "p50_ms": 1.459611,
        "p95_ms": 9.742515,
        "p99_ms": 13.81108,
        "max_ms": 14.861867,
        "total_ms": 1687.354305
      },
      "broadcast_dispatch": {
        "n": 600,
        "mean_ms": 0.04625,
        "p50_ms": 0.030458,
        "p95_ms": 0.072387,
        "p99_ms": 0.214766,
        "max_ms": 2.385311,
        "total_ms": 27.750346
      },
      "encoding": {
        "n": 600,
        "mean_ms": 0.000814,
        "p50_ms": 0.000661,
        "p95_ms": 0.001683,
        "p99_ms": 0.002275,
        "max_ms": 0.012243,
        "total_ms": 0.488514
      },
      "outbox_enqueue": {
        "n": 600,
        "mean_ms": 0.047049,
        "p50_ms": 0.023014,
        "p95_ms": 0.110549,
        "p99_ms": 0.663154,
        "max_ms": 1.611888,
        "total_ms": 28.229516
      },
      "websocket_write": {
        "n": 10170,
        "mean_ms": 0.015858,
        "p50_ms": 0.013326,
        "p95_ms": 0.023735,
        "p99_ms": 0.037401,
        "max_ms": 2.009531,
        "total_ms": 161.284416
      },
      "end_to_end_broadcast": {
        "n": 600,
        "mean_ms": 22.899185,
        "p50_ms": 19.124018,
        "p95_ms": 51.638339,
        "p99_ms": 51.941993,
        "max_ms": 52.006035,
        "total_ms": 13739.511477
      }
    },
    "counters": {
      "events_broadcast": 600,
      "recipients": 192000,
      "outbox_enqueues": 13003,
      "outbox_dropped": 0,
      "send_failures": 0,
      "outbox_full_unregisters": 0,
      "events_without_recipients": 0,
      "max_outbox_depth": 1,
      "max_recipients": 320
    },
    "end_to_end_p95_ms": 51.638339,
    "worker": {
      "queue_depth": 0,
      "queue_capacity": 4096,
      "move_queue_depth": 0,
      "requests_processed": 2833,
      "moves_processed": 600,
      "moves_submitted": 600,
      "requests_rejected": 0,
      "avg_queue_wait_ms": 9.684598,
      "max_queue_wait_ms": 56.072856,
      "avg_processing_ms": 0.002793,
      "max_processing_ms": 1.757985
    },
    "connections": {
      "clients": 324,
      "subscriptions": 201800,
      "max_outbox_depth": 0,
      "total_outbox_depth": 0,
      "pending_event_count": 0,
      "outbox_capacity": 256,
      "event_batching": true
    },
    "persistence": {
      "data_dir": "/tmp/omcb-load-high320_tmpfs-Bw05Et",
      "sequence": "600",
      "wal_segments": 1,
      "wal_bytes": "50416",
      "snapshots": 0,
      "last_snapshot_sequence": null,
      "snapshot_pending": false,
      "snapshot_write_ms": 0,
      "commits_since_snapshot": 600,
      "sync": true,
      "group_size": 64,
      "sync_count": 69,
      "group_count": 69,
      "batched_moves": 600,
      "last_group_size": 4,
      "average_group_size": 8.695652173913043,
      "last_sync_ms": 0.0009765625,
      "fsync_p50_us": 0.9765625,
      "fsync_p95_us": 2.9296875,
      "snapshot_active": false,
      "snapshot_writing": false,
      "snapshot_buffer": false,
      "snapshot_copy_live": 0,
      "snapshot_copy_live_bytes": 0,
      "dirty": false,
      "truncated_wal": false
    },
    "memory": {
      "rss_kb": 629188,
      "smaps_rollup_kb": {
        "Rss": 629184,
        "Pss": 620685,
        "Shared_Clean": 10996,
        "Shared_Dirty": 0,
        "Private_Clean": 0,
        "Private_Dirty": 618188,
        "Anonymous": 618188,
        "Swap": 0,
        "Locked": 0
      },
      "gc": {
        "heap_words": 9562431,
        "live_words": 8726113,
        "free_words": 807252,
        "top_heap_words": 10311999,
        "major_words": 13930662,
        "minor_words": 237176183,
        "promoted_words": 6470194,
        "compactions": 0,
        "major_collections": 19,
        "minor_collections": 919
      },
      "snapshot_copy_live": 0,
      "snapshot_copy_live_bytes": 0
    },
    "adaptive": {
      "enabled": true,
      "max_batch_size": 16,
      "max_batch_delay_us": 0,
      "classification": "moderate",
      "samples": 13,
      "changes": 2,
      "move_rate": 292.9417797171877,
      "pending_moves": 2,
      "fsync_p50_us": 0.9286891807556152,
      "fsync_p95_us": 2.736990308189392,
      "broadcast_backlog": 0,
      "event_lag_p95_ms": 15.15683726884786,
      "recipients_per_event": 72.19287075,
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
  "post_exit_measured_at": "2026-11-26T23:54:55.734Z"
};
