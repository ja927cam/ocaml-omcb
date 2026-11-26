#!/usr/bin/env node
/*
 * Join-near-activity and captured-king tally test.
 *
 * A remote viewer subscribes to a known area. A fresh browser then loads the
 * site without x/y coordinates and must land on that viewer's area (the join
 * suggestion), while the corner tally must match /tally.json.
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
  console.error("FAIL: activity/tally test exceeded its deadline");
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
  const data = path.join(os.tmpdir(), `ocaml-omcb-activity-${process.pid}`);
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

  // Another visitor is looking at board (321, 654).
  const viewer = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await new Promise((resolve, reject) => {
    viewer.onopen = resolve;
    viewer.onerror = () => reject(new Error("viewer websocket error"));
  });
  const windowRequest = Buffer.alloc(6);
  windowRequest[0] = 5;
  windowRequest.writeUInt16LE(321, 1);
  windowRequest.writeUInt16LE(654, 3);
  windowRequest[5] = 3;
  viewer.send(windowRequest);
  await sleep(250);

  const suggestion = await (
    await fetch(`http://127.0.0.1:${port}/active.json`)
  ).json();
  if (!suggestion.active) throw new Error("no active suggestion");
  if (Math.abs(suggestion.x - 321) > 1 || Math.abs(suggestion.y - 654) > 1) {
    throw new Error(`unexpected suggestion ${JSON.stringify(suggestion)}`);
  }
  if (suggestion.source !== "players" || suggestion.watchers < 1) {
    throw new Error(`suggestion did not report the viewer: ${JSON.stringify(suggestion)}`);
  }
  if (
    !Array.isArray(suggestion.viewers) ||
    !suggestion.viewers.some((viewer) => viewer.x === 321 && viewer.y === 654)
  ) {
    throw new Error(`viewer point missing: ${JSON.stringify(suggestion)}`);
  }
  if (!Array.isArray(suggestion.recent)) {
    throw new Error(`recent move list missing: ${JSON.stringify(suggestion)}`);
  }

  const cdpPort = 9800 + Math.floor(Math.random() * 150);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-activity-"));
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
        "try { localStorage.setItem('ocaml-omcb.player-colour','white'); localStorage.setItem('ocaml-omcb.seen-intro','1'); } catch (_) {}",
    });
    await send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
      });
      return result.result.value;
    };
    for (let i = 0; i < 120; i++) {
      if (Number(await evaluate("document.body?.dataset.loadedBoards || 0")) > 0)
        break;
      await sleep(100);
    }
    const view = JSON.parse(
      await evaluate(`JSON.stringify((() => {
        const b = document.body.dataset;
        return {
          left: +b.viewLeft,
          top: +b.viewTop,
          width: +b.viewWidth,
          height: +b.viewHeight,
          url: location.search
        };
      })())`)
    );
    const centreX = view.left + view.width / 2;
    const centreY = view.top + view.height / 2;
    if (Math.abs(centreX - 321) > 2 || Math.abs(centreY - 654) > 2) {
      throw new Error(
        `fresh visitor did not join the active area: centre (${centreX}, ${centreY}), url ${view.url}`
      );
    }
    const tally = await (
      await fetch(`http://127.0.0.1:${port}/tally.json`)
    ).json();
    for (let i = 0; i < 40; i++) {
      const shown = JSON.parse(
        await evaluate(`JSON.stringify({
          black: document.getElementById('tally-black')?.textContent,
          white: document.getElementById('tally-white')?.textContent
        })`)
      );
      if (
        shown.black === String(tally.black) &&
        shown.white === String(tally.white)
      )
        break;
      await sleep(100);
    }
    const shown = JSON.parse(
      await evaluate(`JSON.stringify({
        black: document.getElementById('tally-black')?.textContent,
        white: document.getElementById('tally-white')?.textContent
      })`)
    );
    if (shown.black !== String(tally.black)) {
      throw new Error(`black tally mismatch: ${JSON.stringify({ shown, tally })}`);
    }
    if (shown.white !== String(tally.white)) {
      throw new Error(`white tally mismatch: ${JSON.stringify({ shown, tally })}`);
    }
    await send("Browser.close");
    ws.close();
    console.log(
      `Activity/tally test passed: new visitor joined (${Math.round(centreX)}, ${Math.round(centreY)}); tally ${shown.black}/${shown.white}.`
    );
  } finally {
    viewer.close();
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
