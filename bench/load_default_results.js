window.LOAD_RESULTS = window.LOAD_RESULTS || {};
window.LOAD_RESULTS["default"] = {
  "generated": "2026-11-23T00:06:18.528Z",
  "label": "default",
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
  "duration_ms": 318.64590799999996,
  "throughput_requests_per_second": 1870.4147300708473,
  "snapshot_rtt": {
    "n": 400,
    "mean_ms": 2.447266137500001,
    "p50_ms": 1.6237280000000283,
    "p95_ms": 8.220307999999989,
    "p99_ms": 9.261484999999993,
    "max_ms": 9.405777
  },
  "silent_snapshot_rtt": {
    "n": 8,
    "mean_ms": 0.16570924999999193,
    "p50_ms": 0.17621300000001838,
    "p95_ms": 0.22872200000000475,
    "p99_ms": 0.22872200000000475,
    "max_ms": 0.22872200000000475
  },
  "move_rtt": {
    "n": 100,
    "mean_ms": 2.4328314299999994,
    "p50_ms": 1.7871360000000323,
    "p95_ms": 4.5273820000000455,
    "p99_ms": 6.64915000000002,
    "max_ms": 6.64915000000002
  },
  "event_delivery_lag": {
    "n": 4000,
    "mean_ms": 3.8832331912500053,
    "p50_ms": 3.9056580000000167,
    "p95_ms": 6.277107000000001,
    "p99_ms": 7.887990000000002,
    "max_ms": 8.681700000000035
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
    "rss_baseline_kb": 530036,
    "rss_before_kb": 531340,
    "rss_peak_kb": 539112,
    "fds_baseline": 7,
    "fds_before": 51,
    "fds_peak": 51,
    "cpu_average_percent": 9.414839245323057,
    "cpu_peak_percent": 19.460617650229473,
    "cpu_peak_window_ms": 100,
    "fds_after_close_requests": 52,
    "rss_after_close_requests_kb": 539340,
    "cpu_idle_ticks_per_second": 0,
    "rss_after_exit_kb": 539356,
    "fds_after_exit": 6,
    "cpu_idle_after_exit_ticks_per_second": 0
  },
  "server_metrics": {
    "started_ns": 223258511419931,
    "uptime_ms": 2094.14148,
    "stages": {
      "receive_to_submit": {
        "n": 100,
        "mean_ms": 0.000359,
        "p50_ms": 0.000191,
        "p95_ms": 0.001353,
        "p99_ms": 0.003467,
        "max_ms": 0.003467,
        "total_ms": 0.03592
      },
      "worker_queue_wait": {
        "n": 100,
        "mean_ms": 0.025749,
        "p50_ms": 0.019056,
        "p95_ms": 0.066346,
        "p99_ms": 0.234102,
        "max_ms": 0.234102,
        "total_ms": 2.574968
      },
      "move_processing": {
        "n": 100,
        "mean_ms": 0.00077,
        "p50_ms": 0.000571,
        "p95_ms": 0.002425,
        "p99_ms": 0.006292,
        "max_ms": 0.006292,
        "total_ms": 0.077013
      },
      "commit_to_broadcast": {
        "n": 100,
        "mean_ms": 0.000369,
        "p50_ms": 0.00025,
        "p95_ms": 0.001263,
        "p99_ms": 0.001823,
        "max_ms": 0.001823,
        "total_ms": 0.036985
      },
      "broadcast_wait": {
        "n": 100,
        "mean_ms": 0.086525,
        "p50_ms": 0.06866,
        "p95_ms": 0.262396,
        "p99_ms": 0.345292,
        "max_ms": 0.345292,
        "total_ms": 8.652513
      },
      "broadcast_dispatch": {
        "n": 100,
        "mean_ms": 0.003181,
        "p50_ms": 0.002996,
        "p95_ms": 0.00536,
        "p99_ms": 0.007384,
        "max_ms": 0.007384,
        "total_ms": 0.318168
      },
      "encoding": {
        "n": 100,
        "mean_ms": 0.000375,
        "p50_ms": 0.00031,
        "p95_ms": 0.000902,
        "p99_ms": 0.001513,
        "max_ms": 0.001513,
        "total_ms": 0.037592
      },
      "outbox_enqueue": {
        "n": 100,
        "mean_ms": 0.002637,
        "p50_ms": 0.002144,
        "p95_ms": 0.006232,
        "p99_ms": 0.010099,
        "max_ms": 0.010099,
        "total_ms": 0.26378
      },
      "websocket_write": {
        "n": 334,
        "mean_ms": 0.013183,
        "p50_ms": 0.010309,
        "p95_ms": 0.016711,
        "p99_ms": 0.03183,
        "max_ms": 0.416517,
        "total_ms": 4.403373
      },
      "end_to_end_broadcast": {
        "n": 100,
        "mean_ms": 1.957895,
        "p50_ms": 1.981523,
        "p95_ms": 2.980059,
        "p99_ms": 3.156692,
        "max_ms": 3.156692,
        "total_ms": 195.789553
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
    "end_to_end_p95_ms": 2.980059,
    "worker": {
      "queue_depth": 0,
      "queue_capacity": 4096,
      "requests_processed": 608,
      "requests_rejected": 0,
      "avg_queue_wait_ms": 0.119492,
      "max_queue_wait_ms": 4.75401,
      "avg_processing_ms": 0.000536,
      "max_processing_ms": 0.007524
    },
    "connections": {
      "clients": 44,
      "subscriptions": 27500,
      "max_outbox_depth": 0,
      "outbox_capacity": 256,
      "event_batching": true
    }
  },
  "metrics_error": null,
  "post_exit_measured_at": "2026-11-23T00:06:24.073Z"
};
