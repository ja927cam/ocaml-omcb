window.WRITE_BURST_RESULTS = window.WRITE_BURST_RESULTS || {};
window.WRITE_BURST_RESULTS["disk-g16"] = {
  "generated": "2026-11-26T23:59:38.811Z",
  "label": "disk-g16",
  "clients": 256,
  "rounds": 20,
  "board_base": {
    "x": 100,
    "y": 100
  },
  "moves": 5120,
  "duration_ms": 873.4986079999999,
  "moves_per_second": 5861.486158201183,
  "move_rtt": {
    "n": 5120,
    "p50_ms": 24.98631300000011,
    "p95_ms": 47.06797400000005,
    "p99_ms": 106.15957799999998,
    "max_ms": 110.34640199999998
  },
  "accepted": 5120,
  "rejected": 0,
  "duplicate_sequences": 0,
  "snapshot_errors": 0,
  "server": {
    "cpu_seconds": 0.33,
    "fds_before": 263,
    "fds_after": 263,
    "rss_kb": 144288
  },
  "persistence": {
    "data_dir": "/home/james/Work/ocaml-omcb/bench/evening/wbdata-VDCElv",
    "sequence": "5120",
    "wal_segments": 1,
    "wal_bytes": "430096",
    "snapshots": 0,
    "last_snapshot_sequence": null,
    "snapshot_pending": false,
    "snapshot_write_ms": 0,
    "commits_since_snapshot": 5120,
    "sync": true,
    "group_size": 16,
    "sync_count": 340,
    "group_count": 340,
    "batched_moves": 5120,
    "last_group_size": 15,
    "average_group_size": 15.058823529411764,
    "last_sync_ms": 1.578857421875,
    "fsync_p50_us": 1491.2109375,
    "fsync_p95_us": 1739.013671875,
    "snapshot_active": false,
    "snapshot_writing": false,
    "snapshot_buffer": false,
    "snapshot_copy_live": 0,
    "snapshot_copy_live_bytes": 0,
    "dirty": false,
    "truncated_wal": false
  }
};
