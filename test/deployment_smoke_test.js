#!/usr/bin/env node
/*
 * Deployment smoke test: alternate port, health/readiness probes, a real
 * WebSocket move, graceful SIGTERM drain and restart on the same data directory.
 */

process.env.OCAML_OMCB_WS_URL = "ws://localhost:18080/ws";

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { Client } = require("../bench/ws_client");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const DATA = path.join(ROOT, "deployment-smoke-data");
const PORT = 18080;
const BASE = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function portFree() {
  return new Promise((resolve) => {
    const socket = net.connect(PORT, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(300, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

async function start(fresh) {
  if (fresh) {
    fs.rmSync(DATA, { recursive: true, force: true });
    fs.mkdirSync(DATA, { recursive: true });
  }
  if (!(await portFree())) throw new Error(`port ${PORT} in use`);
  const log = "/tmp/ocaml-omcb-deployment-smoke.log";
  const fd = fs.openSync(log, "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      OCAML_OMCB_DATA_DIR: DATA,
      OCAML_OMCB_PORT: String(PORT),
      OCAML_OMCB_ADAPTIVE: "1",
      OCAML_OMCB_SNAPSHOT_MOVES: "0",
      OCAML_OMCB_SNAPSHOT_SECONDS: "0",
    },
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("server exited during startup");
    }
    try {
      const response = await fetch(`${BASE}/healthz`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return child;
    } catch (_) {}
    await sleep(100);
  }
  child.kill("SIGKILL");
  throw new Error("server did not become healthy");
}

async function stop(child) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      sleep(10_000),
    ]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }
  return { code: child.exitCode, signal: child.signalCode };
}

async function json(path) {
  const response = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return response.json();
}

async function main() {
  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  const first = await start(false);
  const health = await json("/healthz");
  const ready = await json("/readyz");
  if (health.status !== "ok" || ready.status !== "ready") {
    throw new Error("health/readiness probes failed");
  }
  const client = new Client(1, "active");
  await client.open();
  const move = await client.move(
    600,
    600,
    { x: 1, y: 7 },
    { x: 2, y: 5 },
    (57 << 8) | 23
  );
  if (!move.accepted) throw new Error(`move rejected: ${move.rejection}`);
  const before = await json("/state-hash");
  client.close();
  const exit = await stop(first);
  if (exit.code !== 0) throw new Error(`graceful exit code ${JSON.stringify(exit)}`);
  const second = await start(false);
  const after = await json("/state-hash");
  await stop(second);
  fs.rmSync(DATA, { recursive: true, force: true });
  const ok = before.sequence === after.sequence && before.digest === after.digest;
  console.log(
    `Deployment smoke ${ok ? "passed" : "FAILED"}: port ${PORT}, health/ready, ` +
      `graceful exit ${JSON.stringify(exit)}, sequence ${before.sequence} -> ${after.sequence}`
  );
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(1);
});
