#!/usr/bin/env node
/*
 * Initial-load performance regression test.
 *
 * The client caches a 25 x 25 block of boards (625 boards). The original
 * protocol loaded them with 625 sequential 9-byte requests and 625 padded
 * 4096-byte replies: 2.56 MiB and roughly one second of round trips. The
 * batched protocol answers the same window in one variable-size frame of
 * about 30 KiB.
 *
 * This test spawns an isolated server, measures the batched window on a raw
 * WebSocket and in a headless browser, and compares it with the legacy
 * per-board path. It fails if the load regresses structurally (more than a
 * handful of frames, more than 128 KiB, or more than 500 ms in the browser)
 * or if the compact frame stops being dramatically smaller than the padded
 * baseline.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const DATA = path.join(os.tmpdir(), `sim-map-load-perf-${process.pid}`);
const WIRE_FRAME = 4096;
const BOARD_SCALE = 216;
const WINDOW_BOARDS = 25;
const WINDOW_COUNT = WINDOW_BOARDS * WINDOW_BOARDS;
const BATCH_LIMIT_BYTES = 128 * 1024;
const BATCH_LIMIT_MS = 500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

setTimeout(() => {
  console.error("FAIL: load performance test exceeded its overall deadline");
  process.exit(1);
}, 180_000);

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

async function startServer(port) {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  const log = path.join(DATA, "server.log");
  const fd = fs.openSync(log, "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      SIM_MAP_DATA_DIR: DATA,
      SIM_MAP_PORT: String(port),
      SIM_MAP_ADAPTIVE: "1",
      SIM_MAP_SNAPSHOT_MOVES: "0",
      SIM_MAP_SNAPSHOT_SECONDS: "0",
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

function wsClient(url) {
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";
  const batchPending = new Map();
  const singlePending = new Map();
  socket.onmessage = (message) => {
    const bytes = Buffer.from(message.data);
    if (bytes.length >= 13 && bytes[0] === 5) {
      const id = bytes.readInt32LE(1);
      const resolve = batchPending.get(id);
      if (resolve) {
        batchPending.delete(id);
        resolve(bytes);
      }
    } else if (bytes.length === WIRE_FRAME && bytes[0] === 2) {
      const id = bytes.readInt32LE(2);
      const resolve = singlePending.get(id);
      if (resolve) {
        singlePending.delete(id);
        resolve(bytes);
      }
    }
  };
  return {
    socket,
    open: () =>
      new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = () => reject(new Error("websocket connection failed"));
      }),
    close: () => socket.close(),
    batch: (id, x0, y0, x1, y1) =>
      new Promise((resolve, reject) => {
        const request = Buffer.alloc(13);
        request[0] = 6;
        request.writeInt32LE(id, 1);
        request.writeUInt16LE(x0, 5);
        request.writeUInt16LE(y0, 7);
        request.writeUInt16LE(x1, 9);
        request.writeUInt16LE(y1, 11);
        const timer = setTimeout(() => {
          batchPending.delete(id);
          reject(new Error(`batch snapshot ${id} timed out`));
        }, 10_000);
        batchPending.set(id, (bytes) => {
          clearTimeout(timer);
          resolve(bytes);
        });
        socket.send(request);
      }),
    single: (id, x, y) =>
      new Promise((resolve, reject) => {
        const request = Buffer.alloc(9);
        request[0] = 2;
        request.writeInt32LE(id, 1);
        request.writeUInt16LE(x, 5);
        request.writeUInt16LE(y, 7);
        const timer = setTimeout(() => {
          singlePending.delete(id);
          reject(new Error(`single snapshot (${x}, ${y}) timed out`));
        }, 5000);
        singlePending.set(id, (bytes) => {
          clearTimeout(timer);
          resolve(bytes);
        });
        socket.send(request);
      }),
  };
}

async function measureWire(port) {
  const client = wsClient(`ws://localhost:${port}/ws`);
  await client.open();
  let nextId = 1;
  try {
    // Warm the path once so the comparison is steady-state.
    await client.batch(nextId++, 0, 0, 24, 24);
    const batchTimes = [];
    let batchBytes = 0;
    for (let run = 0; run < 7; run++) {
      const started = process.hrtime.bigint();
      const bytes = await client.batch(nextId++, 0, 0, 24, 24);
      batchTimes.push(Number(process.hrtime.bigint() - started) / 1e6);
      batchBytes = bytes.length;
      if (bytes.readUInt16LE(9) !== WINDOW_BOARDS || bytes.readUInt16LE(11) !== WINDOW_BOARDS) {
        fail("batch reply did not cover the requested 25x25 window");
      }
    }
    batchTimes.sort((a, b) => a - b);
    const batchMedian = batchTimes[Math.floor(batchTimes.length / 2)];

    const started = process.hrtime.bigint();
    for (let y = 0; y < WINDOW_BOARDS; y++) {
      for (let x = 0; x < WINDOW_BOARDS; x++) {
        await client.single(nextId++, x, y);
      }
    }
    const legacyMs = Number(process.hrtime.bigint() - started) / 1e6;
    const legacyBytes = WINDOW_COUNT * WIRE_FRAME;

    if (!(legacyBytes >= batchBytes * 50)) {
      fail(
        `batched frame is not compact enough: ${batchBytes} vs ${legacyBytes} bytes`
      );
    }
    console.log(
      `wire: batch ${batchMedian.toFixed(2)} ms / ${batchBytes} bytes, ` +
      `legacy 625 singles ${legacyMs.toFixed(0)} ms / ${legacyBytes} bytes ` +
      `(${(legacyMs / Math.max(batchMedian, 0.01)).toFixed(0)}x latency, ` +
      `${(legacyBytes / batchBytes).toFixed(0)}x bytes)`
    );
    return { batchMedian, batchBytes, legacyMs, legacyBytes };
  } finally {
    client.close();
  }
}

async function waitForEndpoint(url, retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (_) {}
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function measureBrowser(port) {
  const cdpPort = 9800 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "load-perf-chrome-"));
  const chrome = spawn(
    "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1200,900",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  let ws;
  try {
    await waitForEndpoint(`http://127.0.0.1:${cdpPort}/json/version`);
    const targets = await (
      await fetch(`http://127.0.0.1:${cdpPort}/json/list`)
    ).json();
    const page = targets.find((target) => target.type === "page");
    if (!page) throw new Error("no page target");

    ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const received = [];
    let exceptions = 0;
    ws.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.id && pending.has(event.id)) {
        const entry = pending.get(event.id);
        pending.delete(event.id);
        event.error
          ? entry.reject(new Error(JSON.stringify(event.error)))
          : entry.resolve(event.result);
      } else if (event.method === "Network.webSocketFrameReceived") {
        received.push(
          Buffer.from(event.params.response.payloadData || "", "base64")
        );
      } else if (event.method === "Runtime.exceptionThrown") {
        exceptions += 1;
        console.error(
          "browser exception:",
          JSON.stringify(event.params.exceptionDetails)
        );
      }
    };
    await new Promise((resolve) => (ws.onopen = resolve));
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, { resolve, reject });
        ws.send(JSON.stringify({ id: requestId, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) {
        throw new Error(JSON.stringify(result.exceptionDetails));
      }
      return result.result.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    const started = Date.now();
    await send("Page.navigate", {
      url: `http://localhost:${port}/?x=12&y=12`,
    });

    let stats = null;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const raw = await evaluate(
        "JSON.stringify({loaded: document.body.dataset.loadedBoards, batches: document.body.dataset.snapshotBatches, bytes: document.body.dataset.snapshotBytes, ms: document.body.dataset.loadMs, status: document.getElementById('status')?.textContent})"
      ).catch(() => null);
      if (raw) {
        const value = JSON.parse(raw);
        if (Number(value.loaded) >= WINDOW_COUNT) {
          stats = value;
          break;
        }
      }
      await sleep(25);
    }
    const wallMs = Date.now() - started;
    if (!stats) fail(`browser did not load ${WINDOW_COUNT} boards`);

    const paddedSnapshots = received.filter(
      (bytes) => bytes.length === WIRE_FRAME && bytes[0] === 2
    ).length;
    const batchFrames = received.filter(
      (bytes) => bytes.length >= 13 && bytes[0] === 5
    );
    if (paddedSnapshots !== 0) {
      fail(`initial load used ${paddedSnapshots} padded single-board frames`);
    }
    if (batchFrames.length === 0 || batchFrames.length > 4) {
      fail(`initial load used ${batchFrames.length} batch frames`);
    }
    if (Number(stats.batches) > 4) {
      fail(`client reported ${stats.batches} batch frames`);
    }
    if (Number(stats.bytes) > BATCH_LIMIT_BYTES) {
      fail(`client loaded ${stats.bytes} bytes, limit ${BATCH_LIMIT_BYTES}`);
    }
    if (!(Number(stats.ms) > 0) || Number(stats.ms) > BATCH_LIMIT_MS) {
      fail(`client loaded 625 boards in ${stats.ms} ms, limit ${BATCH_LIMIT_MS}`);
    }
    if (exceptions !== 0) fail(`browser raised ${exceptions} exception(s)`);

    const ink = await evaluate(`(() => {
      const canvas = document.getElementById('game');
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const light = r === 240 && g === 217 && b === 181;
        const dark = r === 181 && g === 136 && b === 99;
        if (!light && !dark) count++;
      }
      return count;
    })()`);

    if (ink < 10_000) {
      fail(`only ${ink} piece pixels rendered after load`);
    }

    console.log(
      `browser: ${stats.loaded} boards in ${Number(stats.ms).toFixed(1)} ms ` +
      `(${wallMs} ms wall including page boot), ${stats.bytes} bytes, ` +
      `${stats.batches} batch frame(s), ${ink} piece pixels`
    );
    return { stats, wallMs };
  } finally {
    if (ws) try { ws.close(); } catch (_) {}
    chrome.kill("SIGTERM");
    await sleep(250);
    chrome.kill("SIGKILL");
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

async function main() {
  const port = await freePort();
  const server = await startServer(port);
  try {
    const wire = await measureWire(port);
    const browser = await measureBrowser(port);
    if (browser.stats.bytes > wire.batchBytes * 2) {
      fail(
        `browser loaded ${browser.stats.bytes} bytes but the server frame was ${wire.batchBytes}`
      );
    }
    console.log("Client load performance test passed.");
  } finally {
    await stopServer(server);
    fs.rmSync(DATA, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
