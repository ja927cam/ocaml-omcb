window.SCALE_RESULTS = {
  "generated": "2026-11-27T00:05:26.926Z",
  "config": {
    "levels": [
      40,
      80,
      160,
      320,
      640,
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
      "clients": 40,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_40.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-40\n\nGenerated: 2026-11-27T00:04:42.981Z\n\n## Load\n\n- 40 active clients, 4 silent clients, high subscription distribution\n- 356 requests: 44 connections, 44 subscriptions, 168 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 346 ms, throughput 1028 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 2.5 ms, p95 8.3 ms, p99 8.7 ms, max 8.7 ms\n- Move RTT: p50 12.5 ms, p95 38.2 ms, p99 39.0 ms, max 39.0 ms\n- Client event delivery lag: p50 14.8 ms, p95 39.5 ms, p99 41.5 ms, max 41.7 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- worker queue wait: p50 0.348 ms, p95 27.899 ms, p99 27.917 ms, max 27.917 ms (n=100)\n- move processing: p50 0.006 ms, p95 0.031 ms, p99 0.048 ms, max 0.048 ms (n=100)\n- commit → broadcaster: p50 1.755 ms, p95 24.766 ms, p99 24.784 ms, max 24.784 ms (n=100)\n- broadcast wait: p50 0.325 ms, p95 2.334 ms, p99 2.652 ms, max 2.652 ms (n=100)\n- recipient lookup: p50 0.004 ms, p95 0.012 ms, p99 1.443 ms, max 1.443 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.003 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- outbox enqueue: p50 0.003 ms, p95 0.015 ms, p99 0.022 ms, max 0.022 ms (n=100)\n- WebSocket write: p50 0.017 ms, p95 0.043 ms, p99 0.089 ms, max 0.435 ms (n=295)\n- end-to-end broadcast: p50 6.351 ms, p95 31.334 ms, p99 31.377 ms, max 31.377 ms (n=100)\n\n- Broadcasts: 100 events, 40.0 recipients/event average, 40 max\n- Outbox: 0 max depth, 256 capacity, 663 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 160/160 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 40/40 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 541 MiB peak, 542 MiB after close requests\n- fds: 9 baseline, 53 with clients, 53 peak, 54 after close requests\n- CPU: 8.7% average, 29.7% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/ocaml-omcb/bench/scale_40_results.json, /home/james/Work/ocaml-omcb/bench/scale_40_results.md and /home/james/Work/ocaml-omcb/bench/scale_40_results.js\n",
      "result": {
        "generated": "2026-11-27T00:04:42.981Z",
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
        "duration_ms": 346.27524900000003,
        "throughput_requests_per_second": 1028.0838755529996,
        "snapshot_rtt": {
          "n": 160,
          "mean_ms": 3.351603818749998,
          "p50_ms": 2.547625000000039,
          "p95_ms": 8.254779999999982,
          "p99_ms": 8.663643000000008,
          "max_ms": 8.729387000000003
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.2501001249999817,
          "p50_ms": 0.32400200000000723,
          "p95_ms": 0.4425369999999589,
          "p99_ms": 0.4425369999999589,
          "max_ms": 0.4425369999999589
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 18.88098180999999,
          "p50_ms": 12.473051999999996,
          "p95_ms": 38.20307700000001,
          "p99_ms": 38.958595,
          "max_ms": 38.958595
        },
        "event_delivery_lag": {
          "n": 4000,
          "mean_ms": 21.282331078749973,
          "p50_ms": 14.848601999999971,
          "p95_ms": 39.52031599999998,
          "p99_ms": 41.46838799999995,
          "max_ms": 41.722578
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
          "rss_baseline_kb": 547300,
          "rss_before_kb": 548436,
          "rss_peak_kb": 554416,
          "fds_baseline": 9,
          "fds_before": 53,
          "fds_peak": 53,
          "cpu_average_percent": 8.663628164772469,
          "cpu_peak_percent": 29.65872095362041,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 54,
          "rss_after_close_requests_kb": 554748,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 554780,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 9918404845425,
          "uptime_ms": 1077.014639,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000442,
              "p50_ms": 0.000241,
              "p95_ms": 0.001503,
              "p99_ms": 0.006131,
              "max_ms": 0.006131,
              "total_ms": 0.044235
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 3.803472,
              "p50_ms": 0.347557,
              "p95_ms": 27.899445,
              "p99_ms": 27.917149,
              "max_ms": 27.917149,
              "total_ms": 380.347258
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.009011,
              "p50_ms": 0.005921,
              "p95_ms": 0.030899,
              "p99_ms": 0.047881,
              "max_ms": 0.047881,
              "total_ms": 0.901182
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 5.427953,
              "p50_ms": 1.755017,
              "p95_ms": 24.766104,
              "p99_ms": 24.784238,
              "max_ms": 24.784238,
              "total_ms": 542.795326
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 0.566479,
              "p50_ms": 0.324524,
              "p95_ms": 2.33353,
              "p99_ms": 2.652192,
              "max_ms": 2.652192,
              "total_ms": 56.647934
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.019588,
              "p50_ms": 0.004439,
              "p95_ms": 0.012022,
              "p99_ms": 1.443448,
              "max_ms": 1.443448,
              "total_ms": 1.958839
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000783,
              "p50_ms": 0.000511,
              "p95_ms": 0.002775,
              "p99_ms": 0.005991,
              "max_ms": 0.005991,
              "total_ms": 0.078384
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.004534,
              "p50_ms": 0.003186,
              "p95_ms": 0.014557,
              "p99_ms": 0.021731,
              "max_ms": 0.021731,
              "total_ms": 0.453477
            },
            "websocket_write": {
              "n": 295,
              "mean_ms": 0.020884,
              "p50_ms": 0.016772,
              "p95_ms": 0.043111,
              "p99_ms": 0.088938,
              "max_ms": 0.434551,
              "total_ms": 6.160943
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 12.754679,
              "p50_ms": 6.350501,
              "p95_ms": 31.334466,
              "p99_ms": 31.377438,
              "max_ms": 31.377438,
              "total_ms": 1275.467966
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 4000,
            "outbox_enqueues": 663,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 40
          },
          "end_to_end_p95_ms": 31.334466,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "move_queue_depth": 0,
            "requests_processed": 368,
            "moves_processed": 100,
            "moves_submitted": 100,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 1.193832,
            "max_queue_wait_ms": 27.917219,
            "avg_processing_ms": 0.002807,
            "max_processing_ms": 0.047881
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
            "data_dir": "data",
            "sequence": "100",
            "wal_segments": 1,
            "wal_bytes": "8416",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "group_size": 64,
            "sync_count": 9,
            "group_count": 9,
            "batched_moves": 100,
            "last_group_size": 9,
            "average_group_size": 11.11111111111111,
            "last_sync_ms": 1.618896484375,
            "fsync_p50_us": 1689.94140625,
            "fsync_p95_us": 24655.76171875,
            "snapshot_active": false,
            "snapshot_writing": false,
            "snapshot_buffer": false,
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0,
            "dirty": false,
            "truncated_wal": false
          },
          "memory": {
            "rss_kb": 554428,
            "smaps_rollup_kb": {
              "Rss": 554424,
              "Pss": 545222,
              "Shared_Clean": 11824,
              "Shared_Dirty": 0,
              "Private_Clean": 12,
              "Private_Dirty": 542588,
              "Anonymous": 542588,
              "Swap": 0,
              "Locked": 0
            },
            "gc": {
              "heap_words": 1265708,
              "live_words": 1175527,
              "free_words": 86463,
              "top_heap_words": 1265708,
              "major_words": 1267901,
              "minor_words": 215967102,
              "promoted_words": 568039,
              "compactions": 0,
              "major_collections": 10,
              "minor_collections": 833
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
            "move_rate": 146.99582261890936,
            "pending_moves": 0,
            "fsync_p50_us": 1225.8412475585938,
            "fsync_p95_us": 17884.67315673828,
            "broadcast_backlog": 0,
            "event_lag_p95_ms": 22.72923827475,
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
        "post_exit_measured_at": "2026-11-27T00:04:48.524Z"
      }
    },
    {
      "clients": 80,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_80.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-80\n\nGenerated: 2026-11-27T00:04:50.072Z\n\n## Load\n\n- 80 active clients, 4 silent clients, high subscription distribution\n- 596 requests: 84 connections, 84 subscriptions, 328 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 371 ms, throughput 1606 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 4.7 ms, p95 16.1 ms, p99 17.0 ms, max 17.9 ms\n- Move RTT: p50 14.7 ms, p95 51.0 ms, p99 52.3 ms, max 52.3 ms\n- Client event delivery lag: p50 39.8 ms, p95 52.4 ms, p99 53.3 ms, max 54.4 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- worker queue wait: p50 0.522 ms, p95 7.219 ms, p99 7.255 ms, max 7.255 ms (n=100)\n- move processing: p50 0.005 ms, p95 0.022 ms, p99 0.059 ms, max 0.059 ms (n=100)\n- commit → broadcaster: p50 2.006 ms, p95 28.834 ms, p99 28.845 ms, max 28.845 ms (n=100)\n- broadcast wait: p50 0.447 ms, p95 1.531 ms, p99 1.640 ms, max 1.640 ms (n=100)\n- recipient lookup: p50 0.009 ms, p95 0.023 ms, p99 0.097 ms, max 0.097 ms (n=100)\n- event encoding: p50 0.000 ms, p95 0.002 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- outbox enqueue: p50 0.007 ms, p95 0.027 ms, p99 0.857 ms, max 0.857 ms (n=100)\n- WebSocket write: p50 0.015 ms, p95 0.031 ms, p99 0.067 ms, max 0.097 ms (n=416)\n- end-to-end broadcast: p50 7.748 ms, p95 40.187 ms, p99 40.264 ms, max 40.264 ms (n=100)\n\n- Broadcasts: 100 events, 80.0 recipients/event average, 80 max\n- Outbox: 0 max depth, 256 capacity, 944 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 320/320 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 80/80 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 547 MiB peak, 548 MiB after close requests\n- fds: 9 baseline, 93 with clients, 93 peak, 94 after close requests\n- CPU: 13.5% average, 38.5% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/ocaml-omcb/bench/scale_80_results.json, /home/james/Work/ocaml-omcb/bench/scale_80_results.md and /home/james/Work/ocaml-omcb/bench/scale_80_results.js\n",
      "result": {
        "generated": "2026-11-27T00:04:50.072Z",
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
        "duration_ms": 371.08659400000005,
        "throughput_requests_per_second": 1606.0941290700464,
        "snapshot_rtt": {
          "n": 320,
          "mean_ms": 6.4739414687500005,
          "p50_ms": 4.657322000000022,
          "p95_ms": 16.111747999999977,
          "p99_ms": 17.02514400000001,
          "max_ms": 17.94194699999997
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.33443975000000137,
          "p50_ms": 0.3413550000000214,
          "p95_ms": 0.5119779999999992,
          "p99_ms": 0.5119779999999992,
          "max_ms": 0.5119779999999992
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 23.924928839999996,
          "p50_ms": 14.70135300000004,
          "p95_ms": 50.98264799999998,
          "p99_ms": 52.336235999999985,
          "max_ms": 52.336235999999985
        },
        "event_delivery_lag": {
          "n": 8000,
          "mean_ms": 32.23263389599994,
          "p50_ms": 39.75398799999999,
          "p95_ms": 52.42065600000001,
          "p99_ms": 53.270290999999986,
          "max_ms": 54.44854800000002
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
          "rss_baseline_kb": 547028,
          "rss_before_kb": 550320,
          "rss_peak_kb": 560608,
          "fds_baseline": 9,
          "fds_before": 93,
          "fds_peak": 93,
          "cpu_average_percent": 13.473944035822537,
          "cpu_peak_percent": 38.49218638447838,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 94,
          "rss_after_close_requests_kb": 560752,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 560824,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 9925417939647,
          "uptime_ms": 1153.285456,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000336,
              "p50_ms": 0.000191,
              "p95_ms": 0.001062,
              "p99_ms": 0.003066,
              "max_ms": 0.003066,
              "total_ms": 0.033626
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 1.768169,
              "p50_ms": 0.521646,
              "p95_ms": 7.219353,
              "p99_ms": 7.255231,
              "max_ms": 7.255231,
              "total_ms": 176.816943
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.007981,
              "p50_ms": 0.004519,
              "p95_ms": 0.021701,
              "p99_ms": 0.058621,
              "max_ms": 0.058621,
              "total_ms": 0.798188
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 6.182364,
              "p50_ms": 2.006422,
              "p95_ms": 28.83361,
              "p99_ms": 28.844922,
              "max_ms": 28.844922,
              "total_ms": 618.236462
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 0.592594,
              "p50_ms": 0.447416,
              "p95_ms": 1.530833,
              "p99_ms": 1.639549,
              "max_ms": 1.639549,
              "total_ms": 59.259428
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.011409,
              "p50_ms": 0.009158,
              "p95_ms": 0.022843,
              "p99_ms": 0.096543,
              "max_ms": 0.096543,
              "total_ms": 1.140953
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000681,
              "p50_ms": 0.000471,
              "p95_ms": 0.002064,
              "p99_ms": 0.003907,
              "max_ms": 0.003907,
              "total_ms": 0.068123
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.016681,
              "p50_ms": 0.006502,
              "p95_ms": 0.02669,
              "p99_ms": 0.85737,
              "max_ms": 0.85737,
              "total_ms": 1.668174
            },
            "websocket_write": {
              "n": 416,
              "mean_ms": 0.017563,
              "p50_ms": 0.015239,
              "p95_ms": 0.030618,
              "p99_ms": 0.066666,
              "max_ms": 0.097394,
              "total_ms": 7.306452
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 17.482562,
              "p50_ms": 7.747943,
              "p95_ms": 40.186795,
              "p99_ms": 40.264042,
              "max_ms": 40.264042,
              "total_ms": 1748.256295
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 8000,
            "outbox_enqueues": 944,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 80
          },
          "end_to_end_p95_ms": 40.186795,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "move_queue_depth": 0,
            "requests_processed": 528,
            "moves_processed": 100,
            "moves_submitted": 100,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 1.149752,
            "max_queue_wait_ms": 11.151324,
            "avg_processing_ms": 0.00184,
            "max_processing_ms": 0.058621
          },
          "connections": {
            "clients": 84,
            "subscriptions": 52500,
            "max_outbox_depth": 0,
            "total_outbox_depth": 0,
            "pending_event_count": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "data",
            "sequence": "200",
            "wal_segments": 2,
            "wal_bytes": "16832",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "group_size": 64,
            "sync_count": 7,
            "group_count": 7,
            "batched_moves": 100,
            "last_group_size": 13,
            "average_group_size": 14.285714285714286,
            "last_sync_ms": 1.929931640625,
            "fsync_p50_us": 1929.931640625,
            "fsync_p95_us": 28765.869140625,
            "snapshot_active": false,
            "snapshot_writing": false,
            "snapshot_buffer": false,
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0,
            "dirty": false,
            "truncated_wal": false
          },
          "memory": {
            "rss_kb": 560620,
            "smaps_rollup_kb": {
              "Rss": 560616,
              "Pss": 551493,
              "Shared_Clean": 11688,
              "Shared_Dirty": 0,
              "Private_Clean": 8,
              "Private_Dirty": 548920,
              "Anonymous": 548920,
              "Swap": 0,
              "Locked": 0
            },
            "gc": {
              "heap_words": 1958083,
              "live_words": 1864822,
              "free_words": 85544,
              "top_heap_words": 1958083,
              "major_words": 2015294,
              "minor_words": 217408340,
              "promoted_words": 1100699,
              "compactions": 0,
              "major_collections": 11,
              "minor_collections": 839
            },
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0
          },
          "adaptive": {
            "enabled": true,
            "max_batch_size": 16,
            "max_batch_delay_us": 250,
            "classification": "moderate",
            "samples": 7,
            "changes": 2,
            "move_rate": 113.95636827491,
            "pending_moves": 0,
            "fsync_p50_us": 1900.980694580078,
            "fsync_p95_us": 23630.98171234131,
            "broadcast_backlog": 0,
            "event_lag_p95_ms": 33.017853264768746,
            "recipients_per_event": 19.5195,
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
        "post_exit_measured_at": "2026-11-27T00:04:55.619Z"
      }
    },
    {
      "clients": 160,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_160.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-160\n\nGenerated: 2026-11-27T00:04:57.277Z\n\n## Load\n\n- 160 active clients, 4 silent clients, high subscription distribution\n- 1076 requests: 164 connections, 164 subscriptions, 648 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 431 ms, throughput 2494 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 9.4 ms, p95 33.4 ms, p99 34.4 ms, max 35.7 ms\n- Move RTT: p50 21.3 ms, p95 63.3 ms, p99 64.1 ms, max 64.1 ms\n- Client event delivery lag: p50 25.0 ms, p95 74.9 ms, p99 76.1 ms, max 76.6 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- worker queue wait: p50 1.285 ms, p95 15.116 ms, p99 16.054 ms, max 16.054 ms (n=100)\n- move processing: p50 0.004 ms, p95 0.037 ms, p99 0.070 ms, max 0.070 ms (n=100)\n- commit → broadcaster: p50 2.212 ms, p95 11.790 ms, p99 40.234 ms, max 40.234 ms (n=100)\n- broadcast wait: p50 2.389 ms, p95 5.974 ms, p99 6.320 ms, max 6.320 ms (n=100)\n- recipient lookup: p50 0.017 ms, p95 0.034 ms, p99 0.291 ms, max 0.291 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- outbox enqueue: p50 0.011 ms, p95 0.070 ms, p99 0.226 ms, max 0.226 ms (n=100)\n- WebSocket write: p50 0.013 ms, p95 0.031 ms, p99 0.092 ms, max 0.536 ms (n=736)\n- end-to-end broadcast: p50 9.785 ms, p95 25.717 ms, p99 66.629 ms, max 66.629 ms (n=100)\n\n- Broadcasts: 100 events, 160.0 recipients/event average, 160 max\n- Outbox: 0 max depth, 256 capacity, 1584 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 640/640 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 160/160 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 560 MiB peak, 560 MiB after close requests\n- fds: 9 baseline, 173 with clients, 173 peak, 174 after close requests\n- CPU: 18.5% average, 47.9% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/ocaml-omcb/bench/scale_160_results.json, /home/james/Work/ocaml-omcb/bench/scale_160_results.md and /home/james/Work/ocaml-omcb/bench/scale_160_results.js\n",
      "result": {
        "generated": "2026-11-27T00:04:57.277Z",
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
        "duration_ms": 431.400042,
        "throughput_requests_per_second": 2494.2046714033468,
        "snapshot_rtt": {
          "n": 640,
          "mean_ms": 13.091028385937511,
          "p50_ms": 9.359127,
          "p95_ms": 33.354243,
          "p99_ms": 34.39202399999999,
          "max_ms": 35.68339499999996
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.2236153750000014,
          "p50_ms": 0.2535090000000082,
          "p95_ms": 0.3745480000000043,
          "p99_ms": 0.3745480000000043,
          "max_ms": 0.3745480000000043
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 34.52547704,
          "p50_ms": 21.258194000000003,
          "p95_ms": 63.32876900000002,
          "p99_ms": 64.08790400000004,
          "max_ms": 64.08790400000004
        },
        "event_delivery_lag": {
          "n": 16000,
          "mean_ms": 39.676135833187246,
          "p50_ms": 24.96992799999998,
          "p95_ms": 74.933089,
          "p99_ms": 76.07205100000004,
          "max_ms": 76.57838900000002
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
          "rss_baseline_kb": 546880,
          "rss_before_kb": 553340,
          "rss_peak_kb": 573048,
          "fds_baseline": 9,
          "fds_before": 173,
          "fds_peak": 173,
          "cpu_average_percent": 18.544272649839012,
          "cpu_peak_percent": 47.88164377798007,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 174,
          "rss_after_close_requests_kb": 573504,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 573520,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 9932519971353,
          "uptime_ms": 1247.193344,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000328,
              "p50_ms": 0.000161,
              "p95_ms": 0.001903,
              "p99_ms": 0.002685,
              "max_ms": 0.002685,
              "total_ms": 0.032811
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 3.653562,
              "p50_ms": 1.284898,
              "p95_ms": 15.116126,
              "p99_ms": 16.053899,
              "max_ms": 16.053899,
              "total_ms": 365.356251
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.009253,
              "p50_ms": 0.004469,
              "p95_ms": 0.03655,
              "p99_ms": 0.070092,
              "max_ms": 0.070092,
              "total_ms": 0.925363
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 4.463456,
              "p50_ms": 2.21177,
              "p95_ms": 11.789961,
              "p99_ms": 40.233804,
              "max_ms": 40.233804,
              "total_ms": 446.345632
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 2.54323,
              "p50_ms": 2.388804,
              "p95_ms": 5.97428,
              "p99_ms": 6.320244,
              "max_ms": 6.320244,
              "total_ms": 254.323023
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.021012,
              "p50_ms": 0.016802,
              "p95_ms": 0.033644,
              "p99_ms": 0.29073,
              "max_ms": 0.29073,
              "total_ms": 2.101289
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.000713,
              "p50_ms": 0.000621,
              "p95_ms": 0.001663,
              "p99_ms": 0.003928,
              "max_ms": 0.003928,
              "total_ms": 0.071396
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.019093,
              "p50_ms": 0.011151,
              "p95_ms": 0.070343,
              "p99_ms": 0.225907,
              "max_ms": 0.225907,
              "total_ms": 1.909323
            },
            "websocket_write": {
              "n": 736,
              "mean_ms": 0.017975,
              "p50_ms": 0.013395,
              "p95_ms": 0.031129,
              "p99_ms": 0.091914,
              "max_ms": 0.536253,
              "total_ms": 13.229862
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 16.334718,
              "p50_ms": 9.785183,
              "p95_ms": 25.717441,
              "p99_ms": 66.628976,
              "max_ms": 66.628976,
              "total_ms": 1633.471884
            }
          },
          "counters": {
            "events_broadcast": 100,
            "recipients": 16000,
            "outbox_enqueues": 1584,
            "outbox_dropped": 0,
            "send_failures": 0,
            "outbox_full_unregisters": 0,
            "events_without_recipients": 0,
            "max_outbox_depth": 1,
            "max_recipients": 160
          },
          "end_to_end_p95_ms": 25.717441,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "move_queue_depth": 0,
            "requests_processed": 848,
            "moves_processed": 100,
            "moves_submitted": 100,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 3.638292,
            "max_queue_wait_ms": 20.072763,
            "avg_processing_ms": 0.002834,
            "max_processing_ms": 1.208975
          },
          "connections": {
            "clients": 164,
            "subscriptions": 102500,
            "max_outbox_depth": 0,
            "total_outbox_depth": 0,
            "pending_event_count": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "data",
            "sequence": "300",
            "wal_segments": 3,
            "wal_bytes": "25248",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "group_size": 64,
            "sync_count": 9,
            "group_count": 9,
            "batched_moves": 100,
            "last_group_size": 3,
            "average_group_size": 11.11111111111111,
            "last_sync_ms": 2.06298828125,
            "fsync_p50_us": 2062.98828125,
            "fsync_p95_us": 40192.626953125,
            "snapshot_active": false,
            "snapshot_writing": false,
            "snapshot_buffer": false,
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0,
            "dirty": false,
            "truncated_wal": false
          },
          "memory": {
            "rss_kb": 573068,
            "smaps_rollup_kb": {
              "Rss": 573064,
              "Pss": 564025,
              "Shared_Clean": 11652,
              "Shared_Dirty": 0,
              "Private_Clean": 0,
              "Private_Dirty": 561412,
              "Anonymous": 561412,
              "Swap": 0,
              "Locked": 0
            },
            "gc": {
              "heap_words": 3287141,
              "live_words": 3175644,
              "free_words": 98200,
              "top_heap_words": 3287141,
              "major_words": 3577762,
              "minor_words": 219899000,
              "promoted_words": 2219825,
              "compactions": 0,
              "major_collections": 13,
              "minor_collections": 850
            },
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0
          },
          "adaptive": {
            "enabled": true,
            "max_batch_size": 16,
            "max_batch_delay_us": 0,
            "classification": "moderate",
            "samples": 8,
            "changes": 2,
            "move_rate": 146.47465588888645,
            "pending_moves": 0,
            "fsync_p50_us": 5359.705186462403,
            "fsync_p95_us": 33017.99183807373,
            "broadcast_backlog": 0,
            "event_lag_p95_ms": 18.654788765375002,
            "recipients_per_event": 39.039,
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
        "post_exit_measured_at": "2026-11-27T00:05:02.827Z"
      }
    },
    {
      "clients": 320,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_320.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-320\n\nGenerated: 2026-11-27T00:05:04.647Z\n\n## Load\n\n- 320 active clients, 4 silent clients, high subscription distribution\n- 2036 requests: 324 connections, 324 subscriptions, 1288 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 530 ms, throughput 3845 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 20.1 ms, p95 72.9 ms, p99 75.9 ms, max 77.2 ms\n- Move RTT: p50 34.0 ms, p95 71.3 ms, p99 72.0 ms, max 72.0 ms\n- Client event delivery lag: p50 46.2 ms, p95 93.8 ms, p99 95.6 ms, max 96.4 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- worker queue wait: p50 0.741 ms, p95 8.047 ms, p99 8.068 ms, max 8.068 ms (n=100)\n- move processing: p50 0.006 ms, p95 0.039 ms, p99 0.059 ms, max 0.059 ms (n=100)\n- commit → broadcaster: p50 1.942 ms, p95 5.547 ms, p99 51.290 ms, max 51.290 ms (n=100)\n- broadcast wait: p50 3.646 ms, p95 9.139 ms, p99 9.576 ms, max 9.576 ms (n=100)\n- recipient lookup: p50 0.040 ms, p95 0.078 ms, p99 0.379 ms, max 0.379 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.002 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- outbox enqueue: p50 0.031 ms, p95 0.161 ms, p99 1.966 ms, max 1.966 ms (n=100)\n- WebSocket write: p50 0.015 ms, p95 0.028 ms, p99 0.070 ms, max 2.486 ms (n=1376)\n- end-to-end broadcast: p50 20.036 ms, p95 25.162 ms, p99 77.148 ms, max 77.148 ms (n=100)\n\n- Broadcasts: 100 events, 320.0 recipients/event average, 320 max\n- Outbox: 0 max depth, 256 capacity, 2864 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 1280/1280 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 320/320 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 584 MiB peak, 585 MiB after close requests\n- fds: 9 baseline, 333 with clients, 333 peak, 334 after close requests\n- CPU: 32.1% average, 98.3% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/ocaml-omcb/bench/scale_320_results.json, /home/james/Work/ocaml-omcb/bench/scale_320_results.md and /home/james/Work/ocaml-omcb/bench/scale_320_results.js\n",
      "result": {
        "generated": "2026-11-27T00:05:04.647Z",
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
        "duration_ms": 529.5293839999999,
        "throughput_requests_per_second": 3844.9235519666654,
        "snapshot_rtt": {
          "n": 1280,
          "mean_ms": 29.12582856328126,
          "p50_ms": 20.07234299999999,
          "p95_ms": 72.88957699999997,
          "p99_ms": 75.86953799999998,
          "max_ms": 77.21496100000002
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.16759162499999292,
          "p50_ms": 0.18306599999999662,
          "p95_ms": 0.3076009999999769,
          "p99_ms": 0.3076009999999769,
          "max_ms": 0.3076009999999769
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 44.88819766000002,
          "p50_ms": 34.00272800000005,
          "p95_ms": 71.348975,
          "p99_ms": 71.97650099999998,
          "max_ms": 71.97650099999998
        },
        "event_delivery_lag": {
          "n": 32000,
          "mean_ms": 57.45081065171892,
          "p50_ms": 46.23379299999999,
          "p95_ms": 93.82698400000004,
          "p99_ms": 95.55690300000003,
          "max_ms": 96.37362699999994
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
          "rss_baseline_kb": 546732,
          "rss_before_kb": 562016,
          "rss_peak_kb": 597816,
          "fds_baseline": 9,
          "fds_before": 333,
          "fds_peak": 333,
          "cpu_average_percent": 32.10397857732481,
          "cpu_peak_percent": 98.31013818679476,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 334,
          "rss_after_close_requests_kb": 598868,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 598876,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 9939740153028,
          "uptime_ms": 1390.080822,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000387,
              "p50_ms": 0.00025,
              "p95_ms": 0.001834,
              "p99_ms": 0.003056,
              "max_ms": 0.003056,
              "total_ms": 0.038716
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 2.275949,
              "p50_ms": 0.740739,
              "p95_ms": 8.047318,
              "p99_ms": 8.068428,
              "max_ms": 8.068428,
              "total_ms": 227.594972
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.009923,
              "p50_ms": 0.006402,
              "p95_ms": 0.039355,
              "p99_ms": 0.059342,
              "max_ms": 0.059342,
              "total_ms": 0.99234
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 2.988946,
              "p50_ms": 1.941789,
              "p95_ms": 5.547053,
              "p99_ms": 51.289778,
              "max_ms": 51.289778,
              "total_ms": 298.894642
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 4.694415,
              "p50_ms": 3.6462,
              "p95_ms": 9.138931,
              "p99_ms": 9.575676,
              "max_ms": 9.575676,
              "total_ms": 469.441541
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.04742,
              "p50_ms": 0.039796,
              "p95_ms": 0.077697,
              "p99_ms": 0.378516,
              "max_ms": 0.378516,
              "total_ms": 4.742048
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.001038,
              "p50_ms": 0.000831,
              "p95_ms": 0.002044,
              "p99_ms": 0.004078,
              "max_ms": 0.004078,
              "total_ms": 0.103815
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.062322,
              "p50_ms": 0.031149,
              "p95_ms": 0.161064,
              "p99_ms": 1.965665,
              "max_ms": 1.965665,
              "total_ms": 6.232229
            },
            "websocket_write": {
              "n": 1376,
              "mean_ms": 0.021203,
              "p50_ms": 0.014888,
              "p95_ms": 0.027983,
              "p99_ms": 0.069641,
              "max_ms": 2.486018,
              "total_ms": 29.175813
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 21.766485,
              "p50_ms": 20.036134,
              "p95_ms": 25.162072,
              "p99_ms": 77.148135,
              "max_ms": 77.148135,
              "total_ms": 2176.648505
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
          "end_to_end_p95_ms": 25.162072,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "move_queue_depth": 0,
            "requests_processed": 1488,
            "moves_processed": 100,
            "moves_submitted": 100,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 14.44923,
            "max_queue_wait_ms": 48.993628,
            "avg_processing_ms": 0.002345,
            "max_processing_ms": 1.163899
          },
          "connections": {
            "clients": 324,
            "subscriptions": 202500,
            "max_outbox_depth": 0,
            "total_outbox_depth": 0,
            "pending_event_count": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "data",
            "sequence": "400",
            "wal_segments": 4,
            "wal_bytes": "33664",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "group_size": 64,
            "sync_count": 9,
            "group_count": 9,
            "batched_moves": 100,
            "last_group_size": 4,
            "average_group_size": 11.11111111111111,
            "last_sync_ms": 1.548095703125,
            "fsync_p50_us": 1902.099609375,
            "fsync_p95_us": 51275.146484375,
            "snapshot_active": false,
            "snapshot_writing": false,
            "snapshot_buffer": false,
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0,
            "dirty": false,
            "truncated_wal": false
          },
          "memory": {
            "rss_kb": 597828,
            "smaps_rollup_kb": {
              "Rss": 597824,
              "Pss": 588787,
              "Shared_Clean": 11568,
              "Shared_Dirty": 0,
              "Private_Clean": 8,
              "Private_Dirty": 586248,
              "Anonymous": 586248,
              "Swap": 0,
              "Locked": 0
            },
            "gc": {
              "heap_words": 6235931,
              "live_words": 6131800,
              "free_words": 77843,
              "top_heap_words": 6235931,
              "major_words": 6663568,
              "minor_words": 225262021,
              "promoted_words": 4412183,
              "compactions": 0,
              "major_collections": 15,
              "minor_collections": 872
            },
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0
          },
          "adaptive": {
            "enabled": true,
            "max_batch_size": 32,
            "max_batch_delay_us": 0,
            "classification": "moderate",
            "samples": 9,
            "changes": 3,
            "move_rate": 146.59334083968218,
            "pending_moves": 0,
            "fsync_p50_us": 6308.238490295411,
            "fsync_p95_us": 42122.21236724853,
            "broadcast_backlog": 0,
            "event_lag_p95_ms": 18.251937976999997,
            "recipients_per_event": 78.078,
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
        "post_exit_measured_at": "2026-11-27T00:05:10.222Z"
      }
    },
    {
      "clients": 640,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_640.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-640\n\nGenerated: 2026-11-27T00:05:12.493Z\n\n## Load\n\n- 640 active clients, 4 silent clients, high subscription distribution\n- 3956 requests: 644 connections, 644 subscriptions, 2568 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 818 ms, throughput 4836 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 35.9 ms, p95 195.5 ms, p99 202.8 ms, max 204.0 ms\n- Move RTT: p50 82.1 ms, p95 99.2 ms, p99 135.3 ms, max 135.3 ms\n- Client event delivery lag: p50 108.1 ms, p95 129.6 ms, p99 170.0 ms, max 179.5 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.001 ms, p99 0.003 ms, max 0.003 ms (n=100)\n- worker queue wait: p50 4.756 ms, p95 67.590 ms, p99 67.613 ms, max 67.613 ms (n=100)\n- move processing: p50 0.010 ms, p95 0.049 ms, p99 2.058 ms, max 2.058 ms (n=100)\n- commit → broadcaster: p50 3.195 ms, p95 64.162 ms, p99 64.174 ms, max 64.174 ms (n=100)\n- broadcast wait: p50 9.496 ms, p95 19.690 ms, p99 22.236 ms, max 22.236 ms (n=100)\n- recipient lookup: p50 0.087 ms, p95 0.183 ms, p99 0.255 ms, max 0.255 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.003 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- outbox enqueue: p50 0.067 ms, p95 0.732 ms, p99 2.198 ms, max 2.198 ms (n=100)\n- WebSocket write: p50 0.015 ms, p95 0.025 ms, p99 0.039 ms, max 1.022 ms (n=2017)\n- end-to-end broadcast: p50 46.836 ms, p95 95.538 ms, p99 98.932 ms, max 98.932 ms (n=100)\n\n- Broadcasts: 100 events, 640.0 recipients/event average, 640 max\n- Outbox: 0 max depth, 256 capacity, 4785 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 2560/2560 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 640/640 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 635 MiB peak, 636 MiB after close requests\n- fds: 9 baseline, 653 with clients, 653 peak, 654 after close requests\n- CPU: 44.0% average, 98.5% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/ocaml-omcb/bench/scale_640_results.json, /home/james/Work/ocaml-omcb/bench/scale_640_results.md and /home/james/Work/ocaml-omcb/bench/scale_640_results.js\n",
      "result": {
        "generated": "2026-11-27T00:05:12.493Z",
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
        "duration_ms": 817.967406,
        "throughput_requests_per_second": 4836.378529244233,
        "snapshot_rtt": {
          "n": 2560,
          "mean_ms": 70.5742891656249,
          "p50_ms": 35.884704000000056,
          "p95_ms": 195.451612,
          "p99_ms": 202.78429,
          "max_ms": 204.04186599999997
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.17334899999995912,
          "p50_ms": 0.20728199999996377,
          "p95_ms": 0.31368299999996907,
          "p99_ms": 0.31368299999996907,
          "max_ms": 0.31368299999996907
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 80.75482116,
          "p50_ms": 82.08093499999995,
          "p95_ms": 99.22278999999992,
          "p99_ms": 135.32944399999997,
          "max_ms": 135.32944399999997
        },
        "event_delivery_lag": {
          "n": 64000,
          "mean_ms": 106.4254309957823,
          "p50_ms": 108.14849800000002,
          "p95_ms": 129.562366,
          "p99_ms": 170.04762400000004,
          "max_ms": 179.52304099999992
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
          "rss_baseline_kb": 547072,
          "rss_before_kb": 576684,
          "rss_peak_kb": 649972,
          "fds_baseline": 9,
          "fds_before": 653,
          "fds_peak": 653,
          "cpu_average_percent": 44.011533633162884,
          "cpu_peak_percent": 98.49696390988504,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 654,
          "rss_after_close_requests_kb": 650948,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 651252,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 9947146961035,
          "uptime_ms": 1819.994156,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.00038,
              "p50_ms": 0.00026,
              "p95_ms": 0.000772,
              "p99_ms": 0.003015,
              "max_ms": 0.003015,
              "total_ms": 0.038074
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 16.335217,
              "p50_ms": 4.755948,
              "p95_ms": 67.590301,
              "p99_ms": 67.613064,
              "max_ms": 67.613064,
              "total_ms": 1633.521784
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.033007,
              "p50_ms": 0.009698,
              "p95_ms": 0.048913,
              "p99_ms": 2.0585,
              "max_ms": 2.0585,
              "total_ms": 3.300723
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 15.080708,
              "p50_ms": 3.195248,
              "p95_ms": 64.162262,
              "p99_ms": 64.173835,
              "max_ms": 64.173835,
              "total_ms": 1508.070888
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 10.047249,
              "p50_ms": 9.495645,
              "p95_ms": 19.689659,
              "p99_ms": 22.235941,
              "max_ms": 22.235941,
              "total_ms": 1004.724943
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.095734,
              "p50_ms": 0.086674,
              "p95_ms": 0.183186,
              "p99_ms": 0.254671,
              "max_ms": 0.254671,
              "total_ms": 9.573455
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.0009,
              "p50_ms": 0.000701,
              "p95_ms": 0.002544,
              "p99_ms": 0.004449,
              "max_ms": 0.004449,
              "total_ms": 0.090047
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.153352,
              "p50_ms": 0.066736,
              "p95_ms": 0.731713,
              "p99_ms": 2.197593,
              "max_ms": 2.197593,
              "total_ms": 15.335204
            },
            "websocket_write": {
              "n": 2017,
              "mean_ms": 0.0185,
              "p50_ms": 0.015359,
              "p95_ms": 0.024546,
              "p99_ms": 0.038723,
              "max_ms": 1.021951,
              "total_ms": 37.315155
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 61.955093,
              "p50_ms": 46.836341,
              "p95_ms": 95.537877,
              "p99_ms": 98.932331,
              "max_ms": 98.932331,
              "total_ms": 6195.509325
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
          "end_to_end_p95_ms": 95.537877,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "move_queue_depth": 0,
            "requests_processed": 2768,
            "moves_processed": 100,
            "moves_submitted": 100,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 40.867638,
            "max_queue_wait_ms": 158.495954,
            "avg_processing_ms": 0.002988,
            "max_processing_ms": 2.0585
          },
          "connections": {
            "clients": 644,
            "subscriptions": 402500,
            "max_outbox_depth": 0,
            "total_outbox_depth": 0,
            "pending_event_count": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "data",
            "sequence": "500",
            "wal_segments": 5,
            "wal_bytes": "42080",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "group_size": 64,
            "sync_count": 9,
            "group_count": 9,
            "batched_moves": 100,
            "last_group_size": 6,
            "average_group_size": 11.11111111111111,
            "last_sync_ms": 16.3291015625,
            "fsync_p50_us": 3023.193359375,
            "fsync_p95_us": 64070.068359375,
            "snapshot_active": false,
            "snapshot_writing": false,
            "snapshot_buffer": false,
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0,
            "dirty": false,
            "truncated_wal": false
          },
          "memory": {
            "rss_kb": 650104,
            "smaps_rollup_kb": {
              "Rss": 650104,
              "Pss": 640874,
              "Shared_Clean": 11864,
              "Shared_Dirty": 0,
              "Private_Clean": 16,
              "Private_Dirty": 638224,
              "Anonymous": 638224,
              "Swap": 0,
              "Locked": 0
            },
            "gc": {
              "heap_words": 11955855,
              "live_words": 11649856,
              "free_words": 258429,
              "top_heap_words": 12006491,
              "major_words": 13098193,
              "minor_words": 234606031,
              "promoted_words": 8624260,
              "compactions": 0,
              "major_collections": 18,
              "minor_collections": 911
            },
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0
          },
          "adaptive": {
            "enabled": true,
            "max_batch_size": 16,
            "max_batch_delay_us": 0,
            "classification": "broadcast_bound",
            "samples": 11,
            "changes": 2,
            "move_rate": 100.6092560850447,
            "pending_moves": 0,
            "fsync_p50_us": 2398.069486999512,
            "fsync_p95_us": 52418.794317626955,
            "broadcast_backlog": 0,
            "event_lag_p95_ms": 78.80967352855625,
            "recipients_per_event": 156.156,
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
        "post_exit_measured_at": "2026-11-27T00:05:18.110Z"
      }
    },
    {
      "clients": 1020,
      "distribution": "high",
      "ok": true,
      "exit_code": 0,
      "server_log": "/tmp/sim-map-scale_1020.log",
      "stderr": "",
      "stdout": "# Live load test results\n\nProfile: clients-1020\n\nGenerated: 2026-11-27T00:05:20.825Z\n\n## Load\n\n- 1020 active clients, 4 silent clients, high subscription distribution\n- 6236 requests: 1024 connections, 1024 subscriptions, 4088 snapshots, 100 moves\n- 40 move drivers on a 10 x 10 fresh block, 25 x 25 subscriptions\n- Duration: 1153 ms, throughput 5407 requests/s\n\n## Latency\n\n- Snapshot RTT: p50 58.4 ms, p95 269.3 ms, p99 277.2 ms, max 279.8 ms\n- Move RTT: p50 145.8 ms, p95 154.4 ms, p99 278.6 ms, max 278.6 ms\n- Client event delivery lag: p50 176.7 ms, p95 218.9 ms, p99 278.6 ms, max 341.6 ms\n\n## Server pipeline\n\n- receive → submit: p50 0.000 ms, p95 0.002 ms, p99 0.004 ms, max 0.004 ms (n=100)\n- worker queue wait: p50 2.139 ms, p95 85.367 ms, p99 85.406 ms, max 85.406 ms (n=100)\n- move processing: p50 0.006 ms, p95 0.038 ms, p99 0.075 ms, max 0.075 ms (n=100)\n- commit → broadcaster: p50 2.100 ms, p95 85.054 ms, p99 85.066 ms, max 85.066 ms (n=100)\n- broadcast wait: p50 11.603 ms, p95 26.786 ms, p99 27.857 ms, max 27.857 ms (n=100)\n- recipient lookup: p50 0.134 ms, p95 0.626 ms, p99 4.523 ms, max 4.523 ms (n=100)\n- event encoding: p50 0.001 ms, p95 0.004 ms, p99 0.006 ms, max 0.006 ms (n=100)\n- outbox enqueue: p50 0.127 ms, p95 1.946 ms, p99 2.944 ms, max 2.944 ms (n=100)\n- WebSocket write: p50 0.015 ms, p95 0.033 ms, p99 0.053 ms, max 4.050 ms (n=3157)\n- end-to-end broadcast: p50 125.283 ms, p95 154.287 ms, p99 154.383 ms, max 154.383 ms (n=100)\n\n- Broadcasts: 100 events, 1020.0 recipients/event average, 1020 max\n- Outbox: 0 max depth, 256 capacity, 7445 enqueues\n- Drops/failures: 0 dropped events, 0 send failures, 0 full-outbox unregisters\n\n## Accuracy\n\n- Moves: 100/100 accepted, 0 rejected, 0 request-ID mismatches, 0 duplicate sequences\n- Snapshots: 4080/4080 active valid, 8 silent valid, 0 silent failures\n- Events: 0 missing, 0 duplicate, 0 extra; 1020/1020 clients received events\n- Expected/actual per client: 100-100 expected, 100-100 actual\n- Event contents: 0 wrong board, 0 wrong revision, 0 wrong changes, 0 wrong request ID, 0 wrong board count\n- Isolation: 0 events leaked to silent clients, 0 unexpected closes\n\n## Server resources\n\n- RSS: 534 MiB baseline, 685 MiB peak, 687 MiB after close requests\n- fds: 9 baseline, 1033 with clients, 1033 peak, 1034 after close requests\n- CPU: 48.6% average, 97.6% peak; 0 idle ticks/s after close requests\n\nPost-exit fds/RSS/CPU are appended by `bench/load_after.js`.\n\nWrote /home/james/Work/ocaml-omcb/bench/scale_1020_results.json, /home/james/Work/ocaml-omcb/bench/scale_1020_results.md and /home/james/Work/ocaml-omcb/bench/scale_1020_results.js\n",
      "result": {
        "generated": "2026-11-27T00:05:20.825Z",
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
        "duration_ms": 1153.407767,
        "throughput_requests_per_second": 5406.587486591809,
        "snapshot_rtt": {
          "n": 4080,
          "mean_ms": 100.32739315294121,
          "p50_ms": 58.39065500000004,
          "p95_ms": 269.29061,
          "p99_ms": 277.15073299999995,
          "max_ms": 279.83189100000004
        },
        "silent_snapshot_rtt": {
          "n": 8,
          "mean_ms": 0.14662212500005012,
          "p50_ms": 0.15155700000013894,
          "p95_ms": 0.24373999999988882,
          "p99_ms": 0.24373999999988882,
          "max_ms": 0.24373999999988882
        },
        "move_rtt": {
          "n": 100,
          "mean_ms": 131.48372085,
          "p50_ms": 145.8146479999998,
          "p95_ms": 154.3589239999999,
          "p99_ms": 278.6307300000001,
          "max_ms": 278.6307300000001
        },
        "event_delivery_lag": {
          "n": 102000,
          "mean_ms": 172.58990407785905,
          "p50_ms": 176.72133400000007,
          "p95_ms": 218.90922,
          "p99_ms": 278.5885300000002,
          "max_ms": 341.58625200000006
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
          "rss_baseline_kb": 547036,
          "rss_before_kb": 593064,
          "rss_peak_kb": 701000,
          "fds_baseline": 9,
          "fds_before": 1033,
          "fds_peak": 1033,
          "cpu_average_percent": 48.55177986676416,
          "cpu_peak_percent": 97.57282809056147,
          "cpu_peak_window_ms": 100,
          "fds_after_close_requests": 1034,
          "rss_after_close_requests_kb": 703920,
          "cpu_idle_ticks_per_second": 0,
          "rss_after_exit_kb": 704312,
          "fds_after_exit": 7,
          "cpu_idle_after_exit_ticks_per_second": 0
        },
        "server_metrics": {
          "started_ns": 9954983034166,
          "uptime_ms": 2298.640826,
          "stages": {
            "receive_to_submit": {
              "n": 100,
              "mean_ms": 0.000383,
              "p50_ms": 0.000231,
              "p95_ms": 0.001523,
              "p99_ms": 0.004037,
              "max_ms": 0.004037,
              "total_ms": 0.038301
            },
            "worker_queue_wait": {
              "n": 100,
              "mean_ms": 24.618978,
              "p50_ms": 2.139143,
              "p95_ms": 85.367396,
              "p99_ms": 85.406349,
              "max_ms": 85.406349,
              "total_ms": 2461.89784
            },
            "move_processing": {
              "n": 100,
              "mean_ms": 0.010378,
              "p50_ms": 0.005861,
              "p95_ms": 0.037971,
              "p99_ms": 0.074721,
              "max_ms": 0.074721,
              "total_ms": 1.037826
            },
            "commit_to_broadcast": {
              "n": 100,
              "mean_ms": 28.916543,
              "p50_ms": 2.100149,
              "p95_ms": 85.053973,
              "p99_ms": 85.066307,
              "max_ms": 85.066307,
              "total_ms": 2891.654334
            },
            "broadcast_wait": {
              "n": 100,
              "mean_ms": 13.188323,
              "p50_ms": 11.602817,
              "p95_ms": 26.785559,
              "p99_ms": 27.857234,
              "max_ms": 27.857234,
              "total_ms": 1318.832334
            },
            "broadcast_dispatch": {
              "n": 100,
              "mean_ms": 0.260867,
              "p50_ms": 0.133562,
              "p95_ms": 0.626434,
              "p99_ms": 4.522527,
              "max_ms": 4.522527,
              "total_ms": 26.086736
            },
            "encoding": {
              "n": 100,
              "mean_ms": 0.001384,
              "p50_ms": 0.000992,
              "p95_ms": 0.003837,
              "p99_ms": 0.00555,
              "max_ms": 0.00555,
              "total_ms": 0.138464
            },
            "outbox_enqueue": {
              "n": 100,
              "mean_ms": 0.29688,
              "p50_ms": 0.12706,
              "p95_ms": 1.945787,
              "p99_ms": 2.944164,
              "max_ms": 2.944164,
              "total_ms": 29.688084
            },
            "websocket_write": {
              "n": 3157,
              "mean_ms": 0.020624,
              "p50_ms": 0.015349,
              "p95_ms": 0.032942,
              "p99_ms": 0.05323,
              "max_ms": 4.049553,
              "total_ms": 65.112601
            },
            "end_to_end_broadcast": {
              "n": 100,
              "mean_ms": 111.37348,
              "p50_ms": 125.283428,
              "p95_ms": 154.287489,
              "p99_ms": 154.38348,
              "max_ms": 154.38348,
              "total_ms": 11137.34803
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
          "end_to_end_p95_ms": 154.287489,
          "worker": {
            "queue_depth": 0,
            "queue_capacity": 4096,
            "move_queue_depth": 0,
            "requests_processed": 4288,
            "moves_processed": 100,
            "moves_submitted": 100,
            "requests_rejected": 0,
            "avg_queue_wait_ms": 60.555982,
            "max_queue_wait_ms": 210.395221,
            "avg_processing_ms": 0.00248,
            "max_processing_ms": 1.90517
          },
          "connections": {
            "clients": 1024,
            "subscriptions": 640000,
            "max_outbox_depth": 0,
            "total_outbox_depth": 0,
            "pending_event_count": 0,
            "outbox_capacity": 256,
            "event_batching": true
          },
          "persistence": {
            "data_dir": "data",
            "sequence": "600",
            "wal_segments": 6,
            "wal_bytes": "50496",
            "snapshots": 0,
            "last_snapshot_sequence": null,
            "snapshot_pending": false,
            "snapshot_write_ms": 0,
            "commits_since_snapshot": 100,
            "sync": true,
            "group_size": 64,
            "sync_count": 9,
            "group_count": 9,
            "batched_moves": 100,
            "last_group_size": 5,
            "average_group_size": 11.11111111111111,
            "last_sync_ms": 2.19189453125,
            "fsync_p50_us": 2046.875,
            "fsync_p95_us": 84980.95703125,
            "snapshot_active": false,
            "snapshot_writing": false,
            "snapshot_buffer": false,
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0,
            "dirty": false,
            "truncated_wal": false
          },
          "memory": {
            "rss_kb": 701012,
            "smaps_rollup_kb": {
              "Rss": 701008,
              "Pss": 691813,
              "Shared_Clean": 11780,
              "Shared_Dirty": 0,
              "Private_Clean": 28,
              "Private_Dirty": 689200,
              "Anonymous": 689200,
              "Swap": 0,
              "Locked": 0
            },
            "gc": {
              "heap_words": 17897251,
              "live_words": 17347333,
              "free_words": 473048,
              "top_heap_words": 17897251,
              "major_words": 19866269,
              "minor_words": 245611583,
              "promoted_words": 13430446,
              "compactions": 0,
              "major_collections": 20,
              "minor_collections": 956
            },
            "snapshot_copy_live": 0,
            "snapshot_copy_live_bytes": 0
          },
          "adaptive": {
            "enabled": true,
            "max_batch_size": 16,
            "max_batch_delay_us": 0,
            "classification": "broadcast_bound",
            "samples": 15,
            "changes": 2,
            "move_rate": 42.238805623860834,
            "pending_moves": 0,
            "fsync_p50_us": 5131.301206920623,
            "fsync_p95_us": 78306.71326411056,
            "broadcast_backlog": 0,
            "event_lag_p95_ms": 130.57143864959687,
            "recipients_per_event": 203.1902315625,
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
        "post_exit_measured_at": "2026-11-27T00:05:26.477Z"
      }
    }
  ]
};
