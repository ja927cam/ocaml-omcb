#!/usr/bin/env node
/*
 * Piece information panel test.
 *
 * Double-clicking a piece asks the server for its full record; a third click
 * opens the panel. This checks the request is sent on the second click, that
 * the panel opens on the third, and that white and black pieces both report
 * their colour, type, square and zero moves on a pristine board.
 *
 * Requires the game server at http://localhost:8080 (override with
 * SIM_MAP_TEST_URL) and chromium on PATH.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SERVER = process.env.SIM_MAP_TEST_URL || "http://localhost:8080/";
const WS_URL = SERVER.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
const BOARD_SCALE = 216;
const CELL = BOARD_SCALE / 8;
const CDP_PORT = 9200 + Math.floor(Math.random() * 400);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

setTimeout(() => {
  console.error("FAIL: piece information test exceeded its overall deadline");
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-piece-info-"));
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
      window.__pieceInfoRequests = 0;
      const original = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        try {
          if (data instanceof ArrayBuffer && data.byteLength === 10) {
            if (new Uint8Array(data)[0] === 8) window.__pieceInfoRequests++;
          }
        } catch (_) {}
        return original.call(this, data);
      };
    })();`;
    await send("Page.addScriptToEvaluateOnNewDocument", { source: hook });
    await send("Page.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "try { localStorage.setItem('sim-map.seen-intro', '1'); } catch (_) {}" });
    await send("Runtime.enable");
    await send("Page.navigate", { url: `${SERVER}?x=${board.x}&y=${board.y}` });

    await waitFor(
      async () => Number(await evaluate("document.body.dataset.loadedBoards")) >= 625,
      "the board cache did not load"
    );

    const canvasPoint = async (boardX, boardY, col, row) => {
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
          ((boardX - view.left) * BOARD_SCALE + (col + 0.5) * CELL) * scaleX,
        y:
          info.rect.top +
          ((boardY - view.top) * BOARD_SCALE + (row + 0.5) * CELL) * scaleY,
      };
    };

    const click = async (point, clickCount) => {
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: point.x,
        y: point.y,
        button: "left",
        clickCount,
        buttons: 1,
      });
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: point.x,
        y: point.y,
        button: "left",
        clickCount,
        buttons: 0,
      });
    };

    const tripleClick = async (point) => {
      for (let count = 1; count <= 3; count++) {
        await click(point, count);
        await sleep(90);
      }
    };

    const panelHidden = () =>
      evaluate("document.getElementById('piece-info').hidden");
    const panelText = () =>
      evaluate("document.getElementById('piece-info-body').textContent");
    const panelTitle = () =>
      evaluate("document.getElementById('piece-info-title').textContent");

    // e2 is a white pawn on a pristine board. The request goes on click two;
    // the panel stays closed until click three.
    const e2 = await canvasPoint(board.x, board.y, 4, 6);
    await click(e2, 1);
    await sleep(80);
    await click(e2, 2);
    await waitFor(
      async () => (await evaluate("window.__pieceInfoRequests")) >= 1,
      "double-click did not request piece information"
    );
    if (!(await panelHidden())) {
      fail("piece panel opened before the third click");
    }
    await click(e2, 3);
    await waitFor(
      async () => !(await panelHidden()),
      "triple-click did not open the piece panel"
    );
    await waitFor(
      async () => (await panelText()).includes("Pawn"),
      "piece panel did not receive the pawn information"
    );
    const whiteText = await panelText();
    for (const expected of ["Pawn", "White", "e2", "Moves", "0"]) {
      if (!whiteText.includes(expected)) {
        fail(`white piece panel is missing ${JSON.stringify(expected)}: ${whiteText}`);
      }
    }
    const structure = JSON.parse(
      await evaluate(`JSON.stringify({
        tag: document.getElementById('piece-info-body').tagName,
        glyph: document.querySelector('#piece-info-body .piece-glyph')?.textContent || '',
        stats: document.querySelectorAll('#piece-info-body .piece-stat').length,
        sections: document.querySelectorAll('#piece-info-body .piece-section').length
      })`)
    );
    if (structure.tag !== 'DIV') fail(`piece panel body is not readable DOM: ${structure.tag}`);
    if (!structure.glyph.trim()) fail('piece panel is missing its glyph');
    if (structure.stats < 4) fail(`piece panel only has ${structure.stats} stats`);
    if (structure.sections < 2) fail(`piece panel only has ${structure.sections} sections`);
    const title = await panelTitle();
    if (!title.includes(`(${board.x}, ${board.y})`)) {
      fail(`piece panel title did not identify the board: ${title}`);
    }

    await evaluate("document.getElementById('piece-info-close').click()");
    if (!(await panelHidden())) fail("close button did not hide the panel");

    // a7 is a black pawn on the same board; information is colour-agnostic.
    const a7 = await canvasPoint(board.x, board.y, 0, 1);
    await tripleClick(a7);
    await waitFor(
      async () => !(await panelHidden()),
      "triple-click did not open the black piece panel"
    );
    await waitFor(
      async () => (await panelText()).includes("Black"),
      "piece panel did not receive the black piece information"
    );
    const blackText = await panelText();
    for (const expected of ["Pawn", "Black", "a7"]) {
      if (!blackText.includes(expected)) {
        fail(`black piece panel is missing ${JSON.stringify(expected)}: ${blackText}`);
      }
    }

    if (exceptions !== 0) fail(`browser raised ${exceptions} exception(s)`);
    console.log(
      `Piece information test passed: double-click requested, triple-click ` +
        `opened white e2 and black a7 records on board (${board.x}, ${board.y}).`
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
