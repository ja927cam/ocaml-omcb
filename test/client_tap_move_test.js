#!/usr/bin/env node
/* Tap-to-select and tap-to-move browser test. */
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

setTimeout(() => {
  console.error("FAIL: tap move test exceeded its deadline");
  process.exit(1);
}, 120_000);

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

(async () => {
  const port = await freePort();
  const data = path.join(os.tmpdir(), `sim-map-tap-${process.pid}`);
  fs.rmSync(data, { recursive: true, force: true });
  fs.mkdirSync(data, { recursive: true });
  const logFd = fs.openSync(path.join(data, "server.log"), "w");
  const server = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      SIM_MAP_DATA_DIR: data,
      SIM_MAP_PORT: String(port),
      SIM_MAP_INTERFACE: "127.0.0.1",
      SIM_MAP_SNAPSHOT_MOVES: "0",
      SIM_MAP_SNAPSHOT_SECONDS: "0",
    },
    stdio: ["ignore", logFd, logFd],
  });
  fs.closeSync(logFd);
  for (let i = 0; i < 300; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break;
    } catch (_) {}
    await sleep(100);
  }

  const cdpPort = 9700 + Math.floor(Math.random() * 200);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-tap-"));
  const chrome = spawn(
    "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  try {
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).ok) break;
      } catch (_) {}
      await sleep(150);
    }
    const page = await (
      await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, {
        method: "PUT",
      })
    ).json();
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.id && pending.has(event.id)) {
        const entry = pending.get(event.id);
        pending.delete(event.id);
        event.error
          ? entry.reject(new Error(JSON.stringify(event.error)))
          : entry.resolve(event.result);
      }
    };
    await new Promise((resolve) => (ws.onopen = resolve));
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, { resolve, reject });
        ws.send(JSON.stringify({ id: requestId, method, params }));
      });
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source:
        "try { localStorage.setItem('sim-map.player-colour','white'); localStorage.setItem('sim-map.seen-intro','1'); } catch (_) {}",
    });
    await send("Page.navigate", {
      url: `http://127.0.0.1:${port}/?x=500&y=500`,
    });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
      });
      return result.result.value;
    };
    for (let i = 0; i < 100; i++) {
      if (Number(await evaluate("document.body?.dataset.loadedBoards || 0")) > 0) break;
      await sleep(100);
    }
    const geo = JSON.parse(
      await evaluate(`JSON.stringify((() => {
        const c = document.getElementById('game').getBoundingClientRect();
        return { x: c.x, y: c.y, w: c.width, h: c.height,
          left: +document.body.dataset.viewLeft,
          top: +document.body.dataset.viewTop,
          zoom: +document.body.dataset.zoom };
      })())`)
    );
    const boardPx = 216 * geo.zoom;
    const board = 500;
    const point = (col, row) => ({
      x: geo.x + ((board - geo.left) * boardPx) + (col + 0.5) * boardPx / 8,
      y: geo.y + ((board - geo.top) * boardPx) + (row + 0.5) * boardPx / 8,
    });
    const tap = async (p) => {
      await send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: p.x, y: p.y, id: 1 }],
      });
      await sleep(60);
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(350);
    };
    // Client bytes use 2 = bishop and 3 = knight. Selecting a blocked
    // bishop must not show knight jumps, and the b1 knight must show its
    // two open squares (a3 and c3).
    await tap(point(2, 7)); // white c1 bishop
    const bishop = JSON.parse(
      await evaluate(`JSON.stringify({
        square: document.body.dataset.selectedSquare,
        hints: document.body.dataset.hintCount,
        targets: document.body.dataset.hintTargets
      })`)
    );
    if (bishop.square !== "58" || bishop.hints !== "0") {
      throw new Error(`c1 bishop hints are wrong: ${JSON.stringify(bishop)}`);
    }
    await tap(point(1, 7)); // white b1 knight
    const knight = JSON.parse(
      await evaluate(`JSON.stringify({
        square: document.body.dataset.selectedSquare,
        hints: document.body.dataset.hintCount,
        targets: document.body.dataset.hintTargets
      })`)
    );
    if (knight.square !== "57" || knight.hints !== "2") {
      throw new Error(`b1 knight hints are wrong: ${JSON.stringify(knight)}`);
    }
    for (const square of ["40", "42"]) {
      if (!String(knight.targets).includes(`500:500:${square}`)) {
        throw new Error(`b1 knight is missing square ${square}: ${knight.targets}`);
      }
    }

    await tap(point(4, 6)); // white e2
    const selected = JSON.parse(
      await evaluate(`JSON.stringify({
        square: document.body.dataset.selectedSquare,
        board: document.body.dataset.selectedBoard,
        hints: document.body.dataset.hintCount,
        targets: document.body.dataset.hintTargets
      })`)
    );
    if (selected.square !== "52" || selected.board !== "500,500") {
      throw new Error(`e2 was not selected: ${JSON.stringify(selected)}`);
    }
    if (!(Number(selected.hints) >= 2)) {
      throw new Error(`expected pawn move hints, got ${selected.hints}: ${selected.targets}`);
    }
    await tap(point(4, 4)); // white e4
    const moved = JSON.parse(
      await evaluate(`JSON.stringify({
        pending: document.body.dataset.movePending || null,
        selected: document.body.dataset.selectedSquare || null,
        hints: document.body.dataset.hintCount || null
      })`)
    );
    if (moved.pending === "true") throw new Error("tap move did not settle");
    if (moved.selected !== null) throw new Error("selection was not cleared after moving");
    console.log("Client tap move test passed: e2 selected with hints, tap e4 moved and cleared selection.");
    ws.close();
  } finally {
    server.kill("SIGTERM");
    chrome.kill("SIGTERM");
    await sleep(300);
    chrome.kill("SIGKILL");
    try { server.kill("SIGKILL"); } catch (_) {}
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(data, { recursive: true, force: true });
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
