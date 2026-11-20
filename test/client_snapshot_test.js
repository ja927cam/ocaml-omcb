#!/usr/bin/env node
/*
 * Browser-level snapshot integration test.
 *
 * Requires:
 *   - the game server running at http://localhost:8080
 *   - Node.js with global fetch and WebSocket support
 *   - chromium on PATH
 *
 * The test spawns its own headless browser. It picks a random board, verifies
 * that the initial board came from the server, moves a pawn, switches boards,
 * switches back, reloads the page and checks that the committed move is still
 * present.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CDP_PORT = 9223;
const SERVER = "http://localhost:8080/";
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
    } catch (_) {
      // not ready yet
    }
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function main() {
  try {
    const check = await fetch(SERVER);
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
      return result.result.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url: SERVER });
    await sleep(1500);

    const setBoard = async (x, y) => {
      await evaluate(`(() => {
        const x = document.getElementById('board-x');
        const y = document.getElementById('board-y');
        x.value = '${x}'; x.dispatchEvent(new Event('input', {bubbles:true}));
        y.value = '${y}'; y.dispatchEvent(new Event('input', {bubbles:true}));
      })()`);
      await sleep(800);
    };

    const piecePixels = async (col, row) =>
      evaluate(`(() => {
        const canvas = document.getElementById('game');
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(${col} * 64, ${row} * 64, 64, 64).data;
        const light = (${col} + ${row}) % 2 === 0;
        const bg = light ? [240, 217, 181] : [181, 136, 99];
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] !== bg[0] || data[i+1] !== bg[1] || data[i+2] !== bg[2]) count++;
        }
        return count;
      })()`);

    const drag = async (col1, row1, col2, row2) => {
      const rect = JSON.parse(
        await evaluate("JSON.stringify(document.getElementById('game').getBoundingClientRect())")
      );
      const from = {
        x: rect.left + ((col1 + 0.5) * rect.width) / 8,
        y: rect.top + ((row1 + 0.5) * rect.height) / 8,
      };
      const to = {
        x: rect.left + ((col2 + 0.5) * rect.width) / 8,
        y: rect.top + ((row2 + 0.5) * rect.height) / 8,
      };
      const mouse = (type, point, extra = {}) =>
        send("Input.dispatchMouseEvent", {
          type,
          x: point.x,
          y: point.y,
          button: "left",
          ...extra,
        });
      await mouse("mousePressed", from, { clickCount: 1, buttons: 1 });
      await sleep(80);
      await mouse("mouseMoved", to, { buttons: 1 });
      await sleep(100);
      await mouse("mouseReleased", to, { clickCount: 1, buttons: 0 });
      await sleep(700);
    };

    // Pick a board that is likely untouched by previous test runs.
    let board = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
      };
      await setBoard(candidate.x, candidate.y);
      if ((await piecePixels(4, 6)) > 100) {
        board = candidate;
        break;
      }
    }
    if (!board) fail("could not find an untouched board with a white pawn on e2");

    const beforeE2 = await piecePixels(4, 6);
    const beforeE4 = await piecePixels(4, 4);
    if (beforeE2 < 100) fail("initial server snapshot did not render the e2 pawn");
    if (beforeE4 > 20) fail("e4 was not empty on the selected board");

    await drag(4, 6, 4, 4);
    await sleep(200);
    if ((await piecePixels(4, 6)) > 20) fail("e2 was not cleared after the accepted move");
    if ((await piecePixels(4, 4)) < 100) fail("e4 does not show the moved piece");

    const other = { x: (board.x + 1) % 1000, y: board.y };
    await setBoard(other.x, other.y);
    if ((await piecePixels(4, 4)) > 20) fail("another board inherited the move");
    await setBoard(board.x, board.y);
    if ((await piecePixels(4, 4)) < 100) fail("returning to the board lost the committed move");

    await send("Page.reload", { ignoreCache: true });
    await sleep(1500);
    await setBoard(board.x, board.y);
    if ((await piecePixels(4, 4)) < 100) fail("reload lost the committed move");

    if (exceptions !== 0) fail(`browser raised ${exceptions} exception(s)`);
    console.log(`Client snapshot test passed on board (${board.x}, ${board.y}).`);
    await send("Browser.close");
  } finally {
    if (ws) try { ws.close(); } catch (_) {}
    chrome.kill("SIGTERM");
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
