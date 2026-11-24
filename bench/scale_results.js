window.SCALE_RESULTS = {
  "generated": "2026-11-24T10:19:28.705Z",
  "config": {
    "levels": [
      0,
      20,
      40,
      80,
      160,
      320,
      640,
      800,
      1020
    ],
    "moves": 100,
    "snapshots_per_client": 4,
    "distribution": "high",
    "outbox_capacity": 256
  },
  "stopped_early": false,
  "error": null,
  "runs": [
    {
      "clients": 0,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_0.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-0\n\nGenerated: 2026-11-24T10:18:25.506Z\n\n## Idle baseline\n\n- 0 active clients, 0 silent clients, no load\n- Duration: 1202 ms\n- RSS: 533 MiB\n- fds: 8\n- CPU: 0.0% average over the sample\n- Worker queue: 0/4096, connections 0\n\nWrote /home/james/Work/sim-map/bench/scale_0_results.json, /home/james/Work/sim-map/bench/scale_0_results.md and /home/james/Work/sim-map/bench/scale_0_results.js\n",
      "result": {
        "generated": "2026-11-24T10:18:25.506Z",
        "label": "clients-0",
        "baseline": true,
        "profile": {
          "clients": 0,
          "silent_clients": 0,
          "snapshots_per_client": 0,
          "moves": 0,
          "drivers": 0,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 0,
          "subscriptions": 0,
          "snapshots": 0,
          "moves": 0,
          "requests": 0
        },
        "duration_ms": 1201.6279929999998,
        "throughput_requests_per_second": 0,
        "snapshot_rtt": null,
        "silent_snapshot_rtt": null,
        "move_rtt": null,
        "event_delivery_lag": null,
        "accuracy": {
          "snapshots_ok": 0,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 0,
          "silent_snapshot_errors": 0,
          "moves_accepted": 0,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 0,
            "min_expected": 0,
            "max_expected": 0,
            "min_events": 0,
            "max_events": 0,
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
            "unexpected_closes": 0,
            "clients_with_events": 0
          }
        },
        "resources": {
          "rss_baseline_kb": 545976,
          "rss_before_kb": 545976,
          "rss_peak_kb": 545976,
          "fds_baseline": 8,
          "fds_before": 8,
          "fds_peak": 8,
          "cpu_average_percent": 0,
          "cpu_peak_percent": 0,
          "cpu_peak_window_ms": 1202,
          "fds_after_close_requests": 8,
          "rss_after_close_requests_kb": 545976,
          "cpu_idle_ticks_per_second": 0,
          "fds_after_exit": 8
        },
        "server_metrics": {
          "started_ns": 346385624418417,
          "uptime_ms": 1963.538032,
          "stages": {
            "receive_to_submit": {
              "n": 0,
              "mean_ms": 0,
              "p50_ms": 0,
              "p95_ms": 0,
              "p99_ms": 0,
              "max_ms": 0,
              "total_ms": 0
            },
            "worker_queue_wait": {
              "n": 0,
              "mean_ms": 0,
              "p50_ms": 0,
              "p95_ms": 0,
              "p99_ms": 0,
              "max_ms": 0,
              "total_ms": 0
            },
            "move_processing": {
              "n": 0,
              "mean_ms": 0,
              "p50_ms": 0,
              "p95_ms": 0,
              "p99_ms": 0,
              "max_ms": 0,
              "total_ms": 0
            },
            "commit_to_broadcast": {
              "n": 0,
              "mean_ms": 0,
              "p50_ms": 0,
              "p95_ms": 0,
              "p99_ms": 0,
              "max_ms": 0,
              "total_ms": 0
            },
            "broadcast_wait": {
              "n": 0,
              "mean_ms": 0,
              "p50_ms": 0,
              "p95_ms": 0,
              "p99_ms": 0,
              "max_ms": 0,
              "total_ms": 0
            },
            "broadcast_dispatch": {
              "n": 0,
              "mean_ms": 0,
              "p50_ms": 0,
              "p95_ms": 0,
              "p99_ms": 0,
              "max_ms": 0,
              "total_ms": 0
            },
            "encoding": {
              "n": 0,
              "mean_ms": 0,
              "p50_ms": 0,
              "p95_ms": 0,
              "p99_ms": 0,
              "max_ms": 0,
              "total_ms": 0
            },
            "outbox_enqueue": {
              "n": 0,
              "mean_ms": 0,
              "p50_ms": 0,
              "p95_ms": 0,
              "p99_ms": 0,
              "max_ms": 0,
              "total_ms": 0
            },
            "websocket_write": {
              "n": 0,
              "mean_ms": 0,
              "p50_ms": 0,
              "p95_ms": 0,
              "p99_ms": 0,
              "max_ms": 0,
              "total_ms": 0
            },
            "end_to_end_broadcast": {
              "n": 0,
              "mean_ms": 0,
              "p50_ms": 0,
              "p95_ms": 0,
              "p99_ms": 0,
              "max_ms": 0,
              "total_ms": 0
            }
          },
          "counters": {
            "events_broadcast": 0,
            "recipients": 0,
            "outbox_enqueues": 0,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 0,
            "max_recipients": 0
          },
          "end_to_end_p95_ms": 0,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 0,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 0,
            "max_queue_wait_ms": 0,
            "avg_processing_ms": 0,
            "max_processing_ms": 0
          },
          "connections": {
            "clients": 0,
            "subscriptions": 0,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "/home/james/Work/sim-map/bench-data-scale",
            "sequence": "0",
            "wal_segments": 1,
            "wal_bytes": "16",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 0,
            "sync": true,
            "truncated_wal": false
          }
        },
        "metrics_error": null
      }
    },
    {
      "clients": 20,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_20.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-20\n\nGenerated: 2026-11-24T10:18:27.104Z\n\n## Load\n\n- 20 active clients, 4 silent clients, high subscription distribution\n- 236 requests: 24 connections, 24 subscriptions, 88 snapshots, 100 moves\n- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 535 ms, throughput 441 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 1.4 ms, p95 2.8 ms, p99 3.1 ms, max 3.1 ms\n- Move RTT: p50 30.2 ms, p95 137.7 ms, p99 139.0 ms, max 139.0 ms\n- Client event delivery lag: p50 31.8 ms, p95 138.4 ms, p99 139.8 ms, max 140.2 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- worker queue wait: p50 7.890 ms, p95 23.159 ms, p99 28.760 ms, max 28.760 ms (n=100)\n- move processing: p50 1.389 ms, p95 1.704 ms, p99 102.113 ms, max 102.113 ms (n=100)\n- commit → broadcaster: p50 0.001 ms, p95 0.006 ms, p99 0.009 ms, max 0.009 ms (n=100)\n- broadcast wait: p50 7.157 ms, p95 21.041 ms, p99 27.176 ms, max 27.176 ms (n=100)\n- recipient lookup: p50 0.002 ms, p95 0.003 ms, p99 0.005 ms, max 0.005 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.002 ms, p99 0.005 ms, max 0.005 ms (n=100)\n- outbox enqueue: p50 0.002 ms, p95 0.006 ms, p99 0.017 ms, max 0.017 ms (n=100)\n- WebSocket write: p50 0.013 ms, p95 0.038 ms, p99 0.086 ms, max 0.604 ms (n=195)\n- end-to-end broadcast: p50 26.378 ms, p95 31.859 ms, p99 133.902 ms, max 133.902 ms (n=100)\n\n- Broadcasts: 100 events, 20.0 recipients/event average, 20 max\n- Outbox: 0 max depth, 256 capacity, 483 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 80/80 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 20/20 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 538 MiB peak, 538 MiB after close requests\n- fds: 9 baseline, 33 with clients, 33 peak, 34 after close requests\n- CPU: 7.5% average, 19.1% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_20_results.json, /home/james/Work/sim-map/bench/scale_20_results.md and /home/james/Work/sim-map/bench/scale_20_results.js\n",
      "result": {
        "generated": "2026-11-24T10:18:27.104Z",
        "label": "clients-20",
        "profile": {
          "clients": 20,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 20,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 24,
          "subscriptions": 24,
          "snapshots": 88,
          "moves": 100,
          "requests": 236
        },
        "duration_ms": 534.6543760000001,
        "throughput_requests_per_second": 441.4066555774341,
        "snapshot_rtt": {
          "n": 80,
          "mean_ms": 1.5296328250000026,
          "p50_ms": 1.4265999999999792,
          "p95_ms": 2.8074840000000165,
          "p99_ms": 3.0586959999999976,
          "max_ms": 3.0586959999999976
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.19318025000000105,
          "p50_ms": 0.21773899999999458,
          "p95_ms": 0.2891930000000116,
          "p99_ms": 0.2891930000000116,
          "max_ms": 0.2891930000000116
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 48.433154360000024,
          "p50_ms": 30.154365999999982,
          "p95_ms": 137.73155300000002,
          "p99_ms": 139.034601,
          "max_ms": 139.034601
        },
        "event_delivery_lag": {
          "n": 2000,
          "mean_ms": 53.379762695999986,
          "p50_ms": 31.770601999999997,
          "p95_ms": 138.40088,
          "p99_ms": 139.75829,
          "max_ms": 140.153192
        },
        "accuracy": {
          "snapshots_ok": 80,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 2000,
            "min_expected": 100,
            "max_expected": 100,
            "min_events": 100,
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
          "rss_baseline_kb": 546636,
          "rss_before_kb": 547432,
          "rss_peak_kb": 550944,
          "fds_baseline": 9,
          "fds_before": 33,
          "fds_peak": 33,
          "cpu_average_percent": 7.4814687386005785,
          "cpu_peak_percent": 19.139881662322455,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 34,
          "rss_after_close_requests_kb": 551084,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 551092,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 346387929078953,
          "uptime_ms": 1253.158125,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000496,
              "p50_ms": 0.00027,
              "p95_ms": 0.002034,
              "p99_ms": 0.003737,
              "max_ms": 0.003737,
              "total_ms": 0.049658
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 8.653083,
              "p50_ms": 7.889791,
              "p95_ms": 23.158664,
              "p99_ms": 28.759806,
              "max_ms": 28.759806,
              "total_ms": 865.308318
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 2.409655,
              "p50_ms": 1.389059,
              "p95_ms": 1.703771,
              "p99_ms": 102.112722,
              "max_ms": 102.112722,
              "total_ms": 240.965524
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.001725,
              "p50_ms": 0.001192,
              "p95_ms": 0.005921,
              "p99_ms": 0.008947,
              "max_ms": 0.008947,
              "total_ms": 0.172561
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 8.365085,
              "p50_ms": 7.157226,
              "p95_ms": 21.040936,
              "p99_ms": 27.17579,
              "max_ms": 27.17579,
              "total_ms": 836.508565
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.001814,
              "p50_ms": 0.001633,
              "p95_ms": 0.003487,
              "p99_ms": 0.004668,
              "max_ms": 0.004668,
              "total_ms": 0.181403
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000627,
              "p50_ms": 0.000401,
              "p95_ms": 0.001933,
              "p99_ms": 0.004729,
              "max_ms": 0.004729,
              "total_ms": 0.062787
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.002205,
              "p50_ms": 0.001503,
              "p95_ms": 0.006402,
              "p99_ms": 0.017273,
              "max_ms": 0.017273,
              "total_ms": 0.220555
            },
            "websocket_write": {
              "n": 195,
              "mean_ms": 0.019028,
              "p50_ms": 0.013315,
              "p95_ms": 0.038132,
              "p99_ms": 0.085901,
              "max_ms": 0.603654,
              "total_ms": 3.710536
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 25.389398,
              "p50_ms": 26.377992,
              "p95_ms": 31.858618,
              "p99_ms": 133.901678,
              "max_ms": 133.901678,
              "total_ms": 2538.939849
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 2000,
            "outbox_enqueues": 483,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 20
          },
          "end_to_end_p95_ms": 31.858618,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 288,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 3.040835,
            "max_queue_wait_ms": 28.759907,
            "avg_processing_ms": 0.836978,
            "max_processing_ms": 102.112722
          },
          "connections": {
            "clients": 24,
            "subscriptions": 15000,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "/home/james/Work/sim-map/bench-data-scale",
            "sequence": "100",
            "wal_segments": 1,
            "wal_bytes": "8416",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "truncated_wal": false
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-24T10:18:32.639Z"
      }
    },
    {
      "clients": 40,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_40.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-40\n\nGenerated: 2026-11-24T10:18:34.309Z\n\n## Load\n\n- 40 active clients, 4 silent clients, high subscription distribution\n- 356 requests: 44 connections, 44 subscriptions, 168 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 478 ms, throughput 744 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 1.9 ms, p95 9.2 ms, p99 9.6 ms, max 9.6 ms\n- Move RTT: p50 72.9 ms, p95 95.4 ms, p99 104.1 ms, max 104.1 ms\n- Client event delivery lag: p50 75.5 ms, p95 96.1 ms, p99 104.0 ms, max 106.5 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.025 ms, max 0.025 ms (n=100)\n- worker queue wait: p50 28.605 ms, p95 72.213 ms, p99 77.344 ms, max 77.344 ms (n=100)\n- move processing: p50 1.403 ms, p95 1.784 ms, p99 22.746 ms, max 22.746 ms (n=100)\n- commit → broadcaster: p50 0.001 ms, p95 0.004 ms, p99 0.012 ms, max 0.012 ms (n=100)\n- broadcast wait: p50 18.546 ms, p95 50.369 ms, p99 55.981 ms, max 55.981 ms (n=100)\n- recipient lookup: p50 0.005 ms, p95 0.010 ms, p99 0.014 ms, max 0.014 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- outbox enqueue: p50 0.004 ms, p95 0.021 ms, p99 0.363 ms, max 0.363 ms (n=100)\n- WebSocket write: p50 0.018 ms, p95 0.035 ms, p99 0.087 ms, max 0.609 ms (n=256)\n- end-to-end broadcast: p50 54.701 ms, p95 83.372 ms, p99 87.835 ms, max 87.835 ms (n=100)\n\n- Broadcasts: 100 events, 40.0 recipients/event average, 40 max\n- Outbox: 0 max depth, 256 capacity, 624 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 160/160 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 40/40 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 541 MiB peak, 541 MiB after close requests\n- fds: 9 baseline, 53 with clients, 53 peak, 54 after close requests\n- CPU: 8.4% average, 19.3% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_40_results.json, /home/james/Work/sim-map/bench/scale_40_results.md and /home/james/Work/sim-map/bench/scale_40_results.js\n",
      "result": {
        "generated": "2026-11-24T10:18:34.309Z",
        "label": "clients-40",
        "profile": {
          "clients": 40,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 44,
          "subscriptions": 44,
          "snapshots": 168,
          "moves": 100,
          "requests": 356
        },
        "duration_ms": 478.32664200000005,
        "throughput_requests_per_second": 744.2612824397098,
        "snapshot_rtt": {
          "n": 160,
          "mean_ms": 3.6068368562499993,
          "p50_ms": 1.896193000000011,
          "p95_ms": 9.165918999999974,
          "p99_ms": 9.553007000000008,
          "max_ms": 9.619672000000008
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.7102720000000033,
          "p50_ms": 1.2009560000000192,
          "p95_ms": 1.3585629999999753,
          "p99_ms": 1.3585629999999753,
          "max_ms": 1.3585629999999753
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 67.66295793,
          "p50_ms": 72.91099399999996,
          "p95_ms": 95.40570300000002,
          "p99_ms": 104.11672899999996,
          "max_ms": 104.11672899999996
        },
        "event_delivery_lag": {
          "n": 4000,
          "mean_ms": 70.24414792300013,
          "p50_ms": 75.49361600000003,
          "p95_ms": 96.12337200000002,
          "p99_ms": 104.044964,
          "max_ms": 106.53846799999997
        },
        "accuracy": {
          "snapshots_ok": 160,
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
          "rss_before_kb": 548176,
          "rss_peak_kb": 554040,
          "fds_baseline": 9,
          "fds_before": 53,
          "fds_peak": 53,
          "cpu_average_percent": 8.362486319547301,
          "cpu_peak_percent": 19.30030302633769,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 54,
          "rss_after_close_requests_kb": 554216,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 554216,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 346395057401289,
          "uptime_ms": 1332.158529,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.00067,
              "p50_ms": 0.00023,
              "p95_ms": 0.002475,
              "p99_ms": 0.025167,
              "max_ms": 0.025167,
              "total_ms": 0.067037
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 30.660777,
              "p50_ms": 28.604598,
              "p95_ms": 72.213464,
              "p99_ms": 77.344122,
              "max_ms": 77.344122,
              "total_ms": 3066.077799
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 1.705372,
              "p50_ms": 1.403417,
              "p95_ms": 1.783751,
              "p99_ms": 22.746011,
              "max_ms": 22.746011,
              "total_ms": 170.537272
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.001807,
              "p50_ms": 0.001403,
              "p95_ms": 0.004057,
              "p99_ms": 0.012353,
              "max_ms": 0.012353,
              "total_ms": 0.180776
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 22.59573,
              "p50_ms": 18.546302,
              "p95_ms": 50.369226,
              "p99_ms": 55.980539,
              "max_ms": 55.980539,
              "total_ms": 2259.573053
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.005072,
              "p50_ms": 0.004569,
              "p95_ms": 0.009828,
              "p99_ms": 0.014286,
              "max_ms": 0.014286,
              "total_ms": 0.507217
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000705,
              "p50_ms": 0.000622,
              "p95_ms": 0.002114,
              "p99_ms": 0.003878,
              "max_ms": 0.003878,
              "total_ms": 0.070583
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.008659,
              "p50_ms": 0.003947,
              "p95_ms": 0.020718,
              "p99_ms": 0.363413,
              "max_ms": 0.363413,
              "total_ms": 0.865956
            },
            "websocket_write": {
              "n": 256,
              "mean_ms": 0.02122,
              "p50_ms": 0.017543,
              "p95_ms": 0.034866,
              "p99_ms": 0.087063,
              "max_ms": 0.608503,
              "total_ms": 5.432332
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 57.947322,
              "p50_ms": 54.700523,
              "p95_ms": 83.372026,
              "p99_ms": 87.834731,
              "max_ms": 87.834731,
              "total_ms": 5794.732252
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 4000,
            "outbox_enqueues": 624,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 40
          },
          "end_to_end_p95_ms": 83.372026,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 368,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 8.530039,
            "max_queue_wait_ms": 77.344172,
            "avg_processing_ms": 0.464665,
            "max_processing_ms": 22.746011
          },
          "connections": {
            "clients": 44,
            "subscriptions": 27500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "/home/james/Work/sim-map/bench-data-scale",
            "sequence": "200",
            "wal_segments": 2,
            "wal_bytes": "16832",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "truncated_wal": false
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-24T10:18:39.849Z"
      }
    },
    {
      "clients": 80,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_80.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-80\n\nGenerated: 2026-11-24T10:18:41.591Z\n\n## Load\n\n- 80 active clients, 4 silent clients, high subscription distribution\n- 596 requests: 84 connections, 84 subscriptions, 328 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 519 ms, throughput 1149 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 6.2 ms, p95 17.4 ms, p99 18.4 ms, max 23.1 ms\n- Move RTT: p50 96.3 ms, p95 103.1 ms, p99 105.7 ms, max 105.7 ms\n- Client event delivery lag: p50 99.1 ms, p95 108.6 ms, p99 110.4 ms, max 117.2 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- worker queue wait: p50 23.945 ms, p95 51.907 ms, p99 57.695 ms, max 57.695 ms (n=100)\n- move processing: p50 1.401 ms, p95 1.813 ms, p99 38.431 ms, max 38.431 ms (n=100)\n- commit → broadcaster: p50 0.001 ms, p95 0.005 ms, p99 0.026 ms, max 0.026 ms (n=100)\n- broadcast wait: p50 24.342 ms, p95 50.217 ms, p99 56.914 ms, max 56.914 ms (n=100)\n- recipient lookup: p50 0.009 ms, p95 0.018 ms, p99 0.027 ms, max 0.027 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.003 ms, p99 0.005 ms, max 0.005 ms (n=100)\n- outbox enqueue: p50 0.006 ms, p95 0.024 ms, p99 0.053 ms, max 0.053 ms (n=100)\n- WebSocket write: p50 0.018 ms, p95 0.036 ms, p99 0.074 ms, max 0.220 ms (n=337)\n- end-to-end broadcast: p50 50.185 ms, p95 65.750 ms, p99 104.619 ms, max 104.619 ms (n=100)\n\n- Broadcasts: 100 events, 80.0 recipients/event average, 80 max\n- Outbox: 0 max depth, 256 capacity, 865 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 320/320 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 80/80 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 547 MiB peak, 547 MiB after close requests\n- fds: 9 baseline, 93 with clients, 93 peak, 94 after close requests\n- CPU: 13.5% average, 29.4% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_80_results.json, /home/james/Work/sim-map/bench/scale_80_results.md and /home/james/Work/sim-map/bench/scale_80_results.js\n",
      "result": {
        "generated": "2026-11-24T10:18:41.591Z",
        "label": "clients-80",
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
        "duration_ms": 518.814777,
        "throughput_requests_per_second": 1148.7722139417783,
        "snapshot_rtt": {
          "n": 320,
          "mean_ms": 8.077619787500002,
          "p50_ms": 6.2150270000000205,
          "p95_ms": 17.44542599999997,
          "p99_ms": 18.38436999999999,
          "max_ms": 23.078810000000004
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.5127819999999943,
          "p50_ms": 0.5480489999999918,
          "p95_ms": 0.872649000000024,
          "p99_ms": 0.872649000000024,
          "max_ms": 0.872649000000024
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 76.02474314,
          "p50_ms": 96.34587299999998,
          "p95_ms": 103.07262099999997,
          "p99_ms": 105.65032300000001,
          "max_ms": 105.65032300000001
        },
        "event_delivery_lag": {
          "n": 8000,
          "mean_ms": 81.98647201137496,
          "p50_ms": 99.092714,
          "p95_ms": 108.61825900000002,
          "p99_ms": 110.43338,
          "max_ms": 117.16530700000004
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
          "rss_baseline_kb": 546432,
          "rss_before_kb": 549740,
          "rss_peak_kb": 560112,
          "fds_baseline": 9,
          "fds_before": 93,
          "fds_peak": 93,
          "cpu_average_percent": 13.492291103343035,
          "cpu_peak_percent": 29.448475406292278,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 94,
          "rss_after_close_requests_kb": 560228,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 560240,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 346402270491940,
          "uptime_ms": 1395.315223,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000535,
              "p50_ms": 0.000371,
              "p95_ms": 0.001232,
              "p99_ms": 0.005922,
              "max_ms": 0.005922,
              "total_ms": 0.053559
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 24.150688,
              "p50_ms": 23.945428,
              "p95_ms": 51.907142,
              "p99_ms": 57.695297,
              "max_ms": 57.695297,
              "total_ms": 2415.068863
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 1.808992,
              "p50_ms": 1.401202,
              "p95_ms": 1.812645,
              "p99_ms": 38.430964,
              "max_ms": 38.430964,
              "total_ms": 180.899274
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.002079,
              "p50_ms": 0.001243,
              "p95_ms": 0.005099,
              "p99_ms": 0.02639,
              "max_ms": 0.02639,
              "total_ms": 0.207966
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 24.469043,
              "p50_ms": 24.341693,
              "p95_ms": 50.216656,
              "p99_ms": 56.913898,
              "max_ms": 56.913898,
              "total_ms": 2446.904329
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.01052,
              "p50_ms": 0.009358,
              "p95_ms": 0.017874,
              "p99_ms": 0.02668,
              "max_ms": 0.02668,
              "total_ms": 1.05205
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000707,
              "p50_ms": 0.000531,
              "p95_ms": 0.002515,
              "p99_ms": 0.004679,
              "max_ms": 0.004679,
              "total_ms": 0.070784
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.009257,
              "p50_ms": 0.006422,
              "p95_ms": 0.024085,
              "p99_ms": 0.052559,
              "max_ms": 0.052559,
              "total_ms": 0.925714
            },
            "websocket_write": {
              "n": 337,
              "mean_ms": 0.021437,
              "p50_ms": 0.018244,
              "p95_ms": 0.035577,
              "p99_ms": 0.073899,
              "max_ms": 0.220013,
              "total_ms": 7.224603
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 56.1836,
              "p50_ms": 50.185377,
              "p95_ms": 65.75014,
              "p99_ms": 104.619236,
              "max_ms": 104.619236,
              "total_ms": 5618.360062
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 8000,
            "outbox_enqueues": 865,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 80
          },
          "end_to_end_p95_ms": 65.75014,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 528,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 5.47621,
            "max_queue_wait_ms": 57.695387,
            "avg_processing_ms": 0.34387,
            "max_processing_ms": 38.430964
          },
          "connections": {
            "clients": 84,
            "subscriptions": 52500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "/home/james/Work/sim-map/bench-data-scale",
            "sequence": "300",
            "wal_segments": 3,
            "wal_bytes": "25248",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "truncated_wal": false
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-24T10:18:47.144Z"
      }
    },
    {
      "clients": 160,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_160.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-160\n\nGenerated: 2026-11-24T10:18:49.091Z\n\n## Load\n\n- 160 active clients, 4 silent clients, high subscription distribution\n- 1076 requests: 164 connections, 164 subscriptions, 648 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 589 ms, throughput 1828 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 9.3 ms, p95 37.1 ms, p99 38.8 ms, max 39.5 ms\n- Move RTT: p50 55.9 ms, p95 144.9 ms, p99 145.4 ms, max 145.4 ms\n- Client event delivery lag: p50 66.0 ms, p95 154.3 ms, p99 157.3 ms, max 157.9 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- worker queue wait: p50 28.785 ms, p95 78.528 ms, p99 84.106 ms, max 84.106 ms (n=100)\n- move processing: p50 1.479 ms, p95 3.208 ms, p99 54.113 ms, max 54.113 ms (n=100)\n- commit → broadcaster: p50 0.003 ms, p95 0.010 ms, p99 0.013 ms, max 0.013 ms (n=100)\n- broadcast wait: p50 24.545 ms, p95 71.356 ms, p99 82.803 ms, max 82.803 ms (n=100)\n- recipient lookup: p50 0.018 ms, p95 0.035 ms, p99 0.058 ms, max 0.058 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.005 ms, max 0.005 ms (n=100)\n- outbox enqueue: p50 0.011 ms, p95 0.067 ms, p99 0.698 ms, max 0.698 ms (n=100)\n- WebSocket write: p50 0.016 ms, p95 0.025 ms, p99 0.066 ms, max 1.269 ms (n=577)\n- end-to-end broadcast: p50 55.521 ms, p95 93.561 ms, p99 148.209 ms, max 148.209 ms (n=100)\n\n- Broadcasts: 100 events, 160.0 recipients/event average, 160 max\n- Outbox: 0 max depth, 256 capacity, 1425 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 640/640 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 160/160 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 559 MiB peak, 559 MiB after close requests\n- fds: 9 baseline, 173 with clients, 173 peak, 174 after close requests\n- CPU: 17.0% average, 48.6% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_160_results.json, /home/james/Work/sim-map/bench/scale_160_results.md and /home/james/Work/sim-map/bench/scale_160_results.js\n",
      "result": {
        "generated": "2026-11-24T10:18:49.091Z",
        "label": "clients-160",
        "profile": {
          "clients": 160,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 164,
          "subscriptions": 164,
          "snapshots": 648,
          "moves": 100,
          "requests": 1076
        },
        "duration_ms": 588.7820569999999,
        "throughput_requests_per_second": 1827.501343166781,
        "snapshot_rtt": {
          "n": 640,
          "mean_ms": 14.119609609375013,
          "p50_ms": 9.255900999999994,
          "p95_ms": 37.12236899999999,
          "p99_ms": 38.76795099999998,
          "max_ms": 39.533139000000006
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.2474046250000086,
          "p50_ms": 0.2857970000000023,
          "p95_ms": 0.4294259999999781,
          "p99_ms": 0.4294259999999781,
          "max_ms": 0.4294259999999781
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 92.09896320999997,
          "p50_ms": 55.931768999999974,
          "p95_ms": 144.87802,
          "p99_ms": 145.41004000000004,
          "max_ms": 145.41004000000004
        },
        "event_delivery_lag": {
          "n": 16000,
          "mean_ms": 99.10511110175003,
          "p50_ms": 66.008532,
          "p95_ms": 154.28159800000003,
          "p99_ms": 157.260084,
          "max_ms": 157.88233300000002
        },
        "accuracy": {
          "snapshots_ok": 640,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 16000,
            "min_expected": 100,
            "max_expected": 100,
            "min_events": 100,
            "max_events": 100,
            "clients_with_events": 160,
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
          "rss_baseline_kb": 546560,
          "rss_before_kb": 553360,
          "rss_peak_kb": 571988,
          "fds_baseline": 9,
          "fds_before": 173,
          "fds_peak": 173,
          "cpu_average_percent": 16.984213226457072,
          "cpu_peak_percent": 48.59709280721915,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 174,
          "rss_after_close_requests_kb": 572316,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 572660,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 346409658756292,
          "uptime_ms": 1498.401304,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000495,
              "p50_ms": 0.000371,
              "p95_ms": 0.000721,
              "p99_ms": 0.00553,
              "max_ms": 0.00553,
              "total_ms": 0.049576
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 32.328069,
              "p50_ms": 28.784734,
              "p95_ms": 78.528045,
              "p99_ms": 84.105625,
              "max_ms": 84.105625,
              "total_ms": 3232.806939
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 2.26856,
              "p50_ms": 1.478588,
              "p95_ms": 3.207927,
              "p99_ms": 54.113293,
              "max_ms": 54.113293,
              "total_ms": 226.856057
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.004046,
              "p50_ms": 0.003015,
              "p95_ms": 0.009979,
              "p99_ms": 0.012563,
              "max_ms": 0.012563,
              "total_ms": 0.404609
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 27.738967,
              "p50_ms": 24.545308,
              "p95_ms": 71.35596,
              "p99_ms": 82.803118,
              "max_ms": 82.803118,
              "total_ms": 2773.896741
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.019223,
              "p50_ms": 0.018395,
              "p95_ms": 0.035437,
              "p99_ms": 0.057688,
              "max_ms": 0.057688,
              "total_ms": 1.922337
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000574,
              "p50_ms": 0.000441,
              "p95_ms": 0.001142,
              "p99_ms": 0.004759,
              "max_ms": 0.004759,
              "total_ms": 0.05746
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.021017,
              "p50_ms": 0.011131,
              "p95_ms": 0.067106,
              "p99_ms": 0.697881,
              "max_ms": 0.697881,
              "total_ms": 2.101768
            },
            "websocket_write": {
              "n": 577,
              "mean_ms": 0.019576,
              "p50_ms": 0.01586,
              "p95_ms": 0.024646,
              "p99_ms": 0.066154,
              "max_ms": 1.268944,
              "total_ms": 11.295853
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 68.911383,
              "p50_ms": 55.520867,
              "p95_ms": 93.56055,
              "p99_ms": 148.209169,
              "max_ms": 148.209169,
              "total_ms": 6891.138321
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 16000,
            "outbox_enqueues": 1425,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 160
          },
          "end_to_end_p95_ms": 93.56055,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 848,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 6.417921,
            "max_queue_wait_ms": 84.105715,
            "avg_processing_ms": 0.269335,
            "max_processing_ms": 54.113293
          },
          "connections": {
            "clients": 164,
            "subscriptions": 102500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "/home/james/Work/sim-map/bench-data-scale",
            "sequence": "400",
            "wal_segments": 4,
            "wal_bytes": "33664",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "truncated_wal": false
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-24T10:18:54.636Z"
      }
    },
    {
      "clients": 320,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_320.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-320\n\nGenerated: 2026-11-24T10:18:56.811Z\n\n## Load\n\n- 320 active clients, 4 silent clients, high subscription distribution\n- 2036 requests: 324 connections, 324 subscriptions, 1288 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 717 ms, throughput 2840 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 19.9 ms, p95 78.5 ms, p99 81.9 ms, max 82.7 ms\n- Move RTT: p50 102.4 ms, p95 191.4 ms, p99 192.3 ms, max 192.3 ms\n- Client event delivery lag: p50 115.6 ms, p95 212.1 ms, p99 213.6 ms, max 214.3 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- worker queue wait: p50 34.339 ms, p95 125.522 ms, p99 131.954 ms, max 131.954 ms (n=100)\n- move processing: p50 1.389 ms, p95 1.765 ms, p99 79.900 ms, max 79.900 ms (n=100)\n- commit → broadcaster: p50 0.001 ms, p95 0.007 ms, p99 0.027 ms, max 0.027 ms (n=100)\n- broadcast wait: p50 26.005 ms, p95 48.158 ms, p99 53.493 ms, max 53.493 ms (n=100)\n- recipient lookup: p50 0.042 ms, p95 0.079 ms, p99 0.105 ms, max 0.105 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.003 ms, p99 1.530 ms, max 1.530 ms (n=100)\n- outbox enqueue: p50 0.029 ms, p95 0.154 ms, p99 1.588 ms, max 1.588 ms (n=100)\n- WebSocket write: p50 0.015 ms, p95 0.026 ms, p99 0.046 ms, max 0.636 ms (n=1057)\n- end-to-end broadcast: p50 66.164 ms, p95 148.751 ms, p99 196.501 ms, max 196.501 ms (n=100)\n\n- Broadcasts: 100 events, 320.0 recipients/event average, 320 max\n- Outbox: 0 max depth, 256 capacity, 2545 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 1280/1280 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 320/320 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 582 MiB peak, 583 MiB after close requests\n- fds: 9 baseline, 333 with clients, 333 peak, 334 after close requests\n- CPU: 25.1% average, 97.7% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_320_results.json, /home/james/Work/sim-map/bench/scale_320_results.md and /home/james/Work/sim-map/bench/scale_320_results.js\n",
      "result": {
        "generated": "2026-11-24T10:18:56.811Z",
        "label": "clients-320",
        "profile": {
          "clients": 320,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 324,
          "subscriptions": 324,
          "snapshots": 1288,
          "moves": 100,
          "requests": 2036
        },
        "duration_ms": 716.946012,
        "throughput_requests_per_second": 2839.823314339044,
        "snapshot_rtt": {
          "n": 1280,
          "mean_ms": 31.598278983593765,
          "p50_ms": 19.937802999999974,
          "p95_ms": 78.48841099999999,
          "p99_ms": 81.87534399999998,
          "max_ms": 82.65712400000001
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.37593987500000026,
          "p50_ms": 0.5340029999999842,
          "p95_ms": 0.6750480000000607,
          "p99_ms": 0.6750480000000607,
          "max_ms": 0.6750480000000607
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 115.15686277000005,
          "p50_ms": 102.44071700000006,
          "p95_ms": 191.43127200000004,
          "p99_ms": 192.296969,
          "max_ms": 192.296969
        },
        "event_delivery_lag": {
          "n": 32000,
          "mean_ms": 128.8794059497503,
          "p50_ms": 115.61246700000004,
          "p95_ms": 212.128192,
          "p99_ms": 213.55807800000002,
          "max_ms": 214.30408999999997
        },
        "accuracy": {
          "snapshots_ok": 1280,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 32000,
            "min_expected": 100,
            "max_expected": 100,
            "min_events": 100,
            "max_events": 100,
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
          "rss_baseline_kb": 546380,
          "rss_before_kb": 560468,
          "rss_peak_kb": 595860,
          "fds_baseline": 9,
          "fds_before": 333,
          "fds_peak": 333,
          "cpu_average_percent": 25.106492955846164,
          "cpu_peak_percent": 97.65366942549353,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 334,
          "rss_after_close_requests_kb": 596728,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 596920,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 346417067612845,
          "uptime_ms": 1725.609941,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000432,
              "p50_ms": 0.000281,
              "p95_ms": 0.000722,
              "p99_ms": 0.004218,
              "max_ms": 0.004218,
              "total_ms": 0.043211
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 53.399611,
              "p50_ms": 34.339344,
              "p95_ms": 125.521918,
              "p99_ms": 131.954224,
              "max_ms": 131.954224,
              "total_ms": 5339.961145
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 2.656927,
              "p50_ms": 1.38942,
              "p95_ms": 1.765136,
              "p99_ms": 79.900274,
              "max_ms": 79.900274,
              "total_ms": 265.692716
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.002279,
              "p50_ms": 0.001142,
              "p95_ms": 0.006633,
              "p99_ms": 0.026961,
              "max_ms": 0.026961,
              "total_ms": 0.227968
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 26.243759,
              "p50_ms": 26.004853,
              "p95_ms": 48.158,
              "p99_ms": 53.493285,
              "max_ms": 53.493285,
              "total_ms": 2624.37592
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.045462,
              "p50_ms": 0.04234,
              "p95_ms": 0.079119,
              "p99_ms": 0.105357,
              "max_ms": 0.105357,
              "total_ms": 4.546218
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.020144,
              "p50_ms": 0.000842,
              "p95_ms": 0.003387,
              "p99_ms": 1.530225,
              "max_ms": 1.530225,
              "total_ms": 2.01449
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.065446,
              "p50_ms": 0.028563,
              "p95_ms": 0.15437,
              "p99_ms": 1.588385,
              "max_ms": 1.588385,
              "total_ms": 6.544614
            },
            "websocket_write": {
              "n": 1057,
              "mean_ms": 0.017412,
              "p50_ms": 0.014558,
              "p95_ms": 0.026159,
              "p99_ms": 0.046167,
              "max_ms": 0.636215,
              "total_ms": 18.404976
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 94.530726,
              "p50_ms": 66.163663,
              "p95_ms": 148.751325,
              "p99_ms": 196.501159,
              "max_ms": 196.501159,
              "total_ms": 9453.072683
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 32000,
            "outbox_enqueues": 2545,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 320
          },
          "end_to_end_p95_ms": 148.751325,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 1488,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 18.185679,
            "max_queue_wait_ms": 131.954334,
            "avg_processing_ms": 0.179919,
            "max_processing_ms": 79.900274
          },
          "connections": {
            "clients": 324,
            "subscriptions": 202500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "/home/james/Work/sim-map/bench-data-scale",
            "sequence": "500",
            "wal_segments": 5,
            "wal_bytes": "42080",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "truncated_wal": false
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-24T10:19:02.424Z"
      }
    },
    {
      "clients": 640,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_640.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-640\n\nGenerated: 2026-11-24T10:19:05.262Z\n\n## Load\n\n- 640 active clients, 4 silent clients, high subscription distribution\n- 3956 requests: 644 connections, 644 subscriptions, 2568 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 1235 ms, throughput 3203 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 37.7 ms, p95 192.0 ms, p99 198.5 ms, max 201.5 ms\n- Move RTT: p50 209.9 ms, p95 238.7 ms, p99 388.8 ms, max 388.8 ms\n- Client event delivery lag: p50 248.3 ms, p95 273.3 ms, p99 388.8 ms, max 435.7 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- worker queue wait: p50 154.316 ms, p95 193.457 ms, p99 198.607 ms, max 198.607 ms (n=100)\n- move processing: p50 1.398 ms, p95 44.920 ms, p99 105.402 ms, max 105.402 ms (n=100)\n- commit → broadcaster: p50 0.001 ms, p95 0.008 ms, p99 0.013 ms, max 0.013 ms (n=100)\n- broadcast wait: p50 29.707 ms, p95 54.219 ms, p99 154.973 ms, max 154.973 ms (n=100)\n- recipient lookup: p50 0.097 ms, p95 0.231 ms, p99 2.264 ms, max 2.264 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.003 ms, p99 0.005 ms, max 0.005 ms (n=100)\n- outbox enqueue: p50 0.073 ms, p95 0.313 ms, p99 2.301 ms, max 2.301 ms (n=100)\n- WebSocket write: p50 0.015 ms, p95 0.024 ms, p99 0.040 ms, max 1.414 ms (n=2017)\n- end-to-end broadcast: p50 202.789 ms, p95 230.942 ms, p99 233.286 ms, max 233.286 ms (n=100)\n\n- Broadcasts: 100 events, 640.0 recipients/event average, 640 max\n- Outbox: 0 max depth, 256 capacity, 4785 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 2560/2560 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 640/640 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 637 MiB peak, 637 MiB after close requests\n- fds: 9 baseline, 653 with clients, 653 peak, 654 after close requests\n- CPU: 31.6% average, 106.1% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_640_results.json, /home/james/Work/sim-map/bench/scale_640_results.md and /home/james/Work/sim-map/bench/scale_640_results.js\n",
      "result": {
        "generated": "2026-11-24T10:19:05.262Z",
        "label": "clients-640",
        "profile": {
          "clients": 640,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 644,
          "subscriptions": 644,
          "snapshots": 2568,
          "moves": 100,
          "requests": 3956
        },
        "duration_ms": 1235.180691,
        "throughput_requests_per_second": 3202.7702738756625,
        "snapshot_rtt": {
          "n": 2560,
          "mean_ms": 69.46976150351568,
          "p50_ms": 37.65987800000005,
          "p95_ms": 191.98113999999998,
          "p99_ms": 198.508716,
          "max_ms": 201.46675299999998
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.8180609999999717,
          "p50_ms": 0.7292299999999159,
          "p95_ms": 1.241081999999892,
          "p99_ms": 1.241081999999892,
          "max_ms": 1.241081999999892
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 218.83054701999993,
          "p50_ms": 209.93100000000004,
          "p95_ms": 238.73570800000005,
          "p99_ms": 388.82536700000014,
          "max_ms": 388.82536700000014
        },
        "event_delivery_lag": {
          "n": 64000,
          "mean_ms": 246.4179354113572,
          "p50_ms": 248.26415300000008,
          "p95_ms": 273.255455,
          "p99_ms": 388.761397,
          "max_ms": 435.69184599999994
        },
        "accuracy": {
          "snapshots_ok": 2560,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 64000,
            "min_expected": 100,
            "max_expected": 100,
            "min_events": 100,
            "max_events": 100,
            "clients_with_events": 640,
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
          "rss_baseline_kb": 546536,
          "rss_before_kb": 575648,
          "rss_peak_kb": 651796,
          "fds_baseline": 9,
          "fds_before": 653,
          "fds_peak": 653,
          "cpu_average_percent": 31.574327775821747,
          "cpu_peak_percent": 106.13556686306734,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 654,
          "rss_after_close_requests_kb": 652680,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 652760,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 346424853366705,
          "uptime_ms": 2458.477263,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000361,
              "p50_ms": 0.00021,
              "p95_ms": 0.000611,
              "p99_ms": 0.004398,
              "max_ms": 0.004398,
              "total_ms": 0.036156
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 144.453344,
              "p50_ms": 154.316402,
              "p95_ms": 193.456622,
              "p99_ms": 198.607261,
              "max_ms": 198.607261,
              "total_ms": 14445.334431
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 5.739568,
              "p50_ms": 1.397867,
              "p95_ms": 44.920432,
              "p99_ms": 105.402486,
              "max_ms": 105.402486,
              "total_ms": 573.956806
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.002308,
              "p50_ms": 0.001412,
              "p95_ms": 0.008376,
              "p99_ms": 0.012684,
              "max_ms": 0.012684,
              "total_ms": 0.230895
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 31.912594,
              "p50_ms": 29.707194,
              "p95_ms": 54.218655,
              "p99_ms": 154.973296,
              "max_ms": 154.973296,
              "total_ms": 3191.259432
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.153517,
              "p50_ms": 0.097253,
              "p95_ms": 0.231225,
              "p99_ms": 2.263914,
              "max_ms": 2.263914,
              "total_ms": 15.351741
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.001033,
              "p50_ms": 0.000742,
              "p95_ms": 0.002545,
              "p99_ms": 0.00496,
              "max_ms": 0.00496,
              "total_ms": 0.103378
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.147521,
              "p50_ms": 0.073087,
              "p95_ms": 0.313148,
              "p99_ms": 2.301144,
              "max_ms": 2.301144,
              "total_ms": 14.75215
            },
            "websocket_write": {
              "n": 2017,
              "mean_ms": 0.017827,
              "p50_ms": 0.014708,
              "p95_ms": 0.024135,
              "p99_ms": 0.040365,
              "max_ms": 1.413776,
              "total_ms": 35.958559
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 208.313498,
              "p50_ms": 202.789119,
              "p95_ms": 230.941762,
              "p99_ms": 233.286047,
              "max_ms": 233.286047,
              "total_ms": 20831.349895
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 64000,
            "outbox_enqueues": 4785,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 640
          },
          "end_to_end_p95_ms": 230.941762,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 2768,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 44.466803,
            "max_queue_wait_ms": 198.607301,
            "avg_processing_ms": 0.210979,
            "max_processing_ms": 105.402486
          },
          "connections": {
            "clients": 644,
            "subscriptions": 402500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "/home/james/Work/sim-map/bench-data-scale",
            "sequence": "600",
            "wal_segments": 6,
            "wal_bytes": "50496",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "truncated_wal": false
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-24T10:19:10.875Z"
      }
    },
    {
      "clients": 800,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_800.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-800\n\nGenerated: 2026-11-24T10:19:13.844Z\n\n## Load\n\n- 800 active clients, 4 silent clients, high subscription distribution\n- 4916 requests: 804 connections, 804 subscriptions, 3208 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 1206 ms, throughput 4075 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 52.1 ms, p95 219.4 ms, p99 226.1 ms, max 232.9 ms\n- Move RTT: p50 197.6 ms, p95 224.0 ms, p99 399.1 ms, max 399.1 ms\n- Client event delivery lag: p50 219.4 ms, p95 292.4 ms, p99 424.8 ms, max 445.5 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- worker queue wait: p50 118.378 ms, p95 162.594 ms, p99 168.144 ms, max 168.144 ms (n=100)\n- move processing: p50 1.406 ms, p95 30.328 ms, p99 80.235 ms, max 80.235 ms (n=100)\n- commit → broadcaster: p50 0.002 ms, p95 0.009 ms, p99 0.012 ms, max 0.012 ms (n=100)\n- broadcast wait: p50 30.035 ms, p95 55.624 ms, p99 123.918 ms, max 123.918 ms (n=100)\n- recipient lookup: p50 0.098 ms, p95 0.203 ms, p99 1.513 ms, max 1.513 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- outbox enqueue: p50 0.084 ms, p95 1.728 ms, p99 3.722 ms, max 3.722 ms (n=100)\n- WebSocket write: p50 0.016 ms, p95 0.029 ms, p99 0.053 ms, max 1.068 ms (n=2497)\n- end-to-end broadcast: p50 175.661 ms, p95 219.271 ms, p99 219.354 ms, max 219.354 ms (n=100)\n\n- Broadcasts: 100 events, 800.0 recipients/event average, 800 max\n- Outbox: 0 max depth, 256 capacity, 5905 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 3200/3200 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 800/800 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 656 MiB peak, 657 MiB after close requests\n- fds: 9 baseline, 813 with clients, 813 peak, 814 after close requests\n- CPU: 39.0% average, 105.1% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_800_results.json, /home/james/Work/sim-map/bench/scale_800_results.md and /home/james/Work/sim-map/bench/scale_800_results.js\n",
      "result": {
        "generated": "2026-11-24T10:19:13.844Z",
        "label": "clients-800",
        "profile": {
          "clients": 800,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 804,
          "subscriptions": 804,
          "snapshots": 3208,
          "moves": 100,
          "requests": 4916
        },
        "duration_ms": 1206.253829,
        "throughput_requests_per_second": 4075.4274778762174,
        "snapshot_rtt": {
          "n": 3200,
          "mean_ms": 83.25828993406239,
          "p50_ms": 52.07389999999998,
          "p95_ms": 219.43391299999996,
          "p99_ms": 226.12978700000008,
          "max_ms": 232.929305
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.16392300000001114,
          "p50_ms": 0.16558100000008835,
          "p95_ms": 0.26276400000006106,
          "p99_ms": 0.26276400000006106,
          "max_ms": 0.26276400000006106
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 188.19274464999995,
          "p50_ms": 197.56964799999992,
          "p95_ms": 223.99584000000004,
          "p99_ms": 399.0879870000001,
          "max_ms": 399.0879870000001
        },
        "event_delivery_lag": {
          "n": 80000,
          "mean_ms": 222.25624043883872,
          "p50_ms": 219.42195500000003,
          "p95_ms": 292.402466,
          "p99_ms": 424.76739599999996,
          "max_ms": 445.524584
        },
        "accuracy": {
          "snapshots_ok": 3200,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 80000,
            "min_expected": 100,
            "max_expected": 100,
            "min_events": 100,
            "max_events": 100,
            "clients_with_events": 800,
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
          "rss_baseline_kb": 546444,
          "rss_before_kb": 582712,
          "rss_peak_kb": 671600,
          "fds_baseline": 9,
          "fds_before": 813,
          "fds_peak": 813,
          "cpu_average_percent": 38.96360688775065,
          "cpu_peak_percent": 105.12289176637859,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 814,
          "rss_after_close_requests_kb": 672732,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 672888,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 346433315710686,
          "uptime_ms": 2554.843952,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000554,
              "p50_ms": 0.000361,
              "p95_ms": 0.001583,
              "p99_ms": 0.005581,
              "max_ms": 0.005581,
              "total_ms": 0.055414
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 94.580384,
              "p50_ms": 118.378396,
              "p95_ms": 162.594169,
              "p99_ms": 168.143679,
              "max_ms": 168.143679,
              "total_ms": 9458.038454
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 4.479995,
              "p50_ms": 1.406072,
              "p95_ms": 30.328285,
              "p99_ms": 80.235064,
              "max_ms": 80.235064,
              "total_ms": 447.99955
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.002998,
              "p50_ms": 0.001553,
              "p95_ms": 0.009007,
              "p99_ms": 0.011592,
              "max_ms": 0.011592,
              "total_ms": 0.299863
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 32.65053,
              "p50_ms": 30.034824,
              "p95_ms": 55.624284,
              "p99_ms": 123.918186,
              "max_ms": 123.918186,
              "total_ms": 3265.053012
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.120168,
              "p50_ms": 0.097603,
              "p95_ms": 0.202971,
              "p99_ms": 1.512803,
              "max_ms": 1.512803,
              "total_ms": 12.016815
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.001115,
              "p50_ms": 0.000981,
              "p95_ms": 0.002354,
              "p99_ms": 0.006212,
              "max_ms": 0.006212,
              "total_ms": 0.111537
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.274423,
              "p50_ms": 0.083808,
              "p95_ms": 1.728088,
              "p99_ms": 3.721974,
              "max_ms": 3.721974,
              "total_ms": 27.442372
            },
            "websocket_write": {
              "n": 2497,
              "mean_ms": 0.019424,
              "p50_ms": 0.01551,
              "p95_ms": 0.028704,
              "p99_ms": 0.05318,
              "max_ms": 1.068478,
              "total_ms": 48.503738
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 169.067319,
              "p50_ms": 175.660785,
              "p95_ms": 219.271402,
              "p99_ms": 219.353557,
              "max_ms": 219.353557,
              "total_ms": 16906.731908
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 80000,
            "outbox_enqueues": 5905,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 800
          },
          "end_to_end_p95_ms": 219.271402,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 3408,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 51.459088,
            "max_queue_wait_ms": 168.143719,
            "avg_processing_ms": 0.133123,
            "max_processing_ms": 80.235064
          },
          "connections": {
            "clients": 804,
            "subscriptions": 502500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "/home/james/Work/sim-map/bench-data-scale",
            "sequence": "700",
            "wal_segments": 7,
            "wal_bytes": "58912",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "truncated_wal": false
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-24T10:19:19.452Z"
      }
    },
    {
      "clients": 1020,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_1020.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-1020\n\nGenerated: 2026-11-24T10:19:22.584Z\n\n## Load\n\n- 1020 active clients, 4 silent clients, high subscription distribution\n- 6236 requests: 1024 connections, 1024 subscriptions, 4088 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 1373 ms, throughput 4540 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 60.8 ms, p95 277.4 ms, p99 292.3 ms, max 294.2 ms\n- Move RTT: p50 202.3 ms, p95 240.9 ms, p99 418.7 ms, max 418.7 ms\n- Client event delivery lag: p50 236.3 ms, p95 299.1 ms, p99 418.7 ms, max 479.5 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- worker queue wait: p50 125.072 ms, p95 171.616 ms, p99 176.719 ms, max 176.719 ms (n=100)\n- move processing: p50 1.400 ms, p95 4.435 ms, p99 112.686 ms, max 112.686 ms (n=100)\n- commit → broadcaster: p50 0.001 ms, p95 0.009 ms, p99 0.014 ms, max 0.014 ms (n=100)\n- broadcast wait: p50 31.903 ms, p95 54.190 ms, p99 146.958 ms, max 146.958 ms (n=100)\n- recipient lookup: p50 0.134 ms, p95 0.321 ms, p99 3.838 ms, max 3.838 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.003 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- outbox enqueue: p50 0.124 ms, p95 1.419 ms, p99 3.427 ms, max 3.427 ms (n=100)\n- WebSocket write: p50 0.015 ms, p95 0.030 ms, p99 0.051 ms, max 1.654 ms (n=3157)\n- end-to-end broadcast: p50 183.750 ms, p95 236.891 ms, p99 236.979 ms, max 236.979 ms (n=100)\n\n- Broadcasts: 100 events, 1020.0 recipients/event average, 1020 max\n- Outbox: 0 max depth, 256 capacity, 7445 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 4080/4080 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 1020/1020 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 687 MiB peak, 689 MiB after close requests\n- fds: 9 baseline, 1033 with clients, 1033 peak, 1034 after close requests\n- CPU: 41.5% average, 106.7% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_1020_results.json, /home/james/Work/sim-map/bench/scale_1020_results.md and /home/james/Work/sim-map/bench/scale_1020_results.js\n",
      "result": {
        "generated": "2026-11-24T10:19:22.584Z",
        "label": "clients-1020",
        "profile": {
          "clients": 1020,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 1024,
          "subscriptions": 1024,
          "snapshots": 4088,
          "moves": 100,
          "requests": 6236
        },
        "duration_ms": 1373.4930359999998,
        "throughput_requests_per_second": 4540.248720998976,
        "snapshot_rtt": {
          "n": 4080,
          "mean_ms": 104.67308694436264,
          "p50_ms": 60.82897200000002,
          "p95_ms": 277.4376050000001,
          "p99_ms": 292.263499,
          "max_ms": 294.185612
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.5368101250000166,
          "p50_ms": 0.9225940000001174,
          "p95_ms": 1.0285120000000916,
          "p99_ms": 1.0285120000000916,
          "max_ms": 1.0285120000000916
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 204.08445588000006,
          "p50_ms": 202.3000239999999,
          "p95_ms": 240.85370000000012,
          "p99_ms": 418.7203740000002,
          "max_ms": 418.7203740000002
        },
        "event_delivery_lag": {
          "n": 102000,
          "mean_ms": 242.4448029264994,
          "p50_ms": 236.31205599999998,
          "p95_ms": 299.10070900000005,
          "p99_ms": 418.6771930000002,
          "max_ms": 479.50704700000006
        },
        "accuracy": {
          "snapshots_ok": 4080,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 102000,
            "min_expected": 100,
            "max_expected": 100,
            "min_events": 100,
            "max_events": 100,
            "clients_with_events": 1020,
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
          "rss_baseline_kb": 546700,
          "rss_before_kb": 591964,
          "rss_peak_kb": 703908,
          "fds_baseline": 9,
          "fds_before": 1033,
          "fds_peak": 1033,
          "cpu_average_percent": 41.500028399124695,
          "cpu_peak_percent": 106.6547368495558,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 1034,
          "rss_after_close_requests_kb": 705524,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 705644,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 346441916023231,
          "uptime_ms": 2625.866254,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000413,
              "p50_ms": 0.000261,
              "p95_ms": 0.000791,
              "p99_ms": 0.006442,
              "max_ms": 0.006442,
              "total_ms": 0.041352
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 95.417217,
              "p50_ms": 125.07208,
              "p95_ms": 171.616485,
              "p99_ms": 176.718594,
              "max_ms": 176.718594,
              "total_ms": 9541.721736
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 4.736514,
              "p50_ms": 1.39955,
              "p95_ms": 4.434505,
              "p99_ms": 112.685692,
              "max_ms": 112.685692,
              "total_ms": 473.651446
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.002719,
              "p50_ms": 0.001483,
              "p95_ms": 0.008576,
              "p99_ms": 0.014347,
              "max_ms": 0.014347,
              "total_ms": 0.271941
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 33.80478,
              "p50_ms": 31.902778,
              "p95_ms": 54.189653,
              "p99_ms": 146.957953,
              "max_ms": 146.957953,
              "total_ms": 3380.478033
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.223027,
              "p50_ms": 0.133501,
              "p95_ms": 0.320503,
              "p99_ms": 3.837612,
              "max_ms": 3.837612,
              "total_ms": 22.302715
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.00132,
              "p50_ms": 0.001042,
              "p95_ms": 0.003176,
              "p99_ms": 0.006031,
              "max_ms": 0.006031,
              "total_ms": 0.132016
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.258762,
              "p50_ms": 0.124103,
              "p95_ms": 1.419057,
              "p99_ms": 3.427111,
              "max_ms": 3.427111,
              "total_ms": 25.876286
            },
            "websocket_write": {
              "n": 3157,
              "mean_ms": 0.019591,
              "p50_ms": 0.015419,
              "p95_ms": 0.029977,
              "p99_ms": 0.051346,
              "max_ms": 1.653719,
              "total_ms": 61.848983
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 180.402015,
              "p50_ms": 183.749551,
              "p95_ms": 236.891373,
              "p99_ms": 236.979378,
              "max_ms": 236.979378,
              "total_ms": 18040.201552
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 102000,
            "outbox_enqueues": 7445,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 1020
          },
          "end_to_end_p95_ms": 236.891373,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 4288,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 65.835361,
            "max_queue_wait_ms": 215.713181,
            "avg_processing_ms": 0.113256,
            "max_processing_ms": 112.685692
          },
          "connections": {
            "clients": 1024,
            "subscriptions": 640000,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "/home/james/Work/sim-map/bench-data-scale",
            "sequence": "800",
            "wal_segments": 8,
            "wal_bytes": "67328",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "truncated_wal": false
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-24T10:19:28.332Z"
      }
    }
  ]
};
