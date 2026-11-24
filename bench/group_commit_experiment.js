#!/usr/bin/env node
/*
 * Group-commit experiment runner.
 *
 * For each mode (strict sync, group sizes, no-sync) and each stress profile,
 * start a fresh real server process on an isolated data directory, drive the
 * workload through the WebSocket protocol, verify client-visible correctness,
 * collect latency/throughput/group-size metrics, then stop that exact server.
 *
 * Profiles:
 *   write-64      64 writers, no subscriptions, 10 moves each
 *   write-256     256 writers, no subscriptions, 20 moves each
 *   fanout-80     80 clients/80 drivers, 200 moves, 15x15 fresh block
 *   fanout-256    256 clients/256 drivers, 256 moves, 16x16 fresh block
 *   fanout-1020   1,020 clients/256 drivers, 256 moves, 16x16 fresh block
 *
 * Modes: sync, group-8/16/32/64/128/256, nosync.
 */

const { spawn, execFileSync } = require("child_process");
const { once } = require("events");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { Client } = require("./ws_client");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const WRITE_BURST = path.join(__dirname, "write_burst.js");
const LOAD_TEST = path.join(__dirname, "load_test.js");
const DATA_ROOT = path.join(ROOT, "bench-data-gc");
const METRICS_URL = "http://localhost:8080/metrics";

const ALL_MODES = [
  { name: "sync", group: 1, sync: 1 },
  { name: "group-8", group: 8, sync: 1 },
  { name: "group-16", group: 16, sync: 1 },
  { name: "group-32", group: 32, sync: 1 },
  { name: "group-64", group: 64, sync: 1 },
  { name: "group-128", group: 128, sync: 1 },
  { name: "group-256", group: 256, sync: 1 },
  { name: "nosync", group: 1, sync: 0 },
];

const ALL_PROFILES = [
  {
    name: "write-64",
    kind: "write",
    clients: 64,
    rounds: 10,
    modes: ALL_MODES.map((mode) => mode.name),
  },
  {
    name: "write-256",
    kind: "write",
    clients: 256,
    rounds: 20,
    modes: ALL_MODES.map((mode) => mode.name),
  },
  {
    name: "fanout-80",
    kind: "fanout",
    clients: 80,
    drivers: 80,
    moves: 200,
    block: 15,
    modes: ALL_MODES.map((mode) => mode.name),
  },
  {
    name: "fanout-256",
    kind: "fanout",
    clients: 256,
    drivers: 256,
    moves: 256,
    block: 16,
    modes: ALL_MODES.map((mode) => mode.name),
  },
  {
    name: "fanout-1020",
    kind: "fanout",
    clients: 1020,
    drivers: 256,
    moves: 256,
    block: 16,
    modes: ["sync", "group-16", "group-64", "group-256", "nosync"],
  },
];

const MODE_FILTER = (process.env.GC_MODES || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const PROFILE_FILTER = (process.env.GC_PROFILES || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const modes = MODE_FILTER.length
  ? ALL_MODES.filter((mode) => MODE_FILTER.includes(mode.name))
  : ALL_MODES;
const profiles = (
  PROFILE_FILTER.length
    ? ALL_PROFILES.filter((profile) => PROFILE_FILTER.includes(profile.name))
    : ALL_PROFILES
).map((profile) => ({
  ...profile,
  modes: profile.modes.filter((name) => modes.some((mode) => mode.name === name)),
}));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  throw new Error(message);
}

async function port_is_free() {
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

async function start_server(dataDir, mode, fresh = true) {
  if (fresh) {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.mkdirSync(dataDir, { recursive: true });
  } else {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!(await port_is_free())) fail("port 8080 is already in use");
  const logPath = path.join("/tmp", `sim-map-gc-${path.basename(dataDir)}.log`);
  const log = fs.openSync(logPath, "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      SIM_MAP_DATA_DIR: dataDir,
      SIM_MAP_WAL_GROUP: String(mode.group),
      SIM_MAP_WAL_SYNC: String(mode.sync),
      SIM_MAP_SNAPSHOT_MOVES: "0",
      SIM_MAP_SNAPSHOT_SECONDS: "0",
    },
    stdio: ["ignore", log, log],
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      fs.closeSync(log);
      fail(`server exited during startup; log ${logPath}`);
    }
    try {
      const response = await fetch(METRICS_URL, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        fs.closeSync(log);
        return { child, logPath };
      }
    } catch (_) {}
    await sleep(100);
  }
  child.kill("SIGKILL");
  fs.closeSync(log);
  fail(`server did not become ready; log ${logPath}`);
}

async function stop_server(server) {
  if (!server) return;
  if (server.child.exitCode === null && server.child.signalCode === null) {
    server.child.kill("SIGKILL");
    await once(server.child, "exit").catch(() => {});
  }
}

function run_node(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.once("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`command failed (${code})\n${stdout}\n${stderr}`));
    });
  });
}

async function read_json(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function remove_result_files(prefix) {
  for (const suffix of ["json", "js", "md"]) {
    fs.rmSync(path.join(__dirname, `${prefix}_results.${suffix}`), {
      force: true,
    });
  }
}

async function run_write(profile, mode) {
  const dataDir = path.join(DATA_ROOT, `${profile.name}-${mode.name}`);
  const output = `gc_write_${profile.name}_${mode.name}`;
  const server = await start_server(dataDir, mode);
  try {
    await run_node(WRITE_BURST, {
      LOAD_SERVER_PID: String(server.child.pid),
      WB_CLIENTS: String(profile.clients),
      WB_ROUNDS: String(profile.rounds),
      WB_LABEL: `${profile.name}/${mode.name}`,
      WB_OUTPUT: output,
    });
    const result = await read_json(
      path.join(__dirname, `${output}_results.json`)
    );
    remove_result_files(output);
    const errors =
      result.rejected +
      result.snapshot_errors +
      result.duplicate_sequences +
      (result.accepted === result.moves ? 0 : result.moves - result.accepted);
    return {
      profile: profile.name,
      mode: mode.name,
      configured_group: mode.group,
      fsync: mode.sync === 1,
      clients: profile.clients,
      moves: result.moves,
      duration_ms: result.duration_ms,
      moves_per_second: result.moves_per_second,
      move_p50_ms: result.move_rtt.p50_ms,
      move_p95_ms: result.move_rtt.p95_ms,
      move_p99_ms: result.move_rtt.p99_ms,
      event_lag_p50_ms: null,
      snapshot_p50_ms: null,
      accepted: result.accepted,
      rejected: result.rejected,
      errors,
      average_group_size: result.persistence
        ? result.persistence.average_group_size
        : null,
      sync_count: result.persistence ? result.persistence.sync_count : null,
      last_sync_ms: result.persistence ? result.persistence.last_sync_ms : null,
      cpu_percent:
        result.server.cpu_seconds !== null
          ? (result.server.cpu_seconds * 1000 * 100) / result.duration_ms
          : null,
      rss_mb: result.server.rss_kb ? result.server.rss_kb / 1024 : null,
      fds: result.server.fds_after,
    };
  } finally {
    await stop_server(server);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function run_fanout(profile, mode) {
  const dataDir = path.join(DATA_ROOT, `${profile.name}-${mode.name}`);
  const output = `gc_load_${profile.name}_${mode.name}`;
  const server = await start_server(dataDir, mode);
  try {
    await run_node(LOAD_TEST, {
      LOAD_SERVER_PID: String(server.child.pid),
      LOAD_CLIENTS: String(profile.clients),
      LOAD_SILENT: "4",
      LOAD_SNAPSHOTS: "4",
      LOAD_MOVES: String(profile.moves),
      LOAD_DRIVERS: String(profile.drivers),
      LOAD_BLOCK: String(profile.block),
      LOAD_LABEL: `${profile.name}/${mode.name}`,
      LOAD_OUTPUT: output,
      LOAD_DISTRIBUTION: "high",
    });
    await sleep(250);
    const result = await read_json(
      path.join(__dirname, `${output}_results.json`)
    );
    remove_result_files(output);
    const accuracy = result.accuracy;
    const events = accuracy.events;
    const errors =
      accuracy.moves_rejected +
      accuracy.snapshot_errors +
      events.missing_events +
      events.extra_events +
      events.duplicate_events +
      events.wrong_board_events +
      events.wrong_revision_events +
      events.wrong_change_events +
      events.wrong_request_id_events +
      events.wrong_board_count_events +
      events.silent_events +
      events.unexpected_closes +
      (accuracy.moves_accepted === result.totals.moves
        ? 0
        : result.totals.moves - accuracy.moves_accepted);
    const persistence = result.server_metrics
      ? result.server_metrics.persistence
      : null;
    return {
      profile: profile.name,
      mode: mode.name,
      configured_group: mode.group,
      fsync: mode.sync === 1,
      clients: profile.clients,
      moves: result.totals.moves,
      duration_ms: result.duration_ms,
      moves_per_second: (result.totals.moves * 1000) / result.duration_ms,
      move_p50_ms: result.move_rtt.p50_ms,
      move_p95_ms: result.move_rtt.p95_ms,
      move_p99_ms: result.move_rtt.p99_ms,
      event_lag_p50_ms: result.event_delivery_lag.p50_ms,
      snapshot_p50_ms: result.snapshot_rtt.p50_ms,
      accepted: accuracy.moves_accepted,
      rejected: accuracy.moves_rejected,
      errors,
      average_group_size: persistence ? persistence.average_group_size : null,
      sync_count: persistence ? persistence.sync_count : null,
      last_sync_ms: persistence ? persistence.last_sync_ms : null,
      cpu_percent: result.resources.cpu_average_percent,
      rss_mb: result.resources.rss_peak_kb / 1024,
      fds: result.resources.fds_peak,
    };
  } finally {
    await stop_server(server);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function state_hash() {
  const response = await fetch("http://localhost:8080/state-hash", {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) fail(`state hash returned ${response.status}`);
  return response.json();
}

const b1 = { x: 1, y: 7 };
const c3 = { x: 2, y: 5 };
const signature = (square) => (square << 8) | 23;

async function group_crash_case() {
  const mode = ALL_MODES.find((entry) => entry.name === "group-64");
  const dataDir = path.join(DATA_ROOT, "crash-group-64");
  const server = await start_server(dataDir, mode);
  let clients = [];
  try {
    clients = Array.from(
      { length: 64 },
      (_, index) => new Client(index, "active")
    );
    await Promise.all(clients.map((client) => client.open()));
    const results = await Promise.all(
      clients.map((client, index) =>
        client.move(500 + index, 500, b1, c3, signature(57))
      )
    );
    const accepted = results.filter((result) => result.accepted).length;
    if (accepted !== 64) fail(`group crash case accepted ${accepted}/64`);
    const before = await state_hash();
    for (const client of clients) client.close();
    clients = [];
    await stop_server(server);

    const restarted = await start_server(dataDir, mode, false);
    try {
      const after = await state_hash();
      if (before.digest !== after.digest || after.sequence !== "64") {
        fail("group-64 batch did not recover the acknowledged moves");
      }
      return {
        name: "group-64 crash recovery",
        accepted,
        sequence: after.sequence,
        digest: after.digest,
        ok: true,
      };
    } finally {
      await stop_server(restarted);
    }
  } finally {
    for (const client of clients) {
      try {
        client.close();
      } catch (_) {}
    }
    await stop_server(server);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function main() {
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  const results = [];
  const started = performance.now();
  let index = 0;
  const total = profiles.reduce(
    (sum, profile) => sum + profile.modes.length,
    0
  );
  for (const profile of profiles) {
    for (const modeName of profile.modes) {
      const mode = modes.find((entry) => entry.name === modeName);
      if (!mode) continue;
      index++;
      const runStarted = performance.now();
      process.stdout.write(
        `[${index}/${total}] ${profile.name} / ${mode.name} ... `
      );
      const result =
        profile.kind === "write"
          ? await run_write(profile, mode)
          : await run_fanout(profile, mode);
      results.push(result);
      process.stdout.write(
        `${result.moves_per_second.toFixed(0)} moves/s, ` +
          `move50 ${result.move_p50_ms.toFixed(1)} ms, ` +
          `group ${result.average_group_size === null ? "?" : result.average_group_size.toFixed(1)}, ` +
          `errors ${result.errors} (${(performance.now() - runStarted).toFixed(0)} ms)\n`
      );
      if (result.errors !== 0) {
        fail(`${profile.name}/${mode.name} had ${result.errors} errors`);
      }
    }
  }
  process.stdout.write("Running group-64 crash recovery ... ");
  const crash = await group_crash_case();
  process.stdout.write("ok\n");
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });

  const payload = {
    generated: new Date().toISOString(),
    modes,
    profiles: profiles.map((profile) => ({
      name: profile.name,
      kind: profile.kind,
      clients: profile.clients,
      modes: profile.modes,
      moves: profile.kind === "write"
        ? profile.clients * profile.rounds
        : profile.moves,
    })),
    results,
    crash,
    duration_ms: performance.now() - started,
  };
  fs.writeFileSync(
    path.join(__dirname, "group_commit_results.json"),
    JSON.stringify(payload, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(__dirname, "group_commit_results.js"),
    "window.GROUP_COMMIT_RESULTS = " +
      JSON.stringify(payload, null, 2) +
      ";\n"
  );
  console.log(
    `Group-commit experiment complete: ${results.length} runs, ` +
      `${payload.duration_ms.toFixed(0)} ms total, crash case ${crash.ok ? "ok" : "failed"}.`
  );
  execFileSync(process.execPath, [path.join(__dirname, "plot_group_commit.js")], {
    stdio: "inherit",
  });
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
