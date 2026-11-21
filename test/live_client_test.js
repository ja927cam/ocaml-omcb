#!/usr/bin/env node
/*
 * Browser-side live event test.
 *
 * A remote WebSocket client moves pieces while the browser watches. The test
 * checks that the browser applies events, ignores a late duplicate event, and
 * requests a fresh snapshot when a board revision gap is injected.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SERVER = "http://localhost:8080/";
const BOARD_SCALE = 216;
const CELL = BOARD_SCALE / 8;
const CDP_PORT = 9800 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

function boardByte(bytes, square) {
  return bytes[square];
}

class Remote {
  constructor() {
    this.ws = new WebSocket("ws://localhost:8080/ws");
    this.ws.binaryType = "arraybuffer";
    this.pending = new Map();
    this.nextId = 1;
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error("remote ws error"));
      this.ws.onmessage = (message) => {
        const bytes = Buffer.from(message.data);
        if (bytes.length !== 4096) return;
        const resolve = this.pending.get(bytes[0]);
        if (resolve) {
          this.pending.delete(bytes[0]);
          resolve(bytes);
        }
      };
    });
  }
  request(bytes, kind) {
    return new Promise((resolve) => {
      this.pending.set(kind, resolve);
      this.ws.send(bytes);
    });
  }
  async snapshot(x, y) {
    const id = this.nextId++;
    const bytes = Buffer.alloc(9);
    bytes[0] = 2;
    bytes.writeInt32LE(id, 1);
    bytes.writeUInt16LE(x, 5);
    bytes.writeUInt16LE(y, 7);
    const response = await this.request(bytes, 2);
    return { revision: response.readInt32LE(10), board: response.subarray(14, 78) };
  }
  async moveTo(srcBX, srcBY, sx, sy, dstBX, dstBY, dx, dy) {
    const snap = await this.snapshot(srcBX, srcBY);
    const sq = sy * 8 + sx;
    const piece = snap.board[sq];
    if (!piece) throw new Error("remote move source is empty");
    const id = this.nextId++;
    const bytes = Buffer.alloc(14);
    const pos =
      (srcBX & 0x3ff) | ((srcBY & 0x3ff) << 10) | ((sx & 7) << 20) | ((sy & 7) << 23);
    const wdx = (dstBX * 8 + dx) - (srcBX * 8 + sx);
    const wdy = (dstBY * 8 + dy) - (srcBY * 8 + sy);
    const packed = BigInt(pos) | ((BigInt(wdx) & 0x1ffn) << 26n) | ((BigInt(wdy) & 0x1ffn) << 35n);
    bytes.writeBigUInt64LE(packed, 0);
    bytes.writeInt32LE((sq << 8) | piece, 6);
    bytes.writeInt32LE(id, 10);
    const response = await this.request(bytes, 1);
    if (response[1] !== 1) throw new Error(`remote move rejected ${response[26]}`);
  }
  close() { this.ws.close(); }
}

async function freshBoard(remote) {
  for (let i = 0; i < 30; i++) {
    const x = 100 + Math.floor(Math.random() * 800);
    const y = 100 + Math.floor(Math.random() * 800);
    const snap = await remote.snapshot(x, y);
    if (boardByte(snap.board, 52) === 19 && boardByte(snap.board, 12) === 18) {
      return { x, y };
    }
  }
  throw new Error("no fresh board");
}

async function main() {
  const remote = new Remote();
  await remote.open();
  const board = await freshBoard(remote);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-live-client-"));
  const chrome = spawn("chromium", [
    "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    "--window-size=800,700", `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });

  let ws;
  try {
    for (let i = 0; i < 40; i++) {
      try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) break; } catch (_) {}
      await sleep(250);
    }
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === "page");
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));
    let id = 0;
    const pending = new Map();
    ws.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.id && pending.has(event.id)) {
        const resolve = pending.get(event.id);
        pending.delete(event.id);
        resolve(event.result);
      }
    };
    const send = (method, params = {}) =>
      new Promise((resolve) => {
        const requestId = ++id;
        pending.set(requestId, resolve);
        ws.send(JSON.stringify({ id: requestId, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression, returnByValue: true, awaitPromise: true,
      });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async (condition, message, timeout = 6000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await condition()) return;
        await sleep(100);
      }
      fail(message);
    };

    const hook = `(() => {
      window.__eventFrames = [];
      window.__snapshotRequestCount = 0;
      const add = WebSocket.prototype.addEventListener;
      WebSocket.prototype.addEventListener = function (type, listener, options) {
        if (type !== 'message') return add.call(this, type, listener, options);
        const wrapped = (event) => {
          try {
            if (event.data instanceof ArrayBuffer && event.data.byteLength === 4096 &&
                new Uint8Array(event.data)[0] === 3) {
              window.__eventFrames.push({
                data: event.data.slice(0), listener, target: this,
              });
            }
          } catch (_) {}
          return listener.call(this, event);
        };
        return add.call(this, type, wrapped, options);
      };
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        try {
          if (data instanceof ArrayBuffer && data.byteLength === 9) {
            window.__snapshotRequestCount++;
          }
        } catch (_) {}
        return send.call(this, data);
      };
      window.__replayEvent = (index) => {
        const f = window.__eventFrames[index];
        if (!f) return false;
        const ev = new MessageEvent('message', { data: f.data.slice(0) });
        f.listener.call(f.target, ev);
        return true;
      };
      window.__injectGapEvent = (index, revision) => {
        const f = window.__eventFrames[index];
        if (!f) return false;
        const copy = new Uint8Array(f.data.slice(0));
        new DataView(copy.buffer).setInt32(18, revision, true);
        const ev = new MessageEvent('message', { data: copy.buffer });
        f.listener.call(f.target, ev);
        return true;
      };
    })();`;
    await send("Page.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: hook });
    await send("Page.navigate", { url: `${SERVER}?x=${board.x}&y=${board.y}` });
    await sleep(1500);

    const piecePixels = async (boardX, boardY, col, row) =>
      evaluate(`(() => {
        const canvas = document.getElementById('game');
        const ctx = canvas.getContext('2d');
        const left = parseFloat(document.body.dataset.viewLeft);
        const top = parseFloat(document.body.dataset.viewTop);
        const inset = 5;
        const x = (${boardX} - left) * ${BOARD_SCALE} + ${col} * ${CELL} + inset;
        const y = (${boardY} - top) * ${BOARD_SCALE} + ${row} * ${CELL} + inset;
        const data = ctx.getImageData(Math.round(x), Math.round(y),
          Math.round(${CELL}) - inset * 2, Math.round(${CELL}) - inset * 2).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          if (!((r === 240 && g === 217 && b === 181) ||
                (r === 181 && g === 136 && b === 99))) count++;
        }
        return count;
      })()`);

    await waitFor(async () => (await piecePixels(board.x, board.y, 4, 6)) > 20,
      "browser did not load the initial board");
    const beforeEvents = await evaluate("window.__eventFrames.length");

    await remote.moveTo(board.x, board.y, 4, 6, board.x, board.y, 4, 4);
    await waitFor(async () => (await piecePixels(board.x, board.y, 4, 4)) > 20,
      "browser did not apply first remote move");
    await remote.moveTo(board.x, board.y, 4, 4, board.x, board.y, 4, 3);
    await waitFor(async () => (await piecePixels(board.x, board.y, 4, 3)) > 20,
      "browser did not apply second remote move");
    await waitFor(async () => (await evaluate("window.__eventFrames.length")) >= beforeEvents + 2,
      "browser did not receive both live events");

    // Replaying the first event must be ignored by revision.
    await evaluate("window.__replayEvent(0)");
    await sleep(300);
    if ((await piecePixels(board.x, board.y, 4, 4)) > 5) {
      fail("late duplicate event was applied");
    }

    // Inject a revision gap from an old event. The client must request a
    // snapshot and keep the authoritative state.
    const snapshotsBefore = await evaluate("window.__snapshotRequestCount");
    await evaluate("window.__injectGapEvent(0, 999)");
    await waitFor(
      async () => (await evaluate("window.__snapshotRequestCount")) > snapshotsBefore,
      "revision gap did not trigger a snapshot request"
    );
    await sleep(500);
    if ((await piecePixels(board.x, board.y, 4, 4)) > 5) {
      fail("revision gap applied stale event changes");
    }
    if ((await piecePixels(board.x, board.y, 4, 3)) <= 20) {
      fail("revision gap lost the current pawn position");
    }

    console.log("Live client test passed: event apply, duplicate rejection and revision-gap resync.");
    await send("Browser.close");
    process.exit(0);
  } finally {
    if (ws) try { ws.close(); } catch (_) {}
    remote.close();
    chrome.kill("SIGKILL");
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
