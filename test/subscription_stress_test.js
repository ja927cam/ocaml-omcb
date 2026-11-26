#!/usr/bin/env node
/*
 * Subscription lifecycle stress test.
 *
 * Visits progressively larger areas of the world over one WebSocket
 * connection and records server subscription count, RSS, move latency and
 * broadcast stage latency.
 *
 * MODE=add-only uses plain snapshot batch requests (the pre-review client
 * behaviour). MODE=bounded uses the window-reset batch request, which
 * atomically replaces the connection's subscription set. The bounded mode
 * must keep subscriptions at roughly the useful window regardless of how
 * many boards have been visited.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const MODE = process.env.MODE === "add-only" ? "add-only" : "bounded";
const RADIUS = 14;
const WINDOW_BOARDS = (RADIUS * 2 + 1) ** 2;
const WINDOW_STEP = 20;
const TARGET_VISITED = [1_000, 10_000, 50_000];
const TARGET_WINDOWS = TARGET_VISITED.map((n) => Math.ceil(n / 500));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

setTimeout(() => {
  console.error("FAIL: subscription stress test exceeded its deadline");
  process.exit(1);
}, 240_000);

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startServer(port, dataDir) {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const log = path.join(dataDir, "server.log");
  const fd = fs.openSync(log, "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      OCAML_OMCB_DATA_DIR: dataDir,
      OCAML_OMCB_PORT: String(port),
      OCAML_OMCB_INTERFACE: "127.0.0.1",
      OCAML_OMCB_SNAPSHOT_MOVES: "0",
      OCAML_OMCB_SNAPSHOT_SECONDS: "0",
    },
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`server exited during startup; see ${log}`);
    }
    try {
      const response = await fetch(`http://localhost:${port}/healthz`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return child;
    } catch (_) {}
    await sleep(100);
  }
  child.kill("SIGKILL");
  throw new Error(`server did not become healthy; see ${log}`);
}

async function stopServer(child) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      sleep(8000),
    ]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function run(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  ws.binaryType = "arraybuffer";
  let nextId = 1;
  const pending = new Map();
  const moveRtts = [];
  let events = 0;
  let rejected = 0;

  ws.onmessage = (message) => {
    const bytes = Buffer.from(message.data);
    if (bytes[0] === 4) events += 1;
    let id;
    if (bytes[0] === 5 || bytes[0] === 6) id = bytes.readInt32LE(1);
    else id = bytes.readInt32LE(2);
    const resolve = pending.get(id);
    if (resolve) {
      pending.delete(id);
      resolve(bytes);
    }
  };

  const request = (bytes, id, label, timeout = 4000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timeout ${label}`));
      }, timeout);
      pending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      ws.send(bytes);
    });

  const batch = async (cx, cy) => {
    const id = nextId++;
    const reset = MODE === "bounded";
    const bytes = Buffer.alloc(reset ? 18 : 13);
    bytes[0] = reset ? 7 : 6;
    bytes.writeInt32LE(id, 1);
    bytes.writeUInt16LE(cx - RADIUS, 5);
    bytes.writeUInt16LE(cy - RADIUS, 7);
    bytes.writeUInt16LE(cx + RADIUS, 9);
    bytes.writeUInt16LE(cy + RADIUS, 11);
    if (reset) {
      bytes.writeUInt16LE(cx, 13);
      bytes.writeUInt16LE(cy, 15);
      bytes[17] = RADIUS;
    }
    return request(bytes, id, "batch");
  };

  const move = async (bx, by) => {
    const id = nextId++;
    const bytes = Buffer.alloc(14);
    const source =
      (bx & 0x3ff) | ((by & 0x3ff) << 10) | (4 << 20) | (6 << 23);
    const packed =
      BigInt(source) |
      ((0n & 0x1ffn) << 26n) |
      ((-2n & 0x1ffn) << 35n);
    bytes.writeBigUInt64LE(packed, 0);
    bytes.writeInt32LE((52 << 8) | 19, 6);
    bytes.writeInt32LE(id, 10);
    const started = performance.now();
    const response = await request(bytes, id, "move");
    moveRtts.push(performance.now() - started);
    if (response[1] !== 1) rejected += 1;
  };

  const metrics = async () =>
    (await (await fetch(`http://127.0.0.1:${port}/metrics`)).json());

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("WebSocket failed to open"));
  });

  const base = await metrics();
  const targets = [];
  let windows = 0;
  let nextTarget = 0;
  let moveBoard = 0;

  for (let row = 0; row < 200 && nextTarget < TARGET_WINDOWS.length; row++) {
    const y = Math.min(985, 20 + row * WINDOW_STEP);
    const xs = [];
    for (let x = 20; x < 960; x += WINDOW_STEP) xs.push(x);
    if (row % 2) xs.reverse();
    for (const x of xs) {
      try {
        await batch(x, y);
      } catch (error) {
        fail(`${MODE} batch stalled after ${windows} windows: ${error.message}`);
      }
      windows += 1;
      const state = await metrics();
      if (windows >= TARGET_WINDOWS[nextTarget]) {
        const before = moveRtts.length;
        const beforeEvents = events;
        for (let i = 0; i < 5; i++) {
          const bx = Math.min(998, x + 3 + i);
          const by = Math.min(998, y + 3);
          moveBoard += 1;
          try {
            await move(bx, by);
          } catch (error) {
            fail(`${MODE} move stalled: ${error.message}`);
          }
        }
        await sleep(50);
        const after = await metrics();
        const moves = moveRtts.slice(before);
        targets.push({
          visited_target: TARGET_VISITED[nextTarget],
          windows,
          subscriptions: after.connections.subscriptions,
          rss_kb: after.memory.rss_kb,
          move_p50_ms: percentile(moves, 50),
          move_p95_ms: percentile(moves, 95),
          broadcast_p50_ms: after.stages.broadcast_dispatch.p50_ms,
          broadcast_p95_ms: after.stages.broadcast_dispatch.p95_ms,
          move_event_received: events > beforeEvents,
        });
        nextTarget += 1;
      }
      if (nextTarget >= TARGET_WINDOWS.length) break;
    }
  }

  const beforeReturn = await metrics();
  await batch(500, 500);
  const afterReturn = await metrics();
  const end = await metrics();
  const result = {
    mode: MODE,
    base: {
      subscriptions: base.connections.subscriptions,
      rss_kb: base.memory.rss_kb,
    },
    window_boards: WINDOW_BOARDS,
    windows,
    targets,
    return: {
      before: beforeReturn.connections.subscriptions,
      after: afterReturn.connections.subscriptions,
      final: end.connections.subscriptions,
    },
    moves: {
      total: moveRtts.length,
      rejected,
      p50_ms: percentile(moveRtts, 50),
      p95_ms: percentile(moveRtts, 95),
    },
    events,
    rss_kb: end.memory.rss_kb,
  };
  ws.close();
  await sleep(300);
  result.after_close_subscriptions =
    (await metrics()).connections.subscriptions;
  return result;
}

(async () => {
  const port = await freePort();
  const dataDir = path.join(os.tmpdir(), `ocaml-omcb-subscriptions-${MODE}-${process.pid}`);
  const server = await startServer(port, dataDir);
  try {
    const result = await run(port);
    if (MODE === "bounded") {
      if (result.targets.some((target) => target.subscriptions > 2_000)) {
        fail("bounded subscriptions exceeded 2,000");
      }
      if (result.return.after > 2_000) {
        fail("bounded subscriptions did not stay bounded after returning");
      }
      if (result.targets.some((target) => !target.move_event_received)) {
        fail("a move event was missed after a subscription reset");
      }
      if (result.after_close_subscriptions !== 0) {
        fail(`subscriptions remained after close: ${result.after_close_subscriptions}`);
      }
    }
    const out = path.join(ROOT, "bench", `subscriptions_${MODE.replace("-", "_")}.json`);
    fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await stopServer(server);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
