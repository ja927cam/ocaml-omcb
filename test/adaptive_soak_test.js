#!/usr/bin/env node
/*
 * Adaptive-mode soak test.
 *
 * Runs a changing workload for six phases, samples server and OS metrics, and
 * checks for RSS/fd growth, unbounded queues, controller oscillation and
 * throughput degradation. Defaults to 5 minutes per phase (30 minutes total).
 *
 * Usage:
 *   node test/adaptive_soak_test.js                 # 30 minutes
 *   SOAK_PHASE_SECONDS=10 node test/adaptive_soak_test.js
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { Client } = require("../bench/ws_client");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const DATA_DIR = path.join(ROOT, "soak-data");
const OUT_JSON = path.join(ROOT, "bench", "adaptive_soak_results.json");
const OUT_MD = path.join(ROOT, "bench", "adaptive_soak_results.md");
const PHASE_SECONDS = Math.max(5, Number(process.env.SOAK_PHASE_SECONDS || 300));
const SAMPLE_MS = 2000;
const WRITERS = Math.max(0, Number(process.env.SOAK_WRITERS || 96));
const SUBSCRIBERS = Math.max(0, Number(process.env.SOAK_SUBSCRIBERS || 256));
const SENTINELS = Math.max(0, Number(process.env.SOAK_SENTINELS || 8));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => performance.now();

const PHASES = [
  { name: "quiet", writers: 4, delayMs: 25, subscribers: false },
  { name: "heavy-writes", writers: WRITERS, delayMs: 0, subscribers: false },
  { name: "fanout", writers: 16, delayMs: 0, subscribers: true },
  { name: "mixed", writers: 48, delayMs: 0, subscribers: true },
  { name: "snapshot-writes", writers: 64, delayMs: 0, subscribers: true },
  { name: "quiet-again", writers: 4, delayMs: 25, subscribers: false },
];

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1)
  );
  return sorted[index];
}

function median(values) {
  return percentile([...values].sort((a, b) => a - b), 0.5);
}

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

async function startServer(fresh = true) {
  if (fresh) {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!(await portFree())) throw new Error("port 8080 is already in use");
  const logPath = "/tmp/sim-map-adaptive-soak.log";
  const log = fs.openSync(logPath, "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      SIM_MAP_DATA_DIR: DATA_DIR,
      SIM_MAP_ADAPTIVE: "1",
      SIM_MAP_ADAPTIVE_MAX: "256",
      SIM_MAP_SNAPSHOT_MOVES: "100000",
      SIM_MAP_SNAPSHOT_SECONDS: "0",
    },
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("server exited during startup");
    }
    try {
      const response = await fetch("http://localhost:8080/metrics", {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return { child, logPath };
    } catch (_) {}
    await sleep(100);
  }
  throw new Error("server did not become ready");
}

async function stopServer(child, signal = "SIGKILL") {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      sleep(5000),
    ]);
  }
  return { code: child.exitCode, signal: child.signalCode };
}

function procStatus(pid) {
  try {
    const text = fs.readFileSync(`/proc/${pid}/status`, "utf8");
    const match = text.match(/^VmRSS:\s+(\d+)\s+kB/m);
    const rssMb = match ? Number(match[1]) / 1024 : null;
    const fds = fs.readdirSync(`/proc/${pid}/fd`).length;
    return { rssMb, fds };
  } catch (_) {
    return { rssMb: null, fds: null };
  }
}

async function readMetrics() {
  const response = await fetch("http://localhost:8080/metrics", {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`metrics ${response.status}`);
  return response.json();
}

async function stateHash() {
  const response = await fetch("http://localhost:8080/state-hash", {
    signal: AbortSignal.timeout(30_000),
  });
  return response.json();
}

function boardFor(index) {
  return { x: 400 + (index % 16), y: 400 + Math.floor(index / 16) };
}

async function main() {
  const { child, logPath } = await startServer();
  const serverPid = child.pid;
  const writers = [];
  const subscribers = [];
  const sentinels = [];
  const sentinelWriter = new Client(5000, "active");
  let sentinelRunning = true;
  const sentinelAccepted = [];
  let sentinelErrors = 0;
  const sentinelErrorDetails = [];
  let sentinelResyncs = 0;
  let sentinelRound = 0;

  for (let i = 0; i < WRITERS; i++) {
    const client = new Client(i, "active");
    await client.open();
    writers.push(client);
    if ((i + 1) % 32 === 0) console.log(`writers ${i + 1}/${WRITERS}`);
  }
  for (let i = 0; i < SUBSCRIBERS; i++) {
    const client = new Client(1000 + i, "silent");
    client.record_events = false;
    await client.open();
    client.subscribe_window(0, 0);
    subscribers.push(client);
    if ((i + 1) % 64 === 0) console.log(`subscribers ${i + 1}/${SUBSCRIBERS}`);
  }
  for (let i = 0; i < SENTINELS; i++) {
    const client = new Client(3000 + i, "silent");
    await client.open();
    client.subscribe_window(500, 500);
    sentinels.push(client);
  }
  await sentinelWriter.open();
  console.log("clients connected");
  await sleep(500);

  const samples = [];
  const phases = [];
  const errors = [];
  let currentPhase = "startup";
  let sampling = true;

  const sampler = (async () => {
    while (sampling) {
      try {
        const metrics = await readMetrics();
        const os = procStatus(serverPid);
        samples.push({
          t: now(),
          phase: currentPhase,
          rss_mb: os.rssMb,
          fds: os.fds,
          move_rate: metrics.adaptive?.move_rate ?? null,
          adaptive: metrics.adaptive ?? null,
          worker_queue: metrics.worker?.move_queue_depth ?? null,
          outbox_depth: metrics.connections?.total_outbox_depth ?? null,
          max_outbox_depth: metrics.connections?.max_outbox_depth ?? null,
          sync_count: metrics.persistence?.sync_count ?? null,
          average_group_size: metrics.persistence?.average_group_size ?? null,
          fsync_p50_us: metrics.persistence?.fsync_p50_us ?? null,
          fsync_p95_us: metrics.persistence?.fsync_p95_us ?? null,
          event_lag_p95_ms: metrics.end_to_end_p95_ms ?? null,
          snapshot_pending: metrics.persistence?.snapshot_pending ?? null,
          snapshot_writing: metrics.persistence?.snapshot_writing ?? null,
          snapshots: metrics.persistence?.snapshots ?? null,
          outbox_dropped: metrics.counters?.outbox_dropped ?? null,
          send_failures: metrics.counters?.send_failures ?? null,
        });
      } catch (_) {}
      await sleep(SAMPLE_MS);
    }
  })();

  const sentinelResync = async () => {
    try {
      const snapshot = await sentinelWriter.snapshot(500, 500);
      const b1 = snapshot.board[7 * 8 + 1];
      const c3 = snapshot.board[5 * 8 + 2];
      const knight = (byte) => ((byte >> 1) & 7) === 3;
      sentinelRound = knight(b1) ? 0 : knight(c3) ? 1 : 0;
      sentinelResyncs++;
    } catch (_) {}
  };

  const sentinelLoop = (async () => {
    while (sentinelRunning) {
      const even = sentinelRound % 2 === 0;
      try {
        const result = await sentinelWriter.move(
          500,
          500,
          even ? { x: 1, y: 7 } : { x: 2, y: 5 },
          even ? { x: 2, y: 5 } : { x: 1, y: 7 },
          ((even ? 57 : 42) << 8) | 23
        );
        if (result.accepted) {
          sentinelAccepted.push({
            sequence: result.sequence,
            at: now(),
            round: sentinelRound,
          });
          sentinelRound++;
        } else {
          sentinelErrors++;
          sentinelErrorDetails.push({ rejection: result.rejection });
          // A rejected move means our local parity is stale; recover from the
          // authoritative snapshot rather than retrying a stale piece.
          await sentinelResync();
        }
      } catch (error) {
        sentinelErrors++;
        sentinelErrorDetails.push({
          error: String(error && error.message ? error.message : error),
        });
        await sentinelResync();
      }
      await sleep(50);
    }
  })();

  const writerRounds = new Array(WRITERS).fill(0);
  const runPhase = async (phase) => {
    console.log(`phase ${phase.name} starting`);
    currentPhase = phase.name;
    if (phase.subscribers) {
      for (const client of subscribers) client.subscribe_window(407, 402);
    } else {
      for (const client of subscribers) client.subscribe_window(0, 0);
    }
    const started = now();
    const end = started + PHASE_SECONDS * 1000;
    const active = writers.slice(0, phase.writers);
    const phaseResults = [];
    await Promise.all(
      active.map(async (client, index) => {
        const board = boardFor(index);
        let round = writerRounds[index];
        while (now() < end) {
          const even = round % 2 === 0;
          const sendAt = now();
          try {
            const result = await client.move(
              board.x,
              board.y,
              even ? { x: 1, y: 7 } : { x: 2, y: 5 },
              even ? { x: 2, y: 5 } : { x: 1, y: 7 },
              ((even ? 57 : 42) << 8) | 23
            );
            const rtt = now() - sendAt;
            if (result.accepted) {
              round++;
              writerRounds[index] = round;
              phaseResults.push({ accepted: true, rtt, sequence: result.sequence });
            } else {
              phaseResults.push({
                accepted: false,
                rtt,
                rejection: result.rejection,
              });
            }
          } catch (error) {
            phaseResults.push({
              accepted: false,
              error: String(error && error.message ? error.message : error),
            });
          }
          if (phase.delayMs > 0) await sleep(phase.delayMs);
        }
      })
    );
    // With zero writers the promise resolves immediately; keep every phase at
    // its configured wall-clock length anyway.
    const remaining = end - now();
    if (remaining > 0) await sleep(remaining);
    console.log(`phase ${phase.name} writers done`);
    const duration = now() - started;
    const accepted = phaseResults.filter((result) => result.accepted);
    const rtts = accepted.map((result) => result.rtt).sort((a, b) => a - b);
    const entry = {
      name: phase.name,
      duration_ms: duration,
      writers: phase.writers,
      accepted: accepted.length,
      rejected: phaseResults.filter(
        (result) => !result.accepted && !result.error
      ).length,
      errors: phaseResults.filter((result) => result.error).length,
      moves_per_second: accepted.length / (duration / 1000),
      move_p50_ms: percentile(rtts, 0.5),
      move_p95_ms: percentile(rtts, 0.95),
      move_p99_ms: percentile(rtts, 0.99),
    };
    phases.push(entry);
    console.log(
      `${phase.name}: ${entry.accepted} accepted, ${entry.rejected} rejected, ` +
        `${entry.errors} errors, ${entry.moves_per_second.toFixed(0)} moves/s, ` +
        `p50 ${entry.move_p50_ms.toFixed(1)} ms`
    );
  };

  try {
    for (const phase of PHASES) await runPhase(phase);
  } finally {
    sentinelRunning = false;
    await sentinelLoop.catch(() => {});
    sampling = false;
    await sampler;
  }

  // Let any in-flight snapshot finish so recovery does not race a write.
  for (let i = 0; i < 100; i++) {
    const m = await readMetrics().catch(() => null);
    if (!m || (!m.persistence.snapshot_pending && !m.persistence.snapshot_writing)) {
      break;
    }
    await sleep(100);
  }
  const before = await stateHash();
  await stopServer(child, "SIGKILL");
  const restarted = await startServer(false);
  const after = await stateHash();
  await stopServer(restarted.child, "SIGKILL");

  for (const client of [...writers, ...subscribers, ...sentinels, sentinelWriter]) {
    try {
      client.close();
    } catch (_) {}
  }

  const inWindow = sentinelAccepted.filter((move) => move.sequence);
  let missing = 0;
  let duplicates = 0;
  for (const client of sentinels) {
    for (const move of inWindow) {
      const count = client.eventCounts.get(move.sequence) || 0;
      if (count === 0) missing++;
      else if (count > 1) duplicates++;
    }
  }

  const phaseSamples = (name) => samples.filter((sample) => sample.phase === name);
  const phaseSummary = phases.map((phase) => {
    const values = phaseSamples(phase.name);
    const policies = values
      .map((sample) => sample.adaptive)
      .filter(Boolean);
    const batchChanges = policies.reduce((count, policy, index) => {
      if (index === 0) return count;
      return count +
        (policy.max_batch_size !== policies[index - 1].max_batch_size ? 1 : 0);
    }, 0);
    const directions = policies
      .map((policy, index) =>
        index === 0
          ? 0
          : Math.sign(
              policy.max_batch_size - policies[index - 1].max_batch_size
            )
      )
      .filter((direction) => direction !== 0);
    let flips = 0;
    for (let i = 1; i < directions.length; i++) {
      if (directions[i] !== directions[i - 1]) flips++;
    }
    return {
      ...phase,
      samples: values.length,
      rss_mb_max: Math.max(...values.map((sample) => sample.rss_mb || 0)),
      fds_max: Math.max(...values.map((sample) => sample.fds || 0)),
      queue_max: Math.max(...values.map((sample) => sample.worker_queue || 0)),
      outbox_max: Math.max(...values.map((sample) => sample.outbox_depth || 0)),
      fsync_p95_us_max: Math.max(
        ...values.map((sample) => sample.fsync_p95_us || 0)
      ),
      event_lag_p95_ms_max: Math.max(
        ...values.map((sample) => sample.event_lag_p95_ms || 0)
      ),
      batch_end: policies.length
        ? policies[policies.length - 1].max_batch_size
        : null,
      classification_end: policies.length
        ? policies[policies.length - 1].classification
        : null,
      batch_changes: batchChanges,
      direction_flips: flips,
    };
  });

  const rssValues = samples.map((sample) => sample.rss_mb).filter(Boolean);
  const fdValues = samples.map((sample) => sample.fds).filter(Boolean);
  const firstRss = rssValues.slice(0, 10);
  const lastRss = rssValues.slice(-10);
  const summary = {
    generated: new Date().toISOString(),
    phase_seconds: PHASE_SECONDS,
    samples: samples.length,
    phases: phaseSummary,
    rss_mb: {
      first_median: median(firstRss),
      last_median: median(lastRss),
      max: Math.max(...rssValues),
      growth_mb: median(lastRss) - median(firstRss),
    },
    fds: {
      first: fdValues[0],
      last: fdValues[fdValues.length - 1],
      max: Math.max(...fdValues),
    },
    queue_max: Math.max(...samples.map((sample) => sample.worker_queue || 0)),
    outbox_max: Math.max(...samples.map((sample) => sample.outbox_depth || 0)),
    fsync_p95_us_max: Math.max(
      ...samples.map((sample) => sample.fsync_p95_us || 0)
    ),
    event_lag_p95_ms_max: Math.max(
      ...samples.map((sample) => sample.event_lag_p95_ms || 0)
    ),
    outbox_dropped: Math.max(
      ...samples.map((sample) => sample.outbox_dropped || 0)
    ),
    send_failures: Math.max(
      ...samples.map((sample) => sample.send_failures || 0)
    ),
    sentinel: {
      moves: sentinelAccepted.length,
      errors: sentinelErrors,
      resyncs: sentinelResyncs,
      error_details: sentinelErrorDetails.slice(0, 10),
      subscribers: sentinels.length,
      missing,
      duplicates,
    },
    recovery: {
      before: before.sequence,
      after: after.sequence,
      same_digest: before.digest === after.digest,
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify({ summary, phases, samples }, null, 2) + "\n");
  const lines = [];
  lines.push("# Adaptive-mode soak test\n");
  lines.push(`Generated: ${summary.generated}`);
  lines.push(`Phase length: ${PHASE_SECONDS}s; samples: ${samples.length}\n`);
  lines.push("## Phase summary\n");
  lines.push(
    "| Phase | Accepted | Rejected | Errors | Moves/s | Move p50 | Move p95 | Queue max | Outbox max | Fsync p95 max | Lag p95 max | Batch end | Class | Batch changes | Direction flips |"
  );
  lines.push(
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|"
  );
  for (const phase of phaseSummary) {
    lines.push(
      `| ${phase.name} | ${phase.accepted} | ${phase.rejected} | ${phase.errors} | ` +
        `${phase.moves_per_second.toFixed(0)} | ${phase.move_p50_ms.toFixed(1)} ms | ` +
        `${phase.move_p95_ms.toFixed(1)} ms | ${phase.queue_max} | ${phase.outbox_max} | ` +
        `${(phase.fsync_p95_us_max / 1000).toFixed(1)} ms | ` +
        `${phase.event_lag_p95_ms_max.toFixed(1)} ms | ${phase.batch_end} | ` +
        `${phase.classification_end} | ${phase.batch_changes} | ${phase.direction_flips} |`
    );
  }
  lines.push("\n## Stability\n");
  lines.push(
    `- RSS: first median ${summary.rss_mb.first_median.toFixed(1)} MiB, last median ` +
      `${summary.rss_mb.last_median.toFixed(1)} MiB, max ${summary.rss_mb.max.toFixed(1)} MiB, ` +
      `growth ${summary.rss_mb.growth_mb.toFixed(1)} MiB.`
  );
  lines.push(
    `- File descriptors: first ${summary.fds.first}, last ${summary.fds.last}, max ${summary.fds.max}.`
  );
  lines.push(`- Maximum worker queue depth: ${summary.queue_max}.`);
  lines.push(`- Maximum outbox depth: ${summary.outbox_max}.`);
  lines.push(`- Maximum fsync p95: ${(summary.fsync_p95_us_max / 1000).toFixed(1)} ms.`);
  lines.push(`- Maximum event lag p95: ${summary.event_lag_p95_ms_max.toFixed(1)} ms.`);
  lines.push(`- Outbox drops: ${summary.outbox_dropped}; send failures: ${summary.send_failures}.`);
  lines.push(
    `- Sentinel: ${summary.sentinel.moves} moves, ${summary.sentinel.errors} errors, ` +
      `${summary.sentinel.resyncs} parities resynced; ` +
      `missing=${summary.sentinel.missing}, duplicates=${summary.sentinel.duplicates} ` +
      `across ${summary.sentinel.subscribers} subscribers.`
  );
  lines.push(
    `- Recovery: sequence ${summary.recovery.before} -> ${summary.recovery.after}; ` +
      `digest match=${summary.recovery.same_digest}.`
  );
  fs.writeFileSync(OUT_MD, lines.join("\n") + "\n");

  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`\nWrote ${OUT_MD}`);
  const bad =
    summary.sentinel.missing !== 0 ||
    summary.sentinel.duplicates !== 0 ||
    !summary.recovery.same_digest ||
    summary.sentinel.errors !== 0;
  process.exit(bad ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
