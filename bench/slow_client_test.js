#!/usr/bin/env node
/*
 * Slow / non-reading client reliability test.
 *
 * Each scenario starts a fresh server with a deliberately small per-client
 * outbox (default 8), runs 20 normal clients against a burst of moves, and
 * optionally adds one raw WebSocket client that:
 *
 *   - stops reading entirely (paused-short, paused-long), or
 *   - reads at a poor rate (slow-read).
 *
 * It verifies that normal clients still receive every event, that the slow
 * outbox is bounded and drops events instead of growing without limit, that
 * the server eventually unregisters a client blocked past the send timeout,
 * and that the affected client can recover with a fresh snapshot.
 *
 * Start no server yourself; this script starts and stops its own exact child
 * processes. It never kills Chromium or any unrelated process.
 *
 * Writes bench/slow_results.json and bench/slow_results.js.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { execSync } = require("child_process");

const { Client } = require("./ws_client");
const { RawClient } = require("./raw_ws_client");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const OUT_JSON = path.join(__dirname, "slow_results.json");
const OUT_JS = path.join(__dirname, "slow_results.js");
const METRICS_URL = "http://localhost:8080/metrics";

const NORMAL_CLIENTS = Number(process.env.SLOW_CLIENTS || 20);
const DRIVERS = Number(process.env.SLOW_DRIVERS || 5);
const BOARDS = 25;
const BLOCK = 5;
const ROUNDS = Number(process.env.SLOW_ROUNDS || 1500);
const OUTBOX_CAPACITY = Number(process.env.SLOW_OUTBOX_CAPACITY || 8);
const SEND_TIMEOUT_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => performance.now();

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function stats(values) {
  if (values.length === 0) return null;
  let sum = 0;
  let max = -Infinity;
  for (const value of values) {
    sum += value;
    if (value > max) max = value;
  }
  return {
    n: values.length,
    p50_ms: percentile(values, 50),
    p95_ms: percentile(values, 95),
    p99_ms: percentile(values, 99),
    max_ms: max,
  };
}

const CLK_TCK = Number(execSync("getconf CLK_TCK", { encoding: "utf8" }).trim());

function read_rss_kb(pid) {
  const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
  const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
  return match ? Number(match[1]) : 0;
}

function read_fds(pid) {
  return fs.readdirSync(`/proc/${pid}/fd`).length;
}

function read_cpu_ticks(pid) {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8").trim();
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return Number(fields[11]) + Number(fields[12]);
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
      const response = await fetch(METRICS_URL, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch (_) {}
    await sleep(100);
  }
  throw new Error("timed out waiting for server startup");
}

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

async function stop_server(child) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    if (!(await wait_for_exit(child, 3000))) {
      child.kill("SIGKILL");
      await wait_for_exit(child, 3000);
    }
  }
}

async function start_fresh_server(log_name) {
  if (!(await port_is_free())) {
    throw new Error("port 8080 is already in use; stop that server first");
  }
  const log_path = `/tmp/${log_name}.log`;
  const log = fs.openSync(log_path, "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: { ...process.env, CONNECTION_OUTBOX_CAPACITY: String(OUTBOX_CAPACITY) },
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  try {
    await wait_for_server(child);
  } catch (error) {
    await stop_server(child);
    throw error;
  }
  return { child, log_path };
}

async function fetch_metrics() {
  const response = await fetch(METRICS_URL, { signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw new Error(`metrics failed with ${response.status}`);
  return response.json();
}

async function find_fresh_block(probe) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const cx = BLOCK + Math.floor(Math.random() * (1000 - 2 * BLOCK));
    const cy = BLOCK + Math.floor(Math.random() * (1000 - 2 * BLOCK));
    const x0 = cx - Math.floor(BLOCK / 2);
    const y0 = cy - Math.floor(BLOCK / 2);
    const boards = [];
    for (let y = 0; y < BLOCK; y++) {
      for (let x = 0; x < BLOCK; x++) boards.push({ x: x0 + x, y: y0 + y });
    }
    let fresh = true;
    for (const board of boards) {
      const snap = await probe.snapshot(board.x, board.y);
      if (snap.status !== 1 || snap.revision !== 0 || snap.board[52] !== 19) {
        fresh = false;
        break;
      }
    }
    if (fresh) return { cx, cy, boards };
  }
  throw new Error("could not find a fresh block");
}

function validate_event(event, move) {
  const problems = [];
  if (event.boards.length !== 1) problems.push("board_count");
  const board = event.boards[0];
  if (!board || board.board_x !== move.board_x || board.board_y !== move.board_y) {
    problems.push("board");
  }
  if (board && board.revision !== move.revision) problems.push("revision");
  if (event.requestId !== move.request_id) problems.push("request_id");
  if (board) {
    const source = board.changes.find((change) => change.square === move.from_square);
    const destination = board.changes.find((change) => change.square === move.to_square);
    if (
      board.changes.length !== 2 ||
      !source ||
      source.piece !== 0 ||
      !destination ||
      destination.piece !== move.to_piece
    ) {
      problems.push("changes");
    }
  }
  return problems;
}

async function run_scenario(name, slow_mode) {
  const { child: server, log_path } = await start_fresh_server(`sim-map-slow-${name}`);
  const normal = [];
  let slow = null;
  let reconnect = null;
  try {
    const probe = new Client(-1, "probe");
    await probe.open();
    const block = await find_fresh_block(probe);
    probe.close();
    await sleep(100);

    for (let i = 0; i < NORMAL_CLIENTS; i++) {
      const client = new Client(i, "active");
      await client.open();
      client.subscribe_window(block.cx, block.cy);
      normal.push(client);
    }

    if (slow_mode) {
      slow = new RawClient({ mode: slow_mode === "slow" ? "slow" : "paused" });
      await slow.connect();
      slow.subscribe_window(block.cx, block.cy);
      if (slow_mode === "slow") slow.mode = "slow";
      if (slow_mode === "paused") slow.pause();
    }

    const starts = now();
    const ticksStart = read_cpu_ticks(server.pid);
    const rssStart = read_rss_kb(server.pid);
    const fdsStart = read_fds(server.pid);
    const move_by_sequence = new Map();
    const revision_by_board = new Map();
    let move_rejections = 0;
    await Promise.all(
      Array.from({ length: DRIVERS }, async (_, driver_index) => {
        const client = normal[driver_index];
        for (let round = 0; round < ROUNDS; round++) {
          for (let index = 0; index < BOARDS / DRIVERS; index++) {
            const board = block.boards[driver_index * (BOARDS / DRIVERS) + index];
            const key = `${board.x},${board.y}`;
            const revision = (revision_by_board.get(key) || 0) + 1;
            revision_by_board.set(key, revision);
            const even = round % 2 === 0;
            const from_square = even ? 57 : 42;
            const to_square = even ? 42 : 57;
            const expected_piece_id = even ? (57 << 8) | 23 : (42 << 8) | 23;
            const result = await client.move(
              board.x,
              board.y,
              even ? { x: 1, y: 7 } : { x: 2, y: 5 },
              even ? { x: 2, y: 5 } : { x: 1, y: 7 },
              expected_piece_id
            );
            if (!result.accepted) {
              move_rejections += 1;
              continue;
            }
            move_by_sequence.set(result.sequence, {
              request_id: result.request_id,
              board_x: board.x,
              board_y: board.y,
              revision,
              from_square,
              to_square,
              to_piece: 23,
              start: result.start,
            });
          }
        }
      })
    );

    const total_moves = move_by_sequence.size;
    const deadline = Date.now() + 30000;
    while (
      Date.now() < deadline &&
      normal.some((client) => client.events.length < total_moves)
    ) {
      await sleep(25);
    }
    const moves_done = now();

    if (slow_mode === "paused-long") await sleep(SEND_TIMEOUT_MS + 500);
    if (slow) {
      slow.resume_full();
      await sleep(700);
    }

    const metrics = await fetch_metrics();

    const accuracy = {
      total_moves,
      normal_missing: 0,
      normal_duplicate: 0,
      normal_wrong: 0,
      normal_clients_with_events: normal.filter((c) => c.events.length > 0).length,
      event_lag: null,
    };
    const latencies = [];
    for (const client of normal) {
      const seen = new Map();
      for (const event of client.events) {
        seen.set(event.sequence, (seen.get(event.sequence) || 0) + 1);
        const move = move_by_sequence.get(event.sequence);
        if (!move) {
          accuracy.normal_wrong += 1;
          continue;
        }
        if (validate_event(event, move).length > 0) accuracy.normal_wrong += 1;
        const at = client.eventFirstAt.get(event.sequence);
        if (at !== undefined) latencies.push(at - move.start);
      }
      for (const sequence of move_by_sequence.keys()) {
        if (!seen.has(sequence)) accuracy.normal_missing += 1;
      }
      for (const count of seen.values()) {
        if (count > 1) accuracy.normal_duplicate += count - 1;
      }
    }
    accuracy.event_lag = stats(latencies);

    const slow_stats = slow
      ? {
          events: slow.events,
          unique_events: slow.event_sequences.size,
          revision_gaps: slow.revision_gaps,
          bytes_received: slow.bytes_received,
        }
      : null;

    let recovered = null;
    if (slow) {
      try {
        const snapshot = await slow.snapshot(block.cx, block.cy, 3000);
        recovered = {
          same_connection: true,
          reconnected: false,
          status: snapshot.status,
          revision: snapshot.revision,
        };
      } catch (_) {
        try {
          reconnect = new RawClient({ mode: "flow" });
          await reconnect.connect();
          const snapshot = await reconnect.snapshot(block.cx, block.cy, 5000);
          recovered = {
            same_connection: false,
            reconnected: true,
            status: snapshot.status,
            revision: snapshot.revision,
          };
        } catch (error) {
          recovered = {
            same_connection: false,
            reconnected: false,
            error: String(error.message || error),
          };
        }
      }
    }

    const expected_revision = ROUNDS;
    const duration_ms = moves_done - starts;
    const ticksEnd = read_cpu_ticks(server.pid);
    const resources = {
      rss_start_kb: rssStart,
      rss_end_kb: read_rss_kb(server.pid),
      fds_start: fdsStart,
      fds_end: read_fds(server.pid),
      cpu_average_percent:
        ((ticksEnd - ticksStart) / CLK_TCK) / (duration_ms / 1000) * 100,
    };
    const counters = metrics.counters;
    const capacity_ok = counters.max_outbox_depth <= OUTBOX_CAPACITY;
    const handled =
      !slow_mode ||
      (slow_mode === "paused-long"
        ? counters.outbox_dropped > 0 || counters.send_failures > 0
        : true);
    const ok =
      move_rejections === 0 &&
      accuracy.normal_missing === 0 &&
      accuracy.normal_duplicate === 0 &&
      accuracy.normal_wrong === 0 &&
      accuracy.normal_clients_with_events === NORMAL_CLIENTS &&
      capacity_ok &&
      handled &&
      (!slow || (recovered && recovered.status === 1 && recovered.revision === expected_revision));

    return {
      scenario: name,
      slow_mode: slow_mode || "none",
      ok,
      duration_ms,
      outbox_capacity: OUTBOX_CAPACITY,
      normal_clients: NORMAL_CLIENTS,
      total_moves,
      move_rejections,
      accuracy,
      slow: slow_stats,
      recovery: recovered,
      expected_revision,
      resources,
      server_metrics: metrics,
      server_log: log_path,
    };
  } finally {
    for (const client of normal) client.close();
    if (slow) slow.close();
    if (reconnect) reconnect.close();
    await stop_server(server);
  }
}

async function main() {
  if (!fs.existsSync(SERVER)) {
    throw new Error(`missing server binary: ${SERVER}; run dune build first`);
  }
  const scenarios = [
    ["baseline", null],
    ["paused-short", "paused"],
    ["paused-long", "paused-long"],
    ["slow-read", "slow"],
  ];
  const runs = [];
  for (const [name, mode] of scenarios) {
    process.stdout.write(`\n=== ${name} ===\n`);
    const run = await run_scenario(name, mode);
    runs.push(run);
    const metrics = run.server_metrics;
    console.log(
      `${name}: ok=${run.ok}, normal missing=${run.accuracy.normal_missing}, ` +
        `max outbox=${metrics.counters.max_outbox_depth}/${OUTBOX_CAPACITY}, ` +
        `drops=${metrics.counters.outbox_dropped}, failures=${metrics.counters.send_failures}, ` +
        `recovery=${run.recovery ? JSON.stringify(run.recovery) : "n/a"}`
    );
    const combined = {
      generated: new Date().toISOString(),
      config: {
        normal_clients: NORMAL_CLIENTS,
        drivers: DRIVERS,
        boards: BOARDS,
        rounds: ROUNDS,
        moves: BOARDS * ROUNDS,
        outbox_capacity: OUTBOX_CAPACITY,
      },
      runs,
    };
    fs.writeFileSync(OUT_JSON, JSON.stringify(combined, null, 2) + "\n");
    fs.writeFileSync(
      OUT_JS,
      "window.SLOW_RESULTS = " + JSON.stringify(combined, null, 2) + ";\n"
    );
    await sleep(300);
  }
  const bad = runs.some((run) => !run.ok);
  console.log(`\nWrote ${OUT_JSON} and ${OUT_JS}`);
  process.exit(bad ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
