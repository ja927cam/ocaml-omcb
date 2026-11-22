window.SCALE_RESULTS = {
  "generated": "2026-11-22T00:24:31.091Z",
  "config": {
    "levels": [
      0,
      20,
      40,
      80,
      160,
      200,
      320,
      400,
      600,
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
      "stdout": "# Live load test results\n\nProfile: clients-0\n\nGenerated: 2026-11-22T00:23:09.860Z\n\n## Idle baseline\n\n- 0 active clients, 0 silent clients, no load\n- Duration: 1201 ms\n- RSS: 513 MiB\n- fds: 7\n- CPU: 0.0% average over the sample\n- Worker queue: 0/4096, connections 0\n\nWrote /home/james/Work/sim-map/bench/scale_0_results.json, /home/james/Work/sim-map/bench/scale_0_results.md and /home/james/Work/sim-map/bench/scale_0_results.js\n",
      "result": {
        "generated": "2026-11-22T00:23:09.860Z",
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
        "duration_ms": 1201.3479909999999,
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
          "rss_baseline_kb": 525556,
          "rss_before_kb": 525556,
          "rss_peak_kb": 525556,
          "fds_baseline": 7,
          "fds_before": 7,
          "fds_peak": 7,
          "cpu_average_percent": 0,
          "cpu_peak_percent": 0,
          "cpu_peak_window_ms": 1201,
          "fds_after_close_requests": 7,
          "rss_after_close_requests_kb": 525556,
          "cpu_idle_ticks_per_second": 0,
          "fds_after_exit": 7
        },
        "server_metrics": {
          "started_ns": 137870084211710,
          "uptime_ms": 1857.729281,
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
      "stdout": "# Live load test results\n\nProfile: clients-20\n\nGenerated: 2026-11-22T00:23:11.227Z\n\n## Load\n\n- 20 active clients, 4 silent clients, high subscription distribution\n- 236 requests: 24 connections, 24 subscriptions, 88 snapshots, 100 moves\n- 20 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 300 ms, throughput 786 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 1.5 ms, p95 2.9 ms, p99 3.1 ms, max 3.1 ms\n- Move RTT: p50 2.7 ms, p95 4.4 ms, p99 5.4 ms, max 5.4 ms\n- Client event delivery lag: p50 2.7 ms, p95 4.4 ms, p99 4.9 ms, max 6.4 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- worker queue wait: p50 0.002 ms, p95 0.050 ms, p99 0.067 ms, max 0.067 ms (n=100)\n- move processing: p50 0.001 ms, p95 0.002 ms, p99 0.009 ms, max 0.009 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- broadcast wait: p50 0.001 ms, p95 0.161 ms, p99 0.216 ms, max 0.216 ms (n=100)\n- recipient lookup: p50 0.002 ms, p95 0.003 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- outbox enqueue: p50 0.001 ms, p95 0.003 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- WebSocket write: p50 0.010 ms, p95 0.021 ms, p99 0.045 ms, max 0.197 ms (n=290)\n- end-to-end broadcast: p50 0.962 ms, p95 2.324 ms, p99 2.479 ms, max 2.479 ms (n=100)\n\n- Broadcasts: 100 events, 20.0 recipients/event average, 20 max\n- Outbox: 0 max depth, 256 capacity, 578 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 80/80 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 20/20 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 516 MiB baseline, 520 MiB peak, 520 MiB after close requests\n- fds: 8 baseline, 32 with clients, 32 peak, 33 after close requests\n- CPU: 6.7% average, 10.0% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_20_results.json, /home/james/Work/sim-map/bench/scale_20_results.md and /home/james/Work/sim-map/bench/scale_20_results.js\n",
      "result": {
        "generated": "2026-11-22T00:23:11.227Z",
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
        "duration_ms": 300.355273,
        "throughput_requests_per_second": 785.7361638528649,
        "snapshot_rtt": {
          "n": 80,
          "mean_ms": 1.5259552875,
          "p50_ms": 1.460015999999996,
          "p95_ms": 2.9131599999999764,
          "p99_ms": 3.0759979999999985,
          "max_ms": 3.0759979999999985
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.4564744999999988,
          "p50_ms": 0.22772999999997978,
          "p95_ms": 1.2426759999999888,
          "p99_ms": 1.2426759999999888,
          "max_ms": 1.2426759999999888
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 2.7325335000000006,
          "p50_ms": 2.7445610000000045,
          "p95_ms": 4.3546619999999905,
          "p99_ms": 5.358746999999994,
          "max_ms": 5.358746999999994
        },
        "event_delivery_lag": {
          "n": 2000,
          "mean_ms": 2.6849500115000042,
          "p50_ms": 2.6987650000000087,
          "p95_ms": 4.382623999999993,
          "p99_ms": 4.919457999999992,
          "max_ms": 6.369786000000005
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
          "rss_baseline_kb": 527960,
          "rss_before_kb": 528580,
          "rss_peak_kb": 532744,
          "fds_baseline": 8,
          "fds_before": 32,
          "fds_peak": 32,
          "cpu_average_percent": 6.65878104960055,
          "cpu_peak_percent": 9.994414421612193,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 33,
          "rss_after_close_requests_kb": 532852,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 532868,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137872276937256,
          "uptime_ms": 1028.215378,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000364,
              "p50_ms": 0.00027,
              "p95_ms": 0.000722,
              "p99_ms": 0.003477,
              "max_ms": 0.003477,
              "total_ms": 0.036401
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.01078,
              "p50_ms": 0.002003,
              "p95_ms": 0.049835,
              "p99_ms": 0.066625,
              "max_ms": 0.066625,
              "total_ms": 1.078044
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.000924,
              "p50_ms": 0.000771,
              "p95_ms": 0.002064,
              "p99_ms": 0.009097,
              "max_ms": 0.009097,
              "total_ms": 0.092492
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000454,
              "p50_ms": 0.000371,
              "p95_ms": 0.000932,
              "p99_ms": 0.003046,
              "max_ms": 0.003046,
              "total_ms": 0.045441
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 0.030444,
              "p50_ms": 0.001212,
              "p95_ms": 0.161235,
              "p99_ms": 0.215567,
              "max_ms": 0.215567,
              "total_ms": 3.044457
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.001789,
              "p50_ms": 0.001663,
              "p95_ms": 0.003216,
              "p99_ms": 0.005691,
              "max_ms": 0.005691,
              "total_ms": 0.178998
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000426,
              "p50_ms": 0.000351,
              "p95_ms": 0.000882,
              "p99_ms": 0.002595,
              "max_ms": 0.002595,
              "total_ms": 0.042625
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.001382,
              "p50_ms": 0.001182,
              "p95_ms": 0.002605,
              "p99_ms": 0.006202,
              "max_ms": 0.006202,
              "total_ms": 0.138235
            },
            "websocket_write": {
              "n": 290,
              "mean_ms": 0.011887,
              "p50_ms": 0.009699,
              "p95_ms": 0.020549,
              "p99_ms": 0.044965,
              "max_ms": 0.196501,
              "total_ms": 3.447463
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 1.050766,
              "p50_ms": 0.961856,
              "p95_ms": 2.323897,
              "p99_ms": 2.47921,
              "max_ms": 2.47921,
              "total_ms": 105.076676
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 2000,
            "outbox_enqueues": 578,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 20
          },
          "end_to_end_p95_ms": 2.323897,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 288,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 0.034948,
            "max_queue_wait_ms": 1.083044,
            "avg_processing_ms": 0.000677,
            "max_processing_ms": 0.009097
          },
          "connections": {
            "clients": 24,
            "subscriptions": 15000,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-22T00:23:16.770Z"
      }
    },
    {
      "clients": 40,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_40.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-40\n\nGenerated: 2026-11-22T00:23:18.143Z\n\n## Load\n\n- 40 active clients, 4 silent clients, high subscription distribution\n- 356 requests: 44 connections, 44 subscriptions, 168 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 283 ms, throughput 1257 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 1.9 ms, p95 8.2 ms, p99 8.8 ms, max 9.6 ms\n- Move RTT: p50 4.5 ms, p95 9.8 ms, p99 11.3 ms, max 11.3 ms\n- Client event delivery lag: p50 5.3 ms, p95 11.3 ms, p99 11.9 ms, max 12.4 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- worker queue wait: p50 0.091 ms, p95 1.283 ms, p99 1.327 ms, max 1.327 ms (n=100)\n- move processing: p50 0.001 ms, p95 0.003 ms, p99 0.025 ms, max 0.025 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- broadcast wait: p50 0.252 ms, p95 0.884 ms, p99 1.004 ms, max 1.004 ms (n=100)\n- recipient lookup: p50 0.003 ms, p95 0.008 ms, p99 0.014 ms, max 0.014 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- outbox enqueue: p50 0.002 ms, p95 0.006 ms, p99 0.024 ms, max 0.024 ms (n=100)\n- WebSocket write: p50 0.010 ms, p95 0.018 ms, p99 0.035 ms, max 0.060 ms (n=256)\n- end-to-end broadcast: p50 2.605 ms, p95 3.565 ms, p99 3.641 ms, max 3.641 ms (n=100)\n\n- Broadcasts: 100 events, 40.0 recipients/event average, 40 max\n- Outbox: 0 max depth, 256 capacity, 624 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 160/160 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 40/40 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 514 MiB baseline, 521 MiB peak, 521 MiB after close requests\n- fds: 8 baseline, 52 with clients, 52 peak, 53 after close requests\n- CPU: 7.1% average, 19.1% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_40_results.json, /home/james/Work/sim-map/bench/scale_40_results.md and /home/james/Work/sim-map/bench/scale_40_results.js\n",
      "result": {
        "generated": "2026-11-22T00:23:18.143Z",
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
        "duration_ms": 283.146035,
        "throughput_requests_per_second": 1257.3017312426784,
        "snapshot_rtt": {
          "n": 160,
          "mean_ms": 3.284070500000003,
          "p50_ms": 1.930014,
          "p95_ms": 8.239084999999989,
          "p99_ms": 8.795314999999988,
          "max_ms": 9.632196000000022
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.2603955000000049,
          "p50_ms": 0.2991350000000068,
          "p95_ms": 0.4293910000000096,
          "p99_ms": 0.4293910000000096,
          "max_ms": 0.4293910000000096
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 4.672453950000003,
          "p50_ms": 4.481691000000012,
          "p95_ms": 9.829097999999988,
          "p99_ms": 11.318449000000015,
          "max_ms": 11.318449000000015
        },
        "event_delivery_lag": {
          "n": 4000,
          "mean_ms": 5.78127061299999,
          "p50_ms": 5.269529000000006,
          "p95_ms": 11.265419000000009,
          "p99_ms": 11.855253000000033,
          "max_ms": 12.42750300000003
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
          "rss_baseline_kb": 525976,
          "rss_before_kb": 527308,
          "rss_peak_kb": 533068,
          "fds_baseline": 8,
          "fds_before": 52,
          "fds_peak": 52,
          "cpu_average_percent": 7.0634928721498795,
          "cpu_peak_percent": 19.129164489648193,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 53,
          "rss_after_close_requests_kb": 533196,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 533204,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137879188506556,
          "uptime_ms": 1035.247295,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000365,
              "p50_ms": 0.00023,
              "p95_ms": 0.000992,
              "p99_ms": 0.004459,
              "max_ms": 0.004459,
              "total_ms": 0.036551
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.346547,
              "p50_ms": 0.090952,
              "p95_ms": 1.283263,
              "p99_ms": 1.327476,
              "max_ms": 1.327476,
              "total_ms": 34.654791
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.001027,
              "p50_ms": 0.000551,
              "p95_ms": 0.003156,
              "p99_ms": 0.025248,
              "max_ms": 0.025248,
              "total_ms": 0.102716
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000432,
              "p50_ms": 0.000331,
              "p95_ms": 0.001223,
              "p99_ms": 0.004077,
              "max_ms": 0.004077,
              "total_ms": 0.043285
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 0.310198,
              "p50_ms": 0.251836,
              "p95_ms": 0.88441,
              "p99_ms": 1.004015,
              "max_ms": 1.004015,
              "total_ms": 31.019849
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.003482,
              "p50_ms": 0.003016,
              "p95_ms": 0.008005,
              "p99_ms": 0.013545,
              "max_ms": 0.013545,
              "total_ms": 0.34828
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000417,
              "p50_ms": 0.000301,
              "p95_ms": 0.001122,
              "p99_ms": 0.002705,
              "max_ms": 0.002705,
              "total_ms": 0.041708
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.002849,
              "p50_ms": 0.002245,
              "p95_ms": 0.005541,
              "p99_ms": 0.023745,
              "max_ms": 0.023745,
              "total_ms": 0.284921
            },
            "websocket_write": {
              "n": 256,
              "mean_ms": 0.010927,
              "p50_ms": 0.009748,
              "p95_ms": 0.018475,
              "p99_ms": 0.035407,
              "max_ms": 0.059853,
              "total_ms": 2.797533
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 2.26747,
              "p50_ms": 2.605028,
              "p95_ms": 3.565071,
              "p99_ms": 3.640834,
              "max_ms": 3.640834,
              "total_ms": 226.747022
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
          "end_to_end_p95_ms": 3.565071,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 368,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 0.310403,
            "max_queue_wait_ms": 4.418021,
            "avg_processing_ms": 0.003829,
            "max_processing_ms": 1.174186
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
        "post_exit_measured_at": "2026-11-22T00:23:23.683Z"
      }
    },
    {
      "clients": 80,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_80.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-80\n\nGenerated: 2026-11-22T00:23:25.139Z\n\n## Load\n\n- 80 active clients, 4 silent clients, high subscription distribution\n- 596 requests: 84 connections, 84 subscriptions, 328 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 334 ms, throughput 1787 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 4.8 ms, p95 19.7 ms, p99 21.8 ms, max 23.6 ms\n- Move RTT: p50 6.3 ms, p95 16.6 ms, p99 17.8 ms, max 17.8 ms\n- Client event delivery lag: p50 7.8 ms, p95 18.6 ms, p99 20.1 ms, max 20.7 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- worker queue wait: p50 0.042 ms, p95 0.377 ms, p99 0.402 ms, max 0.402 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.002 ms, p99 0.007 ms, max 0.007 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- broadcast wait: p50 0.187 ms, p95 0.693 ms, p99 0.777 ms, max 0.777 ms (n=100)\n- recipient lookup: p50 0.007 ms, p95 0.011 ms, p99 0.372 ms, max 0.372 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)\n- outbox enqueue: p50 0.004 ms, p95 0.011 ms, p99 0.137 ms, max 0.137 ms (n=100)\n- WebSocket write: p50 0.010 ms, p95 0.015 ms, p99 0.022 ms, max 0.567 ms (n=495)\n- end-to-end broadcast: p50 2.587 ms, p95 3.352 ms, p99 3.383 ms, max 3.383 ms (n=100)\n\n- Broadcasts: 100 events, 80.0 recipients/event average, 80 max\n- Outbox: 0 max depth, 256 capacity, 1023 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 320/320 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 80/80 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 514 MiB baseline, 527 MiB peak, 527 MiB after close requests\n- fds: 8 baseline, 92 with clients, 92 peak, 93 after close requests\n- CPU: 15.0% average, 48.8% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_80_results.json, /home/james/Work/sim-map/bench/scale_80_results.md and /home/james/Work/sim-map/bench/scale_80_results.js\n",
      "result": {
        "generated": "2026-11-22T00:23:25.139Z",
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
        "duration_ms": 333.507581,
        "throughput_requests_per_second": 1787.0658238500432,
        "snapshot_rtt": {
          "n": 320,
          "mean_ms": 7.1735715624999985,
          "p50_ms": 4.7978689999999915,
          "p95_ms": 19.66384499999998,
          "p99_ms": 21.816550000000007,
          "max_ms": 23.629233
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.4944237500000028,
          "p50_ms": 0.603650000000016,
          "p95_ms": 1.0081539999999904,
          "p99_ms": 1.0081539999999904,
          "max_ms": 1.0081539999999904
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 7.409798299999998,
          "p50_ms": 6.327987000000007,
          "p95_ms": 16.606914000000017,
          "p99_ms": 17.83907099999999,
          "max_ms": 17.83907099999999
        },
        "event_delivery_lag": {
          "n": 8000,
          "mean_ms": 8.867719078125022,
          "p50_ms": 7.844840999999974,
          "p95_ms": 18.61501499999997,
          "p99_ms": 20.06409100000002,
          "max_ms": 20.71605199999999
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
          "rss_baseline_kb": 526168,
          "rss_before_kb": 529436,
          "rss_peak_kb": 539544,
          "fds_baseline": 8,
          "fds_before": 92,
          "fds_peak": 92,
          "cpu_average_percent": 14.992162951762108,
          "cpu_peak_percent": 48.84918644122443,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 93,
          "rss_after_close_requests_kb": 539704,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 539712,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137886109915882,
          "uptime_ms": 1106.147436,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000297,
              "p50_ms": 0.00018,
              "p95_ms": 0.000841,
              "p99_ms": 0.003417,
              "max_ms": 0.003417,
              "total_ms": 0.029738
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.06983,
              "p50_ms": 0.041579,
              "p95_ms": 0.376641,
              "p99_ms": 0.401888,
              "max_ms": 0.401888,
              "total_ms": 6.983095
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.000632,
              "p50_ms": 0.00036,
              "p95_ms": 0.002084,
              "p99_ms": 0.006523,
              "max_ms": 0.006523,
              "total_ms": 0.063203
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000322,
              "p50_ms": 0.00022,
              "p95_ms": 0.000881,
              "p99_ms": 0.002885,
              "max_ms": 0.002885,
              "total_ms": 0.032293
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 0.246738,
              "p50_ms": 0.186562,
              "p95_ms": 0.692798,
              "p99_ms": 0.777488,
              "max_ms": 0.777488,
              "total_ms": 24.673879
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.010671,
              "p50_ms": 0.006703,
              "p95_ms": 0.01071,
              "p99_ms": 0.372163,
              "max_ms": 0.372163,
              "total_ms": 1.067148
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000367,
              "p50_ms": 0.00029,
              "p95_ms": 0.000892,
              "p99_ms": 0.001673,
              "max_ms": 0.001673,
              "total_ms": 0.036788
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.006331,
              "p50_ms": 0.004138,
              "p95_ms": 0.01067,
              "p99_ms": 0.137009,
              "max_ms": 0.137009,
              "total_ms": 0.633194
            },
            "websocket_write": {
              "n": 495,
              "mean_ms": 0.011593,
              "p50_ms": 0.009608,
              "p95_ms": 0.015288,
              "p99_ms": 0.022472,
              "max_ms": 0.56675,
              "total_ms": 5.738851
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 2.414444,
              "p50_ms": 2.587456,
              "p95_ms": 3.352068,
              "p99_ms": 3.382937,
              "max_ms": 3.382937,
              "total_ms": 241.44445
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 8000,
            "outbox_enqueues": 1023,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 80
          },
          "end_to_end_p95_ms": 3.352068,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 528,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 0.702985,
            "max_queue_wait_ms": 12.740625,
            "avg_processing_ms": 0.000503,
            "max_processing_ms": 0.006523
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
        "post_exit_measured_at": "2026-11-22T00:23:30.690Z"
      }
    },
    {
      "clients": 160,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_160.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-160\n\nGenerated: 2026-11-22T00:23:32.218Z\n\n## Load\n\n- 160 active clients, 4 silent clients, high subscription distribution\n- 1076 requests: 164 connections, 164 subscriptions, 648 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 368 ms, throughput 2924 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 9.5 ms, p95 32.2 ms, p99 33.3 ms, max 33.6 ms\n- Move RTT: p50 12.0 ms, p95 21.4 ms, p99 26.6 ms, max 26.6 ms\n- Client event delivery lag: p50 14.4 ms, p95 24.6 ms, p99 29.4 ms, max 31.3 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.984 ms, max 0.984 ms (n=100)\n- worker queue wait: p50 0.116 ms, p95 1.214 ms, p99 1.249 ms, max 1.249 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.003 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.002 ms, p99 0.002 ms, max 0.002 ms (n=100)\n- broadcast wait: p50 0.511 ms, p95 1.263 ms, p99 1.363 ms, max 1.363 ms (n=100)\n- recipient lookup: p50 0.015 ms, p95 0.026 ms, p99 0.050 ms, max 0.050 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.370 ms, max 0.370 ms (n=100)\n- outbox enqueue: p50 0.009 ms, p95 0.031 ms, p99 0.093 ms, max 0.093 ms (n=100)\n- WebSocket write: p50 0.013 ms, p95 0.021 ms, p99 0.038 ms, max 0.777 ms (n=895)\n- end-to-end broadcast: p50 5.666 ms, p95 7.104 ms, p99 7.152 ms, max 7.152 ms (n=100)\n\n- Broadcasts: 100 events, 160.0 recipients/event average, 160 max\n- Outbox: 0 max depth, 256 capacity, 1743 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 640/640 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 160/160 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 514 MiB baseline, 540 MiB peak, 540 MiB after close requests\n- fds: 8 baseline, 172 with clients, 172 peak, 173 after close requests\n- CPU: 21.7% average, 67.8% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_160_results.json, /home/james/Work/sim-map/bench/scale_160_results.md and /home/james/Work/sim-map/bench/scale_160_results.js\n",
      "result": {
        "generated": "2026-11-22T00:23:32.218Z",
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
        "duration_ms": 367.99440699999997,
        "throughput_requests_per_second": 2923.9574828646787,
        "snapshot_rtt": {
          "n": 640,
          "mean_ms": 13.061897554687516,
          "p50_ms": 9.477814999999964,
          "p95_ms": 32.22254800000002,
          "p99_ms": 33.29502200000002,
          "max_ms": 33.585801000000004
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.5755818749999975,
          "p50_ms": 0.6288969999999949,
          "p95_ms": 1.0900480000000243,
          "p99_ms": 1.0900480000000243,
          "max_ms": 1.0900480000000243
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 10.660162879999998,
          "p50_ms": 12.036565999999993,
          "p95_ms": 21.354738999999995,
          "p99_ms": 26.558523999999977,
          "max_ms": 26.558523999999977
        },
        "event_delivery_lag": {
          "n": 16000,
          "mean_ms": 14.640349635687507,
          "p50_ms": 14.408343000000002,
          "p95_ms": 24.619302000000005,
          "p99_ms": 29.416559000000007,
          "max_ms": 31.328509999999994
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
          "rss_baseline_kb": 526008,
          "rss_before_kb": 532692,
          "rss_peak_kb": 552796,
          "fds_baseline": 8,
          "fds_before": 172,
          "fds_peak": 172,
          "cpu_average_percent": 21.739460839142595,
          "cpu_peak_percent": 67.82905183599823,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 173,
          "rss_after_close_requests_kb": 553232,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 553384,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137893108898436,
          "uptime_ms": 1176.69864,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.010124,
              "p50_ms": 0.00017,
              "p95_ms": 0.001462,
              "p99_ms": 0.983917,
              "max_ms": 0.983917,
              "total_ms": 1.012453
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.396714,
              "p50_ms": 0.115718,
              "p95_ms": 1.213541,
              "p99_ms": 1.248617,
              "max_ms": 1.248617,
              "total_ms": 39.67149
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.000655,
              "p50_ms": 0.00037,
              "p95_ms": 0.003297,
              "p99_ms": 0.006492,
              "max_ms": 0.006492,
              "total_ms": 0.065534
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000349,
              "p50_ms": 0.000211,
              "p95_ms": 0.001873,
              "p99_ms": 0.002404,
              "max_ms": 0.002404,
              "total_ms": 0.034902
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 0.552943,
              "p50_ms": 0.510614,
              "p95_ms": 1.262543,
              "p99_ms": 1.363464,
              "max_ms": 1.363464,
              "total_ms": 55.294313
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.016504,
              "p50_ms": 0.014738,
              "p95_ms": 0.02649,
              "p99_ms": 0.050175,
              "max_ms": 0.050175,
              "total_ms": 1.650418
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.004094,
              "p50_ms": 0.000301,
              "p95_ms": 0.001252,
              "p99_ms": 0.370159,
              "max_ms": 0.370159,
              "total_ms": 0.409487
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.01168,
              "p50_ms": 0.008967,
              "p95_ms": 0.031269,
              "p99_ms": 0.093476,
              "max_ms": 0.093476,
              "total_ms": 1.168007
            },
            "websocket_write": {
              "n": 895,
              "mean_ms": 0.015193,
              "p50_ms": 0.012533,
              "p95_ms": 0.021261,
              "p99_ms": 0.037822,
              "max_ms": 0.777087,
              "total_ms": 13.598044
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 5.762538,
              "p50_ms": 5.665697,
              "p95_ms": 7.103532,
              "p99_ms": 7.152384,
              "max_ms": 7.152384,
              "total_ms": 576.253834
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 16000,
            "outbox_enqueues": 1743,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 160
          },
          "end_to_end_p95_ms": 7.103532,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 848,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 3.697887,
            "max_queue_wait_ms": 19.807167,
            "avg_processing_ms": 0.000456,
            "max_processing_ms": 0.008436
          },
          "connections": {
            "clients": 164,
            "subscriptions": 102500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-22T00:23:37.774Z"
      }
    },
    {
      "clients": 200,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_200.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-200\n\nGenerated: 2026-11-22T00:23:39.336Z\n\n## Load\n\n- 200 active clients, 4 silent clients, high subscription distribution\n- 1316 requests: 204 connections, 204 subscriptions, 808 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 370 ms, throughput 3559 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 9.6 ms, p95 40.5 ms, p99 42.2 ms, max 43.4 ms\n- Move RTT: p50 11.0 ms, p95 24.0 ms, p99 24.8 ms, max 24.8 ms\n- Client event delivery lag: p50 17.0 ms, p95 29.0 ms, p99 31.0 ms, max 33.1 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- worker queue wait: p50 0.125 ms, p95 0.260 ms, p99 0.275 ms, max 0.275 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.005 ms, p99 0.049 ms, max 0.049 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.002 ms, p99 0.013 ms, max 0.013 ms (n=100)\n- broadcast wait: p50 0.606 ms, p95 1.655 ms, p99 1.883 ms, max 1.883 ms (n=100)\n- recipient lookup: p50 0.016 ms, p95 0.031 ms, p99 0.143 ms, max 0.143 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.001 ms, p99 0.002 ms, max 0.002 ms (n=100)\n- outbox enqueue: p50 0.011 ms, p95 0.048 ms, p99 0.065 ms, max 0.065 ms (n=100)\n- WebSocket write: p50 0.012 ms, p95 0.023 ms, p99 0.033 ms, max 0.671 ms (n=1095)\n- end-to-end broadcast: p50 6.270 ms, p95 7.793 ms, p99 7.983 ms, max 7.983 ms (n=100)\n\n- Broadcasts: 100 events, 200.0 recipients/event average, 200 max\n- Outbox: 0 max depth, 256 capacity, 2103 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 800/800 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 200/200 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 514 MiB baseline, 546 MiB peak, 546 MiB after close requests\n- fds: 8 baseline, 212 with clients, 212 peak, 213 after close requests\n- CPU: 27.0% average, 87.0% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_200_results.json, /home/james/Work/sim-map/bench/scale_200_results.md and /home/james/Work/sim-map/bench/scale_200_results.js\n",
      "result": {
        "generated": "2026-11-22T00:23:39.336Z",
        "label": "clients-200",
        "profile": {
          "clients": 200,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 204,
          "subscriptions": 204,
          "snapshots": 808,
          "moves": 100,
          "requests": 1316
        },
        "duration_ms": 369.722072,
        "throughput_requests_per_second": 3559.430446987217,
        "snapshot_rtt": {
          "n": 800,
          "mean_ms": 15.892694166249992,
          "p50_ms": 9.627306999999973,
          "p95_ms": 40.452796999999975,
          "p99_ms": 42.21989300000001,
          "max_ms": 43.374874000000034
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.17966662500000297,
          "p50_ms": 0.18036100000000488,
          "p95_ms": 0.32713699999999335,
          "p99_ms": 0.32713699999999335,
          "max_ms": 0.32713699999999335
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 13.165498880000005,
          "p50_ms": 10.960984999999994,
          "p95_ms": 24.04259300000001,
          "p99_ms": 24.80166700000001,
          "max_ms": 24.80166700000001
        },
        "event_delivery_lag": {
          "n": 20000,
          "mean_ms": 17.20394480514985,
          "p50_ms": 16.981732000000022,
          "p95_ms": 28.962000999999987,
          "p99_ms": 31.026269000000013,
          "max_ms": 33.10746799999998
        },
        "accuracy": {
          "snapshots_ok": 800,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 20000,
            "min_expected": 100,
            "max_expected": 100,
            "min_events": 100,
            "max_events": 100,
            "clients_with_events": 200,
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
          "rss_baseline_kb": 526156,
          "rss_before_kb": 534552,
          "rss_peak_kb": 559128,
          "fds_baseline": 8,
          "fds_before": 212,
          "fds_peak": 212,
          "cpu_average_percent": 27.047343822091314,
          "cpu_peak_percent": 86.96360133248415,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 213,
          "rss_after_close_requests_kb": 559160,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 559184,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137900201780204,
          "uptime_ms": 1195.883924,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000325,
              "p50_ms": 0.00018,
              "p95_ms": 0.001963,
              "p99_ms": 0.003376,
              "max_ms": 0.003376,
              "total_ms": 0.03258
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.131574,
              "p50_ms": 0.124996,
              "p95_ms": 0.2598,
              "p99_ms": 0.275209,
              "max_ms": 0.275209,
              "total_ms": 13.157413
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.001175,
              "p50_ms": 0.000381,
              "p95_ms": 0.00525,
              "p99_ms": 0.049173,
              "max_ms": 0.049173,
              "total_ms": 0.117503
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000458,
              "p50_ms": 0.000211,
              "p95_ms": 0.001844,
              "p99_ms": 0.012704,
              "max_ms": 0.012704,
              "total_ms": 0.045864
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 0.673311,
              "p50_ms": 0.605684,
              "p95_ms": 1.654614,
              "p99_ms": 1.882705,
              "max_ms": 1.882705,
              "total_ms": 67.331115
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.018591,
              "p50_ms": 0.016171,
              "p95_ms": 0.030969,
              "p99_ms": 0.14317,
              "max_ms": 0.14317,
              "total_ms": 1.859146
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.00042,
              "p50_ms": 0.000341,
              "p95_ms": 0.001032,
              "p99_ms": 0.001593,
              "max_ms": 0.001593,
              "total_ms": 0.042034
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.013964,
              "p50_ms": 0.011252,
              "p95_ms": 0.047761,
              "p99_ms": 0.065003,
              "max_ms": 0.065003,
              "total_ms": 1.396406
            },
            "websocket_write": {
              "n": 1095,
              "mean_ms": 0.014977,
              "p50_ms": 0.012063,
              "p95_ms": 0.022592,
              "p99_ms": 0.033353,
              "max_ms": 0.670886,
              "total_ms": 16.400591
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 6.212647,
              "p50_ms": 6.269617,
              "p95_ms": 7.792793,
              "p99_ms": 7.983373,
              "max_ms": 7.983373,
              "total_ms": 621.264714
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 20000,
            "outbox_enqueues": 2103,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 200
          },
          "end_to_end_p95_ms": 7.792793,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 1008,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 5.117808,
            "max_queue_wait_ms": 25.713839,
            "avg_processing_ms": 0.00284,
            "max_processing_ms": 1.244139
          },
          "connections": {
            "clients": 204,
            "subscriptions": 127500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-22T00:23:44.891Z"
      }
    },
    {
      "clients": 320,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_320.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-320\n\nGenerated: 2026-11-22T00:23:46.600Z\n\n## Load\n\n- 320 active clients, 4 silent clients, high subscription distribution\n- 2036 requests: 324 connections, 324 subscriptions, 1288 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 462 ms, throughput 4403 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 18.5 ms, p95 76.8 ms, p99 79.0 ms, max 82.6 ms\n- Move RTT: p50 16.9 ms, p95 35.0 ms, p99 35.7 ms, max 35.7 ms\n- Client event delivery lag: p50 26.6 ms, p95 45.0 ms, p99 47.5 ms, max 55.2 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- worker queue wait: p50 0.169 ms, p95 0.888 ms, p99 0.936 ms, max 0.936 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.002 ms, p99 0.007 ms, max 0.007 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- broadcast wait: p50 1.666 ms, p95 3.962 ms, p99 6.172 ms, max 6.172 ms (n=100)\n- recipient lookup: p50 0.032 ms, p95 0.065 ms, p99 0.862 ms, max 0.862 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- outbox enqueue: p50 0.020 ms, p95 0.086 ms, p99 1.816 ms, max 1.816 ms (n=100)\n- WebSocket write: p50 0.013 ms, p95 0.023 ms, p99 0.037 ms, max 0.514 ms (n=1376)\n- end-to-end broadcast: p50 11.087 ms, p95 17.322 ms, p99 17.376 ms, max 17.376 ms (n=100)\n\n- Broadcasts: 100 events, 320.0 recipients/event average, 320 max\n- Outbox: 0 max depth, 256 capacity, 2864 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 1280/1280 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 320/320 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 514 MiB baseline, 563 MiB peak, 564 MiB after close requests\n- fds: 8 baseline, 332 with clients, 332 peak, 333 after close requests\n- CPU: 36.8% average, 89.7% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_320_results.json, /home/james/Work/sim-map/bench/scale_320_results.md and /home/james/Work/sim-map/bench/scale_320_results.js\n",
      "result": {
        "generated": "2026-11-22T00:23:46.600Z",
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
        "duration_ms": 462.367726,
        "throughput_requests_per_second": 4403.421531199174,
        "snapshot_rtt": {
          "n": 1280,
          "mean_ms": 29.769053667187514,
          "p50_ms": 18.484940999999992,
          "p95_ms": 76.75949600000001,
          "p99_ms": 78.99357400000002,
          "max_ms": 82.62595200000004
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.1782603749999936,
          "p50_ms": 0.2069909999999595,
          "p95_ms": 0.3372969999999782,
          "p99_ms": 0.3372969999999782,
          "max_ms": 0.3372969999999782
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 18.74315738,
          "p50_ms": 16.90734200000003,
          "p95_ms": 35.022695000000056,
          "p99_ms": 35.65731299999999,
          "max_ms": 35.65731299999999
        },
        "event_delivery_lag": {
          "n": 32000,
          "mean_ms": 25.580628137656248,
          "p50_ms": 26.569365000000005,
          "p95_ms": 45.02571100000006,
          "p99_ms": 47.49130599999995,
          "max_ms": 55.21659199999999
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
          "rss_baseline_kb": 526008,
          "rss_before_kb": 540308,
          "rss_peak_kb": 576372,
          "fds_baseline": 8,
          "fds_before": 332,
          "fds_peak": 332,
          "cpu_average_percent": 36.76727211708544,
          "cpu_peak_percent": 89.71418227810567,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 333,
          "rss_after_close_requests_kb": 577408,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 577432,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137907321285417,
          "uptime_ms": 1341.935058,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000327,
              "p50_ms": 0.00017,
              "p95_ms": 0.000621,
              "p99_ms": 0.003577,
              "max_ms": 0.003577,
              "total_ms": 0.032789
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.279052,
              "p50_ms": 0.168729,
              "p95_ms": 0.888297,
              "p99_ms": 0.936388,
              "max_ms": 0.936388,
              "total_ms": 27.905219
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.000633,
              "p50_ms": 0.000351,
              "p95_ms": 0.002104,
              "p99_ms": 0.007254,
              "max_ms": 0.007254,
              "total_ms": 0.063393
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000329,
              "p50_ms": 0.000211,
              "p95_ms": 0.001273,
              "p99_ms": 0.002534,
              "max_ms": 0.002534,
              "total_ms": 0.032908
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 1.751526,
              "p50_ms": 1.665775,
              "p95_ms": 3.96159,
              "p99_ms": 6.171803,
              "max_ms": 6.171803,
              "total_ms": 175.152612
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.050764,
              "p50_ms": 0.03174,
              "p95_ms": 0.065364,
              "p99_ms": 0.862018,
              "max_ms": 0.862018,
              "total_ms": 5.076414
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000673,
              "p50_ms": 0.000581,
              "p95_ms": 0.001663,
              "p99_ms": 0.002865,
              "max_ms": 0.002865,
              "total_ms": 0.067372
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.055181,
              "p50_ms": 0.020048,
              "p95_ms": 0.085632,
              "p99_ms": 1.816038,
              "max_ms": 1.816038,
              "total_ms": 5.518139
            },
            "websocket_write": {
              "n": 1376,
              "mean_ms": 0.015084,
              "p50_ms": 0.013045,
              "p95_ms": 0.023274,
              "p99_ms": 0.036599,
              "max_ms": 0.51402,
              "total_ms": 20.756148
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 12.797861,
              "p50_ms": 11.087433,
              "p95_ms": 17.322265,
              "p99_ms": 17.375977,
              "max_ms": 17.375977,
              "total_ms": 1279.786187
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 32000,
            "outbox_enqueues": 2864,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 320
          },
          "end_to_end_p95_ms": 17.322265,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 1488,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 13.269481,
            "max_queue_wait_ms": 51.740779,
            "avg_processing_ms": 0.001829,
            "max_processing_ms": 1.087093
          },
          "connections": {
            "clients": 324,
            "subscriptions": 202500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-22T00:23:52.178Z"
      }
    },
    {
      "clients": 400,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_400.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-400\n\nGenerated: 2026-11-22T00:23:53.937Z\n\n## Load\n\n- 400 active clients, 4 silent clients, high subscription distribution\n- 2516 requests: 404 connections, 404 subscriptions, 1608 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 481 ms, throughput 5227 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 20.8 ms, p95 96.1 ms, p99 102.4 ms, max 103.5 ms\n- Move RTT: p50 18.0 ms, p95 33.2 ms, p99 46.4 ms, max 46.4 ms\n- Client event delivery lag: p50 28.4 ms, p95 46.7 ms, p99 50.6 ms, max 56.6 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.003 ms, p99 0.528 ms, max 0.528 ms (n=100)\n- worker queue wait: p50 0.278 ms, p95 1.068 ms, p99 1.128 ms, max 1.128 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.002 ms, p99 0.008 ms, max 0.008 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- broadcast wait: p50 1.478 ms, p95 5.281 ms, p99 5.653 ms, max 5.653 ms (n=100)\n- recipient lookup: p50 0.038 ms, p95 0.081 ms, p99 0.919 ms, max 0.919 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- outbox enqueue: p50 0.028 ms, p95 0.165 ms, p99 1.223 ms, max 1.223 ms (n=100)\n- WebSocket write: p50 0.013 ms, p95 0.020 ms, p99 0.032 ms, max 0.530 ms (n=1696)\n- end-to-end broadcast: p50 14.313 ms, p95 14.881 ms, p99 15.193 ms, max 15.193 ms (n=100)\n\n- Broadcasts: 100 events, 400.0 recipients/event average, 400 max\n- Outbox: 0 max depth, 256 capacity, 3504 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 1600/1600 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 400/400 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 514 MiB baseline, 574 MiB peak, 575 MiB after close requests\n- fds: 8 baseline, 412 with clients, 412 peak, 413 after close requests\n- CPU: 41.6% average, 96.8% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_400_results.json, /home/james/Work/sim-map/bench/scale_400_results.md and /home/james/Work/sim-map/bench/scale_400_results.js\n",
      "result": {
        "generated": "2026-11-22T00:23:53.937Z",
        "label": "clients-400",
        "profile": {
          "clients": 400,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 404,
          "subscriptions": 404,
          "snapshots": 1608,
          "moves": 100,
          "requests": 2516
        },
        "duration_ms": 481.321297,
        "throughput_requests_per_second": 5227.277528922639,
        "snapshot_rtt": {
          "n": 1600,
          "mean_ms": 36.666895574374955,
          "p50_ms": 20.819998999999996,
          "p95_ms": 96.14759199999997,
          "p99_ms": 102.40136000000001,
          "max_ms": 103.52150499999999
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.28771950000000857,
          "p50_ms": 0.28872499999999945,
          "p95_ms": 0.3831639999999652,
          "p99_ms": 0.3831639999999652,
          "max_ms": 0.3831639999999652
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 16.390949460000012,
          "p50_ms": 18.011066000000028,
          "p95_ms": 33.21333900000002,
          "p99_ms": 46.44945999999993,
          "max_ms": 46.44945999999993
        },
        "event_delivery_lag": {
          "n": 40000,
          "mean_ms": 27.672971722524952,
          "p50_ms": 28.398668000000043,
          "p95_ms": 46.73701200000005,
          "p99_ms": 50.61809100000005,
          "max_ms": 56.603951999999936
        },
        "accuracy": {
          "snapshots_ok": 1600,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 40000,
            "min_expected": 100,
            "max_expected": 100,
            "min_events": 100,
            "max_events": 100,
            "clients_with_events": 400,
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
          "rss_baseline_kb": 526116,
          "rss_before_kb": 543708,
          "rss_peak_kb": 587916,
          "fds_baseline": 8,
          "fds_before": 412,
          "fds_peak": 412,
          "cpu_average_percent": 41.5522856035186,
          "cpu_peak_percent": 96.84228961010157,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 413,
          "rss_after_close_requests_kb": 588744,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 588752,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137914614173235,
          "uptime_ms": 1381.320374,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.005676,
              "p50_ms": 0.00024,
              "p95_ms": 0.002695,
              "p99_ms": 0.528338,
              "max_ms": 0.528338,
              "total_ms": 0.567621
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.393087,
              "p50_ms": 0.278226,
              "p95_ms": 1.067736,
              "p99_ms": 1.127609,
              "max_ms": 1.127609,
              "total_ms": 39.308721
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.000724,
              "p50_ms": 0.000411,
              "p95_ms": 0.002074,
              "p99_ms": 0.008116,
              "max_ms": 0.008116,
              "total_ms": 0.072489
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000362,
              "p50_ms": 0.00022,
              "p95_ms": 0.001062,
              "p99_ms": 0.004047,
              "max_ms": 0.004047,
              "total_ms": 0.036254
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 2.019029,
              "p50_ms": 1.478312,
              "p95_ms": 5.281412,
              "p99_ms": 5.653495,
              "max_ms": 5.653495,
              "total_ms": 201.902987
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.050122,
              "p50_ms": 0.038313,
              "p95_ms": 0.080542,
              "p99_ms": 0.919135,
              "max_ms": 0.919135,
              "total_ms": 5.012251
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000665,
              "p50_ms": 0.000581,
              "p95_ms": 0.001703,
              "p99_ms": 0.002585,
              "max_ms": 0.002585,
              "total_ms": 0.066596
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.051412,
              "p50_ms": 0.028243,
              "p95_ms": 0.165462,
              "p99_ms": 1.222989,
              "max_ms": 1.222989,
              "total_ms": 5.141286
            },
            "websocket_write": {
              "n": 1696,
              "mean_ms": 0.014287,
              "p50_ms": 0.012664,
              "p95_ms": 0.019727,
              "p99_ms": 0.03215,
              "max_ms": 0.52976,
              "total_ms": 24.231856
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 13.228938,
              "p50_ms": 14.312913,
              "p95_ms": 14.881407,
              "p99_ms": 15.192945,
              "max_ms": 15.192945,
              "total_ms": 1322.893858
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 40000,
            "outbox_enqueues": 3504,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 400
          },
          "end_to_end_p95_ms": 14.881407,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 1808,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 17.488189,
            "max_queue_wait_ms": 54.250679,
            "avg_processing_ms": 0.00161,
            "max_processing_ms": 1.728293
          },
          "connections": {
            "clients": 404,
            "subscriptions": 251400,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-22T00:23:59.510Z"
      }
    },
    {
      "clients": 600,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_600.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-600\n\nGenerated: 2026-11-22T00:24:01.524Z\n\n## Load\n\n- 600 active clients, 4 silent clients, high subscription distribution\n- 3716 requests: 604 connections, 604 subscriptions, 2408 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 636 ms, throughput 5839 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 36.0 ms, p95 167.5 ms, p99 177.0 ms, max 178.4 ms\n- Move RTT: p50 38.6 ms, p95 45.3 ms, p99 62.7 ms, max 62.7 ms\n- Client event delivery lag: p50 54.0 ms, p95 72.1 ms, p99 77.0 ms, max 107.0 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.005 ms, max 0.005 ms (n=100)\n- worker queue wait: p50 0.220 ms, p95 0.425 ms, p99 0.470 ms, max 0.470 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.001 ms, p99 0.009 ms, max 0.009 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- broadcast wait: p50 3.427 ms, p95 10.494 ms, p99 11.129 ms, max 11.129 ms (n=100)\n- recipient lookup: p50 0.078 ms, p95 0.147 ms, p99 1.884 ms, max 1.884 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.002 ms, p99 0.002 ms, max 0.002 ms (n=100)\n- outbox enqueue: p50 0.046 ms, p95 0.285 ms, p99 2.719 ms, max 2.719 ms (n=100)\n- WebSocket write: p50 0.015 ms, p95 0.031 ms, p99 0.058 ms, max 0.911 ms (n=1897)\n- end-to-end broadcast: p50 31.619 ms, p95 35.768 ms, p99 36.269 ms, max 36.269 ms (n=100)\n\n- Broadcasts: 100 events, 600.0 recipients/event average, 600 max\n- Outbox: 0 max depth, 256 capacity, 4505 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 2400/2400 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 600/600 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 514 MiB baseline, 608 MiB peak, 609 MiB after close requests\n- fds: 8 baseline, 612 with clients, 612 peak, 613 after close requests\n- CPU: 53.4% average, 98.3% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_600_results.json, /home/james/Work/sim-map/bench/scale_600_results.md and /home/james/Work/sim-map/bench/scale_600_results.js\n",
      "result": {
        "generated": "2026-11-22T00:24:01.524Z",
        "label": "clients-600",
        "profile": {
          "clients": 600,
          "silent_clients": 4,
          "snapshots_per_client": 4,
          "moves": 100,
          "drivers": 40,
          "block": 10,
          "window_radius": 12,
          "distribution": "high"
        },
        "totals": {
          "connections": 604,
          "subscriptions": 604,
          "snapshots": 2408,
          "moves": 100,
          "requests": 3716
        },
        "duration_ms": 636.4309800000001,
        "throughput_requests_per_second": 5838.810675118297,
        "snapshot_rtt": {
          "n": 2400,
          "mean_ms": 62.03402172499991,
          "p50_ms": 36.01897599999995,
          "p95_ms": 167.50118499999996,
          "p99_ms": 176.99567100000002,
          "max_ms": 178.416023
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.14955712499998697,
          "p50_ms": 0.1375189999999975,
          "p95_ms": 0.23791900000003352,
          "p99_ms": 0.23791900000003352,
          "max_ms": 0.23791900000003352
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 28.889716899999982,
          "p50_ms": 38.624225000000024,
          "p95_ms": 45.34166899999991,
          "p99_ms": 62.73368599999992,
          "max_ms": 62.73368599999992
        },
        "event_delivery_lag": {
          "n": 60000,
          "mean_ms": 51.746945515350035,
          "p50_ms": 53.99859399999991,
          "p95_ms": 72.13394400000004,
          "p99_ms": 76.991986,
          "max_ms": 107.02027199999998
        },
        "accuracy": {
          "snapshots_ok": 2400,
          "snapshot_errors": 0,
          "silent_snapshots_ok": 8,
          "silent_snapshot_errors": 0,
          "moves_accepted": 100,
          "moves_rejected": 0,
          "move_request_id_mismatches": 0,
          "duplicate_move_sequences": 0,
          "events": {
            "expected_total": 60000,
            "min_expected": 100,
            "max_expected": 100,
            "min_events": 100,
            "max_events": 100,
            "clients_with_events": 600,
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
          "rss_baseline_kb": 526056,
          "rss_before_kb": 552864,
          "rss_peak_kb": 622436,
          "fds_baseline": 8,
          "fds_before": 612,
          "fds_peak": 612,
          "cpu_average_percent": 53.422917910124355,
          "cpu_peak_percent": 98.25852196406638,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 613,
          "rss_after_close_requests_kb": 623676,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 623772,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137921950174195,
          "uptime_ms": 1625.495247,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000358,
              "p50_ms": 0.00024,
              "p95_ms": 0.000501,
              "p99_ms": 0.00519,
              "max_ms": 0.00519,
              "total_ms": 0.035873
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.219709,
              "p50_ms": 0.219514,
              "p95_ms": 0.425344,
              "p99_ms": 0.470158,
              "max_ms": 0.470158,
              "total_ms": 21.970905
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.000667,
              "p50_ms": 0.000411,
              "p95_ms": 0.000922,
              "p99_ms": 0.008887,
              "max_ms": 0.008887,
              "total_ms": 0.066777
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000318,
              "p50_ms": 0.00021,
              "p95_ms": 0.000661,
              "p99_ms": 0.003426,
              "max_ms": 0.003426,
              "total_ms": 0.031886
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 4.499272,
              "p50_ms": 3.427201,
              "p95_ms": 10.493643,
              "p99_ms": 11.129323,
              "max_ms": 11.129323,
              "total_ms": 449.927263
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.121715,
              "p50_ms": 0.077716,
              "p95_ms": 0.147148,
              "p99_ms": 1.883967,
              "max_ms": 1.883967,
              "total_ms": 12.171547
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000565,
              "p50_ms": 0.000461,
              "p95_ms": 0.001523,
              "p99_ms": 0.001984,
              "max_ms": 0.001984,
              "total_ms": 0.056516
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.11586,
              "p50_ms": 0.046337,
              "p95_ms": 0.285168,
              "p99_ms": 2.719294,
              "max_ms": 2.719294,
              "total_ms": 11.586025
            },
            "websocket_write": {
              "n": 1897,
              "mean_ms": 0.018794,
              "p50_ms": 0.015308,
              "p95_ms": 0.031009,
              "p99_ms": 0.057599,
              "max_ms": 0.91131,
              "total_ms": 35.654064
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 30.591026,
              "p50_ms": 31.619129,
              "p95_ms": 35.768233,
              "p99_ms": 36.269409,
              "max_ms": 36.269409,
              "total_ms": 3059.102656
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 60000,
            "outbox_enqueues": 4505,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 600
          },
          "end_to_end_p95_ms": 35.768233,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 2608,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 34.451267,
            "max_queue_wait_ms": 128.89826,
            "avg_processing_ms": 0.00349,
            "max_processing_ms": 1.914605
          },
          "connections": {
            "clients": 604,
            "subscriptions": 377500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-22T00:24:07.124Z"
      }
    },
    {
      "clients": 640,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_640.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-640\n\nGenerated: 2026-11-22T00:24:09.220Z\n\n## Load\n\n- 640 active clients, 4 silent clients, high subscription distribution\n- 3956 requests: 644 connections, 644 subscriptions, 2568 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 698 ms, throughput 5669 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 33.8 ms, p95 194.7 ms, p99 202.3 ms, max 203.9 ms\n- Move RTT: p50 33.7 ms, p95 73.8 ms, p99 77.0 ms, max 77.0 ms\n- Client event delivery lag: p50 54.4 ms, p95 79.5 ms, p99 84.0 ms, max 100.4 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.003 ms, p99 0.005 ms, max 0.005 ms (n=100)\n- worker queue wait: p50 0.170 ms, p95 0.413 ms, p99 0.427 ms, max 0.427 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.006 ms, p99 0.008 ms, max 0.008 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.002 ms, p99 0.024 ms, max 0.024 ms (n=100)\n- broadcast wait: p50 3.402 ms, p95 11.952 ms, p99 12.488 ms, max 12.488 ms (n=100)\n- recipient lookup: p50 0.077 ms, p95 0.163 ms, p99 1.354 ms, max 1.354 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- outbox enqueue: p50 0.050 ms, p95 0.766 ms, p99 3.497 ms, max 3.497 ms (n=100)\n- WebSocket write: p50 0.014 ms, p95 0.029 ms, p99 0.062 ms, max 1.221 ms (n=3295)\n- end-to-end broadcast: p50 25.965 ms, p95 30.437 ms, p99 32.171 ms, max 32.171 ms (n=100)\n\n- Broadcasts: 100 events, 640.0 recipients/event average, 640 max\n- Outbox: 0 max depth, 256 capacity, 6063 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 2560/2560 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 640/640 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 514 MiB baseline, 619 MiB peak, 619 MiB after close requests\n- fds: 8 baseline, 652 with clients, 652 peak, 653 after close requests\n- CPU: 53.0% average, 106.9% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_640_results.json, /home/james/Work/sim-map/bench/scale_640_results.md and /home/james/Work/sim-map/bench/scale_640_results.js\n",
      "result": {
        "generated": "2026-11-22T00:24:09.220Z",
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
        "duration_ms": 697.810466,
        "throughput_requests_per_second": 5669.161173056982,
        "snapshot_rtt": {
          "n": 2560,
          "mean_ms": 68.87040232226556,
          "p50_ms": 33.75471200000004,
          "p95_ms": 194.69836700000002,
          "p99_ms": 202.30052100000006,
          "max_ms": 203.85454499999997
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.5083637499999867,
          "p50_ms": 0.8943590000000086,
          "p95_ms": 0.9999679999999671,
          "p99_ms": 0.9999679999999671,
          "max_ms": 0.9999679999999671
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 34.69682687,
          "p50_ms": 33.68997999999999,
          "p95_ms": 73.81682199999989,
          "p99_ms": 76.96849300000008,
          "max_ms": 76.96849300000008
        },
        "event_delivery_lag": {
          "n": 64000,
          "mean_ms": 52.6861783994843,
          "p50_ms": 54.42169200000001,
          "p95_ms": 79.47341200000005,
          "p99_ms": 83.99152300000003,
          "max_ms": 100.36622
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
          "rss_baseline_kb": 526084,
          "rss_before_kb": 555220,
          "rss_peak_kb": 633576,
          "fds_baseline": 8,
          "fds_before": 652,
          "fds_peak": 652,
          "cpu_average_percent": 53.022993782383296,
          "cpu_peak_percent": 106.87037896731866,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 653,
          "rss_after_close_requests_kb": 634080,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 634136,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137929576868689,
          "uptime_ms": 1698.867256,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000434,
              "p50_ms": 0.000241,
              "p95_ms": 0.003126,
              "p99_ms": 0.00508,
              "max_ms": 0.00508,
              "total_ms": 0.043475
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.191052,
              "p50_ms": 0.169721,
              "p95_ms": 0.412509,
              "p99_ms": 0.427237,
              "max_ms": 0.427237,
              "total_ms": 19.105263
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.00078,
              "p50_ms": 0.000391,
              "p95_ms": 0.005902,
              "p99_ms": 0.008096,
              "max_ms": 0.008096,
              "total_ms": 0.078039
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000574,
              "p50_ms": 0.000211,
              "p95_ms": 0.002144,
              "p99_ms": 0.023906,
              "max_ms": 0.023906,
              "total_ms": 0.05743
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 4.19379,
              "p50_ms": 3.401883,
              "p95_ms": 11.952337,
              "p99_ms": 12.487918,
              "max_ms": 12.487918,
              "total_ms": 419.379078
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.094651,
              "p50_ms": 0.076745,
              "p95_ms": 0.162848,
              "p99_ms": 1.353776,
              "max_ms": 1.353776,
              "total_ms": 9.465145
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000653,
              "p50_ms": 0.000521,
              "p95_ms": 0.001643,
              "p99_ms": 0.003126,
              "max_ms": 0.003126,
              "total_ms": 0.065305
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.167341,
              "p50_ms": 0.049875,
              "p95_ms": 0.766026,
              "p99_ms": 3.496873,
              "max_ms": 3.496873,
              "total_ms": 16.734105
            },
            "websocket_write": {
              "n": 3295,
              "mean_ms": 0.017495,
              "p50_ms": 0.014227,
              "p95_ms": 0.028865,
              "p99_ms": 0.062277,
              "max_ms": 1.220634,
              "total_ms": 57.64806
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 25.366319,
              "p50_ms": 25.965004,
              "p95_ms": 30.436898,
              "p99_ms": 32.170861,
              "max_ms": 32.170861,
              "total_ms": 2536.631922
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 64000,
            "outbox_enqueues": 6063,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 640
          },
          "end_to_end_p95_ms": 30.436898,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 2768,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 39.065462,
            "max_queue_wait_ms": 144.829801,
            "avg_processing_ms": 0.004913,
            "max_processing_ms": 4.820332
          },
          "connections": {
            "clients": 644,
            "subscriptions": 402500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-22T00:24:14.833Z"
      }
    },
    {
      "clients": 800,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_800.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-800\n\nGenerated: 2026-11-22T00:24:17.035Z\n\n## Load\n\n- 800 active clients, 4 silent clients, high subscription distribution\n- 4916 requests: 804 connections, 804 subscriptions, 3208 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 751 ms, throughput 6547 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 41.2 ms, p95 209.4 ms, p99 223.8 ms, max 226.0 ms\n- Move RTT: p50 48.9 ms, p95 56.6 ms, p99 97.5 ms, max 97.5 ms\n- Client event delivery lag: p50 69.4 ms, p95 107.6 ms, p99 141.6 ms, max 153.8 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- worker queue wait: p50 0.255 ms, p95 0.586 ms, p99 0.647 ms, max 0.647 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.001 ms, p99 0.012 ms, max 0.012 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- broadcast wait: p50 5.202 ms, p95 16.229 ms, p99 17.149 ms, max 17.149 ms (n=100)\n- recipient lookup: p50 0.096 ms, p95 0.176 ms, p99 1.658 ms, max 1.658 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- outbox enqueue: p50 0.068 ms, p95 1.073 ms, p99 1.711 ms, max 1.711 ms (n=100)\n- WebSocket write: p50 0.015 ms, p95 0.026 ms, p99 0.042 ms, max 1.298 ms (n=2497)\n- end-to-end broadcast: p50 38.776 ms, p95 43.950 ms, p99 44.614 ms, max 44.614 ms (n=100)\n\n- Broadcasts: 100 events, 800.0 recipients/event average, 800 max\n- Outbox: 0 max depth, 256 capacity, 5905 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 3200/3200 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 800/800 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 514 MiB baseline, 631 MiB peak, 634 MiB after close requests\n- fds: 8 baseline, 812 with clients, 812 peak, 813 after close requests\n- CPU: 55.9% average, 95.9% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_800_results.json, /home/james/Work/sim-map/bench/scale_800_results.md and /home/james/Work/sim-map/bench/scale_800_results.js\n",
      "result": {
        "generated": "2026-11-22T00:24:17.035Z",
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
        "duration_ms": 750.9005719999999,
        "throughput_requests_per_second": 6546.805507027901,
        "snapshot_rtt": {
          "n": 3200,
          "mean_ms": 76.45890040000003,
          "p50_ms": 41.155895999999984,
          "p95_ms": 209.41537600000004,
          "p99_ms": 223.78943600000002,
          "max_ms": 226.03055700000004
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 1.3428830000000147,
          "p50_ms": 0.29350399999998444,
          "p95_ms": 3.19862999999998,
          "p99_ms": 3.19862999999998,
          "max_ms": 3.19862999999998
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 35.608510110000005,
          "p50_ms": 48.92452400000002,
          "p95_ms": 56.61725899999999,
          "p99_ms": 97.45783000000006,
          "max_ms": 97.45783000000006
        },
        "event_delivery_lag": {
          "n": 80000,
          "mean_ms": 66.31344825977578,
          "p50_ms": 69.44103099999995,
          "p95_ms": 107.63504599999999,
          "p99_ms": 141.552364,
          "max_ms": 153.80933700000003
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
          "rss_baseline_kb": 526040,
          "rss_before_kb": 560892,
          "rss_peak_kb": 646124,
          "fds_baseline": 8,
          "fds_before": 812,
          "fds_peak": 812,
          "cpu_average_percent": 55.932837936365296,
          "cpu_peak_percent": 95.85492257778728,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 813,
          "rss_after_close_requests_kb": 648956,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 649084,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137937281358983,
          "uptime_ms": 1795.560058,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000411,
              "p50_ms": 0.00027,
              "p95_ms": 0.000762,
              "p99_ms": 0.005901,
              "max_ms": 0.005901,
              "total_ms": 0.041167
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 0.265644,
              "p50_ms": 0.255052,
              "p95_ms": 0.585556,
              "p99_ms": 0.647132,
              "max_ms": 0.647132,
              "total_ms": 26.564492
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.000711,
              "p50_ms": 0.000421,
              "p95_ms": 0.001153,
              "p99_ms": 0.011892,
              "max_ms": 0.011892,
              "total_ms": 0.071167
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.00033,
              "p50_ms": 0.000201,
              "p95_ms": 0.000581,
              "p99_ms": 0.003938,
              "max_ms": 0.003938,
              "total_ms": 0.033049
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 6.261032,
              "p50_ms": 5.201742,
              "p95_ms": 16.229213,
              "p99_ms": 17.149089,
              "max_ms": 17.149089,
              "total_ms": 626.103235
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.110976,
              "p50_ms": 0.096051,
              "p95_ms": 0.175562,
              "p99_ms": 1.65818,
              "max_ms": 1.65818,
              "total_ms": 11.097687
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000924,
              "p50_ms": 0.000761,
              "p95_ms": 0.002244,
              "p99_ms": 0.003146,
              "max_ms": 0.003146,
              "total_ms": 0.092498
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.159343,
              "p50_ms": 0.068379,
              "p95_ms": 1.072625,
              "p99_ms": 1.711,
              "max_ms": 1.711,
              "total_ms": 15.9343
            },
            "websocket_write": {
              "n": 2497,
              "mean_ms": 0.017671,
              "p50_ms": 0.014678,
              "p95_ms": 0.025839,
              "p99_ms": 0.04241,
              "max_ms": 1.298081,
              "total_ms": 44.125938
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 37.82318,
              "p50_ms": 38.776494,
              "p95_ms": 43.949731,
              "p99_ms": 44.614066,
              "max_ms": 44.614066,
              "total_ms": 3782.318024
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
          "end_to_end_p95_ms": 43.949731,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 3408,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 43.874203,
            "max_queue_wait_ms": 162.925008,
            "avg_processing_ms": 0.002482,
            "max_processing_ms": 1.243908
          },
          "connections": {
            "clients": 804,
            "subscriptions": 502500,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-22T00:24:22.660Z"
      }
    },
    {
      "clients": 1020,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_1020.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-1020\n\nGenerated: 2026-11-22T00:24:25.084Z\n\n## Load\n\n- 1020 active clients, 4 silent clients, high subscription distribution\n- 6236 requests: 1024 connections, 1024 subscriptions, 4088 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 869 ms, throughput 7180 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 57.2 ms, p95 263.9 ms, p99 274.9 ms, max 277.0 ms\n- Move RTT: p50 63.2 ms, p95 85.6 ms, p99 133.4 ms, max 133.4 ms\n- Client event delivery lag: p50 80.6 ms, p95 144.8 ms, p99 157.9 ms, max 168.0 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.005 ms, max 0.005 ms (n=100)\n- worker queue wait: p50 1.063 ms, p95 2.658 ms, p99 2.894 ms, max 2.894 ms (n=100)\n- move processing: p50 0.000 ms, p95 0.001 ms, p99 0.009 ms, max 0.009 ms (n=100)\n- commit → broadcaster: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- broadcast wait: p50 8.654 ms, p95 21.180 ms, p99 22.212 ms, max 22.212 ms (n=100)\n- recipient lookup: p50 0.126 ms, p95 0.323 ms, p99 2.257 ms, max 2.257 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.005 ms, max 0.005 ms (n=100)\n- outbox enqueue: p50 0.114 ms, p95 2.409 ms, p99 3.182 ms, max 3.182 ms (n=100)\n- WebSocket write: p50 0.016 ms, p95 0.029 ms, p99 0.051 ms, max 4.163 ms (n=3157)\n- end-to-end broadcast: p50 56.829 ms, p95 60.763 ms, p99 62.044 ms, max 62.044 ms (n=100)\n\n- Broadcasts: 100 events, 1020.0 recipients/event average, 1020 max\n- Outbox: 0 max depth, 256 capacity, 7445 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 4080/4080 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 1020/1020 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 514 MiB baseline, 662 MiB peak, 664 MiB after close requests\n- fds: 8 baseline, 1032 with clients, 1032 peak, 1033 after close requests\n- CPU: 61.0% average, 99.8% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/sim-map/bench/scale_1020_results.json, /home/james/Work/sim-map/bench/scale_1020_results.md and /home/james/Work/sim-map/bench/scale_1020_results.js\n",
      "result": {
        "generated": "2026-11-22T00:24:25.084Z",
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
        "duration_ms": 868.549764,
        "throughput_requests_per_second": 7179.784346818383,
        "snapshot_rtt": {
          "n": 4080,
          "mean_ms": 97.24637331519605,
          "p50_ms": 57.18445099999997,
          "p95_ms": 263.94964500000003,
          "p99_ms": 274.92067899999995,
          "max_ms": 276.96381700000006
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.2926302500000304,
          "p50_ms": 0.33489299999996547,
          "p95_ms": 0.488262000000077,
          "p99_ms": 0.488262000000077,
          "max_ms": 0.488262000000077
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 49.48090348000001,
          "p50_ms": 63.191102,
          "p95_ms": 85.5574009999998,
          "p99_ms": 133.38948299999993,
          "max_ms": 133.38948299999993
        },
        "event_delivery_lag": {
          "n": 102000,
          "mean_ms": 84.70558076377458,
          "p50_ms": 80.62563999999998,
          "p95_ms": 144.78214400000002,
          "p99_ms": 157.8895419999999,
          "max_ms": 167.99682599999983
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
          "rss_baseline_kb": 526092,
          "rss_before_kb": 570976,
          "rss_peak_kb": 678248,
          "fds_baseline": 8,
          "fds_before": 1032,
          "fds_peak": 1032,
          "cpu_average_percent": 61.02125888091313,
          "cpu_peak_percent": 99.8126466715652,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 1033,
          "rss_after_close_requests_kb": 679812,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 680284,
          "fds_after_exit": 6,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 137945117025927,
          "uptime_ms": 1993.657054,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000524,
              "p50_ms": 0.000291,
              "p95_ms": 0.002004,
              "p99_ms": 0.004609,
              "max_ms": 0.004609,
              "total_ms": 0.052497
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 1.127887,
              "p50_ms": 1.062877,
              "p95_ms": 2.657968,
              "p99_ms": 2.894154,
              "max_ms": 2.894154,
              "total_ms": 112.788784
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.000793,
              "p50_ms": 0.00047,
              "p95_ms": 0.001122,
              "p99_ms": 0.008767,
              "max_ms": 0.008767,
              "total_ms": 0.07938
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 0.000381,
              "p50_ms": 0.00029,
              "p95_ms": 0.000631,
              "p99_ms": 0.003286,
              "max_ms": 0.003286,
              "total_ms": 0.038154
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 9.410911,
              "p50_ms": 8.653679,
              "p95_ms": 21.179549,
              "p99_ms": 22.212419,
              "max_ms": 22.212419,
              "total_ms": 941.091188
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.170732,
              "p50_ms": 0.126318,
              "p95_ms": 0.322959,
              "p99_ms": 2.256751,
              "max_ms": 2.256751,
              "total_ms": 17.073272
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.00108,
              "p50_ms": 0.000912,
              "p95_ms": 0.002475,
              "p99_ms": 0.004649,
              "max_ms": 0.004649,
              "total_ms": 0.108063
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.306387,
              "p50_ms": 0.114356,
              "p95_ms": 2.408958,
              "p99_ms": 3.182109,
              "max_ms": 3.182109,
              "total_ms": 30.638765
            },
            "websocket_write": {
              "n": 3157,
              "mean_ms": 0.020473,
              "p50_ms": 0.015749,
              "p95_ms": 0.029085,
              "p99_ms": 0.050836,
              "max_ms": 4.162519,
              "total_ms": 64.635725
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 55.043711,
              "p50_ms": 56.829219,
              "p95_ms": 60.762616,
              "p99_ms": 62.043645,
              "max_ms": 62.043645,
              "total_ms": 5504.371102
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
          "end_to_end_p95_ms": 60.762616,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "requests_processed": 4288,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 58.006814,
            "max_queue_wait_ms": 197.363964,
            "avg_processing_ms": 0.003455,
            "max_processing_ms": 2.759931
          },
          "connections": {
            "clients": 1024,
            "subscriptions": 640000,
            "max_outbox_depth": 0,
            "outbox_capacity": 256,
            "event_batching": true
          }
        },
        "metrics_error": null,
        "post_exit_measured_at": "2026-11-22T00:24:30.723Z"
      }
    }
  ]
};
