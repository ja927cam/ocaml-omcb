#!/usr/bin/env node
/*
 * Deliberate WebSocket write-failure test.
 *
 * Requires a running server at http://localhost:8080. A raw client subscribes
 * to a move window and then stops reading. A normal client generates a large
 * event burst until the raw client's outbox/send path is backpressured. The raw
 * TCP socket is then reset, which forces the next server write to fail.
 *
 * The server must remain responsive, return to idle CPU, reclaim the connection
 * and keep serving another client. This specifically exercises the vendored
 * httpun-ws Wsd patch: a failed write discards pending bytes and reports Close
 * instead of retrying the same frame forever.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Client } = require("../bench/ws_client");
const { RawClient } = require("../bench/raw_ws_client");

const SERVER = "http://localhost:8080/";
const BLOCK = 5;
const BOARDS = 25;
const ROUNDS = 1500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

function server_pid() {
  if (process.env.LOAD_SERVER_PID) return Number(process.env.LOAD_SERVER_PID);
  return Number(execSync("pgrep -n -x server.exe", { encoding: "utf8" }).trim());
}

function read_cpu_ticks(pid) {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8").trim();
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return Number(fields[11]) + Number(fields[12]);
}

function read_fds(pid) {
  return fs.readdirSync(`/proc/${pid}/fd`).length;
}

async function fetch_metrics(timeout_ms = 3000) {
  const response = await fetch(`${SERVER}metrics`, {
    signal: AbortSignal.timeout(timeout_ms),
    headers: { Connection: "close" },
  });
  if (!response.ok) throw new Error(`metrics returned ${response.status}`);
  return response.json();
}

async function fresh_block(client) {
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
      const snap = await client.snapshot(board.x, board.y);
      if (snap.status !== 1 || snap.revision !== 0 || snap.board[52] !== 19) {
        fresh = false;
        break;
      }
    }
    if (fresh) return { cx, cy, boards };
  }
  throw new Error("could not find a fresh block");
}

async function main() {
  const pid = server_pid();
  const probe = new RawClient({ mode: "flow" });
  await probe.connect();
  const block = await fresh_block(probe);
  probe.reset();

  const drivers = Array.from({ length: 5 }, (_, index) => new Client(1 + index, "active"));
  await Promise.all(drivers.map((client) => client.open()));
  drivers.forEach((client) => client.subscribe_window(block.cx, block.cy));

  const fds_without_slow = read_fds(pid);

  const slow = new RawClient({ mode: "paused" });
  await slow.connect();
  slow.subscribe_window(block.cx, block.cy);
  slow.pause();

  const fds_before = read_fds(pid);
  const ticks_before = read_cpu_ticks(pid);
  const started = performance.now();

  // 25 boards, 1,500 rounds = 37,500 moves. Each board alternates a knight
  // between b1 and c3; the drivers keep reading normally while the raw client
  // intentionally does not.
  await Promise.all(
    drivers.map(async (client, driver_index) => {
      for (let round = 0; round < ROUNDS; round++) {
        for (let index = 0; index < BOARDS / drivers.length; index++) {
          const board = block.boards[driver_index * (BOARDS / drivers.length) + index];
          const even = round % 2 === 0;
          const result = await client.move(
            board.x,
            board.y,
            even ? { x: 1, y: 7 } : { x: 2, y: 5 },
            even ? { x: 2, y: 5 } : { x: 1, y: 7 },
            even ? (57 << 8) | 23 : (42 << 8) | 23
          );
          if (!result.accepted) fail(`move rejected on (${board.x},${board.y})`);
        }
      }
    })
  );

  // Give the sender time to be blocked on a write for the paused raw client.
  await sleep(500);
  console.log(`Generated ${BOARDS * ROUNDS} moves.`);

  // Force a reset while the server has a pending write.
  slow.reset();
  await sleep(3000);

  // Measure descriptors before the control HTTP request adds one.
  let fds_after = read_fds(pid);
  for (let i = 0; i < 50 && fds_after > fds_without_slow; i++) {
    await sleep(100);
    fds_after = read_fds(pid);
  }

  let metrics_after;
  try {
    metrics_after = await fetch_metrics(3000);
  } catch (error) {
    fail(`server was unresponsive after write failure: ${error.message}`);
  }

  const ticks_start = read_cpu_ticks(pid);
  await sleep(1000);
  const ticks_end = read_cpu_ticks(pid);
  const idle_ticks = ticks_end - ticks_start;
  if (idle_ticks > 20) fail(`server busy after write failure: ${idle_ticks} ticks/s`);

  if (fds_after > fds_without_slow + 1) {
    fail(
      `connection resources not reclaimed: fds without slow ${fds_without_slow}, ` +
        `before ${fds_before}, after ${fds_after}`
    );
  }
  if (metrics_after.counters.send_failures === 0) {
    fail("no write failure was observed");
  }

  // The surviving driver must still receive and apply events.
  const board = block.boards[0];
  const final_move = await drivers[0].move(
    board.x,
    board.y,
    { x: 1, y: 7 },
    { x: 2, y: 5 },
    (57 << 8) | 23
  );
  if (!final_move.accepted) fail("surviving client could not move after failure");

  const result = {
    generated: new Date().toISOString(),
    moves: BOARDS * ROUNDS,
    duration_ms: performance.now() - started,
    fds_without_slow,
    fds_before,
    fds_after,
    idle_ticks_per_second: idle_ticks,
    drops_after_reset: metrics_after.counters.outbox_dropped,
    send_failures: metrics_after.counters.send_failures,
    clients_after: metrics_after.connections.clients,
    responsive: true,
    surviving_client: true,
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "bench", "write_failure_results.json"),
    JSON.stringify(result, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(__dirname, "..", "bench", "write_failure_results.js"),
    "window.WRITE_FAILURE_RESULTS = " + JSON.stringify(result, null, 2) + ";\n"
  );

  console.log(
    `WebSocket write-failure test passed: ${result.moves} moves, ` +
      `${result.drops_after_reset} drops, ${result.send_failures} failed sends, ` +
      `${idle_ticks} idle ticks/s, fds ${fds_before} -> ${fds_after}.`
  );
  drivers.forEach((client) => client.close());
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
