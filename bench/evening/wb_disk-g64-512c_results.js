window.WRITE_BURST_RESULTS = window.WRITE_BURST_RESULTS || {};
window.WRITE_BURST_RESULTS["disk-g64-512c"] = {
  "generated": "2026-11-26T23:59:56.174Z",
  "label": "disk-g64-512c",
  "clients": 512,
  "rounds": 10,
  "board_base": {
    "x": 100,
    "y": 100
  },
  "moves": 5120,
  "duration_ms": 500.64589200000006,
  "moves_per_second": 10226.789197343498,
  "move_rtt": {
    "n": 5120,
    "p50_ms": 26.18905499999994,
    "p95_ms": 96.203915,
    "p99_ms": 107.20464900000002,
    "max_ms": 109.88424399999997
  },
  "accepted": 5120,
  "rejected": 0,
  "duplicate_sequences": 0,
  "snapshot_errors": 0,
  "server": {
    "cpu_seconds": 0.27,
    "fds_before": 519,
    "fds_after": 519,
    "rss_kb": 148909
  },
  "persistence": {
    "data_dir": "/home/james/Work/ocaml-omcb/bench/evening/wbdata-SguXqe",
    "sequence": "5120",
    "wal_segments": 1,
    "wal_bytes": "430096",
    "snapshots": 0,
    "last_snapshot_sequence": null,
    "snapshot_pending": false,
    "snapshot_write_ms": 0,
    "commits_since_snapshot": 5120,
    "sync": true,
    "group_size": 64,
    "sync_count": 90,
    "group_count": 90,
    "batched_moves": 5120,
    "last_group_size": 63,
    "average_group_size": 56.888888888888886,
    "last_sync_ms": 1.588134765625,
    "fsync_p50_us": 1632.080078125,
    "fsync_p95_us": 2053.955078125,
    "snapshot_active": false,
    "snapshot_writing": false,
    "snapshot_buffer": false,
    "snapshot_copy_live": 0,
    "snapshot_copy_live_bytes": 0,
    "dirty": false,
    "truncated_wal": false
  }
};
