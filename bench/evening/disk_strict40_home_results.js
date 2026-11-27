window.LOAD_RESULTS = window.LOAD_RESULTS || {};
window.LOAD_RESULTS["disk_strict40_home"] = {
  "generated": "2026-11-26T23:55:35.334Z",
  "label": "disk_strict40_home",
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
  "duration_ms": 620.82254,
  "throughput_requests_per_second": 960.0166901156649,
  "snapshot_rtt": {
    "n": 400,
    "mean_ms": 2.8362614975,
    "p50_ms": 2.228925000000004,
    "p95_ms": 7.233228999999994,
    "p99_ms": 8.501136000000002,
    "max_ms": 8.722083999999995
  },
  "silent_snapshot_rtt": {
    "n": 8,
    "mean_ms": 0.1956999999999951,
    "p50_ms": 0.2465569999999957,
    "p95_ms": 0.33138700000000654,
    "p99_ms": 0.33138700000000654,
    "max_ms": 0.33138700000000654
  },
  "move_rtt": {
    "n": 100,
    "mean_ms": 60.86710589000004,
    "p50_ms": 35.292238999999995,
    "p95_ms": 178.164426,
    "p99_ms": 178.633694,
    "max_ms": 178.633694
  },
  "event_delivery_lag": {
    "n": 4000,
    "mean_ms": 66.89526074675005,
    "p50_ms": 40.64923900000002,
    "p95_ms": 179.40756699999997,
    "p99_ms": 179.801742,
    "max_ms": 180.05343799999997
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
    "rss_baseline_kb": 546232,
    "rss_before_kb": 547436,
    "rss_peak_kb": 554964,
    "fds_baseline": 8,
    "fds_before": 52,
    "fds_peak": 52,
    "cpu_average_percent": 9.664597551499982,
    "cpu_peak_percent": 19.62854875451312,
    "cpu_peak_window_ms": 100,
    "fds_after_close_requests": 53,
    "rss_after_close_requests_kb": 555184,
    "cpu_idle_ticks_per_second": 0,
    "rss_after_exit_kb": 555204,
    "fds_after_exit": 7,
    "cpu_idle_after_exit_ticks_per_second": 0
  },
  "server_metrics": {
    "started_ns": 9370449128333,
    "uptime_ms": 1386.631215,
    "stages": {
      "receive_to_submit": {
        "n": 100,
        "mean_ms": 0.000493,
        "p50_ms": 0.000381,
        "p95_ms": 0.002164,
        "p99_ms": 0.002585,
        "max_ms": 0.002585,
        "total_ms": 0.04935
      },
      "worker_queue_wait": {
        "n": 100,
        "mean_ms": 22.327924,
        "p50_ms": 9.787929,
        "p95_ms": 90.803192,
        "p99_ms": 95.739737,
        "max_ms": 95.739737,
        "total_ms": 2232.792459
      },
      "move_processing": {
        "n": 100,
        "mean_ms": 2.964531,
        "p50_ms": 1.394918,
        "p95_ms": 4.27825,
        "p99_ms": 78.73446,
        "max_ms": 78.73446,
        "total_ms": 296.45318
      },
      "commit_to_broadcast": {
        "n": 100,
        "mean_ms": 0.003215,
        "p50_ms": 0.001884,
        "p95_ms": 0.010981,
        "p99_ms": 0.033984,
        "max_ms": 0.033984,
        "total_ms": 0.321562
      },
      "broadcast_wait": {
        "n": 100,
        "mean_ms": 10.45749,
        "p50_ms": 8.295517,
        "p95_ms": 24.782214,
        "p99_ms": 89.25227,
        "max_ms": 89.25227,
        "total_ms": 1045.749076
      },
      "broadcast_dispatch": {
        "n": 100,
        "mean_ms": 0.004878,
        "p50_ms": 0.003998,
        "p95_ms": 0.010991,
        "p99_ms": 0.014547,
        "max_ms": 0.014547,
        "total_ms": 0.487809
      },
      "encoding": {
        "n": 100,
        "mean_ms": 0.000642,
        "p50_ms": 0.000431,
        "p95_ms": 0.001753,
        "p99_ms": 0.003567,
        "max_ms": 0.003567,
        "total_ms": 0.064221
      },
      "outbox_enqueue": {
        "n": 100,
        "mean_ms": 0.004501,
        "p50_ms": 0.003006,
        "p95_ms": 0.014357,
        "p99_ms": 0.036609,
        "max_ms": 0.036609,
        "total_ms": 0.450174
      },
      "websocket_write": {
        "n": 295,
        "mean_ms": 0.022927,
        "p50_ms": 0.016952,
        "p95_ms": 0.039745,
        "p99_ms": 0.082205,
        "max_ms": 0.802798,
        "total_ms": 6.763655
      },
      "end_to_end_broadcast": {
        "n": 100,
        "mean_ms": 43.68712,
        "p50_ms": 36.570526,
        "p95_ms": 99.512912,
        "p99_ms": 178.55234,
        "max_ms": 178.55234,
        "total_ms": 4368.71204
      }
    },
    "counters": {
      "events_broadcast": 100,
      "recipients": 4000,
      "outbox_enqueues": 903,
      "outbox_dropped": 0,
      "send_failures": 0,
      "outbox_full_unregisters": 0,
      "events_without_recipients": 0,
      "max_outbox_depth": 1,
      "max_recipients": 40
    },
    "end_to_end_p95_ms": 99.512912,
    "worker": {
      "queue_depth": 0,
      "queue_capacity": 4096,
      "move_queue_depth": 0,
      "requests_processed": 608,
      "moves_processed": 100,
      "moves_submitted": 100,
      "requests_rejected": 0,
      "avg_queue_wait_ms": 3.817915,
      "max_queue_wait_ms": 95.739837,
      "avg_processing_ms": 0.491376,
      "max_processing_ms": 78.73446
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
      "data_dir": "/home/james/Work/ocaml-omcb/bench/evening/diskdata-disk_strict40_home-LQUtEe",
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
      "last_sync_ms": 1.3681640625,
      "fsync_p50_us": 1380.859375,
      "fsync_p95_us": 4209.9609375,
      "snapshot_active": false,
      "snapshot_writing": false,
      "snapshot_buffer": false,
      "snapshot_copy_live": 0,
      "snapshot_copy_live_bytes": 0,
      "dirty": false,
      "truncated_wal": false
    },
    "memory": {
      "rss_kb": 554976,
      "smaps_rollup_kb": {
        "Rss": 554972,
        "Pss": 546536,
        "Shared_Clean": 10912,
        "Shared_Dirty": 0,
        "Private_Clean": 0,
        "Private_Dirty": 544060,
        "Anonymous": 544060,
        "Swap": 0,
        "Locked": 0
      },
      "gc": {
        "heap_words": 1471863,
        "live_words": 1381566,
        "free_words": 85498,
        "top_heap_words": 1471863,
        "major_words": 1461329,
        "minor_words": 216753862,
        "promoted_words": 648582,
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
  "post_exit_measured_at": "2026-11-26T23:55:40.878Z"
};
