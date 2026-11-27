window.SLOW_RESULTS = {
  "generated": "2026-11-27T00:11:48.042Z",
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
      "duration_ms": 22155.855616999997,
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
          "p50_ms": 3.9949689999994007,
          "p95_ms": 6.345941000000039,
          "p99_ms": 8.75606499999958,
          "max_ms": 70.20230900000024
        }
      },
      "slow": null,
      "recovery": null,
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 548064,
        "rss_end_kb": 585992,
        "fds_start": 28,
        "fds_end": 29,
        "cpu_average_percent": 32.00056961266666
      },
      "server_metrics": {
        "started_ns": 10232918666009,
        "uptime_ms": 22877.418251,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000611,
            "p50_ms": 0.000261,
            "p95_ms": 0.001182,
            "p99_ms": 0.001944,
            "max_ms": 0.284939,
            "total_ms": 22.947262
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.046987,
            "p50_ms": 0.029906,
            "p95_ms": 0.053912,
            "p99_ms": 0.189528,
            "max_ms": 3.526644,
            "total_ms": 1762.027142
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.010094,
            "p50_ms": 0.006853,
            "p95_ms": 0.019406,
            "p99_ms": 0.033794,
            "max_ms": 0.294998,
            "total_ms": 378.561026
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 1.619386,
            "p50_ms": 1.58781,
            "p95_ms": 1.819117,
            "p99_ms": 2.063349,
            "max_ms": 65.033573,
            "total_ms": 60726.995435
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.077834,
            "p50_ms": 0.069632,
            "p95_ms": 0.162327,
            "p99_ms": 0.378405,
            "max_ms": 1.387662,
            "total_ms": 2918.778952
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.002029,
            "p50_ms": 0.001723,
            "p95_ms": 0.003186,
            "p99_ms": 0.005711,
            "max_ms": 0.347146,
            "total_ms": 76.106161
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.000797,
            "p50_ms": 0.000471,
            "p95_ms": 0.001443,
            "p99_ms": 0.002554,
            "max_ms": 0.495737,
            "total_ms": 29.895493
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.002543,
            "p50_ms": 0.001613,
            "p95_ms": 0.00487,
            "p99_ms": 0.01079,
            "max_ms": 0.613308,
            "total_ms": 95.377006
          },
          "websocket_write": {
            "n": 140879,
            "mean_ms": 0.013994,
            "p50_ms": 0.01039,
            "p95_ms": 0.03206,
            "p99_ms": 0.045506,
            "max_ms": 0.708839,
            "total_ms": 1971.462576
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 3.014096,
            "p50_ms": 2.6726,
            "p95_ms": 4.456481,
            "p99_ms": 5.174958,
            "max_ms": 67.633084,
            "total_ms": 113028.603856
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 750000,
          "outbox_enqueues": 178404,
          "outbox_dropped": 0,
          "send_failures": 0,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 1,
          "max_recipients": 20
        },
        "end_to_end_p95_ms": 4.456481,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "move_queue_depth": 0,
          "requests_processed": 37525,
          "moves_processed": 37500,
          "moves_submitted": 37500,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.047049,
          "max_queue_wait_ms": 3.526974,
          "avg_processing_ms": 0.010088,
          "max_processing_ms": 0.294998
        },
        "connections": {
          "clients": 20,
          "subscriptions": 12500,
          "max_outbox_depth": 0,
          "total_outbox_depth": 0,
          "pending_event_count": 0,
          "outbox_capacity": 8,
          "event_batching": true
        },
        "persistence": {
          "data_dir": "data",
          "sequence": "38100",
          "wal_segments": 7,
          "wal_bytes": "3200512",
          "snapshots": 0,
          "last_snapshot_sequence": null,
          "snapshot_pending": false,
          "snapshot_write_ms": 0,
          "commits_since_snapshot": 37500,
          "sync": true,
          "group_size": 64,
          "sync_count": 10832,
          "group_count": 10832,
          "batched_moves": 37500,
          "last_group_size": 1,
          "average_group_size": 3.4619645494830134,
          "last_sync_ms": 1.576171875,
          "fsync_p50_us": 1564.94140625,
          "fsync_p95_us": 1786.865234375,
          "snapshot_active": false,
          "snapshot_writing": false,
          "snapshot_buffer": false,
          "snapshot_copy_live": 0,
          "snapshot_copy_live_bytes": 0,
          "dirty": false,
          "truncated_wal": false
        },
        "memory": {
          "rss_kb": 585732,
          "smaps_rollup_kb": {
            "Rss": 585732,
            "Pss": 576659,
            "Shared_Clean": 11688,
            "Shared_Dirty": 0,
            "Private_Clean": 12,
            "Private_Dirty": 574032,
            "Anonymous": 574032,
            "Swap": 0,
            "Locked": 0
          },
          "gc": {
            "heap_words": 4819487,
            "live_words": 4718316,
            "free_words": 95999,
            "top_heap_words": 5319943,
            "major_words": 99633941,
            "minor_words": 417966749,
            "promoted_words": 7622615,
            "compactions": 0,
            "major_collections": 101,
            "minor_collections": 1643
          },
          "snapshot_copy_live": 0,
          "snapshot_copy_live_bytes": 0
        },
        "adaptive": {
          "enabled": true,
          "max_batch_size": 64,
          "max_batch_delay_us": 0,
          "classification": "heavy",
          "samples": 220,
          "changes": 3,
          "move_rate": 1555.656961918431,
          "pending_moves": 0,
          "fsync_p50_us": 1555.3991699541846,
          "fsync_p95_us": 1883.2210408145966,
          "broadcast_backlog": 0,
          "event_lag_p95_ms": 4.521907096880035,
          "recipients_per_event": 19.999999999999996,
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
      "server_log": "/tmp/sim-map-slow-baseline.log"
    },
    {
      "scenario": "paused-short",
      "slow_mode": "paused",
      "ok": true,
      "duration_ms": 22228.23561,
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
          "p50_ms": 3.997031999999308,
          "p95_ms": 6.3761779999986175,
          "p99_ms": 9.601692000003823,
          "max_ms": 64.85100699999748
        }
      },
      "slow": {
        "events": 6903,
        "unique_events": 6903,
        "revision_gaps": 0,
        "bytes_received": 4087918
      },
      "recovery": {
        "same_connection": false,
        "reconnected": true,
        "status": 1,
        "revision": 1500
      },
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 564592,
        "rss_end_kb": 593392,
        "fds_start": 29,
        "fds_end": 30,
        "cpu_average_percent": 32.30125920012236
      },
      "server_metrics": {
        "started_ns": 10257417199998,
        "uptime_ms": 23811.952949,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000619,
            "p50_ms": 0.000261,
            "p95_ms": 0.001222,
            "p99_ms": 0.001874,
            "max_ms": 0.272795,
            "total_ms": 23.218984
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.051282,
            "p50_ms": 0.030177,
            "p95_ms": 0.053802,
            "p99_ms": 0.197323,
            "max_ms": 1.5403,
            "total_ms": 1923.099294
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.010101,
            "p50_ms": 0.006923,
            "p95_ms": 0.019527,
            "p99_ms": 0.032372,
            "max_ms": 0.972628,
            "total_ms": 378.800876
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 1.626737,
            "p50_ms": 1.588802,
            "p95_ms": 1.806523,
            "p99_ms": 2.023684,
            "max_ms": 59.927754,
            "total_ms": 61002.657759
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.078111,
            "p50_ms": 0.069091,
            "p95_ms": 0.161896,
            "p99_ms": 0.374097,
            "max_ms": 2.198054,
            "total_ms": 2929.190767
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.001943,
            "p50_ms": 0.001683,
            "p95_ms": 0.002885,
            "p99_ms": 0.004749,
            "max_ms": 0.268216,
            "total_ms": 72.887312
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.000767,
            "p50_ms": 0.000481,
            "p95_ms": 0.001433,
            "p99_ms": 0.002504,
            "max_ms": 0.278457,
            "total_ms": 28.782354
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.00253,
            "p50_ms": 0.001603,
            "p95_ms": 0.005009,
            "p99_ms": 0.009057,
            "max_ms": 0.329954,
            "total_ms": 94.896583
          },
          "websocket_write": {
            "n": 141040,
            "mean_ms": 0.015032,
            "p50_ms": 0.011361,
            "p95_ms": 0.032281,
            "p99_ms": 0.047219,
            "max_ms": 1.050114,
            "total_ms": 2120.244997
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 6.355072,
            "p50_ms": 3.55118,
            "p95_ms": 35.393267,
            "p99_ms": 38.699893,
            "max_ms": 2005.23541,
            "total_ms": 238315.206428
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 760297,
          "outbox_enqueues": 179052,
          "outbox_dropped": 3387,
          "send_failures": 7,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 8,
          "max_recipients": 21
        },
        "end_to_end_p95_ms": 35.393267,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "move_queue_depth": 0,
          "requests_processed": 37525,
          "moves_processed": 37500,
          "moves_submitted": 37500,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.051356,
          "max_queue_wait_ms": 1.54036,
          "avg_processing_ms": 0.010095,
          "max_processing_ms": 0.972628
        },
        "connections": {
          "clients": 20,
          "subscriptions": 12500,
          "max_outbox_depth": 0,
          "total_outbox_depth": 0,
          "pending_event_count": 0,
          "outbox_capacity": 8,
          "event_batching": true
        },
        "persistence": {
          "data_dir": "data",
          "sequence": "75600",
          "wal_segments": 8,
          "wal_bytes": "6350528",
          "snapshots": 0,
          "last_snapshot_sequence": null,
          "snapshot_pending": false,
          "snapshot_write_ms": 0,
          "commits_since_snapshot": 37500,
          "sync": true,
          "group_size": 64,
          "sync_count": 10746,
          "group_count": 10746,
          "batched_moves": 37500,
          "last_group_size": 1,
          "average_group_size": 3.4896705750977106,
          "last_sync_ms": 1.532958984375,
          "fsync_p50_us": 1616.943359375,
          "fsync_p95_us": 1836.181640625,
          "snapshot_active": false,
          "snapshot_writing": false,
          "snapshot_buffer": false,
          "snapshot_copy_live": 0,
          "snapshot_copy_live_bytes": 0,
          "dirty": false,
          "truncated_wal": false
        },
        "memory": {
          "rss_kb": 593392,
          "smaps_rollup_kb": {
            "Rss": 593392,
            "Pss": 584399,
            "Shared_Clean": 11508,
            "Shared_Dirty": 0,
            "Private_Clean": 4,
            "Private_Dirty": 581880,
            "Anonymous": 581880,
            "Swap": 0,
            "Locked": 0
          },
          "gc": {
            "heap_words": 4891663,
            "live_words": 4729977,
            "free_words": 157029,
            "top_heap_words": 6306887,
            "major_words": 102350403,
            "minor_words": 426624407,
            "promoted_words": 9944646,
            "compactions": 0,
            "major_collections": 99,
            "minor_collections": 1674
          },
          "snapshot_copy_live": 0,
          "snapshot_copy_live_bytes": 0
        },
        "adaptive": {
          "enabled": true,
          "max_batch_size": 16,
          "max_batch_delay_us": 250,
          "classification": "moderate",
          "samples": 228,
          "changes": 5,
          "move_rate": 85.47120998054831,
          "pending_moves": 0,
          "fsync_p50_us": 1617.354914415323,
          "fsync_p95_us": 1836.107562006235,
          "broadcast_backlog": 1.080672040645764e-30,
          "event_lag_p95_ms": 4.405002954335084,
          "recipients_per_event": 1.5083778125000007,
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
      "server_log": "/tmp/sim-map-slow-paused-short.log"
    },
    {
      "scenario": "paused-long",
      "slow_mode": "paused-long",
      "ok": true,
      "duration_ms": 22002.752101000005,
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
          "p50_ms": 4.013205999995989,
          "p95_ms": 6.384534999997413,
          "p99_ms": 9.376304999997956,
          "max_ms": 91.81389299999864
        }
      },
      "slow": {
        "events": 7247,
        "unique_events": 7247,
        "revision_gaps": 0,
        "bytes_received": 4075618
      },
      "recovery": {
        "same_connection": false,
        "reconnected": true,
        "status": 1,
        "revision": 1500
      },
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 579284,
        "rss_end_kb": 608156,
        "fds_start": 29,
        "fds_end": 30,
        "cpu_average_percent": 32.63228148479514
      },
      "server_metrics": {
        "started_ns": 10285897857792,
        "uptime_ms": 26173.493534,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000563,
            "p50_ms": 0.00026,
            "p95_ms": 0.001193,
            "p99_ms": 0.001984,
            "max_ms": 0.23427,
            "total_ms": 21.131021
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.051705,
            "p50_ms": 0.030407,
            "p95_ms": 0.054442,
            "p99_ms": 0.194485,
            "max_ms": 2.480457,
            "total_ms": 1938.967163
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.010003,
            "p50_ms": 0.006913,
            "p95_ms": 0.019196,
            "p99_ms": 0.033393,
            "max_ms": 0.344977,
            "total_ms": 375.135761
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 1.659592,
            "p50_ms": 1.606794,
            "p95_ms": 1.836324,
            "p99_ms": 2.075813,
            "max_ms": 83.027035,
            "total_ms": 62234.710247
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.081094,
            "p50_ms": 0.071614,
            "p95_ms": 0.169178,
            "p99_ms": 0.388549,
            "max_ms": 2.168768,
            "total_ms": 3041.03162
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.002068,
            "p50_ms": 0.001754,
            "p95_ms": 0.003236,
            "p99_ms": 0.005641,
            "max_ms": 0.28247,
            "total_ms": 77.580909
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.000822,
            "p50_ms": 0.000531,
            "p95_ms": 0.001453,
            "p99_ms": 0.002595,
            "max_ms": 0.613281,
            "total_ms": 30.844285
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.00243,
            "p50_ms": 0.001573,
            "p95_ms": 0.00499,
            "p99_ms": 0.009728,
            "max_ms": 0.240451,
            "total_ms": 91.141653
          },
          "websocket_write": {
            "n": 138396,
            "mean_ms": 0.014553,
            "p50_ms": 0.010731,
            "p95_ms": 0.032852,
            "p99_ms": 0.048942,
            "max_ms": 1.433639,
            "total_ms": 2014.167608
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 6.475215,
            "p50_ms": 3.612184,
            "p95_ms": 35.139023,
            "p99_ms": 39.668478,
            "max_ms": 2005.381085,
            "total_ms": 242820.575531
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 760730,
          "outbox_enqueues": 176410,
          "outbox_dropped": 3476,
          "send_failures": 7,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 8,
          "max_recipients": 21
        },
        "end_to_end_p95_ms": 35.139023,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "move_queue_depth": 0,
          "requests_processed": 37525,
          "moves_processed": 37500,
          "moves_submitted": 37500,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.05176,
          "max_queue_wait_ms": 2.480677,
          "avg_processing_ms": 0.009998,
          "max_processing_ms": 0.344977
        },
        "connections": {
          "clients": 20,
          "subscriptions": 12500,
          "max_outbox_depth": 0,
          "total_outbox_depth": 0,
          "pending_event_count": 0,
          "outbox_capacity": 8,
          "event_batching": true
        },
        "persistence": {
          "data_dir": "data",
          "sequence": "113100",
          "wal_segments": 9,
          "wal_bytes": "9500544",
          "snapshots": 0,
          "last_snapshot_sequence": null,
          "snapshot_pending": false,
          "snapshot_write_ms": 0,
          "commits_since_snapshot": 37500,
          "sync": true,
          "group_size": 64,
          "sync_count": 10463,
          "group_count": 10463,
          "batched_moves": 37500,
          "last_group_size": 1,
          "average_group_size": 3.584058109528816,
          "last_sync_ms": 1.590087890625,
          "fsync_p50_us": 1631.8359375,
          "fsync_p95_us": 1875.9765625,
          "snapshot_active": false,
          "snapshot_writing": false,
          "snapshot_buffer": false,
          "snapshot_copy_live": 0,
          "snapshot_copy_live_bytes": 0,
          "dirty": false,
          "truncated_wal": false
        },
        "memory": {
          "rss_kb": 607376,
          "smaps_rollup_kb": {
            "Rss": 607376,
            "Pss": 598375,
            "Shared_Clean": 11540,
            "Shared_Dirty": 0,
            "Private_Clean": 0,
            "Private_Dirty": 595836,
            "Anonymous": 595836,
            "Swap": 0,
            "Locked": 0
          },
          "gc": {
            "heap_words": 4997445,
            "live_words": 4856884,
            "free_words": 135435,
            "top_heap_words": 8099483,
            "major_words": 103128017,
            "minor_words": 433938792,
            "promoted_words": 12080248,
            "compactions": 0,
            "major_collections": 100,
            "minor_collections": 1701
          },
          "snapshot_copy_live": 0,
          "snapshot_copy_live_bytes": 0
        },
        "adaptive": {
          "enabled": true,
          "max_batch_size": 16,
          "max_batch_delay_us": 0,
          "classification": "quiet",
          "samples": 250,
          "changes": 7,
          "move_rate": 0.0017172630707470173,
          "pending_moves": 0,
          "fsync_p50_us": 1631.8359327368034,
          "fsync_p95_us": 1875.9765670070435,
          "broadcast_backlog": 8.275174544795619e-35,
          "event_lag_p95_ms": 4.899630722705333,
          "recipients_per_event": 0.000031720794148230305,
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
      "server_log": "/tmp/sim-map-slow-paused-long.log"
    },
    {
      "scenario": "slow-read",
      "slow_mode": "slow",
      "ok": true,
      "duration_ms": 21873.305341,
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
          "p50_ms": 3.9708409999875585,
          "p95_ms": 6.333483999987948,
          "p99_ms": 9.19720700000471,
          "max_ms": 172.92583099998592
        }
      },
      "slow": {
        "events": 7965,
        "unique_events": 7965,
        "revision_gaps": 0,
        "bytes_received": 4534818
      },
      "recovery": {
        "same_connection": false,
        "reconnected": true,
        "status": 1,
        "revision": 1500
      },
      "expected_revision": 1500,
      "resources": {
        "rss_start_kb": 581784,
        "rss_end_kb": 610080,
        "fds_start": 29,
        "fds_end": 30,
        "cpu_average_percent": 32.00247923608959
      },
      "server_metrics": {
        "started_ns": 10316651820690,
        "uptime_ms": 23637.106874,
        "stages": {
          "receive_to_submit": {
            "n": 37500,
            "mean_ms": 0.000585,
            "p50_ms": 0.00027,
            "p95_ms": 0.001192,
            "p99_ms": 0.001883,
            "max_ms": 0.233368,
            "total_ms": 21.939668
          },
          "worker_queue_wait": {
            "n": 37500,
            "mean_ms": 0.047944,
            "p50_ms": 0.030477,
            "p95_ms": 0.055655,
            "p99_ms": 0.185198,
            "max_ms": 2.761541,
            "total_ms": 1797.913756
          },
          "move_processing": {
            "n": 37500,
            "mean_ms": 0.010036,
            "p50_ms": 0.006943,
            "p95_ms": 0.019466,
            "p99_ms": 0.032681,
            "max_ms": 0.281508,
            "total_ms": 376.38359
          },
          "commit_to_broadcast": {
            "n": 37500,
            "mean_ms": 1.645349,
            "p50_ms": 1.589122,
            "p95_ms": 1.818071,
            "p99_ms": 2.042913,
            "max_ms": 87.807002,
            "total_ms": 61700.610305
          },
          "broadcast_wait": {
            "n": 37500,
            "mean_ms": 0.081251,
            "p50_ms": 0.070943,
            "p95_ms": 0.169999,
            "p99_ms": 0.523262,
            "max_ms": 2.837143,
            "total_ms": 3046.913021
          },
          "broadcast_dispatch": {
            "n": 37500,
            "mean_ms": 0.002068,
            "p50_ms": 0.001764,
            "p95_ms": 0.003216,
            "p99_ms": 0.0057,
            "max_ms": 0.476945,
            "total_ms": 77.558629
          },
          "encoding": {
            "n": 37500,
            "mean_ms": 0.00079,
            "p50_ms": 0.000481,
            "p95_ms": 0.001433,
            "p99_ms": 0.002555,
            "max_ms": 0.644298,
            "total_ms": 29.62918
          },
          "outbox_enqueue": {
            "n": 37500,
            "mean_ms": 0.002577,
            "p50_ms": 0.001593,
            "p95_ms": 0.005039,
            "p99_ms": 0.010058,
            "max_ms": 0.329749,
            "total_ms": 96.659393
          },
          "websocket_write": {
            "n": 139116,
            "mean_ms": 0.014072,
            "p50_ms": 0.010339,
            "p95_ms": 0.031499,
            "p99_ms": 0.044563,
            "max_ms": 0.658315,
            "total_ms": 1957.667882
          },
          "end_to_end_broadcast": {
            "n": 37500,
            "mean_ms": 6.505438,
            "p50_ms": 3.54967,
            "p95_ms": 34.900309,
            "p99_ms": 37.380402,
            "max_ms": 2004.296386,
            "total_ms": 243953.946594
          }
        },
        "counters": {
          "events_broadcast": 37500,
          "recipients": 761552,
          "outbox_enqueues": 177140,
          "outbox_dropped": 3579,
          "send_failures": 8,
          "outbox_full_unregisters": 0,
          "events_without_recipients": 0,
          "max_outbox_depth": 8,
          "max_recipients": 21
        },
        "end_to_end_p95_ms": 34.900309,
        "worker": {
          "queue_depth": 0,
          "queue_capacity": 4096,
          "move_queue_depth": 0,
          "requests_processed": 37525,
          "moves_processed": 37500,
          "moves_submitted": 37500,
          "requests_rejected": 0,
          "avg_queue_wait_ms": 0.048005,
          "max_queue_wait_ms": 2.761751,
          "avg_processing_ms": 0.01003,
          "max_processing_ms": 0.281508
        },
        "connections": {
          "clients": 20,
          "subscriptions": 12500,
          "max_outbox_depth": 0,
          "total_outbox_depth": 0,
          "pending_event_count": 0,
          "outbox_capacity": 8,
          "event_batching": true
        },
        "persistence": {
          "data_dir": "data",
          "sequence": "150600",
          "wal_segments": 10,
          "wal_bytes": "12650560",
          "snapshots": 0,
          "last_snapshot_sequence": null,
          "snapshot_pending": false,
          "snapshot_write_ms": 0,
          "commits_since_snapshot": 37500,
          "sync": true,
          "group_size": 64,
          "sync_count": 10515,
          "group_count": 10515,
          "batched_moves": 37500,
          "last_group_size": 1,
          "average_group_size": 3.566333808844508,
          "last_sync_ms": 1.5849609375,
          "fsync_p50_us": 1531.005859375,
          "fsync_p95_us": 1720.947265625,
          "snapshot_active": false,
          "snapshot_writing": false,
          "snapshot_buffer": false,
          "snapshot_copy_live": 0,
          "snapshot_copy_live_bytes": 0,
          "dirty": false,
          "truncated_wal": false
        },
        "memory": {
          "rss_kb": 610080,
          "smaps_rollup_kb": {
            "Rss": 610080,
            "Pss": 600867,
            "Shared_Clean": 11848,
            "Shared_Dirty": 0,
            "Private_Clean": 16,
            "Private_Dirty": 598216,
            "Anonymous": 598216,
            "Swap": 0,
            "Locked": 0
          },
          "gc": {
            "heap_words": 5201490,
            "live_words": 5011760,
            "free_words": 185274,
            "top_heap_words": 8360595,
            "major_words": 105650115,
            "minor_words": 442535087,
            "promoted_words": 14270575,
            "compactions": 0,
            "major_collections": 101,
            "minor_collections": 1733
          },
          "snapshot_copy_live": 0,
          "snapshot_copy_live_bytes": 0
        },
        "adaptive": {
          "enabled": true,
          "max_batch_size": 16,
          "max_batch_delay_us": 250,
          "classification": "moderate",
          "samples": 223,
          "changes": 4,
          "move_rate": 94.64542336590634,
          "pending_moves": 0,
          "fsync_p50_us": 1531.0276069903334,
          "fsync_p95_us": 1720.852273907728,
          "broadcast_backlog": 5.217444134476948e-29,
          "event_lag_p95_ms": 4.605793967742796,
          "recipients_per_event": 1.5083778125000007,
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
      "server_log": "/tmp/sim-map-slow-slow-read.log"
    }
  ]
};
