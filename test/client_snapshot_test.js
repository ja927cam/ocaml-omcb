#!/usr/bin/env node
/*
 * Browser-level grid snapshot integration test.
 *
 * Requires the game server at http://localhost:8080, Node with fetch/WebSocket,
 * and chromium on PATH. It spawns its own headless browser.
 *
 * The client renders the world full-screen at 216 px per board, so a 3x3
 * region is fully visible with more boards at the edges. It caches at most a
 * 25x25 board window around the centre.
 * This test checks nine visible boards, one-board camera pans in both
 * directions, the cache bound, move persistence across pans and a cache
 * eviction, that cross-board quiet moves are accepted, and that cross-board
 * captures of unmoved pieces are blocked locally.
 *
 * Moves persist on the long-running server, so the test first probes a
 * pristine 5x5 block (revision 0, standard starting position) and uses its
 * centre. This keeps repeated runs independent of earlier moves.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CDP_PORT = 9223 + Math.floor(Math.random() * 500);
const SERVER = "http://localhost:8080/";
const WS_URL = "ws://localhost:8080/ws";
const WIRE_FRAME = 4096;
const BOARD_SCALE = 216;
const CELL = BOARD_SCALE / 8;

// Moves are authoritative and persist on the long-running test server, so a
// random board may already have been modified by an earlier run. Query the
// server until a pristine 5x5 block is found: revision 0 means no move has
// ever been committed to that board.
let BOARD;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

// Safety net: a lost CDP response or a stalled browser must fail the test
// with a message instead of hanging the harness.
setTimeout(() => {
  console.error("FAIL: client snapshot test exceeded its overall deadline");
  process.exit(1);
}, 180_000);

async function pickFreshBlock() {
  const socket = new WebSocket(WS_URL);
  socket.binaryType = "arraybuffer";
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error("snapshot probe could not connect"));
    socket.onclose = () =>
      reject(new Error("snapshot probe closed before it connected"));
  });

  let nextId = 2_000_000_000;
  const pending = new Map();
  socket.onmessage = (message) => {
    const bytes = Buffer.from(message.data);
    if (bytes.length !== WIRE_FRAME || bytes[0] !== 2) return;
    const id = bytes.readInt32LE(2);
    const resolve = pending.get(id);
    if (!resolve) return;
    pending.delete(id);
    resolve({
      status: bytes[1],
      revision: Number(bytes.readBigInt64LE(10)),
      board: bytes.subarray(18, 82),
    });
  };

  const snapshot = (x, y) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const request = Buffer.alloc(9);
      request[0] = 2;
      request.writeInt32LE(id, 1);
      request.writeUInt16LE(x, 5);
      request.writeUInt16LE(y, 7);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`snapshot probe timed out for (${x}, ${y})`));
      }, 1500);
      pending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      socket.send(request);
    });

  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      const centreX = 20 + Math.floor(Math.random() * 960);
      const centreY = 20 + Math.floor(Math.random() * 960);
      let fresh = true;
      for (let dy = -2; dy <= 2 && fresh; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const result = await snapshot(centreX + dx, centreY + dy);
          if (
            result.status !== 1 ||
            result.revision !== 0 ||
            // The test assumes the standard starting position: e2 pawn,
            // e4 empty.
            result.board[52] !== 19 ||
            result.board[36] !== 0
          ) {
            fresh = false;
            break;
          }
        }
      }
      if (fresh) return { x: centreX, y: centreY };
    }
  } finally {
    await new Promise((resolve) => {
      socket.onclose = resolve;
      socket.onerror = resolve;
      try { socket.close(); } catch (_) { resolve(); }
      setTimeout(resolve, 500);
    });
  }
  throw new Error("could not find a pristine 5x5 block of boards");
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

  BOARD = await pickFreshBlock();

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
    await send("Page.navigate", { url: `${SERVER}?x=${BOARD.x}&y=${BOARD.y}` });
    await sleep(1500);

    const readView = async () =>
      JSON.parse(
        await evaluate(
          "JSON.stringify({left: parseFloat(document.body.dataset.viewLeft), top: parseFloat(document.body.dataset.viewTop)})"
        )
      );

    const readCanvas = async () =>
      JSON.parse(
        await evaluate(
          "JSON.stringify({width: document.getElementById('game').width, height: document.getElementById('game').height, rect: document.getElementById('game').getBoundingClientRect()})"
        )
      );

    const coordsText = () => evaluate("document.getElementById('coords').textContent");

    // Count pixels that are neither square colour inside a small inset of the
    // cell: board squares are flat #f0d9b5 / #b58863, so anything else is ink.
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
      const info = await readCanvas();
      const view = await readView();
      const scaleX = info.rect.width / info.width;
      const scaleY = info.rect.height / info.height;
      return {
        x: info.rect.left + ((boardX - view.left) * BOARD_SCALE + (col + 0.5) * CELL) * scaleX,
        y: info.rect.top + ((boardY - view.top) * BOARD_SCALE + (row + 0.5) * CELL) * scaleY,
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
      await sleep(500);
    };

    const settle = async () =>
      waitFor(
        async () => (await evaluate("document.body.dataset.movePending")) !== "true",
        "a move request did not settle"
      );

    // Move the camera by dx/dy boards by dragging an empty square. Positive x
    // moves the camera east, which drags the content west.
    const panCamera = async (dx, dy = 0) => {
      const before = await readView();
      const info = await readCanvas();
      const centreX = Math.floor(before.left + (info.width / BOARD_SCALE) / 2);
      const centreY = Math.floor(before.top + (info.height / BOARD_SCALE) / 2);
      const start = await canvasPoint(centreX, centreY, 3, 4);
      const scaleX = info.rect.width / info.width;
      const scaleY = info.rect.height / info.height;
      const end = {
        x: start.x - dx * BOARD_SCALE * scaleX,
        y: start.y - dy * BOARD_SCALE * scaleY,
      };
      await mouse("mousePressed", start, { button: "left", clickCount: 1, buttons: 1 });
      await sleep(80);
      await mouse("mouseMoved", end, { button: "left", buttons: 1 });
      await sleep(120);
      await mouse("mouseReleased", end, { button: "left", clickCount: 1, buttons: 0 });
      const expectedLeft = Math.max(0, Math.min(1000 - info.width / BOARD_SCALE, before.left + dx));
      const expectedTop = Math.max(0, Math.min(1000 - info.height / BOARD_SCALE, before.top + dy));
      await waitFor(async () => {
        const view = await readView();
        return Math.abs(view.left - expectedLeft) < 0.05 && Math.abs(view.top - expectedTop) < 0.05;
      }, `panning to camera (${expectedLeft}, ${expectedTop}) failed`);
    };

    await waitFor(
      async () => (await piecePixels(BOARD.x, BOARD.y, 4, 6)) > 20,
      "e2 pawn was not rendered from the initial query centre"
    );

    if ((await evaluate("window.__snapshotRequests.length")) === 0) {
      fail("the client sent no snapshot requests");
    }

    // Ignore the initial window while the camera settles: the cache bound is
    // checked from the moment the requested centre is established.
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
    if ((await coordsText()) !== `(${BOARD.x}, ${BOARD.y})`) {
      fail(`coordinates overlay showed ${await coordsText()}`);
    }
    const status = await evaluate(
      "JSON.stringify({text: document.getElementById('status').textContent, kind: document.getElementById('status').dataset.status})"
    );
    if (status !== '{"text":"Live","kind":"live"}') {
      fail(`connection status did not become live: ${status}`);
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
    await settle();

    // East one board: the moved pawn comes with the camera, and the neighbour
    // is untouched.
    await panCamera(1);
    await waitFor(
      async () => (await piecePixels(BOARD.x + 1, BOARD.y, 4, 6)) > 20,
      "the eastern neighbouring board did not appear"
    );
    if ((await piecePixels(BOARD.x, BOARD.y, 4, 4)) <= 20) {
      fail("the moved pawn did not move with the camera");
    }
    if ((await piecePixels(BOARD.x + 1, BOARD.y, 4, 4)) > 5) {
      fail("the eastern board inherited the move");
    }
    if ((await coordsText()) !== `(${BOARD.x + 1}, ${BOARD.y})`) {
      fail(`coordinates overlay did not follow the east pan: ${await coordsText()}`);
    }

    // West two boards: back through the centre to the western neighbour.
    await panCamera(-1);
    if ((await piecePixels(BOARD.x, BOARD.y, 4, 4)) <= 20) {
      fail("returning to the centre lost the committed move");
    }
    await panCamera(-1);
    await waitFor(
      async () => (await piecePixels(BOARD.x - 1, BOARD.y, 4, 6)) > 20,
      "the western neighbouring board did not appear"
    );
    if ((await piecePixels(BOARD.x - 1, BOARD.y, 4, 4)) > 5) {
      fail("the western board inherited the move");
    }
    if ((await coordsText()) !== `(${BOARD.x - 1}, ${BOARD.y})`) {
      fail(`coordinates overlay did not follow the west pan: ${await coordsText()}`);
    }

    // Return to the centre for the cross-board drag.
    await panCamera(1);

    // Cross-board captures of unmoved pieces are blocked. Free the eastern
    // f1 bishop's diagonal, then try to take the unmoved black h1 pawn on the
    // centre board. The client must not send a request.
    await drag({ boardX: BOARD.x + 1, boardY: BOARD.y, col: 4, row: 6 },
      { boardX: BOARD.x + 1, boardY: BOARD.y, col: 4, row: 4 });
    await settle();
    const beforeBlockedCapture = await evaluate("window.__moveRequests.length");
    await drag({ boardX: BOARD.x + 1, boardY: BOARD.y, col: 5, row: 7 },
      { boardX: BOARD.x, boardY: BOARD.y, col: 7, row: 1 });
    if ((await evaluate("window.__moveRequests.length")) !== beforeBlockedCapture) {
      fail("a cross-board capture of an unmoved piece sent a move request");
    }
    if ((await piecePixels(BOARD.x, BOARD.y, 7, 1)) <= 20) {
      fail("the unmoved black pawn disappeared after a blocked cross-board capture");
    }
    if ((await piecePixels(BOARD.x + 1, BOARD.y, 5, 7)) <= 20) {
      fail("the blocked bishop left its source square");
    }

    // A quiet move may cross a board boundary. Clear the eastern a-file,
    // walk the rook to a3, then move it to h3 on the centre board.
    await drag({ boardX: BOARD.x + 1, boardY: BOARD.y, col: 0, row: 6 },
      { boardX: BOARD.x + 1, boardY: BOARD.y, col: 0, row: 4 });
    await settle();
    await drag({ boardX: BOARD.x + 1, boardY: BOARD.y, col: 0, row: 7 },
      { boardX: BOARD.x + 1, boardY: BOARD.y, col: 0, row: 5 });
    await settle();
    const beforeCrossMoveCount = await evaluate("window.__moveRequests.length");
    await drag({ boardX: BOARD.x + 1, boardY: BOARD.y, col: 0, row: 5 },
      { boardX: BOARD.x, boardY: BOARD.y, col: 7, row: 5 });
    if ((await evaluate("window.__moveRequests.length")) !== beforeCrossMoveCount + 1) {
      fail("a cross-board quiet move did not send a move request");
    }
    await waitFor(
      async () => (await piecePixels(BOARD.x, BOARD.y, 7, 5)) > 20,
      "the cross-board rook did not appear on the centre board"
    );
    if ((await piecePixels(BOARD.x + 1, BOARD.y, 0, 5)) > 5) {
      fail("the cross-board rook was not cleared from its source board");
    }
    await settle();

    // The rook is now off its original board, so even a same-board capture is
    // blocked until it returns home.
    const beforeOffHomeCapture = await evaluate("window.__moveRequests.length");
    await drag({ boardX: BOARD.x, boardY: BOARD.y, col: 7, row: 5 },
      { boardX: BOARD.x, boardY: BOARD.y, col: 7, row: 1 });
    if ((await evaluate("window.__moveRequests.length")) !== beforeOffHomeCapture) {
      fail("an off-home same-board capture sent a move request");
    }
    if ((await piecePixels(BOARD.x, BOARD.y, 7, 1)) <= 20) {
      fail("the target pawn disappeared after a blocked off-home capture");
    }

    // Every request must fall inside the 25x25 window of a centre the test
    // actually visited: BOARD.x - 1, BOARD.x or BOARD.x + 1.
    const requests = await evaluate("window.__snapshotRequests");
    const centres = [BOARD.x - 1, BOARD.x, BOARD.x + 1];
    for (const [x, y] of requests) {
      const inside = centres.some(
        (cx) => Math.abs(x - cx) <= 12 && Math.abs(y - BOARD.y) <= 12
      );
      if (!inside) fail(`snapshot request (${x}, ${y}) escaped the 25x25 window`);
    }

    // Move far enough to evict the centre board, then return. The client must
    // fetch a fresh snapshot, proving the move is server-authoritative.
    for (let i = 0; i < 5; i++) await panCamera(3);
    for (let i = 0; i < 5; i++) await panCamera(-3);
    await waitFor(
      async () => (await piecePixels(BOARD.x, BOARD.y, 4, 4)) > 20,
      "re-fetching after cache eviction lost the committed move"
    );
    if ((await piecePixels(BOARD.x, BOARD.y, 7, 5)) <= 20) {
      fail("re-fetching after cache eviction lost the cross-board rook");
    }
    if ((await coordsText()) !== `(${BOARD.x}, ${BOARD.y})`) {
      fail(`returning from the eviction lost the query centre: ${await coordsText()}`);
    }

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

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
