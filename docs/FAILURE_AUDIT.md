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
OCAML_OMCB_ADAPTIVE=0 node test/crash_recovery_test.js
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
OCAML_OMCB_FAULT=wal-fsync|wal-append|wal-rotate|snapshot-write|snapshot-fsync|snapshot-rename|snapshot-dir-fsync
OCAML_OMCB_FAULT_AFTER=<number of matching points to skip>
```

With neither variable set, the hooks are inert. The configuration is cached at
first use, so the normal WAL hot path does not perform an environment lookup per
append. Faults raise an ordinary exception, letting the worker exercise its
normal failure path; `OCAML_OMCB_CRASH_POINT` remains the separate hard-kill path.

The audit runner is:

```bash
node test/failure_injection_test.js
```

It starts real servers against isolated data directories, sends moves over the
real WebSocket protocol, checks events, kills/fail-stops servers, restarts them
and compares `/state-hash`. Results are written to
`bench/failure_audit_results.md` and `.json`.

Memory work uses `test/memory_profile_test.js`. It compares a no-snapshot
control with a snapshot-heavy workload and records `/proc` RSS,
`smaps_rollup`, `Gc.quick_stat`, explicitly tracked snapshot-copy bytes, and
the effect of a forced full major GC/compaction (`OCAML_OMCB_DEBUG_GC=1`).
`OCAML_OMCB_MEMPROF=1` additionally samples live allocation sites through
`Gc.Memprof`; both debug endpoints return 404 when not enabled.

## 3. WAL failure injection

| Failure | Exact injection | Expected | Observed |
|---|---|---|---|
| WAL fsync, multi-move group | `OCAML_OMCB_FAULT=wal-fsync`, after the first group | committed group acknowledged; failing group rejected with no events; process fail-stops; restart valid | 16 accepted, 16 connection errors, exit code 70; restart sequence 32; no event for any failed-group move; snapshot request works |
| WAL append / partial write | `OCAML_OMCB_FAULT=wal-append`, after 20 appends (four moves into the second group) | short record left behind; failing group rejected; process fail-stops; recovery truncates the torn tail | 16 accepted, 16 connection errors, exit code 70; restart sequence 20 with `truncated_wal=true`; recovery valid |
| WAL segment rotation | `OCAML_OMCB_FAULT=wal-rotate`, first rotation | failed snapshot rotation must not take down the write path; later snapshot succeeds; no partial segment | 40/40 moves accepted; server stayed live; next snapshot wrote at sequence 24; no temporary/partial segment; restart digest matched |

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

Each case used `OCAML_OMCB_SNAPSHOT_MOVES=10`, sent 24 valid moves and injected a
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

SIGTERM now drains the worker and waits up to 30 seconds for an in-flight
snapshot before closing the WAL and exiting 0. SIGKILL remains the hard-crash
path. Even a hard stop is safe for acknowledged moves because every
acknowledgement is already past its group fsync; recovery removes any
interrupted snapshot temp file.

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

### 30-minute run after D7 (before snapshot buffer reuse)

The same six-phase workload on the D7 controller:

| Phase | Accepted | Moves/s | Move p50 | Move p95 | Queue max | Fsync p95 max | Lag p95 max | Batch end | Class |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| quiet | 35,920 | 120 | 5.9 ms | 13.0 ms | 4 | 113 ms | 40 ms | 8 | moderate |
| heavy writes | 2,933,841 | **9,779** | 7.6 ms | 17.6 ms | 78 | 37 ms | 14 ms | 128 | heavy |
| fan-out | 414,193 | 1,381 | 8.3 ms | 19.6 ms | 16 | 33 ms | 17 ms | 32 | heavy |
| mixed | 434,902 | 1,449 | 18.8 ms | 136.8 ms | 36 | 227 ms | 203 ms | 16 | broadcast-bound |
| snapshot writes | 395,099 | 1,316 | 22.8 ms | 160.1 ms | 64 | 187 ms | 172 ms | 16 | broadcast-bound |
| quiet again | 13,750 | 46 | 52.9 ms | 177.8 ms | 4 | 203 ms | 110 ms | 8 | moderate |

- D7 is stable for the complete workload: heavy stayed at batch 128 with zero
  batch changes; fan-out/mixed/snapshot recovered from the pre-fix 186/275/371
  moves/s to **1,381/1,449/1,316**.
- FDs 369 → 369, max 370; queue max 78; outbox max 0; no drops or send
  failures; sentinel 20,838 moves with zero missing/duplicates; recovery
  sequence 4,248,543 exact.
- RSS exposed D8: 563.8 MiB first median, **3,758.4 MiB last median**,
  3,770.2 MiB max, growth 3,194.6 MiB. It did not return to baseline during
  the final quiet phase.

### Final 30-minute run after the memory fixes

This run includes the reusable snapshot buffer (D8) and the close-race removal
(D9):

| Phase | Accepted | Moves/s | Move p50 | Move p95 | Queue max | Fsync p95 max | Lag p95 max | Batch end | Class |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| quiet | 36,524 | 122 | 6.4 ms | 11.2 ms | 4 | 86 ms | 18 ms | 8 | moderate |
| heavy writes | 3,570,674 | **11,901** | 6.6 ms | 15.9 ms | 42 | 33 ms | 13 ms | 128 | heavy |
| fan-out | 442,018 | 1,473 | 8.0 ms | 18.8 ms | 16 | 33 ms | 17 ms | 64 | heavy |
| mixed | 644,456 | 2,146 | 16.2 ms | 30.5 ms | 48 | 33 ms | 32 ms | 16 | broadcast-bound |
| snapshot writes | 495,176 | 1,650 | 22.1 ms | 157.1 ms | 64 | 147 ms | 138 ms | 8 | broadcast-bound |
| quiet again | 12,825 | 43 | 67.0 ms | 200.0 ms | 4 | 222 ms | 131 ms | 32 | storage-bound |

- RSS: 564.2 MiB first median, **1,182.2 MiB last median**, 1,185.2 MiB max,
  growth 618.0 MiB. This is the world plus one reusable 512 MiB snapshot buffer
  plus normal heap; it is stable and does not grow through the final quiet
  phase.
- FDs 369 → 369, max 370; queue max 64; outbox max 0; no drops or send
  failures.
- Sentinel: 22,245 moves, 0 errors, 0 missing, 0 duplicates across eight
  subscribers.
- Recovery: sequence 5,223,918 → 5,223,918, digest identical.
- D7 is stable under the complete workload: heavy batch stayed at 128 with no
  changes; fan-out/mixed/snapshot sustained 1,473/2,146/1,650 moves/s.
- Remaining controller churn is in fan-out/mixed/quiet transitions (77/126/61
  policy changes over five minutes); throughput and p50 remain stable, so this
  is recorded as tuning headroom rather than a correctness defect.

### Snapshot memory profile

`test/memory_profile_test.js` compares a 60-second write-only control with a
60-second run that takes four snapshots. It records `/proc` RSS, smaps_rollup,
`Gc.quick_stat` and the explicitly tracked snapshot-copy bytes, then forces a
full major collection and compaction.

After the reusable-buffer and close-race fixes (96 writers, 30 seconds):

| Run | Moves | Snapshots | Peak RSS | Live growth (pre-GC) | Heap after GC | External idle | RSS drop after GC |
|---|---:|---:|---:|---:|---:|---:|---:|
| control | 382,950 | 0 | 580 MB | 23.9 MB | 10.3 MB | 0 | 14 MB |
| snapshots | 298,593 | 4 | **1,115 MB** | 22.8 MB | 10.3 MB | **511.9 MB reusable** | 16 MB |

The earlier profile isolated the sources: before reuse, 511.9 MB of transient
snapshot data remained live at idle and a forced GC dropped RSS by 573 MB.
Before the close-race fix, the control run grew 199.1 MiB of live objects in
30 seconds at 96 writers; after the fix it grows 23.9 MiB.

Interpretation:

- The growth is **not a live OCaml object leak**: after a forced full GC the
  OCaml heap is only ~50 MB and live objects did not grow materially.
- It is **external snapshot-copy memory plus heap/allocator retention**. Before
  reuse, the profile showed 511.9 MB of a transient copy still live at idle
  and a 573 MB RSS drop after a forced GC/compaction. In the 30-minute soak,
  copies accumulated between major collections and RSS reached 3.76 GiB.
- After reuse, exactly one 511.9 MB buffer is retained; transient copies are
  zero and peak RSS is bounded at roughly control + one buffer (~1.23 GiB in
  the profile). The remaining ~50 MB RSS drop after GC is allocator/heap
  retention, not the snapshot data.
- The full 30-minute soak must be repeated on this build to confirm the bound
  under fan-out and snapshot transitions.

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

### D8 — High: repeated snapshot copies inflated RSS

- Location: `lib/persistence.ml` (`capture_copy`).
- Before: every snapshot allocated a new 512 MiB board copy plus ledger
  arrays. A 30-minute soak with 42 snapshots reached **3.76 GiB RSS** and did
  not return to baseline during a final five-minute quiet phase. The 60-second
  profile showed 511.9 MiB of transient external snapshot memory still live at
  idle and a 573 MiB RSS drop after a forced full GC/compaction.
- Diagnosis: the memory was external Bigarray data and heap/allocator
  retention, not a growing live OCaml object graph. After the forced GC the
  OCaml heap was only ~50 MiB; live objects had not grown materially. Snapshot
  copies were accumulating between major collections because the write path
  allocated a fresh 512 MiB buffer each time.
- Fix: retain one reusable snapshot-copy buffer in `Persistence.t` and blit
  into it on each capture. Only one snapshot can be in progress at a time, so
  reuse is safe. The profile after the fix still shows 511.9 MiB external
  memory, but it is the single intentional reusable buffer; transient copies
  are zero and peak RSS is bounded at roughly control + one buffer
  (~1.23 GiB in the profile).
- Regression: `test/memory_profile_test.js` records RSS, smaps_rollup, GC
  heap/live words and explicit live-copy bytes. The final 30-minute soak on
  the reuse + close-race build held RSS at 1.18 GiB (564 MiB first median),
  versus 3.76 GiB before the fixes.

### D9 — High: per-request close race leaked Lwt callbacks

- Location: `server/server.ml` (`handle_socket`, `Lwt.pick` against
  `Connection_manager.wait_closed`).
- Before: every WebSocket request raced `Dream.receive` against the
  connection's never-resolving close signal. At high request rates the losing
  waiter left Lwt pending-callback nodes behind. A 30-second 96-writer profile
  showed **199.1 MiB live growth**, 71.4 MiB heap after GC and 773 MiB RSS with
  no snapshots; the 30-minute soak reached multi-gigabyte RSS.
- Fix: remove the per-request `Lwt.pick` race and rely on `Dream.receive`
  returning `None` when the pinned httpun-ws close path closes the socket. The
  close path is still exercised by the write-failure and teardown tests.
- Result: the same 30-second profile fell to **23.9 MiB live growth**, 10.3 MiB
  heap after GC and 580 MiB RSS; snapshot peak fell to 1.115 GiB.
- Regression: `ws_write_failure_test.js` (37,500 moves, 12 failed sends, idle
  CPU 0, fds 14→14), `ws_teardown_test.js` (6 abrupt disconnects, idle CPU 0)
  and the live broadcast test all pass, plus the memory profile.

### Before/after summary

| Check | Before fixes | After fixes |
|---|---|---|
| WAL fsync failure in a multi-move group | worker stopped, process kept serving; 16 tentative moves visible; no exit | process exits 70; failed group never acknowledged or broadcast |
| WAL rotation failure | old fd closed; next commit `EBADF`; worker failed; 16/40 accepted | 40/40 accepted; later snapshot succeeds; no partial segment |
| Snapshot write/fsync/rename failure | 537 MB temp file left behind | temp removed; WAL recovery; restart digest identical |
| Interrupted snapshot temp | never removed on recovery | removed before snapshot listing |
| Broadcast lag after subscribers leave | ~118 ms stale forever | zero after five seconds without recipient samples |
| Small-fanout lag under heavy writes | batch pinned at 16; 1,792 moves/s | batch 128; 8,821 moves/s |
| Recurrent snapshot copies | new 512 MiB copy per snapshot; 3.76 GiB soak RSS | one reusable buffer; ~1.12 GiB profile peak |
| Per-request close race | 199 MiB live growth/30 s at 96 writers | 24 MiB growth/30 s; RSS 580 MiB |

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
- deployment smoke test passed on an alternate port with health/readiness,
  graceful SIGTERM exit 0 and exact restart;
- live broadcast, snapshot consistency, browser cache and WebSocket
  write-failure tests passed again (`37,500` write-failure moves, 12 failed
  sends, 0 idle ticks, fds 21 → 21);
- two full 30-minute post-D7 soaks completed (before and after the memory
  fixes) with exact recovery and zero missing/duplicate sentinel events;
  the final soak held RSS at 1.18 GiB;
- deployment smoke on port 18080: health/readiness, graceful SIGTERM exit 0,
  and exact restart;
- snapshot memory profile: control 580 MB, snapshot peak 1,115 MB with one
  reusable 512 MB buffer, post-GC heap 10 MB.

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
OCAML_OMCB_ADAPTIVE=0 node test/crash_recovery_test.js
node test/adaptive_soak_test.js          # 30 minutes
SOAK_PHASE_SECONDS=10 node test/adaptive_soak_test.js  # smoke
```
