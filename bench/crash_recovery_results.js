window.CRASH_RECOVERY_RESULTS = {
  "generated": "2026-11-24T10:24:57.644Z",
  "passed": 9,
  "failed": 0,
  "cases": [
    {
      "name": "empty world restart",
      "ok": true,
      "duration_ms": 2883
    },
    {
      "name": "several moves restart",
      "ok": true,
      "duration_ms": 4811
    },
    {
      "name": "cross-board move restart",
      "ok": true,
      "duration_ms": 5347
    },
    {
      "name": "castling and en passant restart",
      "ok": true,
      "duration_ms": 4756
    },
    {
      "name": "torn trailing WAL record",
      "ok": true,
      "duration_ms": 2997
    },
    {
      "name": "crash during snapshot temp write",
      "ok": true,
      "duration_ms": 4330
    },
    {
      "name": "crash after snapshot rename before WAL cleanup",
      "ok": true,
      "duration_ms": 5579
    },
    {
      "name": "corrupt newest snapshot falls back",
      "ok": true,
      "duration_ms": 12501
    },
    {
      "name": "large WAL replay",
      "ok": true,
      "duration_ms": 3348
    }
  ]
};
