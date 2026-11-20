#!/usr/bin/env node
/*
 * Browser-level grid snapshot integration test.
 *
 * Requires the game server at http://localhost:8080, Node with fetch/WebSocket,
 * and chromium on PATH. It spawns its own headless browser.
 *
 * The client shows a pannable 3x3-board viewport (about nine boards) and caches
 * at most a 25x25 board window around the selected centre. This test checks
 * that neighbouring boards render together, that dragging empty space pans the
 * map, that only nearby boards are requested, and that moves stay authoritative
 * across board switches and reloads.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CDP_PORT = 9223 + Math.floor(Math.random() * 500);
const SERVER = "http://localhost:8080/";
const CANVAS = 512;
const BOARD_SCALE = 168;
const CELL = BOARD_SCALE / 8;
const VISIBLE_BOARDS = CANVAS / BOARD_SCALE;
// Pick a fresh board each run: moves are authoritative and persist on the
// long-running test server.
const BOARD = {
  x: 400 + Math.floor(Math.random() * 200),
  y: 400 + Math.floor(Math.random() * 200),
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-client-test-"));
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
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
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
        event.error ? entry.reject(new Error(JSON.stringify(event.error))) : entry.resolve(event.result);
      } else if (event.method === "Runtime.exceptionThrown") {
        exceptions += 1;
        console.error("browser exception:", JSON.stringify(event.params.exceptionDetails));
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
        await sleep(100);
      }
      fail(message);
    };

    await send("Page.enable");
    await send("Runtime.enable");

    // Record the 9-byte snapshot requests and 14-byte move requests the client
    // puts on the wire, without changing the page itself.
    const hook = `(() => {
      window.__snapshotRequests = [];
      window.__moveRequests = [];
      const original = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        try {
          if (data instanceof ArrayBuffer && data.byteLength === 9) {
            const view = new DataView(data);
            window.__snapshotRequests.push([view.getUint16(5, true), view.getUint16(7, true)]);
          } else if (data instanceof ArrayBuffer && data.byteLength === 14) {
            const view = new DataView(data);
            const src = view.getUint32(0, true) & 0x3ffffff;
            window.__moveRequests.push([
              src & 0x3ff,
              (src >>> 10) & 0x3ff,
              (src >>> 20) & 7,
              (src >>> 23) & 7,
            ]);
          }
        } catch (_) {}
        return original.call(this, data);
      };
    })();`;
    await send("Page.addScriptToEvaluateOnNewDocument", { source: hook });
    await send("Page.navigate", { url: SERVER });
    await sleep(1500);

    const readView = async () =>
      JSON.parse(
        await evaluate(
          "JSON.stringify({left: parseFloat(document.body.dataset.viewLeft), top: parseFloat(document.body.dataset.viewTop)})"
        )
      );

    const centredView = (x, y) => ({
      left: Math.max(0, Math.min(1000 - VISIBLE_BOARDS, x + 0.5 - VISIBLE_BOARDS / 2)),
      top: Math.max(0, Math.min(1000 - VISIBLE_BOARDS, y + 0.5 - VISIBLE_BOARDS / 2)),
    });

    // Inputs are ignored while a move is in flight, so retry until the camera
    // actually reaches the requested centre and the board is rendered.
    const setCentre = async (x, y, ready, message) => {
      const deadline = Date.now() + 6000;
      const expected = centredView(x, y);
      while (Date.now() < deadline) {
        await evaluate(`(() => {
          const x = document.getElementById('board-x');
          const y = document.getElementById('board-y');
          x.value = '${x}'; x.dispatchEvent(new Event('input', {bubbles:true}));
          y.value = '${y}'; y.dispatchEvent(new Event('input', {bubbles:true}));
        })()`);
        await sleep(120);
        const view = await readView();
        if (
          Math.abs(view.left - expected.left) < 0.01 &&
          Math.abs(view.top - expected.top) < 0.01 &&
          (await ready())
        ) {
          return;
        }
      }
      const state = await evaluate(
        "JSON.stringify({x: document.getElementById('board-x').value, y: document.getElementById('board-y').value, pending: document.body.dataset.movePending, requests: window.__snapshotRequests.length})"
      );
      fail(`${message} (${state})`);
    };

    // Measure the centre of a square using the client's published viewport, so
    // sub-pixel panning does not misalign the sample.
    const piecePixels = async (boardX, boardY, col, row) =>
      evaluate(`(() => {
        const canvas = document.getElementById('game');
        const ctx = canvas.getContext('2d');
        const left = parseFloat(document.body.dataset.viewLeft);
        const top = parseFloat(document.body.dataset.viewTop);
        const inset = 5;
        const x = (${boardX} - left) * ${BOARD_SCALE} + ${col} * ${CELL} + inset;
        const y = (${boardY} - top) * ${BOARD_SCALE} + ${row} * ${CELL} + inset;
        const data = ctx.getImageData(Math.round(x), Math.round(y), Math.round(${CELL}) - inset * 2, Math.round(${CELL}) - inset * 2).data;
        // Count pixels that are neither square colour: board squares are flat
        // #f0d9b5 / #b58863, so anything else is piece ink.
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          const light = r === 240 && g === 217 && b === 181;
          const dark = r === 181 && g === 136 && b === 99;
          if (!light && !dark) count++;
        }
        return count;
      })()`);

    const mouse = async (type, point, extra = {}) =>
      send("Input.dispatchMouseEvent", { type, x: point.x, y: point.y, ...extra });

    const canvasPoint = async (boardX, boardY, col, row) => {
      const info = JSON.parse(
        await evaluate(`JSON.stringify({
          left: parseFloat(document.body.dataset.viewLeft),
          top: parseFloat(document.body.dataset.viewTop),
          rect: document.getElementById('game').getBoundingClientRect(),
        })`)
      );
      const scale = info.rect.width / CANVAS;
      return {
        x: info.rect.left + ((boardX - info.left) * BOARD_SCALE + (col + 0.5) * CELL) * scale,
        y: info.rect.top + ((boardY - info.top) * BOARD_SCALE + (row + 0.5) * CELL) * scale,
      };
    };

    const drag = async (from, to) => {
      const start = await canvasPoint(from.boardX, from.boardY, from.col, from.row);
      const end = await canvasPoint(to.boardX, to.boardY, to.col, to.row);
      await mouse("mousePressed", start, { button: "left", clickCount: 1, buttons: 1 });
      await sleep(80);
      await mouse("mouseMoved", end, { button: "left", buttons: 1 });
      await sleep(120);
      await mouse("mouseReleased", end, { button: "left", clickCount: 1, buttons: 0 });
      await sleep(700);
    };

    await setCentre(BOARD.x, BOARD.y,
      async () => (await piecePixels(BOARD.x, BOARD.y, 4, 6)) > 20,
      "e2 pawn was not rendered from the server snapshot");

    if ((await evaluate("window.__snapshotRequests.length")) === 0) {
      fail("the client sent no snapshot requests");
    }

    // Ignore the initial (0, 0) window: the cache bound applies from the
    // moment the test navigates to its chosen centre.
    await evaluate("window.__snapshotRequests = []");

    // Nine fully visible boards: the centre board and its eight neighbours.
    for (let by = BOARD.y - 1; by <= BOARD.y + 1; by++) {
      for (let bx = BOARD.x - 1; bx <= BOARD.x + 1; bx++) {
        if ((await piecePixels(bx, by, 4, 6)) < 5) {
          fail(`board (${bx}, ${by}) was not visible in the 3x3 viewport`);
        }
      }
    }
    if ((await piecePixels(BOARD.x, BOARD.y, 4, 4)) > 5) {
      fail("e4 was not empty before the move");
    }
    // Move a pawn on the centre board.
    await drag({ boardX: BOARD.x, boardY: BOARD.y, col: 4, row: 6 },
      { boardX: BOARD.x, boardY: BOARD.y, col: 4, row: 4 });
    await waitFor(
      async () => (await piecePixels(BOARD.x, BOARD.y, 4, 4)) > 20,
      "e4 does not show the moved piece"
    );
    if ((await piecePixels(BOARD.x, BOARD.y, 4, 6)) > 5) {
      fail("e2 was not cleared after the move");
    }

    await setCentre(BOARD.x + 1, BOARD.y,
      async () => (await piecePixels(BOARD.x + 1, BOARD.y, 4, 6)) > 20,
      "the neighbouring board did not appear");
    if ((await piecePixels(BOARD.x + 1, BOARD.y, 4, 4)) > 5) {
      fail("a different board inherited the move");
    }
    await setCentre(BOARD.x, BOARD.y,
      async () => (await piecePixels(BOARD.x, BOARD.y, 4, 4)) > 20,
      "returning to the board lost the committed move");

    // Dragging empty space pans by exactly one board. The centre board (with
    // the moved e4 pawn) slides one board to the right of the canvas.
    const beforePanMoveCount = await evaluate("window.__moveRequests.length");
    const beforePan = await readView();
    const panStart = await canvasPoint(BOARD.x, BOARD.y, 3, 4);
    const canvasScale = JSON.parse(
      await evaluate("JSON.stringify(document.getElementById('game').getBoundingClientRect())")
    ).width / CANVAS;
    const panDistance = BOARD_SCALE * canvasScale;
    await mouse("mousePressed", panStart, { button: "left", clickCount: 1, buttons: 1 });
    await mouse("mouseMoved", { x: panStart.x + panDistance, y: panStart.y },
      { button: "left", buttons: 1 });
    await sleep(120);
    await mouse("mouseReleased", { x: panStart.x + panDistance, y: panStart.y },
      { button: "left", clickCount: 1, buttons: 0 });
    await waitFor(
      async () => (await readView()).left < beforePan.left - 0.9,
      "panning did not move the viewport"
    );
    const afterPan = await readView();
    if (Math.abs((beforePan.left - afterPan.left) - 1) > 0.05) {
      fail(`panning moved ${beforePan.left - afterPan.left} boards instead of one`);
    }
    if (Math.abs(afterPan.top - beforePan.top) > 0.05) {
      fail("a horizontal pan changed the vertical position");
    }
    if ((await piecePixels(BOARD.x, BOARD.y, 4, 4)) <= 20) {
      fail("the moved pawn did not pan with the board");
    }
    if ((await piecePixels(BOARD.x - 1, BOARD.y, 4, 4)) > 5) {
      fail("the old centre square still showed the unmoved board after panning");
    }
    if ((await evaluate("window.__moveRequests.length")) !== beforePanMoveCount) {
      fail("panning on an empty square sent a move");
    }

    // A drag from one board to another is cancelled, not sent as a move.
    await setCentre(BOARD.x, BOARD.y,
      async () => (await piecePixels(BOARD.x, BOARD.y, 4, 4)) > 20,
      "the centre board did not reappear before the cross-board test");
    const beforeCrossMoveCount = await evaluate("window.__moveRequests.length");
    await drag({ boardX: BOARD.x + 1, boardY: BOARD.y, col: 4, row: 6 },
      { boardX: BOARD.x, boardY: BOARD.y, col: 3, row: 4 });
    if ((await evaluate("window.__moveRequests.length")) !== beforeCrossMoveCount) {
      fail("a cross-board drag sent a move request");
    }

    // Every request must fall inside the 25x25 window of a centre the test
    // actually visited: BOARD.x - 1 after the pan, or BOARD.x / BOARD.x + 1.
    const requests = await evaluate("window.__snapshotRequests");
    const centres = [BOARD.x - 1, BOARD.x, BOARD.x + 1];
    for (const [x, y] of requests) {
      const inside = centres.some(
        (cx) => Math.abs(x - cx) <= 12 && Math.abs(y - BOARD.y) <= 12
      );
      if (!inside) fail(`snapshot request (${x}, ${y}) escaped the 25x25 window`);
    }

    await send("Page.reload", { ignoreCache: true });
    await sleep(1500);
    await setCentre(BOARD.x, BOARD.y,
      async () => (await piecePixels(BOARD.x, BOARD.y, 4, 4)) > 20,
      "reload lost the committed move");

    if (exceptions !== 0) fail(`browser raised ${exceptions} exception(s)`);
    console.log(
      `Client grid snapshot test passed: ${new Set(requests.map(([x, y]) => `${x},${y}`)).size} distinct boards requested, ` +
      `each within 25x25 of a visited centre near (${BOARD.x}, ${BOARD.y}).`
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
