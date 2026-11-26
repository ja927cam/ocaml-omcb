#!/usr/bin/env node
/*
 * End-to-end crash recovery test.
 *
 * Each case starts a real server process against an isolated data directory,
 * performs deterministic moves through the WebSocket protocol, kills the
 * process at a chosen point and restarts it. The recovered state is compared
 * with a control run (or with the pre-shutdown hash) through /state-hash.
 *
 * This covers the durable-before-publish WAL path, torn trailing records,
 * atomic snapshots, crash points around the snapshot lifecycle, a corrupt
 * snapshot and a large WAL replay. Castling and en passant are replayed too;
 * promotion is covered by test/test_persistence.ml.
 */

const { spawn } = require("child_process");
const { once } = require("events");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Client } = require("../bench/ws_client");

const SERVER_URL = "http://localhost:8080";
const ROOT = path.join(__dirname, "..");
const SERVER_BIN = path.join(ROOT, "_build", "default", "server", "server.exe");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

function tempDir(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ocaml-omcb-crash-${label}-`));
  return dir;
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

async function startServer(dataDir, extraEnv = {}) {
  const child = spawn(SERVER_BIN, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      OCAML_OMCB_DATA_DIR: dataDir,
      OCAML_OMCB_SNAPSHOT_SECONDS: "0",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  const append = (chunk) => {
    log += chunk.toString();
    if (log.length > 200_000) log = log.slice(-100_000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited during startup\n${log}`);
    }
    try {
      const response = await fetch(`${SERVER_URL}/metrics`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return { child, log: () => log };
    } catch (_) {}
    await sleep(100);
  }
  child.kill("SIGKILL");
  throw new Error(`server did not become ready\n${log}`);
}

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

async function stopServer(server) {
  if (!server) return;
  if (!hasExited(server.child)) {
    server.child.kill("SIGKILL");
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5000);
      server.child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

async function waitForExit(server, timeoutMs = 10_000) {
  if (hasExited(server.child)) return;
  await new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      if (!hasExited(server.child)) server.child.kill("SIGKILL");
      resolve();
    }, timeoutMs);
    server.child.once("exit", done);
  });
}

async function stateHash() {
  const response = await fetch(`${SERVER_URL}/state-hash`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) fail(`state hash returned ${response.status}`);
  return response.json();
}

async function openClient() {
  const client = new Client(0, "active");
  await client.open();
  return client;
}

async function closeClient(client) {
  if (!client) return;
  try {
    client.close();
  } catch (_) {}
  await sleep(100);
}

const e2e4 = (client, x, y) =>
  client.move(x, y, { x: 4, y: 6 }, { x: 4, y: 4 }, (52 << 8) | 19);

async function crossBoardMoves(client, x, y) {
  const results = [];
  results.push(
    await client.move(x, y, { x: 0, y: 6 }, { x: 0, y: 4 }, (48 << 8) | 19)
  );
  results.push(
    await client.move(x, y, { x: 0, y: 7 }, { x: 0, y: 5 }, (56 << 8) | 57)
  );
  // to.x = 8 expresses one square beyond h3, so dx = 8 crosses the board edge.
  results.push(
    await client.move(x, y, { x: 0, y: 5 }, { x: 8, y: 5 }, (40 << 8) | 25)
  );
  for (const result of results) {
    if (!result.accepted) fail("cross-board move was rejected");
  }
}

async function specialMoves(client) {
  // Castling on (300, 300): clear g1/f1 with knight and bishop, then O-O.
  const castle = [
    [300, 300, { x: 4, y: 6 }, { x: 4, y: 4 }, (52 << 8) | 19],
    [300, 300, { x: 6, y: 7 }, { x: 5, y: 5 }, (62 << 8) | 23],
    [300, 300, { x: 5, y: 7 }, { x: 4, y: 6 }, (61 << 8) | 21],
    [300, 300, { x: 4, y: 7 }, { x: 6, y: 7 }, (60 << 8) | 61],
  ];
  for (const [x, y, from, to, expected] of castle) {
    const result = await client.move(x, y, from, to, expected);
    if (!result.accepted) fail(`castling setup move rejected at ${x},${y}`);
  }

  // En passant on (301, 300): e2-e4, a7-a6, e4-e5, d7-d5, exd6 e.p.
  const enPassant = [
    [301, 300, { x: 4, y: 6 }, { x: 4, y: 4 }, (52 << 8) | 19],
    [301, 300, { x: 0, y: 1 }, { x: 0, y: 2 }, (8 << 8) | 18],
    [301, 300, { x: 4, y: 4 }, { x: 4, y: 3 }, (36 << 8) | 51],
    [301, 300, { x: 3, y: 1 }, { x: 3, y: 3 }, (11 << 8) | 18],
    [301, 300, { x: 4, y: 3 }, { x: 3, y: 2 }, (28 << 8) | 19],
  ];
  for (const [x, y, from, to, expected] of enPassant) {
    const result = await client.move(x, y, from, to, expected);
    if (!result.accepted) fail(`en passant sequence rejected at ${x},${y}`);
  }
}

async function runControl(label, moves, env = {}) {
  const dir = tempDir(`control-${label}`);
  let server;
  let client;
  try {
    server = await startServer(dir, {
      OCAML_OMCB_SNAPSHOT_MOVES: "0",
      ...env,
    });
    client = await openClient();
    await moves(client);
    return await stateHash();
  } finally {
    await closeClient(client);
    await stopServer(server);
    removeDir(dir);
  }
}

async function hashWithClient(client) {
  await closeClient(client);
  return stateHash();
}

async function snapshotBoard(client, x, y) {
  return client.snapshot(x, y);
}

const cases = [];

async function runCase(name, fn) {
  const started = Date.now();
  try {
    await fn();
    cases.push({ name, ok: true, duration_ms: Date.now() - started });
    console.log(`PASS ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    cases.push({
      name,
      ok: false,
      duration_ms: Date.now() - started,
      error: String(error && error.message ? error.message : error),
    });
    console.error(`FAIL ${name}: ${error.message || error}`);
    process.exitCode = 1;
  }
}

async function main() {
  const check = await fetch(`${SERVER_URL}/metrics`).catch(() => null);
  if (check) fail("a server is already running on port 8080");

  await runCase("empty world restart", async () => {
    const dir = tempDir("empty");
    let server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    let hash = await stateHash();
    await stopServer(server);
    server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    const recovered = await stateHash();
    await stopServer(server);
    removeDir(dir);
    if (recovered.digest !== hash.digest || recovered.sequence !== "0") {
      fail("empty world was not reproduced byte-for-byte");
    }
  });

  await runCase("several moves restart", async () => {
    const control = await runControl("several", async (client) => {
      for (const board of [100, 101, 102]) {
        const result = await e2e4(client, board, 100);
        if (!result.accepted) fail("move rejected in control");
      }
    });
    const dir = tempDir("several");
    let server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    let client = await openClient();
    for (const board of [100, 101, 102]) {
      const result = await e2e4(client, board, 100);
      if (!result.accepted) fail("move rejected");
    }
    const before = await stateHash();
    await closeClient(client);
    await stopServer(server);
    server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    const after = await stateHash();
    client = await openClient();
    const board = await snapshotBoard(client, 100, 100);
    await closeClient(client);
    await stopServer(server);
    removeDir(dir);
    if (before.digest !== after.digest || after.digest !== control.digest) {
      fail("several moves did not survive the restart");
    }
    if (after.sequence !== "3") fail(`sequence was ${after.sequence}`);
    if (board.board[36] === 0 || board.board[52] !== 0) {
      fail("e4/e2 squares were not restored");
    }
  });

  await runCase("cross-board move restart", async () => {
    const control = await runControl("cross", (client) =>
      crossBoardMoves(client, 200, 200)
    );
    const dir = tempDir("cross");
    let server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    let client = await openClient();
    await crossBoardMoves(client, 200, 200);
    const before = await stateHash();
    await closeClient(client);
    await stopServer(server);
    server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    const after = await stateHash();
    client = await openClient();
    const source = await snapshotBoard(client, 200, 200);
    const destination = await snapshotBoard(client, 201, 200);
    await closeClient(client);
    await stopServer(server);
    removeDir(dir);
    if (before.digest !== after.digest || after.digest !== control.digest) {
      fail("cross-board move did not survive the restart");
    }
    if (source.board[40] !== 0) fail("a3 was not cleared after recovery");
    if (destination.board[40] === 0) fail("cross-board rook was not restored");
  });

  await runCase("castling and en passant restart", async () => {
    const control = await runControl("special", (client) => specialMoves(client));
    const dir = tempDir("special");
    let server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    let client = await openClient();
    await specialMoves(client);
    const before = await stateHash();
    await closeClient(client);
    await stopServer(server);
    server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    const after = await stateHash();
    client = await openClient();
    const castle = await snapshotBoard(client, 300, 300);
    const enPassant = await snapshotBoard(client, 301, 300);
    await closeClient(client);
    await stopServer(server);
    removeDir(dir);
    if (before.digest !== after.digest || after.digest !== control.digest) {
      fail("special moves were not replayed exactly");
    }
    if (castle.board[62] === 0 || castle.board[61] === 0) {
      fail("castled king/rook were not restored at g1/f1");
    }
    if (enPassant.board[27] !== 0 || enPassant.board[19] === 0) {
      fail("en passant result was not restored");
    }
  });

  await runCase("torn trailing WAL record", async () => {
    const dir = tempDir("torn");
    const server = await startServer(dir, {
      OCAML_OMCB_SNAPSHOT_MOVES: "0",
      OCAML_OMCB_CRASH_POINT: "wal-partial-write",
    });
    const client = await openClient();
    const before = await stateHash();
    let crashed = false;
    try {
      await e2e4(client, 400, 400);
    } catch (_) {
      crashed = true;
    }
    await closeClient(client);
    await waitForExit(server);
    if (!crashed) fail("move unexpectedly succeeded through the crash point");
    await stopServer(server);
    const restarted = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    const after = await stateHash();
    await stopServer(restarted);
    removeDir(dir);
    if (after.digest !== before.digest || after.sequence !== "0") {
      fail("torn WAL record changed the recovered world");
    }
  });

  await runCase("crash during snapshot temp write", async () => {
    const control = await runControl("snapshot-partial", async (client) => {
      const result = await e2e4(client, 500, 500);
      if (!result.accepted) fail("move rejected in control");
    });
    const dir = tempDir("snapshot-partial");
    const server = await startServer(dir, {
      OCAML_OMCB_SNAPSHOT_MOVES: "1",
      OCAML_OMCB_CRASH_POINT: "snapshot-partial-temp",
    });
    const client = await openClient();
    const result = await e2e4(client, 500, 500);
    if (!result.accepted) fail("move was not acknowledged before the snapshot crush");
    await closeClient(client);
    await waitForExit(server);
    await stopServer(server);
    const restarted = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    const after = await stateHash();
    await stopServer(restarted);
    removeDir(dir);
    if (after.digest !== control.digest || after.sequence !== "1") {
      fail("partial snapshot lost the acknowledged move");
    }
  });

  await runCase("crash after snapshot rename before WAL cleanup", async () => {
    const control = await runControl("snapshot-renamed", async (client) => {
      const result = await e2e4(client, 510, 510);
      if (!result.accepted) fail("move rejected in control");
    });
    const dir = tempDir("snapshot-renamed");
    const server = await startServer(dir, {
      OCAML_OMCB_SNAPSHOT_MOVES: "1",
      OCAML_OMCB_CRASH_POINT: "snapshot-renamed",
    });
    const client = await openClient();
    const result = await e2e4(client, 510, 510);
    if (!result.accepted) fail("move was not acknowledged");
    await closeClient(client);
    await waitForExit(server);
    await stopServer(server);
    const restarted = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    const after = await stateHash();
    await stopServer(restarted);
    removeDir(dir);
    if (after.digest !== control.digest || after.sequence !== "1") {
      fail("snapshot before cleanup did not recover the acknowledged move");
    }
  });

  await runCase("corrupt newest snapshot falls back", async () => {
    const dir = tempDir("corrupt-snapshot");
    const server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "1" });
    const client = await openClient();
    for (const board of [600, 601, 602]) {
      const result = await e2e4(client, board, 600);
      if (!result.accepted) fail("move rejected while creating snapshots");
      await sleep(2500);
    }
    const before = await stateHash();
    await closeClient(client);
    await stopServer(server);

    const snapshots = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".snap"))
      .sort();
    if (snapshots.length < 2) fail("expected at least two snapshots to fall back to");
    const newest = path.join(dir, snapshots[snapshots.length - 1]);
    const fd = fs.openSync(newest, "r+");
    const buffer = Buffer.from([0xff]);
    fs.writeSync(fd, buffer, 0, 1, 100);
    fs.closeSync(fd);

    const restarted = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    const after = await stateHash();
    await stopServer(restarted);
    removeDir(dir);
    if (after.digest !== before.digest || after.sequence !== "3") {
      fail("corrupt newest snapshot did not fall back to the previous one");
    }
  });

  await runCase("large WAL replay", async () => {
    const dir = tempDir("large-wal");
    let server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    let client = await openClient();
    for (let board = 0; board < 200; board++) {
      const result = await e2e4(client, board, 0);
      if (!result.accepted) fail(`move rejected on board ${board}`);
    }
    const before = await stateHash();
    await closeClient(client);
    await stopServer(server);
    server = await startServer(dir, { OCAML_OMCB_SNAPSHOT_MOVES: "0" });
    const after = await stateHash();
    await stopServer(server);
    removeDir(dir);
    if (before.digest !== after.digest || after.sequence !== "200") {
      fail("large WAL replay did not reproduce the state");
    }
  });

  const passed = cases.filter((entry) => entry.ok).length;
  const failed = cases.length - passed;
  const result = {
    generated: new Date().toISOString(),
    passed,
    failed,
    cases,
  };
  fs.writeFileSync(
    path.join(ROOT, "bench", "crash_recovery_results.json"),
    JSON.stringify(result, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(ROOT, "bench", "crash_recovery_results.js"),
    "window.CRASH_RECOVERY_RESULTS = " + JSON.stringify(result, null, 2) + ";\n"
  );
  console.log(`Crash recovery: ${passed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
