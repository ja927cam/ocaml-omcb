window.LOAD_RESULTS = window.LOAD_RESULTS || {};
window.LOAD_RESULTS["default"] = {
  "generated": "2026-11-21T23:14:22.799Z",
  "label": "default",
  "profile": {
    "clients": 40,
    "silent_clients": 4,
    "snapshots_per_client": 10,
    "moves": 100,
    "drivers": 20,
    "block": 10,
    "window_radius": 12
  },
  "totals": {
    "connections": 44,
    "subscriptions": 44,
    "snapshots": 408,
    "moves": 100,
    "requests": 596
  },
  "duration_ms": 374.40457200000003,
  "throughput_requests_per_second": 1591.8609028097017,
  "snapshot_rtt": {
    "n": 400,
    "mean_ms": 2.812261405000001,
    "p50_ms": 1.9287249999999858,
    "p95_ms": 9.59348,
    "p99_ms": 11.869199000000037,
    "max_ms": 12.145282000000009
  },
  "silent_snapshot_rtt": {
    "n": 8,
    "mean_ms": 0.18731412499999323,
    "p50_ms": 0.21301299999998946,
    "p95_ms": 0.2648810000000026,
    "p99_ms": 0.2648810000000026,
    "max_ms": 0.2648810000000026
  },
  "move_rtt": {
    "n": 100,
    "mean_ms": 12.503919700000006,
    "p50_ms": 12.43231400000002,
    "p95_ms": 18.02254800000003,
    "p99_ms": 18.927808999999968,
    "max_ms": 18.927808999999968
  },
  "event_delivery_lag": {
    "n": 4000,
    "mean_ms": 12.275704177999991,
    "p50_ms": 12.140412000000026,
    "p95_ms": 17.729604999999992,
    "p99_ms": 19.385103000000015,
    "max_ms": 22.084614000000045
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
      "expected_per_client": 100,
      "min_events": 100,
      "max_events": 100,
      "missing_clients": 0,
      "duplicate_clients": 0,
      "extra_clients": 0,
      "wrong_board_events": 0,
      "wrong_revision_events": 0,
      "wrong_change_events": 0,
      "wrong_request_id_events": 0,
      "wrong_board_count_events": 0,
      "silent_events": 0,
      "unexpected_closes": 0,
      "wrong_board": null,
      "wrong_revision": null,
      "wrong_changes": null,
      "wrong_request_id": null,
      "wrong_board_count": null
    }
  },
  "resources": {
    "rss_baseline_kb": 522924,
    "rss_before_kb": 523720,
    "rss_peak_kb": 536524,
    "fds_baseline": 7,
    "fds_before": 51,
    "fds_peak": 51,
    "cpu_average_percent": 21.36726044039868,
    "cpu_peak_percent": 69.29971597511408,
    "fds_after_close_requests": 51,
    "rss_after_close_requests_kb": 536524,
    "cpu_idle_ticks_per_second": 0,
    "rss_after_exit_kb": 536540,
    "fds_after_exit": 6,
    "cpu_idle_after_exit_ticks_per_second": 0,
    "cpu_peak_window_ms": 100
  },
  "post_exit_measured_at": "2026-11-21T23:14:28.343Z"
};
