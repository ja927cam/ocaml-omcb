window.LOAD_RESULTS = window.LOAD_RESULTS || {};
window.LOAD_RESULTS["default-disk-nosync"] = {
  "generated": "2026-11-24T10:17:46.838Z",
  "label": "default-disk-nosync",
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
  "duration_ms": 321.243524,
  "throughput_requests_per_second": 1855.2903186306721,
  "snapshot_rtt": {
    "n": 400,
    "mean_ms": 2.523813469999999,
    "p50_ms": 1.7695130000000177,
    "p95_ms": 7.470077000000003,
    "p99_ms": 8.158570999999995,
    "max_ms": 8.37843300000003
  },
  "silent_snapshot_rtt": {
    "n": 8,
    "mean_ms": 0.18074074999999112,
    "p50_ms": 0.19342399999999316,
    "p95_ms": 0.2620019999999954,
    "p99_ms": 0.2620019999999954,
    "max_ms": 0.2620019999999954
  },
  "move_rtt": {
    "n": 100,
    "mean_ms": 2.7477123500000022,
    "p50_ms": 2.3939450000000306,
    "p95_ms": 6.123639000000026,
    "p99_ms": 6.4012800000000425,
    "max_ms": 6.4012800000000425
  },
  "event_delivery_lag": {
    "n": 4000,
    "mean_ms": 4.260486676749995,
    "p50_ms": 4.255381,
    "p95_ms": 6.879809000000023,
    "p99_ms": 7.559985999999981,
    "max_ms": 8.328739999999982
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
    "rss_baseline_kb": 546624,
    "rss_before_kb": 548032,
    "rss_peak_kb": 556312,
    "fds_baseline": 8,
    "fds_before": 52,
    "fds_peak": 52,
    "cpu_average_percent": 12.451612876715922,
    "cpu_peak_percent": 29.724511738977565,
    "cpu_peak_window_ms": 100,
    "fds_after_close_requests": 53,
    "rss_after_close_requests_kb": 556348,
    "cpu_idle_ticks_per_second": 0,
    "post_exit_error": "ENOENT: no such file or directory, open '/proc/1843867/stat'"
  },
  "server_metrics": {
    "started_ns": 346346311122807,
    "uptime_ms": 2605.517868,
    "stages": {
      "receive_to_submit": {
        "n": 100,
        "mean_ms": 0.000374,
        "p50_ms": 0.000191,
        "p95_ms": 0.001453,
        "p99_ms": 0.003176,
        "max_ms": 0.003176,
        "total_ms": 0.037475
      },
      "worker_queue_wait": {
        "n": 100,
        "mean_ms": 0.081311,
        "p50_ms": 0.065493,
        "p95_ms": 0.141386,
        "p99_ms": 0.547528,
        "max_ms": 0.547528,
        "total_ms": 8.131103
      },
      "move_processing": {
        "n": 100,
        "mean_ms": 0.00778,
        "p50_ms": 0.004979,
        "p95_ms": 0.023494,
        "p99_ms": 0.052238,
        "max_ms": 0.052238,
        "total_ms": 0.778022
      },
      "commit_to_broadcast": {
        "n": 100,
        "mean_ms": 0.000423,
        "p50_ms": 0.00031,
        "p95_ms": 0.001192,
        "p99_ms": 0.001844,
        "max_ms": 0.001844,
        "total_ms": 0.042354
      },
      "broadcast_wait": {
        "n": 100,
        "mean_ms": 0.285345,
        "p50_ms": 0.174348,
        "p95_ms": 0.998164,
        "p99_ms": 1.061654,
        "max_ms": 1.061654,
        "total_ms": 28.534571
      },
      "broadcast_dispatch": {
        "n": 100,
        "mean_ms": 0.004047,
        "p50_ms": 0.003166,
        "p95_ms": 0.007424,
        "p99_ms": 0.04256,
        "max_ms": 0.04256,
        "total_ms": 0.404711
      },
      "encoding": {
        "n": 100,
        "mean_ms": 0.000432,
        "p50_ms": 0.000321,
        "p95_ms": 0.001182,
        "p99_ms": 0.001403,
        "max_ms": 0.001403,
        "total_ms": 0.043261
      },
      "outbox_enqueue": {
        "n": 100,
        "mean_ms": 0.006984,
        "p50_ms": 0.002264,
        "p95_ms": 0.01086,
        "p99_ms": 0.389601,
        "max_ms": 0.389601,
        "total_ms": 0.698464
      },
      "websocket_write": {
        "n": 373,
        "mean_ms": 0.012202,
        "p50_ms": 0.011091,
        "p95_ms": 0.020739,
        "p99_ms": 0.036338,
        "max_ms": 0.062357,
        "total_ms": 4.551621
      },
      "end_to_end_broadcast": {
        "n": 100,
        "mean_ms": 1.904319,
        "p50_ms": 1.769172,
        "p95_ms": 2.708547,
        "p99_ms": 2.736289,
        "max_ms": 2.736289,
        "total_ms": 190.431987
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
    "end_to_end_p95_ms": 2.708547,
    "worker": {
      "queue_depth": 0,
      "queue_capacity": 4096,
      "requests_processed": 608,
      "requests_rejected": 0,
      "avg_queue_wait_ms": 0.173796,
      "max_queue_wait_ms": 4.093697,
      "avg_processing_ms": 0.001788,
      "max_processing_ms": 0.097643
    },
    "connections": {
      "clients": 44,
      "subscriptions": 27500,
      "max_outbox_depth": 0,
      "outbox_capacity": 256,
      "event_batching": true
    },
    "persistence": {
      "data_dir": "/home/james/Work/sim-map/bench-data-nosync",
      "sequence": "100",
      "wal_segments": 1,
      "wal_bytes": "8416",
      "snapshots": 0,
      "last_snapshot_sequence": null,
      "snapshot_pending": false,
      "snapshot_write_ms": 0,
      "commits_since_snapshot": 100,
      "sync": false,
      "truncated_wal": false
    }
  },
  "metrics_error": null
};
