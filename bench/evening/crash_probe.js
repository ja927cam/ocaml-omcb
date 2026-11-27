#!/usr/bin/env node
/*
 * Crash / restart recovery probe.
 *
 * Starts a real server, drives acknowledged moves, kills it with SIGKILL,
 * restarts on the same data directory, and checks that the recovered sequence
 * is at least the last acknowledged sequence and that the server becomes ready.
 *
 * Environment:
 *   CRASH_TRIALS=3 CRASH_KILL_MS=800 CRASH_CLIENTS=1
 *   CRASH_DATA_ROOT=/path CRASH_LABEL=... CRASH_OUTPUT=...
 */

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Client } = require("../ws_client");

const ROOT = path.join(__dirname, "..", "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const TRIALS = Number(process.env.CRASH_TRIALS || 3);
const KILL_MS = Number(process.env.CRASH_KILL_MS || 800);
const CLIENTS = Number(process.env.CRASH_CLIENTS || 1);
const DATA_ROOT =
  process.env.CRASH_DATA_ROOT || path.join(__dirname, "crash-data");
const LABEL = process.env.CRASH_LABEL || "crash";
const OUTPUT = process.env.CRASH_OUTPUT || "crash_probe";
const B1 = { x: 1, y: 7 };
const C3 = { x: 2, y: 5 };
const KNIGHT_BYTE = 23;
const squareId = (square) => square.y * 8 + square.x;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitReady(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/readyz`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return true;
    } catch (_) {}
    await sleep(50);
  }
  return false;
}

function startServer(dataDir, logPath) {
  const log = fs.openSync(logPath, "a");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      OCAML_OMCB_DATA_DIR: dataDir,
      OCAML_OMCB_PORT: "8080",
      OCAML_OMCB_INTERFACE: "127.0.0.1",
      OCAML_OMCB_ADAPTIVE: "0",
      OCAML_OMCB_WAL_GROUP: "64",
      OCAML_OMCB_SNAPSHOT_MOVES: "0",
      OCAML_OMCB_SNAPSHOT_SECONDS: "0",
    },
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  return child;
}

async function killAndWait(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGKILL");
  await new Promise((resolve) => child.once("exit", resolve));
}

function parseRecovery(logPath) {
  const text = fs.readFileSync(logPath, "utf8");
  const lines = text.split("\n");
  const recovery = [...lines].reverse().find((line) => line.startsWith("recovery: "));
  const total = [...lines].reverse().find((line) => line.startsWith("total startup: "));
  const phase = [...lines]
    .reverse()
    .find((line) => line.startsWith("persistence recovery: "));
  return { recovery, total, phase };
}

async function runTrial(trial) {
  const dataDir = path.join(DATA_ROOT, `trial-${trial}`);
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const logPath = path.join(DATA_ROOT, `trial-${trial}.log`);
  fs.writeFileSync(logPath, "");

  let server = startServer(dataDir, logPath);
  if (!(await waitReady(8080))) throw new Error("server did not start");
  const startedAt = Date.now();

  const clients = [];
  let lastAck = 0;
  let sent = 0;
  let stopped = false;
  for (let index = 0; index < CLIENTS; index++) {
    const client = new Client(index, "probe");
    client.record_events = false;
    await client.open();
    clients.push(client);
  }

  const workers = clients.map(async (client, index) => {
    const boardX = 700 + index;
    const boardY = 700;
    let moveIndex = 0;
    while (!stopped) {
      const from = moveIndex % 2 === 0 ? B1 : C3;
      const to = moveIndex % 2 === 0 ? C3 : B1;
      try {
        const result = await client.move(
          boardX,
          boardY,
          from,
          to,
          (squareId(from) << 8) | KNIGHT_BYTE
        );
        sent++;
        if (result.accepted) {
          lastAck = Math.max(lastAck, Number(result.sequence));
        }
      } catch (_) {
        return;
      }
      moveIndex++;
    }
  });

  await sleep(KILL_MS);
  stopped = true;
  const killedAt = Date.now();
  await killAndWait(server);
  for (const client of clients) client.close();
  await Promise.race([
    Promise.allSettled(workers),
    sleep(1000),
  ]);

  const restartStarted = Date.now();
  server = startServer(dataDir, logPath);
  const ready = await waitReady(8080);
  const restartReadyMs = Date.now() - restartStarted;
  let recovered = 0;
  if (ready) {
    const health = await (await fetch("http://127.0.0.1:8080/healthz")).json();
    recovered = Number(health.sequence);
  }
  const log = parseRecovery(logPath);
  const walFiles = fs
    .readdirSync(dataDir)
    .filter((name) => name.startsWith("wal-"))
    .map((name) => ({
      name,
      bytes: fs.statSync(path.join(dataDir, name)).size,
    }));
  await killAndWait(server);

  return {
    trial,
    kill_ms: killedAt - startedAt,
    sent,
    last_ack: lastAck,
    ready,
    restart_ready_ms: restartReadyMs,
    recovered_sequence: recovered,
    acked_moves_survived: recovered >= lastAck,
    unacked_but_durable: Math.max(0, recovered - lastAck),
    acked_but_lost: Math.max(0, lastAck - recovered),
    wal_files: walFiles,
    log,
  };
}

async function main() {
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  const trials = [];
  for (let trial = 0; trial < TRIALS; trial++) {
    const result = await runTrial(trial);
    trials.push(result);
    console.log(
      `trial ${trial}: ack ${result.last_ack}, recovered ${result.recovered_sequence}, ` +
        `restart ${result.restart_ready_ms} ms, ` +
        `${result.acked_moves_survived ? "ok" : "LOST ACKED MOVES"}`
    );
    await sleep(300);
  }
  const payload = {
    label: LABEL,
    generated: new Date().toISOString(),
    trials,
    all_acked_survived: trials.every((item) => item.acked_moves_survived),
  };
  fs.writeFileSync(
    path.join(__dirname, `${OUTPUT}_results.json`),
    JSON.stringify(payload, null, 2) + "\n"
  );
  spawnSync("rm", ["-rf", DATA_ROOT]);
  process.exit(payload.all_acked_survived ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
