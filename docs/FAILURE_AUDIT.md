# Production Hardening and Failure-Injection Audit

Audited commit: `d56f145` (adaptive group commit default, fixed-64 fallback).
Machine: AMD Ryzen 7 250, 16 cores, btrfs home with `compress=zstd:3`, Linux.

Scope: operational correctness and durability only. No gameplay, protocol or
speculative performance changes.

## 1. Setup and review

Baseline checks were run before and after the changes:

```bash
dune build
dune runtest
node test/crash_recovery_test.js
SIM_MAP_ADAPTIVE=0 node test/crash_recovery_test.js
```

The persistence, worker, connection-manager and adaptive-controller designs
were reviewed against `SPEC.md`, `docs/ALGORITHMS.md` and `bench/README.md`.
Documentation corrections made during the review:

- `SPEC.md` said the process fail-stops on a durability failure, but the code
  only stopped the worker. The code now implements the documented fail-stop.
- `docs/ALGORITHMS.md` said precommit always fsyncs. It now distinguishes
  strict mode from group/adaptive mode, where the fsync is deferred to the
  group commit.
- Snapshot failure cleanup, WAL rotation failure handling and the test-only
  fault hooks were not documented; they are now in `SPEC.md` and
  `docs/ALGORITHMS.md`.

The relevant durability invariant is:

- a move response or live event is published only after the group fsync;
- a failed commit publishes nothing and must not leave a live process serving
  state that may not be durable;
- recovery either reconstructs a valid world or refuses to start;
- snapshots are atomic and a corrupt newest snapshot falls back to the older
  one plus the retained WAL.

## 2. Failure-injection method

A test-only, one-shot fault hook was added to `lib/persistence.ml`:

```bash
SIM_MAP_FAULT=wal-fsync|wal-append|wal-rotate|snapshot-write|snapshot-fsync|snapshot-rename|snapshot-dir-fsync
SIM_MAP_FAULT_AFTER=<number of matching points to skip>
```

With neither variable set, the hooks are inert. The configuration is cached at
first use, so the normal WAL hot path does not perform an environment lookup per
append. Faults raise an ordinary exception, letting the worker exercise its
normal failure path; `SIM_MAP_CRASH_POINT` remains the separate hard-kill path.

The audit runner is:

```bash
node test/failure_injection_test.js
```

It starts real servers against isolated data directories, sends moves over the
real WebSocket protocol, checks events, kills/fail-stops servers, restarts them
and compares `/state-hash`. Results are written to
`bench/failure_audit_results.md` and `.json`.

## 3. WAL failure injection

| Failure | Exact injection | Expected | Observed |
|---|---|---|---|
| WAL fsync, multi-move group | `SIM_MAP_FAULT=wal-fsync`, after the first group | committed group acknowledged; failing group rejected with no events; process fail-stops; restart valid | 16 accepted, 16 connection errors, exit code 70; restart sequence 32; no event for any failed-group move; snapshot request works |
| WAL append / partial write | `SIM_MAP_FAULT=wal-append`, after 20 appends (four moves into the second group) | short record left behind; failing group rejected; process fail-stops; recovery truncates the torn tail | 16 accepted, 16 connection errors, exit code 70; restart sequence 20 with `truncated_wal=true`; recovery valid |
| WAL segment rotation | `SIM_MAP_FAULT=wal-rotate`, first rotation | failed snapshot rotation must not take down the write path; later snapshot succeeds; no partial segment | 40/40 moves accepted; server stayed live; next snapshot wrote at sequence 24; no temporary/partial segment; restart digest matched |

A group of 16 was used, with a 10 ms group-formation delay, so the failing
group contained several moves. An accepted response was never observed for a
move in the failed group, and the watcher received no event for a failed move.

After a commit failure the worker rejects the group, clears the queue and calls
`on_fatal`; the server writes a fatal log line and exits with status 70. This is
a real fail-stop, not just a stopped worker.

Unacknowledged moves can still be present after restart: if the WAL bytes
reached the kernel page cache before the process exited, recovery may include
them. This is the standard durable-before-publish ambiguity. They were never
acknowledged, and clients saw connection errors or a close.

## 4. Snapshot failure injection

Each case used `SIM_MAP_SNAPSHOT_MOVES=10`, sent 24 valid moves and injected a
one-shot failure on the first snapshot.

| Failure | Expected | Observed |
|---|---|---|
| Before/during snapshot write (`snapshot-write`) | snapshot fails, no temp file, writes continue, later snapshot succeeds | 24/24 accepted; live; no temp; later snapshot at sequence 24; restart digest identical |
| Before snapshot fsync (`snapshot-fsync`) | non-fatal; no temp file; WAL remains authoritative | 24/24 accepted; live; no temp; restart digest identical |
| During rename (`snapshot-rename`) | non-fatal; no temp or orphan; WAL remains | 24/24 accepted; live; no temp; restart digest identical |
| During directory fsync (`snapshot-dir-fsync`) | rename must not be trusted; remove untrusted file; old snapshot + WAL recover | 24/24 accepted; live; no orphan snapshot; restart digest identical |

Additional recovery cases are covered by the existing crash suite:

- interruption during snapshot writing (`snapshot-partial-temp`);
- crash after temp fsync and after rename (`snapshot-temp-fsynced`,
  `snapshot-renamed`);
- corruption of the newest snapshot falls back to the older snapshot plus WAL;
- large WAL replay.

The suite passed **9/9** with both the adaptive default and the fixed-64
fallback.

## 5. Shutdown and restart

| Case | Injection | Expected | Observed |
|---|---|---|---|
| Empty queue | SIGTERM after 48 acknowledged moves | every acknowledged move survives; exact digest | 48/48; restart sequence 48, digest identical |
| Queued work | SIGTERM after 16 acknowledged moves while a further 48-move burst was queued | acknowledged moves survive; unacknowledged requests fail without corruption | 16 accepted, 48 connection errors; restart sequence 16 |
| Snapshot writing | SIGTERM while `snapshot_pending` and `snapshot_writing` were true | acknowledged moves survive; restart valid; no temp survives recovery | 48/48; restart digest identical; no temp remained |
| During fsync / torn WAL | existing `wal-before-write`, `wal-partial-write`, `wal-after-fsync` crash points | recovery either truncates the torn tail or keeps the durable prefix | crash suite 9/9 |

SIGTERM is not a graceful-drain operation in this server; it terminates the
process. That is acceptable because every acknowledgement is already past its
group fsync. An in-flight snapshot may leave a temporary file, which recovery
removes.

## 6. Long-running adaptive stability

Command (30 minutes, six five-minute phases):

```bash
node test/adaptive_soak_test.js
```

Phases: quiet → 96-writer heavy → 16 writers with 256 subscribers → mixed →
snapshot-heavy writes → quiet again. A continuous sentinel writer and eight
sentinel subscribers verify event delivery throughout.

### 30-minute run (before the recipient-aware controller fix)

This run exposed D7 below: the adaptive controller was pinned at batch 16
because eight sentinel subscribers had high end-to-end lag under write load.

| Phase | Accepted | Moves/s | Move p50 | Move p95 | Queue max | Fsync p95 max | Lag p95 max | Batch end | Class |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| quiet | 25,329 | 84 | 5.6 ms | 97.6 ms | 4 | 180 ms | 96 ms | 16 | moderate |
| heavy writes | 537,738 | 1,792 | 34.1 ms | 169.1 ms | 59 | 179 ms | 80 ms | 16 | broadcast-bound |
| fan-out | 55,920 | 186 | 53.4 ms | 228.6 ms | 17 | 219 ms | 169 ms | 16 | broadcast-bound |
| mixed | 82,613 | 275 | 153.8 ms | 473.5 ms | 3 | 271 ms | 264 ms | 16 | broadcast-bound |
| snapshot writes | 111,251 | 371 | 147.1 ms | 480.0 ms | 8 | 177 ms | 257 ms | 16 | broadcast-bound |
| quiet again | 19,420 | 65 | 4.2 ms | 138.0 ms | 4 | 155 ms | 176 ms | 16 | broadcast-bound |

- RSS: 560.6 MiB first median, **1,255.3 MiB last median**, 1,707.6 MiB max,
  growth **694.6 MiB**. The peaks coincide with the 512 MiB snapshot copy; the
  last median does not return to the starting value.
- FDs: 369 → 369, max 370. No descriptor leak.
- Worker queue max 59 of 4,096; outbox max 0 of 256; no drops or send
  failures.
- Sentinel: 12,840 moves, 0 errors, 0 missing, 0 duplicates across eight
  subscribers.
- Recovery: sequence 845,111 → 845,111, digest identical.
- Policy: 158 cumulative changes. Quiet phases had 28 and 26 changes per five
  minutes, mostly 8↔16 oscillation; heavy stayed at 16/broadcast-bound.

### Post-fix validation (6 minutes, 60-second phases)

After the recipient-aware classification fix (D7), the same workload ran for
six minutes:

| Phase | Accepted | Moves/s | Move p50 | Move p95 | Queue max | Fsync p95 max | Lag p95 max | Batch end | Class |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| quiet | 6,991 | 116 | 5.0 ms | 23.1 ms | 2 | 21 ms | 31 ms | 16 | moderate |
| heavy writes | 529,347 | **8,821** | 8.9 ms | 20.3 ms | 32 | 22 ms | 24 ms | 128 | heavy |
| fan-out | 71,031 | 1,184 | 11.0 ms | 23.7 ms | 16 | 36 ms | 22 ms | 64 | heavy |
| mixed | 94,433 | 1,568 | 20.8 ms | 90.0 ms | 1 | 58 ms | 84 ms | 32 | broadcast-bound |
| snapshot writes | 50,236 | 837 | 28.6 ms | 215.9 ms | 2 | 162 ms | 207 ms | 16 | broadcast-bound |
| quiet again | 3,819 | 64 | 18.4 ms | 109.2 ms | 3 | 135 ms | 175 ms | 16 | moderate |

- Heavy throughput recovered from 1,792 to **8,821 moves/s**; heavy p50 fell
  from 34.1 to 8.9 ms and batch settled at 128.
- RSS: 564.5 MiB first median, 1,111.5 MiB last median, 1,665.8 MiB max.
- FDs 369 → 369, max 370; queues/outbox bounded; sentinel 4,355 moves with
  0 missing/duplicate; recovery sequence 760,212 exact.
- Mixed-phase classification still changes (16 changes in 60 s) under 256
  subscribers; this is real fan-out pressure, not the small-sentinel
  misclassification.

The full 30-minute run was not repeated after D7; the six-minute run validates
the controller fix, while the 30-minute run above supplies the long-duration
memory/fd/queue evidence.

## 7. Defects found and fixed

### D1 — High: commit failure left the server alive with tentative state

- Location: `lib/state_worker.ml:102` (`fail_queue`), `lib/state_worker.ml:311`
  (`on_fatal`), `server/server.ml:466` (fatal exit).
- Before: a group fsync/append failure rejected the group and stopped the
  worker, but the process kept serving. In the probe, 11 moves were
  acknowledged while `/state-hash` reported sequence 27; the 16 moves in the
  failed group remained in memory and were readable through the live server.
  The process did not exit.
- Fix: `State_worker.start` accepts `on_fatal`; the server logs and exits with
  status 70 (`Unix._exit`) after a commit failure. Snapshot-only failures remain
  non-fatal.
- Regression: `test/test_worker.ml` injects a throwing `commit_group` and checks
  that the group is rejected, no event is published, `on_fatal` runs and the
  worker stays failed.

### D2 — High: WAL rotation failure broke the write path

- Location: `lib/persistence.ml:923` (`rotate_wal`), `lib/persistence.ml:423`
  (`open_wal_segment`).
- Before: rotation closed the old WAL descriptor before opening the new
  segment. In the probe, the first rotation failure left `t.fd` closed; the
  next commit failed with `EBADF`, the worker failed, and only 16 of 40 valid
  moves were accepted.
- Fix: open the replacement first, switch only on success, then close the old
  descriptor. A failed new segment is removed if it has no valid header.
- Regression: `wal-rotate` case in `test/failure_injection_test.js` verifies
  40/40 accepted moves, a later successful snapshot and no partial segment.

### D3 — Medium: failed snapshots leaked approximately 537 MB per failure

- Location: `lib/persistence.ml:1015` (`write_snapshot`).
- Before: a failure before rename left `snapshot-*.snap.tmp.<pid>` behind; a
  failure after rename but before directory fsync left an untrusted final
  snapshot. The probe showed a 537 MB temp file still present even after a
  later snapshot succeeded. Repeated failures could exhaust disk.
- Fix: unlink the temp file on any write/fsync/rename failure, and unlink the
  renamed file if the directory fsync fails. The old snapshot and every WAL
  segment needed by it remain.
- Regression: four snapshot fault cases in `test/failure_injection_test.js`.

### D4 — Medium: stale snapshot temp files were never removed

- Location: `lib/persistence.ml:223` (`remove_stale_temps`).
- Before: the prefix check compared a five-character substring with the
  six-character string `"snapsh"`, so it could never match. Recovery never
  removed interrupted temp files; the new unit test failed until the prefix
  comparison was corrected.
- Fix: compare the full eight-character `"snapshot"` prefix.
- Regression: `test/test_persistence.ml` writes a stale temp file, runs
  recovery and checks it is gone.

### D5 — Medium: stale event lag kept the controller broadcast-bound

- Location: `lib/metrics.ml:153` (`recent_p95_ms`).
- Before: zero-recipient broadcasts do not record end-to-end samples, so the
  last high-latency fan-out window remained “recent” forever. In the soak
  smoke, lag stayed at ~118 ms for the whole quiet-after-fanout phase and the
  controller stayed broadcast-bound.
- Fix: return zero when the last end-to-end sample is older than five seconds.
- Regression: covered by the soak/controller timeline; no wall-clock-dependent
  unit test was added.

### D6 — Low: test-client open race

- Location: `bench/ws_client.js:115`.
- Before: if a WebSocket reached `OPEN` before `open()` installed its handlers,
  the promise could resolve before `onmessage` was installed, causing the
  client to time out.
- Fix: install handlers first, then resolve immediately if already open.
- This affects only the benchmark/test harness, not the server.

### D7 — High: recipient-blind broadcast pressure collapsed heavy throughput

- Location: `lib/adaptive_commit.ml` (`classify`, `broadcast_pressure`) and
  `server/server.ml` (adaptive sampler).
- Before: any event lag p95 ≥50 ms was treated as broadcast-bound. The soak's
  eight sentinel subscribers were enough to trigger this under 96-writer load,
  so the policy stayed at batch 16 for the whole heavy phase. Throughput was
  1,792 moves/s instead of 8,821, p50 34.1 ms instead of 8.9 ms, while the
  client outbox was empty.
- Fix: the sampler now computes recipients per broadcast event from the
  metrics counters. Broadcast pressure requires outbox backlog ≥32, event lag
  ≥50 ms **and** at least 16 recipients per event, or severe lag ≥250 ms.
  Eight-recipient sentinel traffic no longer pins a write-heavy workload.
- Regression: `test/test_adaptive_commit.ml` checks that high lag with eight
  recipients does not cap batching; high lag with 80 recipients still does.
  The post-fix soak above shows batch 128 and 8,821 moves/s in the heavy phase.
- Severity rationale: this was a 5× throughput and 4× median-latency
  regression under an ordinary mixed workload, not a durability violation.

### Residual memory finding

RSS rose from ~560 MiB to ~1.25 GiB over 30 minutes and peaked at ~1.7 GiB
during the 512 MiB snapshot copy. FDs, worker queue, outbox, drops and sentinel
delivery stayed bounded, and recovery was exact. This is consistent with
retained allocator/heap pages after repeated full-world copies rather than an
unbounded queue or descriptor leak, but the retained ~700 MiB is operationally
significant. It was not fixed because changing snapshot buffer reuse/GC policy
would be a performance change outside this audit; it should be profiled with a
heap dump before changing production defaults.

### Before/after summary

| Check | Before fixes | After fixes |
|---|---|---|
| WAL fsync failure in a multi-move group | worker stopped, process kept serving; 16 tentative moves visible; no exit | process exits 70; failed group never acknowledged or broadcast |
| WAL rotation failure | old fd closed; next commit `EBADF`; worker failed; 16/40 accepted | 40/40 accepted; later snapshot succeeds; no partial segment |
| Snapshot write/fsync/rename failure | 537 MB temp file left behind | temp removed; WAL recovery; restart digest identical |
| Interrupted snapshot temp | never removed on recovery | removed before snapshot listing |
| Broadcast lag after subscribers leave | ~118 ms stale forever | zero after five seconds without recipient samples |
| Small-fanout lag under heavy writes | batch pinned at 16; 1,792 moves/s | batch 128; 8,821 moves/s |

## 8. Test suite before/after

Before the fixes, at `d56f145`:

- `dune runtest` passed;
- crash recovery passed **9/9** with adaptive default and **9/9** with the
  fixed-64 fallback;
- live broadcast, snapshot consistency, browser cache and WebSocket
  write-failure tests passed.

After the fixes:

- `dune runtest` passed, including the new worker fatal-path and stale-temp
  regressions;
- crash recovery passed **9/9** with adaptive default and **9/9** with the
  fixed-64 fallback;
- `test/failure_injection_test.js` passed **10/10**;
- live broadcast, snapshot consistency, browser cache and WebSocket
  write-failure tests passed again (`37,500` write-failure moves, 12 failed
  sends, 0 idle ticks, fds 21 → 21);
- adaptive 30-minute soak plus a 6-minute post-D7 validation completed with
  exact recovery and zero missing/duplicate sentinel events.

## 9. Verified invariants

- No failed-group move received an accepted response.
- No failed-group move generated a broadcast event.
- A commit failure terminates the process instead of continuing to serve
  tentative state.
- Acknowledged moves survive restart with the exact pre-shutdown digest.
- Snapshot failures are non-fatal; no temp/orphan remains; WAL recovery works.
- A rotation failure leaves the old WAL appendable.
- Recovery removes stale snapshot temps.
- Adaptive long-run event delivery to the sentinel subscribers is exactly once
  (subject to the final soak result).

## 10. Residual risks and limitations

- A failed fsync may still leave its bytes in the page cache. Recovery can then
  include moves that were never acknowledged. This is the documented
  durable-before-publish trade-off, not a violation: no client saw success.
- A fatal process exit can cut off already-committed live events before their
  sender fibers flush. Clients lose the connection and must resynchronise from
  snapshots; the WAL still contains the committed moves.
- SIGTERM is a hard terminate, not a drain. Acked moves survive because they
  are already fsynced, but in-flight snapshots leave a temp file until recovery.
- Full-world snapshots are ~537 MB and temporarily raise RSS by ~500 MB while
  the world is copied. The final soak numbers should be read with that copy in
  mind.
- The adaptive controller remains heuristic. The soak records policy changes
  and direction flips rather than claiming optimality.
- No authentication, TLS, replication or multi-node failover is implemented.

## 11. Reproduce

```bash
dune build
dune runtest
node test/failure_injection_test.js
node test/crash_recovery_test.js
SIM_MAP_ADAPTIVE=0 node test/crash_recovery_test.js
node test/adaptive_soak_test.js          # 30 minutes
SOAK_PHASE_SECONDS=10 node test/adaptive_soak_test.js  # smoke
```
