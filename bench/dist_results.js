window.DIST_RESULTS = {
  "generated": "2026-11-23T00:09:04.354Z",
  "config": {
    "levels": [
      80
    ],
    "modes": [
      "high",
      "low",
      "partial"
    ],
    "moves": 100,
    "snapshots_per_client": 4,
    "outbox_capacity": 256
  },
  "stopped_early": false,
  "error": null,
  "runs": [
    {
      "clients": 80,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-dist_high_80.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: dist-high-80\n\nGenerated: 2026-11-23T00:08:44.429Z\n\n## Load\n\n- 80 active clients, 4 silent clients, high subscription distribution\n- 596 requests: 84 connections, 84 subscriptions, 328 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 337 ms, throughput 1770 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 4.1 ms, p95 19.8 ms, p99 20.5 ms, max 22.3 ms\n- Move RTT: p50 7.6 ms, p95 17.4 ms, p99 17.6 ms, max 17.6 ms\n- Client event delivery lag: p50 9.0 ms, p95 19.1 ms, p99 22.5 ms, max 25.6 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- worker queue wait: p50 0.048 ms, p95 0.427 ms, p99 0.489 ms, max 0.489 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.004 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.002 ms, p99 0.002 ms, max 0.002 ms (n=100)\n- broadcast wait: p50 0.203 ms, p95 1.012 ms, p99 1.132 ms, max 1.132 ms (n=100)\n- recipient lookup: p50 0.007 ms, p95 0.012 ms, p99 0.021 ms, max 0.021 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)\n- outbox enqueue: p50 0.004 ms, p95 0.013 ms, p99 0.562 ms, max 0.562 ms (n=100)\n- WebSocket write: p50 0.011 ms, p95 0.020 ms, p99 0.040 ms, max 0.365 ms (n=574)\n- end-to-end broadcast: p50 2.580 ms, p95 3.158 ms, p99 3.329 ms, max 3.329 ms (n=100)\n\n- Broadcasts: 100 events, 80.0 recipients/event average, 80 max\n- Outbox: 0 max depth, 256 capacity, 1102 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 320/320 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 80/80 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 518 MiB baseline, 531 MiB peak, 531 MiB after close requests\n- fds: 8 baseline, 92 with clients, 92 peak, 93 after close requests\n- CPU: 14.9% average, 39.7% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/dist_high_80_results.json, /home/james/Work/sim-map/bench/dist_high_80_results.md and /home/james/Work/sim-map/bench/dist_high_80_results.js\n",
      "result": {
        "generated": "2026-11-23T00:08:44.429Z",
        "label": "dist-high-80",
        "profile": {
          "clients": 80,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 84,
          "subscriptions": 84,
          "snapshots": 328,
          "moves": 100,
          "requests": 596
        },
        "duration_ms": 336.646341,
        "throughput_requests_per_second": 1770.403914771793,
        "snapshot_rtt": {
          "n": 320,
          "mean_ms": 7.2485314781250025,
          "p50_ms": 4.088481999999999,
          "p95_ms": 19.777579000000003,
          "p99_ms": 20.470857999999964,
          "max_ms": 22.299914
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.3121132499999888,
          "p50_ms": 0.27842499999997017,
          "p95_ms": 0.6245799999999804,
          "p99_ms": 0.6245799999999804,
          "max_ms": 0.6245799999999804
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 8.30076107,
          "p50_ms": 7.564528999999993,
          "p95_ms": 17.372465999999974,
          "p99_ms": 17.629902000000016,
          "max_ms": 17.629902000000016
        },
        "event_delivery_lag": {
          "n": 8000,
          "mean_ms": 9.68768046449998,
          "p50_ms": 8.956789999999955,
          "p95_ms": 19.122071000000005,
          "p99_ms": 22.470906000000014,
          "max_ms": 25.61569700000001
        },
        "accuracy": {
          "snapshots_ok": 320,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 8000,
            "min_expected": 100,
            "max_expected": 100,
            "min_events": 100,
            "max_events": 100,
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
          "rss_baseline_kb": 530064,
          "rss_before_kb": 533312,
          "rss_peak_kb": 543664,
          "fds_baseline": 8,
          "fds_before": 92,
          "fds_peak": 92,
          "cpu_average_percent": 14.852381835333835,
          "cpu_peak_percent": 39.73218560028314,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 93,
          "rss_after_close_requests_kb": 543988,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 543996,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 223405321965146,
          "uptime_ms": 1181.368376,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000422,
              "p50_ms": 0.000211,
              "p95_ms": 0.002244,
              "p99_ms": 0.003847,
              "max_ms": 0.003847,
              "total_ms": 0.042236
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.089783,
              "p50_ms": 0.04757,
              "p95_ms": 0.427468,
              "p99_ms": 0.489264,
              "max_ms": 0.489264,
              "total_ms": 8.978387
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.000845,
              "p50_ms": 0.00043,
              "p95_ms": 0.004148,
              "p99_ms": 0.005931,
              "max_ms": 0.005931,
              "total_ms": 0.08457
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000398,
              "p50_ms": 0.00023,
              "p95_ms": 0.001513,
              "p99_ms": 0.002495,
              "max_ms": 0.002495,
              "total_ms": 0.039803
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 0.319047,
              "p50_ms": 0.202653,
              "p95_ms": 1.012002,
              "p99_ms": 1.131627,
              "max_ms": 1.131627,
              "total_ms": 31.904762
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.007497,
              "p50_ms": 0.006692,
              "p95_ms": 0.012413,
              "p99_ms": 0.02126,
              "max_ms": 0.02126,
              "total_ms": 0.749737
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000435,
              "p50_ms": 0.00031,
              "p95_ms": 0.001132,
              "p99_ms": 0.002185,
              "max_ms": 0.002185,
              "total_ms": 0.04357
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.011221,
              "p50_ms": 0.004298,
              "p95_ms": 0.013225,
              "p99_ms": 0.562071,
              "max_ms": 0.562071,
              "total_ms": 1.122119
            },
            "websocket_write": {
              "n": 574,
              "mean_ms": 0.012611,
              "p50_ms": 0.01058,
              "p95_ms": 0.020319,
              "p99_ms": 0.039685,
              "max_ms": 0.365109,
              "total_ms": 7.23892
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 2.632181,
              "p50_ms": 2.579503,
              "p95_ms": 3.158296,
              "p99_ms": 3.329209,
              "max_ms": 3.329209,
              "total_ms": 263.218105
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 8000,
            "outbox_enqueues": 1102,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 80
          },
          "end_to_end_p95_ms": 3.158296,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 528,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 0.509253,
            "max_queue_wait_ms": 11.616654,
            "avg_processing_ms": 0.001248,
            "max_processing_ms": 0.382622
          },
          "connections": {
            "clients": 84,
            "subscriptions": 52500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-23T00:08:49.978Z"
      }
    },
    {
      "clients": 80,
      "distribution": "low",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-dist_low_80.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: dist-low-80\n\nGenerated: 2026-11-23T00:08:51.532Z\n\n## Load\n\n- 80 active clients, 4 silent clients, low subscription distribution\n- 596 requests: 84 connections, 84 subscriptions, 328 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 334 ms, throughput 1782 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 6.1 ms, p95 36.5 ms, p99 43.1 ms, max 43.6 ms\n- Move RTT: p50 1.6 ms, p95 2.7 ms, p99 2.8 ms, max 2.8 ms\n- Client event delivery lag: p50 1.8 ms, p95 2.3 ms, p99 2.3 ms, max 2.3 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- worker queue wait: p50 0.025 ms, p95 0.107 ms, p99 0.122 ms, max 0.122 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.001 ms, p99 0.007 ms, max 0.007 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.675 ms, max 0.675 ms (n=100)\n- broadcast wait: p50 0.042 ms, p95 0.209 ms, p99 0.234 ms, max 0.234 ms (n=100)\n- recipient lookup: p50 0.001 ms, p95 0.002 ms, p99 0.002 ms, max 0.002 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.000 ms, p99 0.001 ms, max 0.001 ms (n=100)\n- outbox enqueue: p50 0.000 ms, p95 0.000 ms, p99 0.002 ms, max 0.002 ms (n=100)\n- WebSocket write: p50 0.017 ms, p95 0.030 ms, p99 0.030 ms, max 0.030 ms (n=8)\n- end-to-end broadcast: p50 0.449 ms, p95 1.264 ms, p99 1.288 ms, max 1.288 ms (n=100)\n\n- Broadcasts: 100 events, 1.0 recipients/event average, 1 max\n- Outbox: 0 max depth, 256 capacity, 536 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 320/320 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 1/80 clients received events\n- Expected/actual per client: 0-100 expected, 0-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 517 MiB baseline, 538 MiB peak, 538 MiB after close requests\n- fds: 8 baseline, 92 with clients, 92 peak, 93 after close requests\n- CPU: 17.9% average, 47.7% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/dist_low_80_results.json, /home/james/Work/sim-map/bench/dist_low_80_results.md and /home/james/Work/sim-map/bench/dist_low_80_results.js\n",
      "result": {
        "generated": "2026-11-23T00:08:51.532Z",
        "label": "dist-low-80",
        "profile": {
          "clients": 80,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "low"
        },
        "totals": {
          "connections": 84,
          "subscriptions": 84,
          "snapshots": 328,
          "moves": 100,
          "requests": 596
        },
        "duration_ms": 334.42303100000004,
        "throughput_requests_per_second": 1782.1739077533805,
        "snapshot_rtt": {
          "n": 320,
          "mean_ms": 12.247638643749998,
          "p50_ms": 6.080926999999974,
          "p95_ms": 36.49359399999997,
          "p99_ms": 43.085758,
          "max_ms": 43.570873000000006
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.4976989999999972,
          "p50_ms": 0.5387180000000171,
          "p95_ms": 0.8808639999999741,
          "p99_ms": 0.8808639999999741,
          "max_ms": 0.8808639999999741
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 1.6107950299999987,
          "p50_ms": 1.6186370000000352,
          "p95_ms": 2.6594240000000013,
          "p99_ms": 2.817493000000013,
          "max_ms": 2.817493000000013
        },
        "event_delivery_lag": {
          "n": 100,
          "mean_ms": 1.7172338199999815,
          "p50_ms": 1.8219719999999597,
          "p95_ms": 2.2844749999999863,
          "p99_ms": 2.33981,
          "max_ms": 2.33981
        },
        "accuracy": {
          "snapshots_ok": 320,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 100,
            "min_expected": 0,
            "max_expected": 100,
            "min_events": 0,
            "max_events": 100,
            "clients_with_events": 1,
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
          "rss_baseline_kb": 529844,
          "rss_before_kb": 533248,
          "rss_peak_kb": 550904,
          "fds_baseline": 8,
          "fds_before": 92,
          "fds_peak": 92,
          "cpu_average_percent": 17.941348064631345,
          "cpu_peak_percent": 47.696356599329924,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 93,
          "rss_after_close_requests_kb": 551348,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 551364,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 223412397224881,
          "uptime_ms": 1215.142445,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000274,
              "p50_ms": 0.00021,
              "p95_ms": 0.000521,
              "p99_ms": 0.003316,
              "max_ms": 0.003316,
              "total_ms": 0.027409
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.033175,
              "p50_ms": 0.025237,
              "p95_ms": 0.107453,
              "p99_ms": 0.1219,
              "max_ms": 0.1219,
              "total_ms": 3.317514
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.000558,
              "p50_ms": 0.0004,
              "p95_ms": 0.001182,
              "p99_ms": 0.006573,
              "max_ms": 0.006573,
              "total_ms": 0.055805
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.007039,
              "p50_ms": 0.000231,
              "p95_ms": 0.000781,
              "p99_ms": 0.674815,
              "max_ms": 0.674815,
              "total_ms": 0.703962
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 0.062255,
              "p50_ms": 0.041969,
              "p95_ms": 0.209375,
              "p99_ms": 0.233752,
              "max_ms": 0.233752,
              "total_ms": 6.225509
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.001077,
              "p50_ms": 0.001012,
              "p95_ms": 0.001793,
              "p99_ms": 0.002214,
              "max_ms": 0.002214,
              "total_ms": 0.107715
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000308,
              "p50_ms": 0.00028,
              "p95_ms": 0.000481,
              "p99_ms": 0.001242,
              "max_ms": 0.001242,
              "total_ms": 0.030847
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.000217,
              "p50_ms": 0.000161,
              "p95_ms": 0.000431,
              "p99_ms": 0.002024,
              "max_ms": 0.002024,
              "total_ms": 0.021794
            },
            "websocket_write": {
              "n": 8,
              "mean_ms": 0.015266,
              "p50_ms": 0.017303,
              "p95_ms": 0.029576,
              "p99_ms": 0.029576,
              "max_ms": 0.029576,
              "total_ms": 0.122131
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 0.558519,
              "p50_ms": 0.449008,
              "p95_ms": 1.263857,
              "p99_ms": 1.288023,
              "max_ms": 1.288023,
              "total_ms": 55.851923
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 100,
            "outbox_enqueues": 536,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 1
          },
          "end_to_end_p95_ms": 1.263857,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 528,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 2.059302,
            "max_queue_wait_ms": 26.988159,
            "avg_processing_ms": 0.001336,
            "max_processing_ms": 0.409183
          },
          "connections": {
            "clients": 84,
            "subscriptions": 52500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-23T00:08:57.067Z"
      }
    },
    {
      "clients": 80,
      "distribution": "partial",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-dist_partial_80.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: dist-partial-80\n\nGenerated: 2026-11-23T00:08:58.500Z\n\n## Load\n\n- 80 active clients, 4 silent clients, partial subscription distribution\n- 596 requests: 84 connections, 84 subscriptions, 328 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 321 ms, throughput 1859 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 5.2 ms, p95 17.3 ms, p99 18.2 ms, max 18.3 ms\n- Move RTT: p50 3.6 ms, p95 7.4 ms, p99 8.5 ms, max 8.5 ms\n- Client event delivery lag: p50 3.4 ms, p95 6.1 ms, p99 7.8 ms, max 8.9 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.013 ms, max 0.013 ms (n=100)\n- worker queue wait: p50 0.014 ms, p95 0.149 ms, p99 0.559 ms, max 0.559 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.002 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)\n- broadcast wait: p50 0.031 ms, p95 0.270 ms, p99 0.313 ms, max 0.313 ms (n=100)\n- recipient lookup: p50 0.002 ms, p95 0.003 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.001 ms, max 0.001 ms (n=100)\n- outbox enqueue: p50 0.001 ms, p95 0.003 ms, p99 0.009 ms, max 0.009 ms (n=100)\n- WebSocket write: p50 0.009 ms, p95 0.017 ms, p99 0.019 ms, max 0.021 ms (n=142)\n- end-to-end broadcast: p50 0.826 ms, p95 1.677 ms, p99 1.830 ms, max 1.830 ms (n=100)\n\n- Broadcasts: 100 events, 20.0 recipients/event average, 20 max\n- Outbox: 0 max depth, 256 capacity, 670 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 320/320 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 20/80 clients received events\n- Expected/actual per client: 0-100 expected, 0-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 518 MiB baseline, 529 MiB peak, 529 MiB after close requests\n- fds: 8 baseline, 92 with clients, 92 peak, 93 after close requests\n- CPU: 9.4% average, 29.8% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/dist_partial_80_results.json, /home/james/Work/sim-map/bench/dist_partial_80_results.md and /home/james/Work/sim-map/bench/dist_partial_80_results.js\n",
      "result": {
        "generated": "2026-11-23T00:08:58.500Z",
        "label": "dist-partial-80",
        "profile": {
          "clients": 80,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "partial"
        },
        "totals": {
          "connections": 84,
          "subscriptions": 84,
          "snapshots": 328,
          "moves": 100,
          "requests": 596
        },
        "duration_ms": 320.65237,
        "throughput_requests_per_second": 1858.7107277579141,
        "snapshot_rtt": {
          "n": 320,
          "mean_ms": 6.818705853124996,
          "p50_ms": 5.157321999999965,
          "p95_ms": 17.25341000000003,
          "p99_ms": 18.165182999999956,
          "max_ms": 18.285018999999977
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.4648079999999979,
          "p50_ms": 0.544497999999976,
          "p95_ms": 0.6575520000000097,
          "p99_ms": 0.6575520000000097,
          "max_ms": 0.6575520000000097
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 3.6364689000000014,
          "p50_ms": 3.6124340000000075,
          "p95_ms": 7.3905300000000125,
          "p99_ms": 8.45990999999998,
          "max_ms": 8.45990999999998
        },
        "event_delivery_lag": {
          "n": 2000,
          "mean_ms": 3.456750754999997,
          "p50_ms": 3.3958339999999794,
          "p95_ms": 6.076888999999994,
          "p99_ms": 7.803690999999958,
          "max_ms": 8.910812999999962
        },
        "accuracy": {
          "snapshots_ok": 320,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 2000,
            "min_expected": 0,
            "max_expected": 100,
            "min_events": 0,
            "max_events": 100,
            "clients_with_events": 20,
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
          "rss_baseline_kb": 530016,
          "rss_before_kb": 533492,
          "rss_peak_kb": 541404,
          "fds_baseline": 8,
          "fds_before": 92,
          "fds_peak": 92,
          "cpu_average_percent": 9.355926482002923,
          "cpu_peak_percent": 29.75572425001366,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 93,
          "rss_after_close_requests_kb": 541820,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 541840,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 223419484625782,
          "uptime_ms": 1093.312583,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000419,
              "p50_ms": 0.000211,
              "p95_ms": 0.000631,
              "p99_ms": 0.012754,
              "max_ms": 0.012754,
              "total_ms": 0.041964
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.037683,
              "p50_ms": 0.013866,
              "p95_ms": 0.148531,
              "p99_ms": 0.558936,
              "max_ms": 0.558936,
              "total_ms": 3.768359
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.00067,
              "p50_ms": 0.000481,
              "p95_ms": 0.001573,
              "p99_ms": 0.006472,
              "max_ms": 0.006472,
              "total_ms": 0.067073
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000353,
              "p50_ms": 0.000291,
              "p95_ms": 0.000742,
              "p99_ms": 0.001804,
              "max_ms": 0.001804,
              "total_ms": 0.035316
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 0.06658,
              "p50_ms": 0.030988,
              "p95_ms": 0.26958,
              "p99_ms": 0.313131,
              "max_ms": 0.313131,
              "total_ms": 6.658024
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.00188,
              "p50_ms": 0.001763,
              "p95_ms": 0.003226,
              "p99_ms": 0.003968,
              "max_ms": 0.003968,
              "total_ms": 0.188089
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000371,
              "p50_ms": 0.000301,
              "p95_ms": 0.000912,
              "p99_ms": 0.001402,
              "max_ms": 0.001402,
              "total_ms": 0.03711
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.001584,
              "p50_ms": 0.001293,
              "p95_ms": 0.002685,
              "p99_ms": 0.009338,
              "max_ms": 0.009338,
              "total_ms": 0.158452
            },
            "websocket_write": {
              "n": 142,
              "mean_ms": 0.010135,
              "p50_ms": 0.009247,
              "p95_ms": 0.016932,
              "p99_ms": 0.019347,
              "max_ms": 0.02131,
              "total_ms": 1.439239
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 0.977013,
              "p50_ms": 0.826221,
              "p95_ms": 1.676958,
              "p99_ms": 1.829736,
              "max_ms": 1.829736,
              "total_ms": 97.701336
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 2000,
            "outbox_enqueues": 670,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 20
          },
          "end_to_end_p95_ms": 1.676958,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 528,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 0.770648,
            "max_queue_wait_ms": 7.905813,
            "avg_processing_ms": 0.00385,
            "max_processing_ms": 1.393553
          },
          "connections": {
            "clients": 84,
            "subscriptions": 52500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-23T00:09:04.041Z"
      }
    }
  ]
};
