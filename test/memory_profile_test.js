#!/usr/bin/env node
/*
 * Snapshot memory-retention profiler.
 *
 * Runs two controlled workloads:
 *   control  - steady writes, snapshots disabled
 *   snapshot - steady writes with a snapshot every SNAPSHOT_MOVES commits
 *
 * Samples /metrics.memory (RSS, smaps_rollup, OCaml GC stats and explicitly
 * tracked live snapshot-copy bytes), then forces a full major collection and
 * compaction through /debug/gc. The report separates live OCaml objects, heap
 * retention/fragmentation and external Bigarray allocations.
 *
 * Usage:
 *   node test/memory_profile_test.js
 *   MEMORY_SECONDS=60 MEMORY_SNAPSHOT_MOVES=20000 node test/memory_profile_test.js
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { Client } = require("../bench/ws_client");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const DATA_ROOT = path.join(ROOT, "memory-profile-data");
const OUT_JSON = path.join(ROOT, "bench", "memory_profile_results.json");
const OUT_MD = path.join(ROOT, "bench", "memory_profile_results.md");
const SECONDS = Math.max(10, Number(process.env.MEMORY_SECONDS || 60));
const SNAPSHOT_MOVES = Math.max(1000, Number(process.env.MEMORY_SNAPSHOT_MOVES || 50000));
const WRITERS = Math.max(1, Number(process.env.MEMORY_WRITERS || 16));
const SAMPLE_MS = 500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function portFree() {
  return new Promise((resolve) => {
    const socket = net.connect(8080, "::1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(300, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

function boardFor(index) {
  return { x: 420 + (index % 16), y: 420 + Math.floor(index / 16) };
}

async function startServer(name, snapshotMoves) {
  const dir = path.join(DATA_ROOT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  if (!(await portFree())) throw new Error("port 8080 is in use");
  const log = path.join("/tmp", `memory-profile-${name}.log`);
  const fd = fs.openSync(log, "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      SIM_MAP_DATA_DIR: dir,
      SIM_MAP_ADAPTIVE: "0",
      SIM_MAP_WAL_GROUP: "64",
      SIM_MAP_WAL_GROUP_DELAY_US: "0",
      SIM_MAP_SNAPSHOT_MOVES: String(snapshotMoves),
      SIM_MAP_SNAPSHOT_SECONDS: "0",
      SIM_MAP_DEBUG_GC: "1",
      SIM_MAP_MEMPROF: process.env.MEMORY_MEMPROF || "0",
      SIM_MAP_MEMPROF_RATE: process.env.MEMORY_MEMPROF_RATE || "0.0001",
    },
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`server exited during startup; ${log}`);
    }
    try {
      const response = await fetch("http://localhost:8080/metrics", {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return { child, dir, log };
    } catch (_) {}
    await sleep(100);
  }
  child.kill("SIGKILL");
  throw new Error(`server did not become ready; ${log}`);
}

async function stopServer(child) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      sleep(5000),
    ]);
  }
}

async function metrics() {
  const response = await fetch("http://localhost:8080/metrics", {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`metrics ${response.status}`);
  return response.json();
}

async function forceGc() {
  const response = await fetch("http://localhost:8080/debug/gc", {
    method: "GET",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`debug/gc ${response.status}`);
  return response.json();
}

function snapshotOf(metrics, elapsedMs) {
  const memory = metrics.memory || {};
  const gc = memory.gc || {};
  const smaps = memory.smaps_rollup_kb || {};
  const persistence = metrics.persistence || {};
  return {
    t: elapsedMs,
    phase: "running",
    rss_kb: memory.rss_kb ?? null,
    anonymous_kb: smaps.Anonymous ?? null,
    private_dirty_kb: smaps.Private_Dirty ?? null,
    heap_words: gc.heap_words ?? null,
    live_words: gc.live_words ?? null,
    free_words: gc.free_words ?? null,
    top_heap_words: gc.top_heap_words ?? null,
    major_words: gc.major_words ?? null,
    minor_words: gc.minor_words ?? null,
    promoted_words: gc.promoted_words ?? null,
    compactions: gc.compactions ?? null,
    snapshot_copy_live: memory.snapshot_copy_live ?? null,
    snapshot_copy_live_bytes: memory.snapshot_copy_live_bytes ?? null,
    snapshot_pending: persistence.snapshot_pending ?? null,
    snapshot_writing: persistence.snapshot_writing ?? null,
    snapshot_buffer: persistence.snapshot_buffer ?? false,
    last_snapshot_sequence: persistence.last_snapshot_sequence ?? null,
    snapshots: persistence.snapshots ?? null,
    sequence: persistence.sequence ?? null,
  };
}

async function runScenario(name, snapshotMoves) {
  const { child, dir, log } = await startServer(name, snapshotMoves);
  const clients = [];
  for (let i = 0; i < WRITERS; i++) {
    const client = new Client(i, "active");
    await client.open();
    clients.push(client);
  }
  // Start from a compacted heap so the baseline is not an artefact of startup
  // allocation and copying.
  await forceGc();
  await sleep(500);
  const started = Date.now();
  let running = true;
  const rounds = new Array(WRITERS).fill(0);
  const worker = Promise.all(
    clients.map(async (client, index) => {
      const board = boardFor(index);
      while (running) {
        const round = rounds[index];
        const even = round % 2 === 0;
        try {
          const result = await client.move(
            board.x,
            board.y,
            even ? { x: 1, y: 7 } : { x: 2, y: 5 },
            even ? { x: 2, y: 5 } : { x: 1, y: 7 },
            ((even ? 57 : 42) << 8) | 23
          );
          if (result.accepted) rounds[index]++;
        } catch (_) {
          await sleep(10);
        }
      }
    })
  ).catch(() => {});

  const samples = [];
  let completedSnapshots = 0;
  let lastSnapshotSequence = null;
  const deadline = started + SECONDS * 1000;
  while (Date.now() < deadline) {
    const m = await metrics().catch(() => null);
    if (m) {
      const sample = snapshotOf(m, Date.now() - started);
      samples.push(sample);
      const sequence = sample.last_snapshot_sequence;
      if (sequence && sequence !== lastSnapshotSequence) {
        lastSnapshotSequence = sequence;
        completedSnapshots++;
      }
    }
    await sleep(SAMPLE_MS);
  }
  running = false;
  await worker;
  // Wait for an in-flight snapshot write to finish.
  for (let i = 0; i < 200; i++) {
    const m = await metrics().catch(() => null);
    if (!m) break;
    const p = m.persistence || {};
    if (!p.snapshot_pending && !p.snapshot_writing) break;
    await sleep(100);
  }
  const idleMetrics = await metrics();
  const idle = snapshotOf(idleMetrics, Date.now() - started);
  idle.phase = "idle";
  samples.push(idle);
  const memprof = await fetch("http://localhost:8080/debug/memprof", {
    signal: AbortSignal.timeout(60_000),
  })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
  const gcMetrics = await forceGc();
  const postGc = snapshotOf(
    { memory: gcMetrics, persistence: idleMetrics.persistence },
    Date.now() - started
  );
  postGc.phase = "post_gc";
  samples.push(postGc);
  await stopServer(child);
  for (const client of clients) {
    try {
      client.close();
    } catch (_) {}
  }
  const accepted = rounds.reduce((total, value) => total + value, 0);
  return {
    name,
    snapshot_moves: snapshotMoves,
    seconds: (Date.now() - started) / 1000,
    writers: WRITERS,
    accepted,
    completed_snapshots: completedSnapshots,
    samples,
    idle,
    post_gc: postGc,
    log,
    dir,
    memprof,
  };
}

function wordBytes(words) {
  return words === null ? null : words * 8;
}

function summarise(run) {
  const start = run.samples[0];
  const peakRss = Math.max(
    ...run.samples.map((sample) => sample.rss_kb || 0)
  );
  const peakCopy = Math.max(
    ...run.samples.map((sample) => sample.snapshot_copy_live_bytes || 0)
  );
  const liveStart = wordBytes(start.live_words);
  const liveIdle = wordBytes(run.idle.live_words);
  const heapStart = wordBytes(start.heap_words);
  const heapIdle = wordBytes(run.idle.heap_words);
  const heapPostGc = wordBytes(run.post_gc.heap_words);
  const livePostGc = wordBytes(run.post_gc.live_words);
  const externalIdle = run.idle.snapshot_copy_live_bytes || 0;
  const reusableBuffer = run.idle.snapshot_buffer === true;
  const rssDropAfterGc = (run.idle.rss_kb || 0) - (run.post_gc.rss_kb || 0);
  return {
    start,
    idle: run.idle,
    post_gc: run.post_gc,
    peak_rss_kb: peakRss,
    peak_copy_bytes: peakCopy,
    live_growth_bytes: liveIdle - liveStart,
    heap_growth_bytes: heapIdle - heapStart,
    heap_after_gc_bytes: heapPostGc,
    live_after_gc_bytes: livePostGc,
    live_growth_after_gc_bytes: livePostGc - liveStart,
    external_idle_bytes: externalIdle,
    reusable_buffer: reusableBuffer,
    rss_drop_after_gc_kb: rssDropAfterGc,
    diagnosis: {
      external_copy_retained: externalIdle > 0 && !reusableBuffer,
      reusable_snapshot_buffer: reusableBuffer,
      live_objects_growing:
        livePostGc - liveStart > 32 * 1024 * 1024,
      heap_retention:
        heapPostGc - heapStart > 64 * 1024 * 1024,
      gc_reclaims_heap: heapPostGc < heapIdle - 32 * 1024 * 1024,
      rss_reclaimed_by_gc: rssDropAfterGc > 64 * 1024,
    },
  };
}

async function main() {
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  const control = await runScenario("control", 0);
  const snapshots = await runScenario("snapshots", SNAPSHOT_MOVES);
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });

  const payload = {
    generated: new Date().toISOString(),
    seconds: SECONDS,
    snapshot_moves: SNAPSHOT_MOVES,
    writers: WRITERS,
    control: { ...control, summary: summarise(control) },
    snapshots: { ...snapshots, summary: summarise(snapshots) },
    memprof: snapshots.memprof,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n");

  const rows = [
    ["control", payload.control],
    ["snapshots", payload.snapshots],
  ];
  const lines = [];
  lines.push("# Snapshot memory-retention profile\n");
  lines.push(`Generated: ${payload.generated}`);
  lines.push(
    `Writers: ${WRITERS}; duration cap: ${SECONDS}s; snapshot interval: ${SNAPSHOT_MOVES} commits.\n`
  );
  lines.push(
    "| Run | Accepted | Snapshots | Peak RSS | Peak copy | Idle RSS | Live growth | Heap growth | Heap after GC | External idle | RSS drop after GC |"
  );
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const [name, run] of rows) {
    const s = run.summary;
    lines.push(
      `| ${name} | ${run.accepted} | ${run.completed_snapshots} | ` +
        `${s.peak_rss_kb} kB | ${(s.peak_copy_bytes / 1048576).toFixed(1)} MiB | ` +
        `${s.idle.rss_kb} kB | ${(s.live_growth_bytes / 1048576).toFixed(1)} MiB | ` +
        `${(s.heap_growth_bytes / 1048576).toFixed(1)} MiB | ` +
        `${(s.heap_after_gc_bytes / 1048576).toFixed(1)} MiB | ` +
        `${(s.external_idle_bytes / 1048576).toFixed(1)} MiB | ` +
        `${s.rss_drop_after_gc_kb} kB |`
    );
  }
  if (payload.memprof && payload.memprof.sites_by_count) {
    lines.push("\n## Live allocation sites by count (memprof samples)\n");
    lines.push("| Blocks | Bytes | Stack |");
    lines.push("|---:|---:|---|");
    for (const site of payload.memprof.sites_by_count.slice(0, 50)) {
      lines.push(
        `| ${site.count} | ${site.bytes} | ${String(site.stack).split("\n")[0]} |`
      );
    }
  }
  if (payload.memprof && payload.memprof.sites) {
    lines.push("\n## Live allocation sites (memprof samples)\n");
    lines.push("| Bytes | Blocks | Stack |");
    lines.push("|---:|---:|---|");
    for (const site of payload.memprof.sites) {
      lines.push(
        `| ${site.bytes} | ${site.count} | ${String(site.stack).split("\n")[0]} |`
      );
    }
  }
  lines.push("\n## Diagnosis\n");
  for (const [name, run] of rows) {
    const d = run.summary.diagnosis;
    lines.push(`### ${name}\n`);
    lines.push(
      `- reusable snapshot buffer retained at idle: ${d.reusable_snapshot_buffer}`
    );
    lines.push(
      `- transient external snapshot copies retained at idle: ${d.external_copy_retained}`
    );
    lines.push(`- live OCaml objects growing: ${d.live_objects_growing}`);
    lines.push(`- OCaml heap retention: ${d.heap_retention}`);
    lines.push(`- full GC/compaction reclaims heap: ${d.gc_reclaims_heap}`);
    lines.push(`- full GC/compaction reclaims RSS: ${d.rss_reclaimed_by_gc}`);
  }
  fs.writeFileSync(OUT_MD, lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });
  process.exit(1);
});
