#!/usr/bin/env node
/*
 * Adaptive group-commit transition experiment.
 *
 * Runs the same phase sequence against fixed batch 16, fixed batch 64 and the
 * adaptive controller:
 *   quiet -> heavy writes -> quiet -> high fan-out -> mixed -> snapshot writes
 *
 * Writers alternate a knight on distinct boards. Fan-out clients subscribe to
 * a hot 25x25 window and verify every event from the fan-out/mixed/snapshot
 * phases exactly once. The sampler records the adaptive policy, queue depth,
 * fsync latency, outbox backlog and event lag every 100 ms.
 */

const { spawn, execFileSync } = require("child_process");
const { once } = require("events");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { Client } = require("./ws_client");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const DATA_ROOT = path.join(ROOT, "bench-data-adaptive");
const SERVER_URL = "http://localhost:8080";
const METRICS_URL = `${SERVER_URL}/metrics`;
const B1 = { x: 1, y: 7 };
const C3 = { x: 2, y: 5 };
const KNIGHT_BYTE = 23;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => performance.now();

const MODES = [
  { name: "fixed-16", adaptive: 0, group: 16, delay_us: 0 },
  { name: "fixed-64", adaptive: 0, group: 64, delay_us: 0 },
  { name: "adaptive", adaptive: 1, group: 64, delay_us: 0 },
];

const REPS = Math.max(1, Number(process.env.ADAPTIVE_REPS || 3));
const HEAVY_WRITERS = 128;
const FANOUT_CLIENTS = 256;
const HOT_WRITERS = 8;
const MIXED_WRITERS = 16;
const HOT_CX = 702;
const HOT_CY = 702;

function fail(message) {
  throw new Error(message);
}

function heavyBoard(index) {
  return { x: 100 + (index % 16), y: 100 + Math.floor(index / 16) };
}
function hotBoard(index) {
  return { x: 700 + (index % 6), y: 700 + Math.floor(index / 6) };
}
function quietBoard(index) {
  return { x: 200 + index, y: 200 };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1)
  );
  return sorted[index];
}

async function port_free() {
  return new Promise((resolve) => {
    const socket = net.connect(8080, "::1");
    const done = (free) => {
      socket.destroy();
      resolve(free);
    };
    socket.once("connect", () => done(false));
    socket.once("error", () => done(true));
    socket.setTimeout(500, () => done(true));
  });
}

async function start_server(mode, rep) {
  const suffix = `${mode.name}-${rep + 1}`;
  const dataDir = path.join(DATA_ROOT, suffix);
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  if (!(await port_free())) fail("port 8080 is already in use");
  const log = path.join("/tmp", `sim-map-adaptive-${suffix}.log`);
  const fd = fs.openSync(log, "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      SIM_MAP_DATA_DIR: dataDir,
      SIM_MAP_ADAPTIVE: String(mode.adaptive),
      SIM_MAP_ADAPTIVE_MAX: "256",
      SIM_MAP_WAL_GROUP: String(mode.group),
      SIM_MAP_WAL_GROUP_DELAY_US: String(mode.delay_us),
      SIM_MAP_SNAPSHOT_MOVES: "3000",
      SIM_MAP_SNAPSHOT_SECONDS: "0",
    },
    stdio: ["ignore", fd, fd],
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      fs.closeSync(fd);
      fail(`server exited during startup; log ${log}`);
    }
    try {
      const response = await fetch(METRICS_URL, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        fs.closeSync(fd);
        return { child, log, dataDir };
      }
    } catch (_) {}
    await sleep(100);
  }
  child.kill("SIGKILL");
  fs.closeSync(fd);
  fail(`server did not become ready; log ${log}`);
}

// Removing a 500 MiB snapshot makes btrfs do a lot of deferred work. Flush it
// before the next mode starts so one run's teardown does not distort the next
// run's latency measurements.
function settle_disk() {
  execFileSync("sync", { stdio: "ignore" });
}

async function stop_server(server) {
  if (!server) return;
  if (server.child.exitCode === null && server.child.signalCode === null) {
    server.child.kill("SIGKILL");
    await once(server.child, "exit").catch(() => {});
  }
}

function read_metrics() {
  return fetch(METRICS_URL, { signal: AbortSignal.timeout(3000) }).then(
    (response) => {
      if (!response.ok) throw new Error(`metrics ${response.status}`);
      return response.json();
    }
  );
}

function sample_of(metrics, phase, t) {
  const persistence = metrics.persistence || {};
  const worker = metrics.worker || {};
  const connections = metrics.connections || {};
  return {
    t,
    phase,
    adaptive: metrics.adaptive || null,
    move_queue_depth: worker.move_queue_depth ?? null,
    queue_depth: worker.queue_depth ?? null,
    moves_processed: Number(worker.moves_processed || 0),
    sync_count: persistence.sync_count ?? null,
    average_group_size: persistence.average_group_size ?? null,
    fsync_p50_us: persistence.fsync_p50_us ?? null,
    fsync_p95_us: persistence.fsync_p95_us ?? null,
    snapshot_pending: persistence.snapshot_pending ?? null,
    snapshot_write_ms: persistence.snapshot_write_ms ?? null,
    outbox_depth: connections.total_outbox_depth ?? 0,
    max_outbox_depth: connections.max_outbox_depth ?? 0,
    event_lag_p95_ms: metrics.end_to_end_p95_ms ?? 0,
  };
}

async function run_mode(mode, rep) {
  const server = await start_server(mode, rep);
  const data = {
    mode: mode.name,
    rep: rep + 1,
    started: new Date().toISOString(),
    phases: [],
    samples: [],
    moves: [],
    errors: [],
    correctness: null,
  };
  let writers = [];
  let fanout = [];
  let phase = "startup";
  let sampling = true;
  const start = now();

  const sampler = (async () => {
    while (sampling) {
      try {
        const metrics = await read_metrics();
        data.samples.push(sample_of(metrics, phase, now() - start));
      } catch (_) {}
      await sleep(100);
    }
  })();

  try {
    writers = Array.from(
      { length: HEAVY_WRITERS },
      (_, index) => new Client(index, "active")
    );
    fanout = Array.from(
      { length: FANOUT_CLIENTS },
      (_, index) => new Client(1000 + index, "silent")
    );
    await Promise.all([
      ...writers.map((client) => client.open()),
      ...fanout.map((client) => client.open()),
    ]);

    const board_counts = new Map();
    const all_moves = [];
    const hot_moves = [];

    const knight_move = async (client, bx, by, phase_name) => {
      const key = `${bx},${by}`;
      const count = board_counts.get(key) || 0;
      const even = count % 2 === 0;
      const from = even ? B1 : C3;
      const to = even ? C3 : B1;
      const expected = ((even ? 57 : 42) << 8) | KNIGHT_BYTE;
      const send_at = now();
      try {
        const result = await client.move(bx, by, from, to, expected);
        const rtt = now() - send_at;
        if (!result.accepted) {
          data.errors.push({ phase: phase_name, kind: "rejected", board: [bx, by] });
          return;
        }
        board_counts.set(key, count + 1);
        const move = {
          sequence: result.sequence,
          bx,
          by,
          rtt,
          send_at: result.start,
          phase: phase_name,
        };
        all_moves.push(move);
        if (phase_name !== "quiet" && phase_name !== "heavy" && phase_name !== "quiet-again") {
          hot_moves.push(move);
        }
      } catch (error) {
        data.errors.push({
          phase: phase_name,
          kind: "request",
          board: [bx, by],
          error: String(error && error.message ? error.message : error),
        });
        await sleep(10);
      }
    };

    const run_burst = async (name, duration_ms, active_writers, boards, delay_ms) => {
      phase = name;
      const phase_start = now();
      const end = phase_start + duration_ms;
      await Promise.all(
        active_writers.map(async (client, index) => {
          // One writer per board keeps the knight parity unambiguous.
          const board = boards[index % boards.length];
          while (now() < end) {
            await knight_move(client, board.x, board.y, name);
            if (delay_ms > 0) await sleep(delay_ms);
          }
        })
      );
      const phase_moves = all_moves.filter((move) => move.phase === name);
      data.phases.push({
        name,
        start_t: phase_start - start,
        end_t: now() - start,
        duration_ms: now() - phase_start,
        moves: phase_moves.length,
      });
    };

    const heavy_boards = Array.from({ length: HEAVY_WRITERS }, (_, i) =>
      heavyBoard(i)
    );
    const quiet_boards = Array.from({ length: 2 }, (_, i) => quietBoard(i));
    const hot_boards = Array.from({ length: 24 }, (_, i) => hotBoard(i));

    await run_burst("quiet", 2000, writers.slice(0, 2), quiet_boards, 40);
    await run_burst("heavy", 5000, writers, heavy_boards, 0);
    await run_burst("quiet-again", 1500, writers.slice(0, 2), quiet_boards, 40);

    for (const client of fanout) client.subscribe_window(HOT_CX, HOT_CY);
    // Wait until every 25x25 fan-out window is registered on the server.
    const subscription_target = FANOUT_CLIENTS * 25 * 25;
    const subscription_deadline = now() + 5000;
    while (now() < subscription_deadline) {
      const metrics = await read_metrics().catch(() => null);
      if (
        metrics &&
        (metrics.connections?.subscriptions || 0) >= subscription_target
      ) {
        break;
      }
      await sleep(100);
    }
    await sleep(150);
    await run_burst(
      "fanout",
      3000,
      writers.slice(0, HOT_WRITERS),
      hot_boards.slice(0, HOT_WRITERS),
      0
    );
    await run_burst(
      "mixed",
      3000,
      writers.slice(0, MIXED_WRITERS),
      hot_boards.slice(0, MIXED_WRITERS),
      0
    );
    await run_burst(
      "snapshot",
      3000,
      writers.slice(0, MIXED_WRITERS),
      hot_boards.slice(0, MIXED_WRITERS),
      0
    );
    sampling = false;
    await sampler;

    const hot_set = new Set(hot_moves.map((move) => move.sequence));

    // Judge only after the final broadcast has drained: the last events can
    // still be queued in a slow subscriber's socket when the writers stop.
    const missing_pairs = () => {
      const pairs = [];
      for (const [client_index, client] of fanout.entries()) {
        for (const move of hot_moves) {
          if ((client.eventCounts.get(move.sequence) || 0) === 0) {
            pairs.push({
              client: client_index,
              phase: move.phase,
              sequence: move.sequence,
            });
          }
        }
      }
      return pairs;
    };
    let pending_missing = missing_pairs();
    let stable = 0;
    const drain_deadline = now() + 5000;
    while (pending_missing.length > 0 && now() < drain_deadline) {
      await sleep(250);
      const next = missing_pairs();
      stable = next.length === pending_missing.length ? stable + 1 : 0;
      pending_missing = next;
      if (stable >= 2) break;
    }
    const missing_detail = pending_missing;
    const missing_by_phase = {};
    for (const entry of missing_detail) {
      missing_by_phase[entry.phase] = (missing_by_phase[entry.phase] || 0) + 1;
    }
    const missing_by_client = {};
    for (const entry of missing_detail) {
      missing_by_client[entry.client] = (missing_by_client[entry.client] || 0) + 1;
    }
    let missing = 0;
    let duplicates = 0;
    let unexpected = 0;
    const lags = [];
    const phase_lags = new Map();
    for (const client of fanout) {
      for (const move of hot_moves) {
        const count = client.eventCounts.get(move.sequence) || 0;
        if (count === 0) missing++;
        else if (count > 1) duplicates++;
        const received = client.eventFirstAt.get(move.sequence);
        if (received !== undefined) {
          const lag = received - move.send_at;
          lags.push(lag);
          if (!phase_lags.has(move.phase)) phase_lags.set(move.phase, []);
          phase_lags.get(move.phase).push(lag);
        }
      }
      for (const sequence of client.eventCounts.keys()) {
        if (!hot_set.has(sequence)) unexpected++;
      }
    }
    lags.sort((a, b) => a - b);

    const final_metrics = await read_metrics().catch(() => null);
    const persistence = final_metrics ? final_metrics.persistence : {};
    const counters = final_metrics ? final_metrics.counters || {} : {};
    const snapshotSamples = data.samples.filter(
      (sample) => sample.snapshot_pending || sample.snapshot_writing
    ).length;
    data.correctness = {
      accepted: all_moves.length,
      errors: data.errors.length,
      missing,
      duplicates,
      unexpected,
      outbox_dropped: counters.outbox_dropped || 0,
      send_failures: counters.send_failures || 0,
      full_outbox_unregisters: counters.full_outbox_unregisters || 0,
      hot_moves: hot_moves.length,
      fanout_clients: fanout.length,
      missing_by_phase,
      missing_by_client,
      event_lag_p50_ms: percentile(lags, 0.5),
      event_lag_p95_ms: percentile(lags, 0.95),
      retained_snapshots: persistence.snapshots || 0,
      last_snapshot_sequence: persistence.last_snapshot_sequence ?? null,
      snapshot_pending_at_end: persistence.snapshot_pending ?? null,
      snapshot_writing_at_end: persistence.snapshot_writing ?? null,
      snapshot_samples: snapshotSamples,
    };

    for (const phase of data.phases) {
      const rtts = all_moves
        .filter((move) => move.phase === phase.name)
        .map((move) => move.rtt)
        .sort((a, b) => a - b);
      phase.move_p50_ms = percentile(rtts, 0.5);
      phase.move_p95_ms = percentile(rtts, 0.95);
      phase.move_p99_ms = percentile(rtts, 0.99);
      phase.moves_per_second = rtts.length
        ? (rtts.length * 1000) / phase.duration_ms
        : 0;
      const phase_samples = data.samples.filter(
        (sample) => sample.phase === phase.name
      );
      if (phase_samples.length > 0) {
        const first = phase_samples[0];
        const last = phase_samples[phase_samples.length - 1];
        phase.syncs =
          first.sync_count !== null && last.sync_count !== null
            ? last.sync_count - first.sync_count
            : null;
        phase.average_group_size =
          phase.syncs && phase.syncs > 0
            ? phase.moves / phase.syncs
            : null;
        phase.fsync_p95_us = last.fsync_p95_us;
        phase.event_lag_p95_ms = last.event_lag_p95_ms;
        phase.adaptive_batch_start = first.adaptive
          ? first.adaptive.max_batch_size
          : null;
        phase.adaptive_batch_end = last.adaptive
          ? last.adaptive.max_batch_size
          : null;
        phase.adaptive_delay_start = first.adaptive
          ? first.adaptive.max_batch_delay_us
          : null;
        phase.adaptive_delay_end = last.adaptive
          ? last.adaptive.max_batch_delay_us
          : null;
        phase.classification_end = last.adaptive
          ? last.adaptive.classification
          : null;
      }
      const lag_values = (phase_lags.get(phase.name) || []).sort((a, b) => a - b);
      phase.client_event_lag_p50_ms = percentile(lag_values, 0.5);
      phase.client_event_lag_p95_ms = percentile(lag_values, 0.95);
    }
    data.mode_metrics = persistence;
    data.ok =
      data.errors.length === 0 &&
      missing === 0 &&
      duplicates === 0 &&
      unexpected === 0 &&
      persistence.last_snapshot_sequence !== null &&
      persistence.last_snapshot_sequence !== undefined;
    return data;
  } finally {
    sampling = false;
    for (const client of writers) {
      try {
        client.close();
      } catch (_) {}
    }
    for (const client of fanout) {
      try {
        client.close();
      } catch (_) {}
    }
    await stop_server(server);
    fs.rmSync(server.dataDir, { recursive: true, force: true });
    settle_disk();
  }
}

async function main() {
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  settle_disk();
  const runs = [];
  for (let rep = 0; rep < REPS; rep++) {
    // Rotate the order across repetitions so thermal or ordering bias does not
    // consistently favour one mode.
    const order = MODES.map(
      (_, index) => MODES[(index + rep) % MODES.length]
    );
    for (const mode of order) {
      process.stdout.write(`rep ${rep + 1}/${REPS} ${mode.name} ... `);
      const result = await run_mode(mode, rep);
      runs.push(result);
      process.stdout.write(
        `${result.ok ? "ok" : "FAIL"} (${result.correctness.accepted} moves, ` +
          `${result.correctness.missing} missing, ${result.correctness.duplicates} duplicates, ` +
          `${result.correctness.unexpected} unexpected)\n`
      );
    }
  }
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });
  const payload = {
    generated: new Date().toISOString(),
    phases: runs[0] ? runs[0].phases.map((phase) => phase.name) : [],
    modes: MODES.map((mode) => mode.name),
    reps: REPS,
    runs,
  };
  fs.writeFileSync(
    path.join(__dirname, "adaptive_commit_results.json"),
    JSON.stringify(payload, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(__dirname, "adaptive_commit_results.js"),
    "window.ADAPTIVE_COMMIT_RESULTS = " +
      JSON.stringify(payload, null, 2) +
      ";\n"
  );
  const failed = runs.filter((run) => !run.ok).length;
  console.log(
    `Adaptive commit transitions: ${runs.length - failed}/${runs.length} clean.`
  );
  execFileSync(process.execPath, [path.join(__dirname, "plot_adaptive_commit.js")], {
    stdio: "inherit",
  });
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
