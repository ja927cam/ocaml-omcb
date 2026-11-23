window.SLOW_RESULTS = {
  "generated": "2026-11-23T00:10:12.307Z",
  "config": {
    "normal_clients": 20,
    "drivers": 5,
    "boards": 25,
    "rounds": 1500,
    "moves": 37500,
    "outbox_capacity": 8
  },
  "runs": [
    {
      "scenario": "baseline",
      "slow_mode": "none",
      "ok": true,
      "duration_ms": 2763.078276,
      "outbox_capacity": 8,
      "normal_clients": 20,
      "total_moves": 37500,
      "move_rejections": 0,
      "accuracy": {
        "total_moves": 37500,
        "normal_missing": 0,
        "normal_duplicate": 0,
        "normal_wrong": 0,
        "normal_clients_with_events": 20,
        "event_lag": {
          "n": 750000,
          "p50_ms": 0.8112019999998665,
          "p95_ms": 2.180778999999916,
          "p99_ms": 7.896514000000025,
          "max_ms": 58.02581399999963
        }
      },
      "slow": null,
      "recovery": null,
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 530476,
        "rss_end_kb": 568896,
        "fds_start": 27,
        "fds_end": 28,
        "cpu_average_percent": 65.50664943956151
      },
      "server_metrics": {
        "started_ns": 223466854572546,
        "uptime_ms": 3589.195311,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000373,
            "p50_ms": 0.000201,
            "p95_ms": 0.000611,
            "p99_ms": 0.001373,
            "max_ms": 0.414483,
            "total_ms": 13.98851
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.007733,
            "p50_ms": 0.005079,
            "p95_ms": 0.017783,
            "p99_ms": 0.048261,
            "max_ms": 1.128181,
            "total_ms": 290.010223
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.000722,
            "p50_ms": 0.000391,
            "p95_ms": 0.001303,
            "p99_ms": 0.003416,
            "max_ms": 0.497781,
            "total_ms": 27.092577
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 0.000508,
            "p50_ms": 0.00029,
            "p95_ms": 0.000791,
            "p99_ms": 0.001623,
            "max_ms": 0.695754,
            "total_ms": 19.053105
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.022916,
            "p50_ms": 0.002826,
            "p95_ms": 0.071225,
            "p99_ms": 0.191852,
            "max_ms": 1.266552,
            "total_ms": 859.366746
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.001261,
            "p50_ms": 0.000822,
            "p95_ms": 0.002445,
            "p99_ms": 0.004158,
            "max_ms": 0.505735,
            "total_ms": 47.319141
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.000438,
            "p50_ms": 0.000291,
            "p95_ms": 0.000691,
            "p99_ms": 0.001252,
            "max_ms": 0.437636,
            "total_ms": 16.448913
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.001608,
            "p50_ms": 0.001072,
            "p95_ms": 0.002455,
            "p99_ms": 0.004669,
            "max_ms": 0.690835,
            "total_ms": 60.302092
          },
          "websocket_write": {
            "n": 68603,
            "mean_ms": 0.011208,
            "p50_ms": 0.008226,
            "p95_ms": 0.018696,
            "p99_ms": 0.033694,
            "max_ms": 1.168146,
            "total_ms": 768.935191
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 0.878244,
            "p50_ms": 0.81536,
            "p95_ms": 1.569074,
            "p99_ms": 2.065621,
            "max_ms": 3.774338,
            "total_ms": 32934.167315
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 750000,
          "outbox_enqueues": 106128,
          "outbox_dropped": 0,
          "send_failures": 0,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 1,
          "max_recipients": 20
        },
        "end_to_end_p95_ms": 1.569074,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "requests_processed": 37525,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.007795,
          "max_queue_wait_ms": 1.128271,
          "avg_processing_ms": 0.000722,
          "max_processing_ms": 0.497781
        },
        "connections": {
          "clients": 20,
          "subscriptions": 12500,
          "max_outbox_depth": 0,
          "outbox_capacity": 8,
          "event_batching": true
        }
      },
      "server_log": "/tmp/sim-map-slow-baseline.log"
    },
    {
      "scenario": "paused-short",
      "slow_mode": "paused",
      "ok": true,
      "duration_ms": 2498.362138999999,
      "outbox_capacity": 8,
      "normal_clients": 20,
      "total_moves": 37500,
      "move_rejections": 0,
      "accuracy": {
        "total_moves": 37500,
        "normal_missing": 0,
        "normal_duplicate": 0,
        "normal_wrong": 0,
        "normal_clients_with_events": 20,
        "event_lag": {
          "n": 750000,
          "p50_ms": 0.7909939999999551,
          "p95_ms": 2.0544099999997343,
          "p99_ms": 7.634981000000153,
          "max_ms": 51.764578000000256
        }
      },
      "slow": {
        "events": 25754,
        "unique_events": 25754,
        "revision_gaps": 15,
        "bytes_received": 4087914
      },
      "recovery": {
        "same_connection": true,
        "reconnected": false,
        "status": 1,
        "revision": 1500
      },
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 530704,
        "rss_end_kb": 569576,
        "fds_start": 28,
        "fds_end": 29,
        "cpu_average_percent": 68.04457902489855
      },
      "server_metrics": {
        "started_ns": 223472074952445,
        "uptime_ms": 3968.816394,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.00041,
            "p50_ms": 0.000201,
            "p95_ms": 0.000551,
            "p99_ms": 0.001293,
            "max_ms": 0.759475,
            "total_ms": 15.390149
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.007954,
            "p50_ms": 0.005239,
            "p95_ms": 0.016712,
            "p99_ms": 0.060604,
            "max_ms": 1.442906,
            "total_ms": 298.281644
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.00067,
            "p50_ms": 0.000431,
            "p95_ms": 0.001153,
            "p99_ms": 0.002745,
            "max_ms": 0.491628,
            "total_ms": 25.149374
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 0.000414,
            "p50_ms": 0.000291,
            "p95_ms": 0.000691,
            "p99_ms": 0.001292,
            "max_ms": 0.351514,
            "total_ms": 15.561296
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.022631,
            "p50_ms": 0.009107,
            "p95_ms": 0.070484,
            "p99_ms": 0.192223,
            "max_ms": 1.095088,
            "total_ms": 848.662583
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.001136,
            "p50_ms": 0.000852,
            "p95_ms": 0.001984,
            "p99_ms": 0.004087,
            "max_ms": 0.437226,
            "total_ms": 42.625802
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.000449,
            "p50_ms": 0.000281,
            "p95_ms": 0.000601,
            "p99_ms": 0.001062,
            "max_ms": 0.591417,
            "total_ms": 16.866317
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.001577,
            "p50_ms": 0.001112,
            "p95_ms": 0.002335,
            "p99_ms": 0.004319,
            "max_ms": 0.574996,
            "total_ms": 59.137646
          },
          "websocket_write": {
            "n": 66731,
            "mean_ms": 0.027496,
            "p50_ms": 0.008215,
            "p95_ms": 0.017513,
            "p99_ms": 0.030368,
            "max_ms": 868.37455,
            "total_ms": 1834.881143
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 5.688776,
            "p50_ms": 1.22813,
            "p95_ms": 17.830156,
            "p99_ms": 22.31162,
            "max_ms": 869.432679,
            "total_ms": 213329.110289
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 787500,
          "outbox_enqueues": 104745,
          "outbox_dropped": 11746,
          "send_failures": 0,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 8,
          "max_recipients": 21
        },
        "end_to_end_p95_ms": 17.830156,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "requests_processed": 37525,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.008004,
          "max_queue_wait_ms": 1.443086,
          "avg_processing_ms": 0.000672,
          "max_processing_ms": 0.491628
        },
        "connections": {
          "clients": 21,
          "subscriptions": 13125,
          "max_outbox_depth": 0,
          "outbox_capacity": 8,
          "event_batching": true
        }
      },
      "server_log": "/tmp/sim-map-slow-paused-short.log"
    },
    {
      "scenario": "paused-long",
      "slow_mode": "paused-long",
      "ok": true,
      "duration_ms": 2450.9917650000007,
      "outbox_capacity": 8,
      "normal_clients": 20,
      "total_moves": 37500,
      "move_rejections": 0,
      "accuracy": {
        "total_moves": 37500,
        "normal_missing": 0,
        "normal_duplicate": 0,
        "normal_wrong": 0,
        "normal_clients_with_events": 20,
        "event_lag": {
          "n": 750000,
          "p50_ms": 0.7870460000012827,
          "p95_ms": 2.0480590000006487,
          "p99_ms": 7.63589200000024,
          "max_ms": 54.10196299999916
        }
      },
      "slow": {
        "events": 26401,
        "unique_events": 26401,
        "revision_gaps": 0,
        "bytes_received": 4055114
      },
      "recovery": {
        "same_connection": false,
        "reconnected": true,
        "status": 1,
        "revision": 1500
      },
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 530612,
        "rss_end_kb": 569524,
        "fds_start": 28,
        "fds_end": 30,
        "cpu_average_percent": 68.13568384225066
      },
      "server_metrics": {
        "started_ns": 223477802153425,
        "uptime_ms": 6412.442441,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000338,
            "p50_ms": 0.000191,
            "p95_ms": 0.000501,
            "p99_ms": 0.001222,
            "max_ms": 0.389215,
            "total_ms": 12.69987
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.007555,
            "p50_ms": 0.005139,
            "p95_ms": 0.01625,
            "p99_ms": 0.057539,
            "max_ms": 0.801223,
            "total_ms": 283.318025
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.000641,
            "p50_ms": 0.000391,
            "p95_ms": 0.001102,
            "p99_ms": 0.002605,
            "max_ms": 0.578423,
            "total_ms": 24.071172
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 0.000428,
            "p50_ms": 0.000271,
            "p95_ms": 0.000671,
            "p99_ms": 0.001293,
            "max_ms": 0.386409,
            "total_ms": 16.053216
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.023087,
            "p50_ms": 0.004027,
            "p95_ms": 0.068099,
            "p99_ms": 0.188396,
            "max_ms": 1.562281,
            "total_ms": 865.791609
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.001135,
            "p50_ms": 0.000842,
            "p95_ms": 0.002004,
            "p99_ms": 0.003747,
            "max_ms": 1.046267,
            "total_ms": 42.562588
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.000404,
            "p50_ms": 0.000291,
            "p95_ms": 0.000621,
            "p99_ms": 0.001042,
            "max_ms": 0.311759,
            "total_ms": 15.175604
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.00157,
            "p50_ms": 0.001092,
            "p95_ms": 0.002254,
            "p99_ms": 0.003797,
            "max_ms": 0.728536,
            "total_ms": 58.876754
          },
          "websocket_write": {
            "n": 65981,
            "mean_ms": 0.010231,
            "p50_ms": 0.008326,
            "p95_ms": 0.017583,
            "p99_ms": 0.030307,
            "max_ms": 0.65675,
            "total_ms": 675.063723
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 12.093391,
            "p50_ms": 1.189136,
            "p95_ms": 17.493901,
            "p99_ms": 26.212829,
            "max_ms": 2003.491155,
            "total_ms": 453502.191073
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 787500,
          "outbox_enqueues": 103965,
          "outbox_dropped": 11099,
          "send_failures": 27,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 8,
          "max_recipients": 21
        },
        "end_to_end_p95_ms": 17.493901,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "requests_processed": 37525,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.007619,
          "max_queue_wait_ms": 0.801273,
          "avg_processing_ms": 0.000642,
          "max_processing_ms": 0.578423
        },
        "connections": {
          "clients": 20,
          "subscriptions": 12500,
          "max_outbox_depth": 0,
          "outbox_capacity": 8,
          "event_batching": true
        }
      },
      "server_log": "/tmp/sim-map-slow-paused-long.log"
    },
    {
      "scenario": "slow-read",
      "slow_mode": "slow",
      "ok": true,
      "duration_ms": 2597.682955,
      "outbox_capacity": 8,
      "normal_clients": 20,
      "total_moves": 37500,
      "move_rejections": 0,
      "accuracy": {
        "total_moves": 37500,
        "normal_missing": 0,
        "normal_duplicate": 0,
        "normal_wrong": 0,
        "normal_clients_with_events": 20,
        "event_lag": {
          "n": 750000,
          "p50_ms": 0.7941900000005262,
          "p95_ms": 2.077714000002743,
          "p99_ms": 7.558957000001101,
          "max_ms": 65.80357500000173
        }
      },
      "slow": {
        "events": 25070,
        "unique_events": 25070,
        "revision_gaps": 10,
        "bytes_received": 4165814
      },
      "recovery": {
        "same_connection": true,
        "reconnected": false,
        "status": 1,
        "revision": 1500
      },
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 530836,
        "rss_end_kb": 569732,
        "fds_start": 28,
        "fds_end": 29,
        "cpu_average_percent": 65.827894690097
      },
      "server_metrics": {
        "started_ns": 223488970821445,
        "uptime_ms": 4045.699643,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000389,
            "p50_ms": 0.00022,
            "p95_ms": 0.000581,
            "p99_ms": 0.001303,
            "max_ms": 0.507027,
            "total_ms": 14.614221
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.007263,
            "p50_ms": 0.004839,
            "p95_ms": 0.016311,
            "p99_ms": 0.051928,
            "max_ms": 0.876345,
            "total_ms": 272.380559
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.000676,
            "p50_ms": 0.000391,
            "p95_ms": 0.001192,
            "p99_ms": 0.002715,
            "max_ms": 0.751219,
            "total_ms": 25.367474
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 0.00045,
            "p50_ms": 0.000271,
            "p95_ms": 0.000711,
            "p99_ms": 0.001383,
            "max_ms": 0.623447,
            "total_ms": 16.90128
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.022312,
            "p50_ms": 0.002605,
            "p95_ms": 0.067928,
            "p99_ms": 0.187654,
            "max_ms": 1.17552,
            "total_ms": 836.719949
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.001195,
            "p50_ms": 0.000851,
            "p95_ms": 0.002194,
            "p99_ms": 0.003898,
            "max_ms": 0.591347,
            "total_ms": 44.837277
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.000404,
            "p50_ms": 0.000291,
            "p95_ms": 0.000641,
            "p99_ms": 0.001082,
            "max_ms": 0.241006,
            "total_ms": 15.172812
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.001602,
            "p50_ms": 0.001122,
            "p95_ms": 0.002445,
            "p99_ms": 0.004438,
            "max_ms": 0.735489,
            "total_ms": 60.109613
          },
          "websocket_write": {
            "n": 67548,
            "mean_ms": 0.028441,
            "p50_ms": 0.008035,
            "p95_ms": 0.016721,
            "p99_ms": 0.030177,
            "max_ms": 923.181902,
            "total_ms": 1921.153298
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 5.830569,
            "p50_ms": 1.23371,
            "p95_ms": 17.65727,
            "p99_ms": 21.502973,
            "max_ms": 924.249278,
            "total_ms": 218646.34338
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 787500,
          "outbox_enqueues": 105585,
          "outbox_dropped": 12430,
          "send_failures": 0,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 8,
          "max_recipients": 21
        },
        "end_to_end_p95_ms": 17.65727,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "requests_processed": 37525,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.007318,
          "max_queue_wait_ms": 0.876415,
          "avg_processing_ms": 0.000676,
          "max_processing_ms": 0.751219
        },
        "connections": {
          "clients": 21,
          "subscriptions": 13125,
          "max_outbox_depth": 0,
          "outbox_capacity": 8,
          "event_batching": true
        }
      },
      "server_log": "/tmp/sim-map-slow-slow-read.log"
    }
  ]
};
