window.LOAD_RESULTS = window.LOAD_RESULTS || {};
window.LOAD_RESULTS["stress-disk-sync"] = {
  "generated": "2026-11-24T10:18:02.813Z",
  "label": "stress-disk-sync",
  "profile": {
    "clients": 80,
    "silent_clients": 4,
    "snapshots_per_client": 10,
    "moves": 200,
    "drivers": 40,
    "block": 15,
    "window_radius": 12,
    "distribution": "high"
  },
  "totals": {
    "connections": 84,
    "subscriptions": 84,
    "snapshots": 808,
    "moves": 200,
    "requests": 1176
  },
  "duration_ms": 760.5480129999999,
  "throughput_requests_per_second": 1546.2534644739126,
  "snapshot_rtt": {
    "n": 800,
    "mean_ms": 4.358116056250001,
    "p50_ms": 3.0643049999999903,
    "p95_ms": 14.921605,
    "p99_ms": 17.272158999999988,
    "max_ms": 18.173050999999987
  },
  "silent_snapshot_rtt": {
    "n": 8,
    "mean_ms": 0.41826800000000475,
    "p50_ms": 0.4335540000000151,
    "p95_ms": 0.757944000000009,
    "p99_ms": 0.757944000000009,
    "max_ms": 0.757944000000009
  },
  "move_rtt": {
    "n": 200,
    "mean_ms": 83.91503231499998,
    "p50_ms": 57.158852000000024,
    "p95_ms": 165.33922700000005,
    "p99_ms": 166.81386699999996,
    "max_ms": 166.97379800000004
  },
  "event_delivery_lag": {
    "n": 16000,
    "mean_ms": 88.44538611337539,
    "p50_ms": 63.911193000000026,
    "p95_ms": 170.40805699999999,
    "p99_ms": 171.44631700000002,
    "max_ms": 172.06168300000002
  },
  "accuracy": {
    "snapshots_ok": 800,
    "snapshot_errors": 0,
    "silent_snapshots_ok": 8,
    "silent_snapshot_errors": 0,
    "moves_accepted": 200,
    "moves_rejected": 0,
    "move_request_id_mismatches": 0,
    "duplicate_move_sequences": 0,
    "events": {
      "expected_total": 16000,
      "min_expected": 200,
      "max_expected": 200,
      "min_events": 200,
      "max_events": 200,
      "clients_with_events": 80,
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
    "rss_baseline_kb": 547108,
    "rss_before_kb": 550500,
    "rss_peak_kb": 565740,
    "fds_baseline": 8,
    "fds_before": 92,
    "fds_peak": 92,
    "cpu_average_percent": 15.778096576264414,
    "cpu_peak_percent": 29.6646629373439,
    "cpu_peak_window_ms": 100,
    "fds_after_close_requests": 93,
    "rss_after_close_requests_kb": 566140,
    "cpu_idle_ticks_per_second": 0,
    "post_exit_error": "ENOENT: no such file or directory, open '/proc/1845628/stat'"
  },
  "server_metrics": {
    "started_ns": 346361791569199,
    "uptime_ms": 3087.968816,
    "stages": {
      "receive_to_submit": {
        "n": 200,
        "mean_ms": 0.001539,
        "p50_ms": 0.00033,
        "p95_ms": 0.000732,
        "p99_ms": 0.004708,
        "max_ms": 0.214172,
        "total_ms": 0.307997
      },
      "worker_queue_wait": {
        "n": 200,
        "mean_ms": 28.259422,
        "p50_ms": 24.081548,
        "p95_ms": 77.764882,
        "p99_ms": 88.845102,
        "max_ms": 90.128662,
        "total_ms": 5651.88459
      },
      "move_processing": {
        "n": 200,
        "mean_ms": 1.969091,
        "p50_ms": 1.398747,
        "p95_ms": 1.959961,
        "p99_ms": 31.16418,
        "max_ms": 67.19467,
        "total_ms": 393.818358
      },
      "commit_to_broadcast": {
        "n": 200,
        "mean_ms": 0.002244,
        "p50_ms": 0.001352,
        "p95_ms": 0.006562,
        "p99_ms": 0.010088,
        "max_ms": 0.011832,
        "total_ms": 0.448902
      },
      "broadcast_wait": {
        "n": 200,
        "mean_ms": 23.48296,
        "p50_ms": 21.365808,
        "p95_ms": 45.200682,
        "p99_ms": 86.622207,
        "max_ms": 89.119478,
        "total_ms": 4696.59204
      },
      "broadcast_dispatch": {
        "n": 200,
        "mean_ms": 0.011564,
        "p50_ms": 0.010279,
        "p95_ms": 0.022432,
        "p99_ms": 0.033002,
        "max_ms": 0.036839,
        "total_ms": 2.312862
      },
      "encoding": {
        "n": 200,
        "mean_ms": 0.000752,
        "p50_ms": 0.000461,
        "p95_ms": 0.002325,
        "p99_ms": 0.00541,
        "max_ms": 0.019196,
        "total_ms": 0.15046
      },
      "outbox_enqueue": {
        "n": 200,
        "mean_ms": 0.009637,
        "p50_ms": 0.006582,
        "p95_ms": 0.029205,
        "p99_ms": 0.077656,
        "max_ms": 0.082515,
        "total_ms": 1.927404
      },
      "websocket_write": {
        "n": 753,
        "mean_ms": 0.020489,
        "p50_ms": 0.015729,
        "p95_ms": 0.0428,
        "p99_ms": 0.087525,
        "max_ms": 1.297116,
        "total_ms": 15.428513
      },
      "end_to_end_broadcast": {
        "n": 200,
        "mean_ms": 58.904173,
        "p50_ms": 53.017894,
        "p95_ms": 95.731055,
        "p99_ms": 95.896705,
        "max_ms": 163.491527,
        "total_ms": 11780.834681
      }
    },
    "counters": {
      "events_broadcast": 200,
      "recipients": 16000,
      "outbox_enqueues": 1986,
      "outbox_dropped": 0,
      "send_failures": 0,
      "outbox_full_unregisters": 0,
      "events_without_recipients": 0,
      "max_outbox_depth": 1,
      "max_recipients": 80
    },
    "end_to_end_p95_ms": 95.731055,
    "worker": {
      "queue_depth": 0,
      "queue_capacity": 4096,
      "requests_processed": 1233,
      "requests_rejected": 0,
      "avg_queue_wait_ms": 5.100723,
      "max_queue_wait_ms": 90.128733,
      "avg_processing_ms": 0.321186,
      "max_processing_ms": 67.19467
    },
    "connections": {
      "clients": 84,
      "subscriptions": 52500,
      "max_outbox_depth": 0,
      "outbox_capacity": 256,
      "event_batching": true
    },
    "persistence": {
      "data_dir": "/home/james/Work/sim-map/bench-data-stress",
      "sequence": "200",
      "wal_segments": 1,
      "wal_bytes": "16816",
      "snapshots": 0,
      "last_snapshot_sequence": null,
      "snapshot_pending": false,
      "snapshot_write_ms": 0,
      "commits_since_snapshot": 200,
      "sync": true,
      "truncated_wal": false
    }
  },
  "metrics_error": null
};
