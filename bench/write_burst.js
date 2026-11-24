#!/usr/bin/env node
/*
 * Write-only burst harness for commit-policy experiments.
 *
 * Opens N WebSocket clients, gives each a distinct pristine board, and has
 * every client alternate a knight between b1 and c3. No board subscriptions
 * are installed, so the measured latency is move validation + WAL commit +
 * response, not event fan-out. A final snapshot per board verifies that every
 * acknowledged move was applied.
 *
 * Configuration:
 *   WB_CLIENTS=256       concurrent clients / boards
 *   WB_ROUNDS=20         moves per client
 *   WB_BOARD_X=100       first board x
 *   WB_BOARD_Y=100       board y
 *   WB_LABEL=...         label stored in the result
 *   WB_OUTPUT=...        output prefix in bench/
 *   LOAD_SERVER_PID=...  optional server PID for /proc metrics
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("./ws_client");

const CLIENTS = Number(process.env.WB_CLIENTS || 256);
const ROUNDS = Number(process.env.WB_ROUNDS || 20);
const BOARD_X = Number(process.env.WB_BOARD_X || 100);
const BOARD_Y = Number(process.env.WB_BOARD_Y || 100);
const LABEL = process.env.WB_LABEL || `${CLIENTS}x${ROUNDS}`;
const OUTPUT = process.env.WB_OUTPUT || "write_burst";
const SERVER_PID = process.env.LOAD_SERVER_PID
  ? Number(process.env.LOAD_SERVER_PID)
  : null;

const b1 = { x: 1, y: 7 };
const c3 = { x: 2, y: 5 };
const KNIGHT_BYTE = 23;
const signature = (square) => (square << 8) | KNIGHT_BYTE;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index];
}

function read_process(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8").trim();
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return {
      ticks: Number(fields[11]) + Number(fields[12]),
      rss_kb: Number(fields[21]),
    };
  } catch (_) {
    return null;
  }
}

function read_fds(pid) {
  try {
    return fs.readdirSync(`/proc/${pid}/fd`).length;
  } catch (_) {
    return null;
  }
}

async function fetch_metrics() {
  const response = await fetch("http://localhost:8080/metrics", {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`metrics returned ${response.status}`);
  return response.json();
}

async function main() {
  const clients = Array.from(
    { length: CLIENTS },
    (_, index) => new Client(index, "active")
  );
  await Promise.all(clients.map((client) => client.open()));

  const rtts = [];
  const accepted = [];
  const rejected = [];
  const sequences = new Set();
  const started = performance.now();
  let process_before = SERVER_PID ? read_process(SERVER_PID) : null;
  let fds_before = SERVER_PID ? read_fds(SERVER_PID) : null;

  for (let round = 0; round < ROUNDS; round++) {
    const even = round % 2 === 0;
    const from = even ? b1 : c3;
    const to = even ? c3 : b1;
    const expected = signature(even ? 57 : 42);
    const results = await Promise.all(
      clients.map(async (client, index) => {
        const board_x = BOARD_X + (index % 256);
        const board_y = BOARD_Y + Math.floor(index / 256);
        const moveStarted = performance.now();
        const result = await client.move(
          board_x,
          board_y,
          from,
          to,
          expected
        );
        const elapsed = performance.now() - moveStarted;
        return { result, elapsed, board_x, board_y };
      })
    );
    for (const { result, elapsed } of results) {
      rtts.push(elapsed);
      if (result.accepted) {
        accepted.push(result);
        sequences.add(result.sequence);
      } else {
        rejected.push(result);
      }
    }
  }
  const duration_ms = performance.now() - started;
  const process_after = SERVER_PID ? read_process(SERVER_PID) : null;
  const fds_after = SERVER_PID ? read_fds(SERVER_PID) : null;
  const metrics = await fetch_metrics().catch(() => null);

  // Verify every board ended on the expected square.
  let snapshot_errors = 0;
  const expected_at_b1 = ROUNDS % 2 === 0;
  for (let index = 0; index < clients.length; index++) {
    const board_x = BOARD_X + (index % 256);
    const board_y = BOARD_Y + Math.floor(index / 256);
    const snapshot = await clients[index].snapshot(board_x, board_y);
    const at_b1 = snapshot.board[57] !== 0;
    const at_c3 = snapshot.board[42] !== 0;
    if (snapshot.status !== 1 || (expected_at_b1 ? !at_b1 : !at_c3)) {
      snapshot_errors++;
    }
  }
  for (const client of clients) client.close();

  rtts.sort((a, b) => a - b);
  const timer_seconds =
    process_before && process_after
      ? (process_after.ticks - process_before.ticks) / 100
      : null;
  const result = {
    generated: new Date().toISOString(),
    label: LABEL,
    clients: CLIENTS,
    rounds: ROUNDS,
    board_base: { x: BOARD_X, y: BOARD_Y },
    moves: CLIENTS * ROUNDS,
    duration_ms,
    moves_per_second: (CLIENTS * ROUNDS * 1000) / duration_ms,
    move_rtt: {
      n: rtts.length,
      p50_ms: percentile(rtts, 0.5),
      p95_ms: percentile(rtts, 0.95),
      p99_ms: percentile(rtts, 0.99),
      max_ms: rtts.length ? rtts[rtts.length - 1] : 0,
    },
    accepted: accepted.length,
    rejected: rejected.length,
    duplicate_sequences:
      accepted.length - sequences.size,
    snapshot_errors,
    server: {
      cpu_seconds: timer_seconds,
      fds_before,
      fds_after,
      rss_kb: process_after ? process_after.rss_kb : null,
    },
    persistence: metrics ? metrics.persistence : null,
  };
  fs.writeFileSync(
    path.join(__dirname, `${OUTPUT}_results.json`),
    JSON.stringify(result, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(__dirname, `${OUTPUT}_results.js`),
    `window.WRITE_BURST_RESULTS = window.WRITE_BURST_RESULTS || {};\n` +
      `window.WRITE_BURST_RESULTS[${JSON.stringify(LABEL)}] = ` +
      JSON.stringify(result, null, 2) +
      ";\n"
  );
  console.log(
    `${LABEL}: ${result.moves} moves in ${duration_ms.toFixed(0)} ms, ` +
      `${result.moves_per_second.toFixed(0)} moves/s, ` +
      `p50 ${result.move_rtt.p50_ms.toFixed(1)} ms, ` +
      `p95 ${result.move_rtt.p95_ms.toFixed(1)} ms, ` +
      `accepted ${accepted.length}, rejected ${rejected.length}, ` +
      `snapshot errors ${snapshot_errors}, groups ` +
      (metrics ? metrics.persistence.average_group_size.toFixed(1) : "?") +
      `, syncs ${metrics ? metrics.persistence.sync_count : "?"}`
  );
  process.exit(
    rejected.length === 0 &&
      snapshot_errors === 0 &&
      accepted.length === CLIENTS * ROUNDS
      ? 0
      : 1
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
