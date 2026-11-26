#!/usr/bin/env node
/* Browser reconnect test: kill and restart the server under a live client. */
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

setTimeout(() => {
  console.error("FAIL: reconnect test exceeded its deadline");
  process.exit(1);
}, 180_000);

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
  const data = path.join(os.tmpdir(), `ocaml-omcb-reconnect-${process.pid}`);
  fs.rmSync(data, { recursive: true, force: true });
  fs.mkdirSync(data, { recursive: true });
  const startServer = () => {
    const fd = fs.openSync(path.join(data, "server.log"), "a");
    const child = spawn(SERVER, [], {
      cwd: ROOT,
      env: {
        ...process.env,
        OCAML_OMCB_DATA_DIR: data,
        OCAML_OMCB_PORT: String(port),
        OCAML_OMCB_INTERFACE: "127.0.0.1",
        OCAML_OMCB_SNAPSHOT_MOVES: "0",
        OCAML_OMCB_SNAPSHOT_SECONDS: "0",
      },
      stdio: ["ignore", fd, fd],
    });
    fs.closeSync(fd);
    return child;
  };
  let server = startServer();
  for (let i = 0; i < 300; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break;
    } catch (_) {}
    await sleep(100);
  }

  const cdpPort = 9500 + Math.floor(Math.random() * 300);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-reconnect-"));
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
    const target = await (
      await fetch(
        `http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(
          `http://127.0.0.1:${port}/?x=500&y=500`
        )}`,
        { method: "PUT" }
      )
    ).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
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
      source: "try { localStorage.setItem('ocaml-omcb.seen-intro', '1'); } catch (_) {}",
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
    if ((await evaluate("document.getElementById('status').textContent")) !== "Live") {
      throw new Error("initial connection was not live");
    }

    server.kill("SIGTERM");
    await sleep(1200);
    const stopped = await evaluate("document.getElementById('status').textContent");
    if (!stopped.toLowerCase().includes("reconnect") && !stopped.toLowerCase().includes("offline")) {
      throw new Error(`client did not report reconnect/offline: ${stopped}`);
    }
    server = startServer();
    let live = false;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if ((await evaluate("document.getElementById('status').textContent")) === "Live") {
        live = true;
        break;
      }
      await sleep(100);
    }
    if (!live) throw new Error("client did not reconnect");
    if (Number(await evaluate("document.body.dataset.loadedBoards || 0")) < 1) {
      throw new Error("client did not reload boards after reconnect");
    }
    console.log("Client reconnect test passed: server restart recovered to Live with boards loaded.");
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
