window.LOAD_RESULTS = window.LOAD_RESULTS || {};
window.LOAD_RESULTS["disk_nosync40_home"] = {
  "generated": "2026-11-26T23:55:42.622Z",
  "label": "disk_nosync40_home",
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
  "duration_ms": 322.03300800000005,
  "throughput_requests_per_second": 1850.7419587249265,
  "snapshot_rtt": {
    "n": 400,
    "mean_ms": 2.4352972425000012,
    "p50_ms": 1.8955249999999921,
    "p95_ms": 7.284185000000008,
    "p99_ms": 8.76311100000001,
    "max_ms": 9.087954999999994
  },
  "silent_snapshot_rtt": {
    "n": 8,
    "mean_ms": 0.15460349999999323,
    "p50_ms": 0.1687289999999848,
    "p95_ms": 0.22258099999999104,
    "p99_ms": 0.22258099999999104,
    "max_ms": 0.22258099999999104
  },
  "move_rtt": {
    "n": 100,
    "mean_ms": 3.244813730000002,
    "p50_ms": 3.3564170000000217,
    "p95_ms": 5.23125200000004,
    "p99_ms": 6.084154999999953,
    "max_ms": 6.084154999999953
  },
  "event_delivery_lag": {
    "n": 4000,
    "mean_ms": 4.285314027750001,
    "p50_ms": 4.293740000000014,
    "p95_ms": 7.348326000000043,
    "p99_ms": 7.860343999999998,
    "max_ms": 8.224463000000014
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
    "rss_baseline_kb": 546224,
    "rss_before_kb": 547356,
    "rss_peak_kb": 555296,
    "fds_baseline": 8,
    "fds_before": 52,
    "fds_peak": 52,
    "cpu_average_percent": 9.315815228481172,
    "cpu_peak_percent": 29.7260998515746,
    "cpu_peak_window_ms": 100,
    "fds_after_close_requests": 53,
    "rss_after_close_requests_kb": 555312,
    "cpu_idle_ticks_per_second": 0,
    "rss_after_exit_kb": 556124,
    "fds_after_exit": 7,
    "cpu_idle_after_exit_ticks_per_second": 1
  },
  "server_metrics": {
    "started_ns": 9378038640588,
    "uptime_ms": 1085.220898,
    "stages": {
      "receive_to_submit": {
        "n": 100,
        "mean_ms": 0.000283,
        "p50_ms": 0.00018,
        "p95_ms": 0.000952,
        "p99_ms": 0.001974,
        "max_ms": 0.001974,
        "total_ms": 0.028388
      },
      "worker_queue_wait": {
        "n": 100,
        "mean_ms": 0.687712,
        "p50_ms": 0.643617,
        "p95_ms": 1.447267,
        "p99_ms": 1.790766,
        "max_ms": 1.790766,
        "total_ms": 68.771251
      },
      "move_processing": {
        "n": 100,
        "mean_ms": 0.006841,
        "p50_ms": 0.004589,
        "p95_ms": 0.02121,
        "p99_ms": 0.040707,
        "max_ms": 0.040707,
        "total_ms": 0.684111
      },
      "commit_to_broadcast": {
        "n": 100,
        "mean_ms": 0.030639,
        "p50_ms": 0.025118,
        "p95_ms": 0.074781,
        "p99_ms": 0.099568,
        "max_ms": 0.099568,
        "total_ms": 3.063939
      },
      "broadcast_wait": {
        "n": 100,
        "mean_ms": 0.216265,
        "p50_ms": 0.161646,
        "p95_ms": 0.559859,
        "p99_ms": 1.343771,
        "max_ms": 1.343771,
        "total_ms": 21.62657
      },
      "broadcast_dispatch": {
        "n": 100,
        "mean_ms": 0.003881,
        "p50_ms": 0.003757,
        "p95_ms": 0.007644,
        "p99_ms": 0.012413,
        "max_ms": 0.012413,
        "total_ms": 0.388104
      },
      "encoding": {
        "n": 100,
        "mean_ms": 0.00053,
        "p50_ms": 0.000371,
        "p95_ms": 0.001032,
        "p99_ms": 0.008085,
        "max_ms": 0.008085,
        "total_ms": 0.053058
      },
      "outbox_enqueue": {
        "n": 100,
        "mean_ms": 0.003626,
        "p50_ms": 0.002364,
        "p95_ms": 0.007334,
        "p99_ms": 0.085031,
        "max_ms": 0.085031,
        "total_ms": 0.362654
      },
      "websocket_write": {
        "n": 373,
        "mean_ms": 0.011944,
        "p50_ms": 0.010229,
        "p95_ms": 0.019978,
        "p99_ms": 0.050556,
        "max_ms": 0.065063,
        "total_ms": 4.455475
      },
      "end_to_end_broadcast": {
        "n": 100,
        "mean_ms": 2.554056,
        "p50_ms": 2.716126,
        "p95_ms": 3.564811,
        "p99_ms": 3.639642,
        "max_ms": 3.639642,
        "total_ms": 255.405696
      }
    },
    "counters": {
      "events_broadcast": 100,
      "recipients": 4000,
      "outbox_enqueues": 981,
      "outbox_dropped": 0,
      "send_failures": 0,
      "outbox_full_unregisters": 0,
      "events_without_recipients": 0,
      "max_outbox_depth": 1,
      "max_recipients": 40
    },
    "end_to_end_p95_ms": 3.564811,
    "worker": {
      "queue_depth": 0,
      "queue_capacity": 4096,
      "move_queue_depth": 0,
      "requests_processed": 608,
      "moves_processed": 100,
      "moves_submitted": 100,
      "requests_rejected": 0,
      "avg_queue_wait_ms": 0.243832,
      "max_queue_wait_ms": 4.116033,
      "avg_processing_ms": 0.001455,
      "max_processing_ms": 0.040707
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
      "data_dir": "/home/james/Work/ocaml-omcb/bench/evening/diskdata-disk_nosync40_home-qbVv10",
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
      "group_count": 13,
      "batched_moves": 100,
      "last_group_size": 3,
      "average_group_size": 7.6923076923076925,
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
      "rss_kb": 555308,
      "smaps_rollup_kb": {
        "Rss": 555304,
        "Pss": 546887,
        "Shared_Clean": 10892,
        "Shared_Dirty": 0,
        "Private_Clean": 4,
        "Private_Dirty": 544408,
        "Anonymous": 544408,
        "Swap": 0,
        "Locked": 0
      },
      "gc": {
        "heap_words": 1488923,
        "live_words": 1397954,
        "free_words": 86247,
        "top_heap_words": 1488923,
        "major_words": 1545063,
        "minor_words": 216755995,
        "promoted_words": 638215,
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
      "max_batch_delay_us": 250,
      "classification": "moderate",
      "samples": 6,
      "changes": 2,
      "move_rate": 146.91260653089455,
      "pending_moves": 0,
      "fsync_p50_us": 0,
      "fsync_p95_us": 0,
      "broadcast_backlog": 0,
      "event_lag_p95_ms": 2.585824779125,
      "recipients_per_event": 5.915000000000001,
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
  "post_exit_measured_at": "2026-11-26T23:55:48.166Z"
};
