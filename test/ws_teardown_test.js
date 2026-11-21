#!/usr/bin/env node
/*
 * WebSocket teardown regression test (Linux).
 *
 * Requires the game server at http://localhost:8080 and chromium on PATH.
 * Repeatedly loads the client and SIGKILLs the browser without a close frame.
 * Then checks that the server is idle, its file-descriptor count is stable,
 * and a fresh WebSocket snapshot request still works.
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SERVER = "http://localhost:8080/";
const CYCLES = 6;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

function serverPid() {
  try {
    return Number(execSync("pgrep -n -x server.exe", { encoding: "utf8" }).trim());
  } catch (_) {
    throw new Error("server.exe is not running; start the server first");
  }
}

function cpuTicks(pid) {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8").trim();
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return Number(fields[11]) + Number(fields[12]); // utime + stime
}

function fdCount(pid) {
  return fs.readdirSync(`/proc/${pid}/fd`).length;
}

async function waitForEndpoint(url, retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_) {}
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function loadAndKill() {
  const port = 9600 + Math.floor(Math.random() * 300);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-teardown-"));
  const chrome = spawn(
    "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=800,700",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  try {
    await waitForEndpoint(`http://127.0.0.1:${port}/json/version`);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((target) => target.type === "page");
    if (!page) throw new Error("no page target");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
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
    await send("Page.enable");
    await send("Page.navigate", { url: `${SERVER}?x=500&y=500` });
    await sleep(1200);
    try { ws.close(); } catch (_) {}
  } finally {
    chrome.kill("SIGKILL");
    await sleep(250);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

function snapshot(pid) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket("ws://localhost:8080/ws");
    socket.binaryType = "arraybuffer";
    const requestId = 12345;
    const request = Buffer.alloc(9);
    request[0] = 2;
    request.writeInt32LE(requestId, 1);
    request.writeUInt16LE(500, 5);
    request.writeUInt16LE(500, 7);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("snapshot request timed out"));
    }, 4000);
    socket.onopen = () => socket.send(request);
    socket.onmessage = (event) => {
      const data = Buffer.from(event.data);
      if (data.length !== 4096) return;
      clearTimeout(timer);
      socket.close();
      if (data[0] !== 2 || data[1] !== 1 || data.readInt32LE(2) !== requestId) {
        reject(new Error("unexpected snapshot response"));
      } else {
        resolve();
      }
    };
    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error("snapshot WebSocket failed"));
    };
  });
}

async function main() {
  const pid = serverPid();
  const beforeFds = fdCount(pid);
  for (let i = 0; i < CYCLES; i++) await loadAndKill();
  await sleep(2000);

  const startTicks = cpuTicks(pid);
  await sleep(1000);
  const idleTicks = cpuTicks(pid) - startTicks;
  if (idleTicks > 20) {
    fail(`server used ${idleTicks} CPU ticks/s after teardown (expected idle)`);
  }

  const afterFds = fdCount(pid);
  if (afterFds > beforeFds + 8) {
    fail(`server file descriptors grew from ${beforeFds} to ${afterFds}`);
  }

  await snapshot(pid);
  console.log(
    `WebSocket teardown test passed: ${CYCLES} abrupt disconnects, ` +
      `${idleTicks} CPU ticks/s idle, fds ${beforeFds} -> ${afterFds}, worker responsive.`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
