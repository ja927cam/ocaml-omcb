#!/usr/bin/env node
/*
 * Progressive client-count scaling runner.
 *
 * Each level gets a fresh server process (exact child PID, never a broad
 * process kill), runs bench/load_test.js for that client count, waits for the
 * post-exit measurement, then stops the server and records the result.
 *
 * Default levels:
 *   0, 20, 40, 80, 160, 320, 640
 *
 * Configuration:
 *   SCALE_CLIENTS=0,20,40,...  comma-separated levels (use 0 for idle baseline)
 *   SCALE_MOVES=100            moves per level
 *   SCALE_SNAPSHOTS=4          snapshots per active client
 *   SCALE_DISTRIBUTION=high    high, low or partial
 *   SCALE_OUTBOX_CAPACITY=256  server per-client outbox capacity
 *   SCALE_STOP_ON_FAIL=1       stop at the first unstable level
 *
 * Writes bench/scale_results.json and bench/scale_results.js after every level.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const LOAD_TEST = path.join(__dirname, "load_test.js");
const OUT_JSON = path.join(__dirname, "scale_results.json");
const OUT_JS = path.join(__dirname, "scale_results.js");
const DIST_JSON = path.join(__dirname, "dist_results.json");
const DIST_JS = path.join(__dirname, "dist_results.js");
const METRICS_URL = "http://localhost:8080/metrics";

const LEVELS = (process.env.SCALE_CLIENTS || "0,20,40,80,160,320,640")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value >= 0);
const MOVES = Number(process.env.SCALE_MOVES || 100);
const SNAPSHOTS = Number(process.env.SCALE_SNAPSHOTS || 4);
const DISTRIBUTION = process.env.SCALE_DISTRIBUTION || "high";
const DIST_MODES = (process.env.SCALE_DISTRIBUTIONS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const OUTBOX_CAPACITY = Number(process.env.SCALE_OUTBOX_CAPACITY || 256);
const STOP_ON_FAIL = process.env.SCALE_STOP_ON_FAIL !== "0";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function wait_for_exit(child, timeout_ms) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve(true);
    const timer = setTimeout(() => resolve(false), timeout_ms);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
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

async function wait_for_server(child, timeout_ms = 30000) {
  const deadline = Date.now() + timeout_ms;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited during startup with ${child.exitCode}`);
    }
    try {
      const response = await fetch(METRICS_URL, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch (_) {}
    await sleep(100);
  }
  throw new Error("timed out waiting for server startup");
}

async function stop_server(child) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    if (!(await wait_for_exit(child, 3000))) {
      child.kill("SIGKILL");
      await wait_for_exit(child, 3000);
    }
  }
}

async function wait_for_result(file, timeout_ms = 10000) {
  const deadline = Date.now() + timeout_ms;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) {
      try {
        const result = JSON.parse(fs.readFileSync(file, "utf8"));
        if (result.resources && result.resources.fds_after_exit !== undefined) {
          return result;
        }
        if (result.baseline) return result;
      } catch (_) {}
    }
    await sleep(100);
  }
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  return null;
}

function write_scale(runs, error) {
  const combined = {
    generated: new Date().toISOString(),
    config: {
      levels: LEVELS,
      moves: MOVES,
      snapshots_per_client: SNAPSHOTS,
      distribution: DISTRIBUTION,
      outbox_capacity: OUTBOX_CAPACITY,
    },
    stopped_early: Boolean(error),
    error: error || null,
    runs,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(combined, null, 2) + "\n");
  fs.writeFileSync(
    OUT_JS,
    "window.SCALE_RESULTS = " + JSON.stringify(combined, null, 2) + ";\n"
  );
}

async function run_level(count, options = {}) {
  if (!(await port_is_free())) {
    throw new Error("port 8080 is already in use; stop that server first");
  }
  const mode = options.distribution || DISTRIBUTION;
  const output = options.output || `scale_${count}`;
  const label = options.label || `clients-${count}`;
  const log_path = `/tmp/sim-map-${output}.log`;
  const log = fs.openSync(log_path, "w");
  const server = spawn(SERVER, [], {
    cwd: ROOT,
    env: { ...process.env, CONNECTION_OUTBOX_CAPACITY: String(OUTBOX_CAPACITY) },
    stdio: ["ignore", log, log],
  });
  try {
    await wait_for_server(server);
    const env = {
      ...process.env,
      LOAD_SERVER_PID: String(server.pid),
      LOAD_CLIENTS: String(count),
      LOAD_SILENT: count === 0 ? "0" : "4",
      LOAD_SNAPSHOTS: count === 0 ? "0" : String(SNAPSHOTS),
      LOAD_MOVES: count === 0 ? "0" : String(MOVES),
      LOAD_DRIVERS: count === 0 ? "0" : String(Math.min(40, count)),
      LOAD_BLOCK: "10",
      LOAD_LABEL: label,
      LOAD_OUTPUT: output,
      LOAD_DISTRIBUTION: mode,
      LOAD_BASELINE: count === 0 ? "1" : "0",
    };
    const child = spawn(process.execPath, [LOAD_TEST], {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    const exit_code = await new Promise((resolve) => {
      child.once("exit", (code, signal) =>
        resolve(code === null ? `signal:${signal}` : code)
      );
    });
    const result = await wait_for_result(
      path.join(__dirname, `${output}_results.json`)
    );
    return {
      clients: count,
      distribution: mode,
      ok: exit_code === 0,
      exit_code,
      server_log: log_path,
      stderr: stderr.slice(-4000),
      stdout: stdout.slice(-4000),
      result,
    };
  } finally {
    fs.closeSync(log);
    await stop_server(server);
  }
}

function write_distributions(runs, error) {
  const combined = {
    generated: new Date().toISOString(),
    config: {
      levels: LEVELS,
      modes: DIST_MODES,
      moves: MOVES,
      snapshots_per_client: SNAPSHOTS,
      outbox_capacity: OUTBOX_CAPACITY,
    },
    stopped_early: Boolean(error),
    error: error || null,
    runs,
  };
  fs.writeFileSync(DIST_JSON, JSON.stringify(combined, null, 2) + "\n");
  fs.writeFileSync(
    DIST_JS,
    "window.DIST_RESULTS = " + JSON.stringify(combined, null, 2) + ";\n"
  );
}

async function run_distributions() {
  const runs = [];
  let error = null;
  for (const mode of DIST_MODES) {
    for (const count of LEVELS) {
      process.stdout.write(`\n=== ${mode}, ${count} clients ===\n`);
      try {
        const run = await run_level(count, {
          distribution: mode,
          output: `dist_${mode}_${count}`,
          label: `dist-${mode}-${count}`,
        });
        runs.push(run);
        write_distributions(runs, null);
        if (!run.ok) {
          error = `${mode} at ${count} clients failed`;
          if (STOP_ON_FAIL) break;
        }
        const r = run.result;
        if (r && !r.baseline) {
          const e = r.accuracy.events;
          console.log(
            `${mode} ${count}: ${r.totals.requests} requests, ` +
              `${r.server_metrics.counters.recipients / r.server_metrics.counters.events_broadcast} recipients/event, ` +
              `move p50 ${r.move_rtt.p50_ms.toFixed(1)} ms, ` +
              `${e.missing_events} missing/${e.extra_events} extra`
          );
        }
      } catch (e) {
        error = String(e.message || e);
        console.error(`${mode} ${count} failed: ${error}`);
        if (STOP_ON_FAIL) break;
      }
      await sleep(300);
    }
    if (error && STOP_ON_FAIL) break;
  }
  write_distributions(runs, error);
  console.log(`\nWrote ${DIST_JSON} and ${DIST_JS}`);
  process.exit(error ? 1 : 0);
}

async function main() {
  if (!fs.existsSync(SERVER)) {
    throw new Error(`missing server binary: ${SERVER}; run dune build first`);
  }
  if (DIST_MODES.length > 0) return run_distributions();
  const runs = [];
  let error = null;
  for (const count of LEVELS) {
    process.stdout.write(`\n=== ${count} clients ===\n`);
    try {
      const run = await run_level(count);
      runs.push(run);
      write_scale(runs, null);
      if (!run.ok) {
        error = `level ${count} failed`;
        if (STOP_ON_FAIL) break;
      }
      const r = run.result;
      if (r && !r.baseline) {
        console.log(
          `${count} clients: ${r.totals.requests} requests, move p50 ${r.move_rtt.p50_ms.toFixed(1)} ms, ` +
            `lag p50 ${r.event_delivery_lag.p50_ms.toFixed(1)} ms, CPU ${r.resources.cpu_average_percent.toFixed(1)}%`
        );
      } else if (r) {
        console.log(`${count} clients: idle baseline, ${r.resources.fds_baseline} fds`);
      }
    } catch (e) {
      error = String(e.message || e);
      console.error(`level ${count} failed: ${error}`);
      if (STOP_ON_FAIL) break;
    }
    await sleep(300);
  }
  write_scale(runs, error);
  console.log(`\nWrote ${OUT_JSON} and ${OUT_JS}`);
  process.exit(error ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
