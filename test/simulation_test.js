#!/usr/bin/env node
/*
 * Integration test for simulated activity.
 *
 * Starts a server with simulation enabled, subscribes one client at (500,500),
 * and checks that:
 *   - simulated moves are committed and broadcast near the viewer;
 *   - they do not run on the viewer's exact board;
 *   - the server reports them in /metrics;
 *   - the world keeps producing ambient moves after the viewer disconnects.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exit(1);
}

setTimeout(() => fail("simulation test exceeded its deadline"), 45_000);

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

async function main() {
  const port = await freePort();
  process.env.OCAML_OMCB_WS_URL = `ws://127.0.0.1:${port}/ws`;
  const { Client } = require("../bench/ws_client");
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "omcb-simulation-"));
  const log = fs.openSync(path.join(data, "server.log"), "w");
  const serverEnv = {
    ...process.env,
    OCAML_OMCB_DATA_DIR: data,
    OCAML_OMCB_PORT: String(port),
    OCAML_OMCB_INTERFACE: "127.0.0.1",
    OCAML_OMCB_SNAPSHOT_MOVES: "0",
    OCAML_OMCB_SNAPSHOT_SECONDS: "0",
    OCAML_OMCB_SIMULATION: "1",
    OCAML_OMCB_SIM_INTERVAL_MS: "150",
    OCAML_OMCB_SIM_MAX: "4",
    OCAML_OMCB_SIM_RADIUS: "1",
    OCAML_OMCB_SIM_AMBIENT_MS: "300",
  };
  let server = spawn(SERVER, [], {
    cwd: ROOT,
    env: serverEnv,
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  let restarted = null;
  try {
    for (let attempt = 0; attempt < 300; attempt++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/readyz`)).ok) break;
      } catch (_) {}
      await sleep(100);
    }
    const base = `http://127.0.0.1:${port}`;
    const client = new Client(0, "probe");
    client.record_events = true;
    await client.open();
    client.subscribe_window(500, 500);

    const deadline = Date.now() + 10_000;
    while (client.events.length < 3 && Date.now() < deadline) await sleep(50);
    if (client.events.length < 3) {
      fail(`only ${client.events.length} simulated events arrived`);
    }

    for (const event of client.events) {
      if (event.boards.length !== 1) {
        fail(`simulated event touched ${event.boards.length} boards`);
      }
      const board = event.boards[0];
      if (board.board_x < 499 || board.board_x > 501) {
        fail(`simulated x ${board.board_x} is outside the viewer radius`);
      }
      if (board.board_y < 499 || board.board_y > 501) {
        fail(`simulated y ${board.board_y} is outside the viewer radius`);
      }
      if (board.board_x === 500 && board.board_y === 500) {
        fail("simulated move ran on the viewer's own board");
      }
      if (board.changes.length < 2) {
        fail("simulated event did not contain a move");
      }
    }

    const metrics = await (await fetch(`${base}/metrics`)).json();
    if (!metrics.simulation?.enabled) fail("simulation was not enabled");
    if (!(metrics.simulation.accepted > 0)) {
      fail(`simulation accepted ${metrics.simulation.accepted} moves`);
    }
    if (metrics.worker.requests_rejected !== 0) {
      fail(`server rejected ${metrics.worker.requests_rejected} requests`);
    }
    if (!(metrics.simulation.submitted >= metrics.simulation.accepted)) {
      fail("simulation submitted counter is inconsistent");
    }

    const before = Number((await (await fetch(`${base}/healthz`)).json()).sequence);
    client.close();
    await sleep(1600);
    const after = Number((await (await fetch(`${base}/healthz`)).json()).sequence);
    if (after <= before) {
      fail(`ambient activity did not advance the sequence (${before} -> ${after})`);
    }

    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
    const restartLog = fs.openSync(path.join(data, "restart.log"), "a");
    restarted = spawn(SERVER, [], {
      cwd: ROOT,
      env: serverEnv,
      stdio: ["ignore", restartLog, restartLog],
    });
    fs.closeSync(restartLog);
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        if ((await fetch(`${base}/readyz`)).ok) break;
      } catch (_) {}
      await sleep(50);
    }
    const recovered = Number(
      (await (await fetch(`${base}/healthz`)).json()).sequence
    );
    if (recovered < after) {
      fail(`recovery lost simulated moves (${after} -> ${recovered})`);
    }

    const events = client.events.length;
    const board = client.events[0].boards[0];
    console.log(
      `Simulation test passed: ${events} near-viewer events, ` +
        `${metrics.simulation.accepted} accepted, first board ` +
        `${board.board_x},${board.board_y}, ambient ${before}->${after}, ` +
        `recovered ${recovered}.`
    );
  } finally {
    for (const child of [restarted, server]) {
      if (!child) continue;
      child.kill("SIGTERM");
      await sleep(200);
      child.kill("SIGKILL");
    }
    fs.rmSync(data, { recursive: true, force: true });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
