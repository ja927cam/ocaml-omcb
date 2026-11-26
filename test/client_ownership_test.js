#!/usr/bin/env node
/*
 * Client-side colour ownership test.
 *
 * A device may only move pieces of its assigned colour. The guard is in the
 * client: dragging an opponent piece pans instead of starting a drag and sends
 * no move request. Dragging an owned pawn still sends one.
 *
 * Requires the game server at http://localhost:8080 (override with
 * OCAML_OMCB_TEST_URL) and chromium on PATH.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SERVER = process.env.OCAML_OMCB_TEST_URL || process.env.SIM_MAP_TEST_URL || "http://localhost:8080/";
const WS_URL = SERVER.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
const BOARD_SCALE = 216;
const CELL = BOARD_SCALE / 8;
const CDP_PORT = 9300 + Math.floor(Math.random() * 400);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

setTimeout(() => {
  console.error("FAIL: colour ownership test exceeded its overall deadline");
  process.exit(1);
}, 120_000);

class Remote {
  constructor() {
    this.ws = new WebSocket(WS_URL);
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
        const id = bytes.readInt32LE(2);
        const resolve = this.pending.get(id);
        if (resolve) {
          this.pending.delete(id);
          resolve(bytes);
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
    return {
      revision: Number(response.readBigInt64LE(10)),
      board: response.subarray(18, 82),
    };
  }
  close() {
    this.ws.close();
  }
}

async function freshBoard(remote) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = 100 + Math.floor(Math.random() * 800);
    const y = 100 + Math.floor(Math.random() * 800);
    const snapshot = await remote.snapshot(x, y);
    if (
      snapshot.revision === 0 &&
      snapshot.board[52] === 19 &&
      snapshot.board[12] === 18
    ) {
      return { x, y };
    }
  }
  throw new Error("could not find a pristine board");
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

async function main() {
  try {
    const check = await fetch(SERVER, { signal: AbortSignal.timeout(3000) });
    if (!check.ok) throw new Error(`server returned ${check.status}`);
  } catch (error) {
    console.error(`Server is not available at ${SERVER}. Start it first.`);
    throw error;
  }

  const remote = new Remote();
  await remote.open();
  const board = await freshBoard(remote);
  remote.close();

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-ownership-"));
  const chrome = spawn(
    "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=800,700",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let ws;
  try {
    await waitForEndpoint(`http://127.0.0.1:${CDP_PORT}/json/version`);
    const targets = await (
      await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
    ).json();
    const page = targets.find((target) => target.type === "page");
    if (!page) throw new Error("no page target");

    ws = new WebSocket(page.webSocketDebuggerUrl);
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
    const waitFor = async (condition, message, timeout = 6000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await condition()) return;
        await sleep(50);
      }
      fail(message);
    };

    const hook = `(() => {
      window.__moveRequests = 0;
      const original = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        try {
          if (data instanceof ArrayBuffer && data.byteLength === 14) {
            window.__moveRequests++;
          }
        } catch (_) {}
        return original.call(this, data);
      };
    })();`;
    await send("Page.addScriptToEvaluateOnNewDocument", { source: hook });
    await send("Page.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "try { localStorage.setItem('ocaml-omcb.seen-intro', '1'); } catch (_) {}" });
    await send("Runtime.enable");
    await send("Page.navigate", { url: `${SERVER}?x=${board.x}&y=${board.y}` });

    await waitFor(
      async () => Number(await evaluate("document.body.dataset.loadedBoards")) >= 625,
      "the board cache did not load"
    );

    const colour = await evaluate("document.body.dataset.colour");
    if (colour !== "white" && colour !== "black") {
      fail(`invalid device colour: ${colour}`);
    }

    const canvasPoint = async (col, row) => {
      const info = JSON.parse(
        await evaluate(
          "JSON.stringify({width: document.getElementById('game').width, height: document.getElementById('game').height, rect: document.getElementById('game').getBoundingClientRect()})"
        )
      );
      const view = JSON.parse(
        await evaluate(
          "JSON.stringify({left: parseFloat(document.body.dataset.viewLeft), top: parseFloat(document.body.dataset.viewTop)})"
        )
      );
      const scaleX = info.rect.width / info.width;
      const scaleY = info.rect.height / info.height;
      return {
        x:
          info.rect.left +
          ((board.x - view.left) * BOARD_SCALE + (col + 0.5) * CELL) * scaleX,
        y:
          info.rect.top +
          ((board.y - view.top) * BOARD_SCALE + (row + 0.5) * CELL) * scaleY,
      };
    };

    const drag = async (from, to) => {
      const start = await canvasPoint(from.col, from.row);
      const end = await canvasPoint(to.col, to.row);
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: start.x,
        y: start.y,
        button: "left",
        clickCount: 1,
        buttons: 1,
      });
      await sleep(80);
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: end.x,
        y: end.y,
        button: "left",
        buttons: 1,
      });
      await sleep(120);
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: end.x,
        y: end.y,
        button: "left",
        clickCount: 1,
        buttons: 0,
      });
      await sleep(600);
    };

    // White owns e2/e4; black owns e7/e5 on a standard board.
    const white = { col: 4, row: 6 };
    const whiteTo = { col: 4, row: 4 };
    const black = { col: 4, row: 1 };
    const blackTo = { col: 4, row: 3 };
    const own = colour === "white" ? white : black;
    const ownTo = colour === "white" ? whiteTo : blackTo;
    const opponent = colour === "white" ? black : white;
    const opponentTo = colour === "white" ? blackTo : whiteTo;

    const beforeOpponent = await evaluate("window.__moveRequests");
    await drag(opponent, opponentTo);
    const afterOpponent = await evaluate("window.__moveRequests");
    if (afterOpponent !== beforeOpponent) {
      fail(
        `${colour} device sent a move request for an opponent piece ` +
          `(${beforeOpponent} -> ${afterOpponent})`
      );
    }

    const beforeOwn = await evaluate("window.__moveRequests");
    await drag(own, ownTo);
    await waitFor(
      async () => (await evaluate("window.__moveRequests")) > beforeOwn,
      `${colour} device did not send a move request for its own piece`
    );

    if (exceptions !== 0) fail(`browser raised ${exceptions} exception(s)`);
    console.log(
      `Colour ownership test passed: ${colour} device ignored an opponent ` +
        `drag and moved its own pawn on board (${board.x}, ${board.y}).`
    );
    await send("Browser.close");
  } finally {
    if (ws) try { ws.close(); } catch (_) {}
    chrome.kill("SIGTERM");
    await sleep(250);
    chrome.kill("SIGKILL");
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
