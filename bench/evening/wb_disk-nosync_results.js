window.WRITE_BURST_RESULTS = window.WRITE_BURST_RESULTS || {};
window.WRITE_BURST_RESULTS["disk-nosync"] = {
  "generated": "2026-11-26T23:59:49.580Z",
  "label": "disk-nosync",
  "clients": 256,
  "rounds": 20,
  "board_base": {
    "x": 100,
    "y": 100
  },
  "moves": 5120,
  "duration_ms": 242.45896399999998,
  "moves_per_second": 21116.975489510052,
  "move_rtt": {
    "n": 5120,
    "p50_ms": 6.0548559999999725,
    "p95_ms": 13.044408000000004,
    "p99_ms": 15.813913000000014,
    "max_ms": 17.130993000000018
  },
  "accepted": 5120,
  "rejected": 0,
  "duplicate_sequences": 0,
  "snapshot_errors": 0,
  "server": {
    "cpu_seconds": 0.22,
    "fds_before": 263,
    "fds_after": 263,
    "rss_kb": 144093
  },
  "persistence": {
    "data_dir": "/home/james/Work/ocaml-omcb/bench/evening/wbdata-PYXcRH",
    "sequence": "5120",
    "wal_segments": 1,
    "wal_bytes": "430096",
    "snapshots": 0,
    "last_snapshot_sequence": null,
    "snapshot_pending": false,
    "snapshot_write_ms": 0,
    "commits_since_snapshot": 5120,
    "sync": false,
    "group_size": 1,
    "sync_count": 0,
    "group_count": 5120,
    "batched_moves": 5120,
    "last_group_size": 1,
    "average_group_size": 1,
    "last_sync_ms": 0,
    "fsync_p50_us": 0,
    "fsync_p95_us": 0,
    "snapshot_active": false,
    "snapshot_writing": false,
    "snapshot_buffer": false,
    "snapshot_copy_live": 0,
    "snapshot_copy_live_bytes": 0,
    "dirty": true,
    "truncated_wal": false
  }
};
