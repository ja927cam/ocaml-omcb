#!/usr/bin/env node
/*
 * iPhone-sized touch regression test.
 *
 * Uses a 390 x 664 viewport at devicePixelRatio 3 and real touch events.
 * Checks that a slightly jittery fingertip still counts as a tap, that
 * tap-to-move works, and that dragging empty space pans the board.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Remote {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";
    this.pending = new Map();
    this.nextId = 1;
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error("remote websocket error"));
      this.ws.onmessage = (message) => {
        const bytes = Buffer.from(message.data);
        if (bytes.length !== 4096 || bytes[0] !== 2) return;
        const resolver = this.pending.get(bytes.readInt32LE(2));
        if (resolver) {
          this.pending.delete(bytes.readInt32LE(2));
          resolver(bytes);
        }
      };
    });
  }
  async snapshot(x, y) {
    const id = this.nextId++;
    const request = Buffer.alloc(9);
    request[0] = 2;
    request.writeInt32LE(id, 1);
    request.writeUInt16LE(x, 5);
    request.writeUInt16LE(y, 7);
    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("snapshot timed out"));
      }, 3000);
      this.pending.set(id, (bytes) => {
        clearTimeout(timer);
        resolve(bytes);
      });
      this.ws.send(request);
    });
    return response.subarray(18, 82);
  }
  close() {
    this.ws.close();
  }
}

setTimeout(() => {
  console.error("FAIL: touch test exceeded its deadline");
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
  const data = path.join(os.tmpdir(), `sim-map-touch-${process.pid}`);
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

  const remote = new Remote(`ws://127.0.0.1:${port}/ws`);
  await remote.open();

  const cdpPort = 9930 + Math.floor(Math.random() * 60);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-touch-"));
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
    let exceptions = 0;
    ws.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.id && pending.has(event.id)) {
        const entry = pending.get(event.id);
        pending.delete(event.id);
        event.error
          ? entry.reject(new Error(JSON.stringify(event.error)))
          : entry.resolve(event.result);
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
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 664,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5,
    });
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
      if (result.exceptionDetails) {
        throw new Error(JSON.stringify(result.exceptionDetails));
      }
      return result.result.value;
    };
    for (let i = 0; i < 150; i++) {
      if (Number(await evaluate("document.body?.dataset.loadedBoards || 0")) > 0)
        break;
      await sleep(100);
    }
    await sleep(300);
    const geo = JSON.parse(
      await evaluate(`JSON.stringify({
        left: +document.body.dataset.viewLeft,
        top: +document.body.dataset.viewTop,
        zoom: +document.body.dataset.zoom,
        rect: document.getElementById('game').getBoundingClientRect().toJSON()
      })`)
    );
    if (await evaluate("devicePixelRatio") !== 3) {
      throw new Error("devicePixelRatio emulation failed");
    }
    const boardPx = 216 * geo.zoom;
    const pointOn = (bx, by, col, row) => ({
      x: geo.rect.x + (bx - geo.left) * boardPx + (col + 0.5) * boardPx / 8,
      y: geo.rect.y + (by - geo.top) * boardPx + (row + 0.5) * boardPx / 8,
    });
    const point = (col, row) => pointOn(500, 500, col, row);
    const tap = async (p, jitter = 6) => {
      await send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: p.x, y: p.y, id: 1 }],
      });
      await send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: p.x + jitter, y: p.y + jitter, id: 1 }],
      });
      await sleep(30);
      await send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await sleep(450);
    };
    const drag = async (from, to) => {
      await send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: from.x, y: from.y, id: 1 }],
      });
      for (let step = 1; step <= 10; step++) {
        await send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: from.x + ((to.x - from.x) * step) / 10,
              y: from.y + ((to.y - from.y) * step) / 10,
              id: 1,
            },
          ],
        });
        await sleep(12);
      }
      await send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await sleep(500);
    };

    // A real fingertip drifts a few CSS pixels. At DPR 3 this used to fall
    // outside the old 12-canvas-pixel tap slop.
    await tap(point(4, 6), 6);
    const selected = JSON.parse(
      await evaluate(`JSON.stringify({
        square: document.body.dataset.selectedSquare || null,
        board: document.body.dataset.selectedBoard || null,
        hints: document.body.dataset.hintCount || null
      })`)
    );
    if (selected.square !== "52" || selected.board !== "500,500") {
      throw new Error(`e2 tap with jitter did not select: ${JSON.stringify(selected)}`);
    }
    if (!(Number(selected.hints) >= 2)) {
      throw new Error(`expected pawn move hints, got ${selected.hints}`);
    }
    await tap(point(4, 4), -4);
    const moved = JSON.parse(
      await evaluate(`JSON.stringify({
        pending: document.body.dataset.movePending || null,
        selected: document.body.dataset.selectedSquare || null
      })`)
    );
    if (moved.pending === "true") throw new Error("tap move did not settle");
    if (moved.selected !== null) throw new Error("selection was not cleared after moving");

    // Dragging a piece with a fingertip must move it, not pan.
    const dragFrom = pointOn(500, 500, 3, 6);
    const dragTo = pointOn(500, 500, 3, 4);
    await drag(dragFrom, dragTo);
    const draggedBoard = await remote.snapshot(500, 500);
    if (draggedBoard[51] !== 0 || draggedBoard[35] !== 51) {
      throw new Error(
        `touch drag did not move d2-d4: d2=${draggedBoard[51]}, d4=${draggedBoard[35]}`
      );
    }

    const before = JSON.parse(
      await evaluate(`JSON.stringify({
        left: +document.body.dataset.viewLeft,
        top: +document.body.dataset.viewTop
      })`)
    );
    const empty = point(3, 3);
    await drag(empty, { x: empty.x - 100, y: empty.y - 70 });
    const after = JSON.parse(
      await evaluate(`JSON.stringify({
        left: +document.body.dataset.viewLeft,
        top: +document.body.dataset.viewTop
      })`)
    );
    const dx = after.left - before.left;
    const dy = after.top - before.top;
    if (Math.abs(dx - 100 / 216) > 0.08 || Math.abs(dy - 70 / 216) > 0.08) {
      throw new Error(`touch drag did not pan correctly: dx=${dx}, dy=${dy}`);
    }

    if (exceptions !== 0) throw new Error(`browser raised ${exceptions} exception(s)`);
    console.log(
      `Touch test passed: jittery tap selected e2 and moved to e4; drag panned by ${dx.toFixed(2)}, ${dy.toFixed(2)} boards.`
    );
    await send("Browser.close").catch(() => {});
    ws.close();
  } finally {
    remote.close();
    server.kill("SIGTERM");
    chrome.kill("SIGTERM");
    await sleep(300);
    chrome.kill("SIGKILL");
    try {
      server.kill("SIGKILL");
    } catch (_) {}
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(data, { recursive: true, force: true });
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
