#!/usr/bin/env node
/*
 * Regression: a quiet move onto the same local square on an adjacent board.
 *
 * A queen on d4 must be able to move to d4 on the next board when that square
 * is empty. The client used to compare only the local square index and drop
 * the move before sending it.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

setTimeout(() => {
  console.error("FAIL: cross-board test exceeded its deadline");
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

class Game {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";
    this.pending = new Map();
    this.nextId = 1;
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error("game websocket error"));
      this.ws.onmessage = (message) => {
        const bytes = Buffer.from(message.data);
        if (bytes.length !== 4096) return;
        const resolver = this.pending.get(bytes.readInt32LE(2));
        if (resolver) {
          this.pending.delete(bytes.readInt32LE(2));
          resolver(bytes);
        }
      };
    });
  }
  request(bytes, kind, id) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("request timed out"));
      }, 3000);
      this.pending.set(id, (response) => {
        clearTimeout(timer);
        if (response[0] !== kind) reject(new Error("unexpected response kind"));
        else resolve(response);
      });
      this.ws.send(bytes);
    });
  }
  async snapshot(x, y) {
    const id = this.nextId++;
    const request = Buffer.alloc(9);
    request[0] = 2;
    request.writeInt32LE(id, 1);
    request.writeUInt16LE(x, 5);
    request.writeUInt16LE(y, 7);
    const response = await this.request(request, 2, id);
    return response.subarray(18, 82);
  }
  async move(boardX, boardY, srcX, srcY, dx, dy, piece) {
    const id = this.nextId++;
    const position =
      (boardX & 0x3ff) |
      ((boardY & 0x3ff) << 10) |
      (srcX << 20) |
      (srcY << 23);
    const packed =
      BigInt(position) |
      (BigInt(dx & 0x1ff) << 26n) |
      (BigInt(dy & 0x1ff) << 35n);
    const request = Buffer.alloc(14);
    for (let i = 0; i < 6; i++) {
      request[i] = Number((packed >> BigInt(i * 8)) & 255n);
    }
    request.writeInt32LE(((srcY * 8 + srcX) << 8) | piece, 6);
    request.writeInt32LE(id, 10);
    const response = await this.request(request, 1, id);
    if (response[1] !== 1) {
      throw new Error(`setup move rejected with code ${response[26]}`);
    }
  }
  close() {
    this.ws.close();
  }
}

(async () => {
  const port = await freePort();
  const data = path.join(os.tmpdir(), `ocaml-omcb-cross-board-${process.pid}`);
  fs.rmSync(data, { recursive: true, force: true });
  fs.mkdirSync(data, { recursive: true });
  const logFd = fs.openSync(path.join(data, "server.log"), "w");
  const server = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      OCAML_OMCB_DATA_DIR: data,
      OCAML_OMCB_PORT: String(port),
      OCAML_OMCB_INTERFACE: "127.0.0.1",
      OCAML_OMCB_SNAPSHOT_MOVES: "0",
      OCAML_OMCB_SNAPSHOT_SECONDS: "0",
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

  const game = new Game(`ws://127.0.0.1:${port}/ws`);
  await game.open();
  // d2-d4, d4-d5, Qd1-d4.
  await game.move(500, 500, 3, 6, 0, -2, 19);
  await game.move(500, 500, 3, 4, 0, -1, 51);
  await game.move(500, 500, 3, 7, 0, -3, 27);
  const prepared = await game.snapshot(500, 500);
  if (prepared[35] !== 27) throw new Error("queen did not reach d4");

  const cdpPort = 9960 + Math.floor(Math.random() * 30);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-cross-board-"));
  const chrome = spawn(
    "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1000,800",
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
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source:
        "try { localStorage.setItem('ocaml-omcb.player-colour','white'); localStorage.setItem('ocaml-omcb.seen-intro','1'); } catch (_) {}",
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
    for (let i = 0; i < 150; i++) {
      if (Number(await evaluate("document.body?.dataset.loadedBoards || 0")) > 0)
        break;
      await sleep(100);
    }
    await evaluate("document.getElementById('intro-close')?.click()");
    await sleep(300);
    const geo = JSON.parse(
      await evaluate(`JSON.stringify({
        left: +document.body.dataset.viewLeft,
        top: +document.body.dataset.viewTop,
        zoom: +document.body.dataset.zoom,
        rect: document.getElementById('game').getBoundingClientRect().toJSON()
      })`)
    );
    const boardPx = 216 * geo.zoom;
    const point = (bx, col, row) => ({
      x: geo.rect.x + (bx - geo.left) * boardPx + (col + 0.5) * boardPx / 8,
      y: geo.rect.y + (500 - geo.top) * boardPx + (row + 0.5) * boardPx / 8,
    });
    const click = async (p) => {
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: p.x,
        y: p.y,
        button: "left",
        clickCount: 1,
        buttons: 1,
      });
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: p.x,
        y: p.y,
        button: "left",
        clickCount: 1,
        buttons: 0,
      });
      await sleep(350);
    };

    await click(point(500, 3, 4));
    const selected = JSON.parse(
      await evaluate(`JSON.stringify({
        square: document.body.dataset.selectedSquare,
        board: document.body.dataset.selectedBoard,
        targets: document.body.dataset.hintTargets
      })`)
    );
    if (selected.square !== "35" || selected.board !== "500,500") {
      throw new Error(`queen d4 was not selected: ${JSON.stringify(selected)}`);
    }
    if (!String(selected.targets).includes("501:500:35")) {
      throw new Error(`adjacent d4 is not a hint target: ${selected.targets}`);
    }
    await click(point(501, 3, 4));
    await sleep(900);
    const settled = JSON.parse(
      await evaluate(`JSON.stringify({
        pending: document.body.dataset.movePending || null,
        selected: document.body.dataset.selectedSquare || null
      })`)
    );
    if (settled.pending === "true" || settled.selected !== null) {
      throw new Error(`same-square cross-board move did not settle: ${JSON.stringify(settled)}`);
    }
    const src = await game.snapshot(500, 500);
    const dst = await game.snapshot(501, 500);
    if (src[35] !== 0 || dst[35] !== 11) {
      throw new Error(
        `wrong board state: source d4=${src[35]}, destination d4=${dst[35]}`
      );
    }
    console.log(
      "Cross-board test passed: queen d4 moved to d4 on the adjacent board."
    );
    await send("Browser.close").catch(() => {});
    ws.close();
  } finally {
    game.close();
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
