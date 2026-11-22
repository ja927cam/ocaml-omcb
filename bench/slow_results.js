window.SLOW_RESULTS = {
  "generated": "2026-11-22T00:29:58.566Z",
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
      "duration_ms": 2500.325902,
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
          "p50_ms": 0.7922560000001795,
          "p95_ms": 2.0979220000001533,
          "p99_ms": 7.0861620000000585,
          "max_ms": 60.82006300000012
        }
      },
      "slow": null,
      "recovery": null,
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 526632,
        "rss_end_kb": 565052,
        "fds_start": 27,
        "fds_end": 28,
        "cpu_average_percent": 67.1912408960838
      },
      "server_metrics": {
        "started_ns": 138254489035243,
        "uptime_ms": 3309.53092,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000392,
            "p50_ms": 0.000191,
            "p95_ms": 0.000551,
            "p99_ms": 0.001282,
            "max_ms": 0.601105,
            "total_ms": 14.701161
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.007459,
            "p50_ms": 0.00532,
            "p95_ms": 0.016952,
            "p99_ms": 0.061516,
            "max_ms": 0.680926,
            "total_ms": 279.723759
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.000636,
            "p50_ms": 0.000421,
            "p95_ms": 0.001233,
            "p99_ms": 0.003236,
            "max_ms": 0.319814,
            "total_ms": 23.863286
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 0.000447,
            "p50_ms": 0.00026,
            "p95_ms": 0.000681,
            "p99_ms": 0.001393,
            "max_ms": 0.718437,
            "total_ms": 16.797771
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.022357,
            "p50_ms": 0.018175,
            "p95_ms": 0.069521,
            "p99_ms": 0.191872,
            "max_ms": 1.308441,
            "total_ms": 838.415205
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.001172,
            "p50_ms": 0.000802,
            "p95_ms": 0.002454,
            "p99_ms": 0.004098,
            "max_ms": 0.638847,
            "total_ms": 43.971688
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.00044,
            "p50_ms": 0.000261,
            "p95_ms": 0.000631,
            "p99_ms": 0.001132,
            "max_ms": 0.598059,
            "total_ms": 16.504709
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.001312,
            "p50_ms": 0.000922,
            "p95_ms": 0.002164,
            "p99_ms": 0.003957,
            "max_ms": 0.622666,
            "total_ms": 49.223691
          },
          "websocket_write": {
            "n": 66019,
            "mean_ms": 0.010595,
            "p50_ms": 0.008125,
            "p95_ms": 0.018595,
            "p99_ms": 0.031519,
            "max_ms": 0.959221,
            "total_ms": 699.507802
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 0.888526,
            "p50_ms": 0.844284,
            "p95_ms": 1.624077,
            "p99_ms": 2.120544,
            "max_ms": 3.063826,
            "total_ms": 33319.733173
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 750000,
          "outbox_enqueues": 103544,
          "outbox_dropped": 0,
          "send_failures": 0,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 1,
          "max_recipients": 20
        },
        "end_to_end_p95_ms": 1.624077,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "requests_processed": 37525,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.007519,
          "max_queue_wait_ms": 0.680966,
          "avg_processing_ms": 0.000636,
          "max_processing_ms": 0.319814
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
      "duration_ms": 2266.078968,
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
          "p50_ms": 0.779591999999866,
          "p95_ms": 1.9790069999999105,
          "p99_ms": 7.311566999999741,
          "max_ms": 53.89632799999981
        }
      },
      "slow": {
        "events": 28365,
        "unique_events": 28365,
        "revision_gaps": 10,
        "bytes_received": 4092014
      },
      "recovery": {
        "same_connection": true,
        "reconnected": false,
        "status": 1,
        "revision": 1500
      },
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 526840,
        "rss_end_kb": 565920,
        "fds_start": 28,
        "fds_end": 29,
        "cpu_average_percent": 70.1652511873099
      },
      "server_metrics": {
        "started_ns": 138259384270631,
        "uptime_ms": 3735.874969,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000322,
            "p50_ms": 0.00019,
            "p95_ms": 0.000431,
            "p99_ms": 0.001052,
            "max_ms": 0.712856,
            "total_ms": 12.108514
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.008028,
            "p50_ms": 0.00539,
            "p95_ms": 0.016201,
            "p99_ms": 0.10606,
            "max_ms": 0.720461,
            "total_ms": 301.081792
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.000634,
            "p50_ms": 0.000401,
            "p95_ms": 0.001022,
            "p99_ms": 0.002414,
            "max_ms": 0.809939,
            "total_ms": 23.789744
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 0.000411,
            "p50_ms": 0.00026,
            "p95_ms": 0.000571,
            "p99_ms": 0.001122,
            "max_ms": 0.505765,
            "total_ms": 15.416577
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.023566,
            "p50_ms": 0.018936,
            "p95_ms": 0.068891,
            "p99_ms": 0.192634,
            "max_ms": 1.119785,
            "total_ms": 883.758554
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.001101,
            "p50_ms": 0.000822,
            "p95_ms": 0.001763,
            "p99_ms": 0.003537,
            "max_ms": 0.447895,
            "total_ms": 41.301871
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.00038,
            "p50_ms": 0.00027,
            "p95_ms": 0.000501,
            "p99_ms": 0.000942,
            "max_ms": 0.587519,
            "total_ms": 14.275614
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.001428,
            "p50_ms": 0.001002,
            "p95_ms": 0.001904,
            "p99_ms": 0.003226,
            "max_ms": 0.564877,
            "total_ms": 53.58741
          },
          "websocket_write": {
            "n": 63711,
            "mean_ms": 0.024052,
            "p50_ms": 0.007975,
            "p95_ms": 0.014727,
            "p99_ms": 0.027292,
            "max_ms": 626.587867,
            "total_ms": 1532.414352
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 4.778274,
            "p50_ms": 1.118181,
            "p95_ms": 17.461624,
            "p99_ms": 21.384352,
            "max_ms": 627.804575,
            "total_ms": 179185.284634
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 787500,
          "outbox_enqueues": 101565,
          "outbox_dropped": 9135,
          "send_failures": 0,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 8,
          "max_recipients": 21
        },
        "end_to_end_p95_ms": 17.461624,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "requests_processed": 37525,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.008076,
          "max_queue_wait_ms": 0.720501,
          "avg_processing_ms": 0.000634,
          "max_processing_ms": 0.809939
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
      "duration_ms": 2240.603698000001,
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
          "p50_ms": 0.7990190000000439,
          "p95_ms": 2.0252939999991213,
          "p99_ms": 6.970602999999755,
          "max_ms": 53.69521799999893
        }
      },
      "slow": {
        "events": 28375,
        "unique_events": 28375,
        "revision_gaps": 0,
        "bytes_received": 4087914
      },
      "recovery": {
        "same_connection": false,
        "reconnected": true,
        "status": 1,
        "revision": 1500
      },
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 526692,
        "rss_end_kb": 565060,
        "fds_start": 28,
        "fds_end": 30,
        "cpu_average_percent": 70.07040117810249
      },
      "server_metrics": {
        "started_ns": 138264766471050,
        "uptime_ms": 6198.75831,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000385,
            "p50_ms": 0.000181,
            "p95_ms": 0.000421,
            "p99_ms": 0.000942,
            "max_ms": 0.621443,
            "total_ms": 14.461628
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.008321,
            "p50_ms": 0.00541,
            "p95_ms": 0.01579,
            "p99_ms": 0.117311,
            "max_ms": 0.783199,
            "total_ms": 312.040477
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.000629,
            "p50_ms": 0.0004,
            "p95_ms": 0.000972,
            "p99_ms": 0.002305,
            "max_ms": 0.586708,
            "total_ms": 23.596162
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 0.000425,
            "p50_ms": 0.000251,
            "p95_ms": 0.000541,
            "p99_ms": 0.001092,
            "max_ms": 0.454449,
            "total_ms": 15.962664
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.023763,
            "p50_ms": 0.018926,
            "p95_ms": 0.06852,
            "p99_ms": 0.174961,
            "max_ms": 1.144231,
            "total_ms": 891.123388
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.001087,
            "p50_ms": 0.000841,
            "p95_ms": 0.001693,
            "p99_ms": 0.003516,
            "max_ms": 0.735479,
            "total_ms": 40.785398
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.000371,
            "p50_ms": 0.000261,
            "p95_ms": 0.000461,
            "p99_ms": 0.000841,
            "max_ms": 0.424813,
            "total_ms": 13.929558
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.001272,
            "p50_ms": 0.000932,
            "p95_ms": 0.001754,
            "p99_ms": 0.002895,
            "max_ms": 0.38654,
            "total_ms": 47.700057
          },
          "websocket_write": {
            "n": 63633,
            "mean_ms": 0.009808,
            "p50_ms": 0.007955,
            "p95_ms": 0.015229,
            "p99_ms": 0.027332,
            "max_ms": 0.766407,
            "total_ms": 624.151834
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 11.047498,
            "p50_ms": 1.110908,
            "p95_ms": 17.495468,
            "p99_ms": 22.021566,
            "max_ms": 2003.865244,
            "total_ms": 414281.211252
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 787500,
          "outbox_enqueues": 101485,
          "outbox_dropped": 9125,
          "send_failures": 31,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 8,
          "max_recipients": 21
        },
        "end_to_end_p95_ms": 17.495468,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "requests_processed": 37525,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.008383,
          "max_queue_wait_ms": 0.78337,
          "avg_processing_ms": 0.000629,
          "max_processing_ms": 0.586708
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
      "duration_ms": 2363.7926259999986,
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
          "p50_ms": 0.8006419999983336,
          "p95_ms": 2.0799779999979364,
          "p99_ms": 6.523639999999432,
          "max_ms": 59.426140999999916
        }
      },
      "slow": {
        "events": 28693,
        "unique_events": 28693,
        "revision_gaps": 15,
        "bytes_received": 4169914
      },
      "recovery": {
        "same_connection": true,
        "reconnected": false,
        "status": 1,
        "revision": 1500
      },
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 526844,
        "rss_end_kb": 565168,
        "fds_start": 28,
        "fds_end": 29,
        "cpu_average_percent": 69.80307755643202
      },
      "server_metrics": {
        "started_ns": 138275608299070,
        "uptime_ms": 3807.537236,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000378,
            "p50_ms": 0.000191,
            "p95_ms": 0.000511,
            "p99_ms": 0.001262,
            "max_ms": 0.506125,
            "total_ms": 14.180197
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.008482,
            "p50_ms": 0.00541,
            "p95_ms": 0.016741,
            "p99_ms": 0.110939,
            "max_ms": 0.565868,
            "total_ms": 318.080711
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.000676,
            "p50_ms": 0.000401,
            "p95_ms": 0.001122,
            "p99_ms": 0.002966,
            "max_ms": 0.532024,
            "total_ms": 25.384988
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 0.000457,
            "p50_ms": 0.00027,
            "p95_ms": 0.000651,
            "p99_ms": 0.001282,
            "max_ms": 0.517878,
            "total_ms": 17.162886
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.024241,
            "p50_ms": 0.019076,
            "p95_ms": 0.070363,
            "p99_ms": 0.180702,
            "max_ms": 1.059821,
            "total_ms": 909.06144
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.001178,
            "p50_ms": 0.000832,
            "p95_ms": 0.002545,
            "p99_ms": 0.004368,
            "max_ms": 0.521114,
            "total_ms": 44.201416
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.000343,
            "p50_ms": 0.00027,
            "p95_ms": 0.000561,
            "p99_ms": 0.001032,
            "max_ms": 0.220266,
            "total_ms": 12.89139
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.001412,
            "p50_ms": 0.000962,
            "p95_ms": 0.002084,
            "p99_ms": 0.004088,
            "max_ms": 0.539529,
            "total_ms": 52.969865
          },
          "websocket_write": {
            "n": 64946,
            "mean_ms": 0.025909,
            "p50_ms": 0.008175,
            "p95_ms": 0.019016,
            "p99_ms": 0.038553,
            "max_ms": 704.943361,
            "total_ms": 1682.732676
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 4.848298,
            "p50_ms": 1.107542,
            "p95_ms": 16.614184,
            "p99_ms": 23.080986,
            "max_ms": 706.051194,
            "total_ms": 181811.187731
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 787500,
          "outbox_enqueues": 102845,
          "outbox_dropped": 8807,
          "send_failures": 0,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 8,
          "max_recipients": 21
        },
        "end_to_end_p95_ms": 16.614184,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "requests_processed": 37525,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.008542,
          "max_queue_wait_ms": 0.565929,
          "avg_processing_ms": 0.000676,
          "max_processing_ms": 0.532024
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
