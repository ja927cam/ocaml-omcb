#!/usr/bin/env node
/*
 * Operational failure-injection audit.
 *
 * Spawns real servers against isolated data directories, injects one-shot I/O
 * failures through the test-only OCAML_OMCB_FAULT hooks, and verifies the
 * durable-before-publish and recovery invariants. Writes a Markdown report and
 * a machine-readable result file under bench/.
 *
 * Usage: node test/failure_injection_test.js
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { Client } = require("../bench/ws_client");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const DATA_ROOT = path.join(ROOT, "failure-audit-data");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => performance.now();

const results = [];

function record(entry) {
  results.push(entry);
  console.log(
    `${entry.ok ? "PASS" : "FAIL"} ${entry.name}: ${entry.observed}`
  );
}

function fail(message) {
  throw new Error(message);
}

async function portFree() {
  return new Promise((resolve) => {
    const socket = net.connect(8080, "::1");
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

async function startServer({
  name,
  env = {},
  fresh = true,
  dataDir,
}) {
  const dir = dataDir || path.join(DATA_ROOT, name);
  if (fresh) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!(await portFree())) fail("port 8080 is in use");
  const logPath = path.join("/tmp", `ocaml-omcb-failure-${name}.log`);
  const log = fs.openSync(logPath, "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      OCAML_OMCB_DATA_DIR: dir,
      OCAML_OMCB_ADAPTIVE: "0",
      OCAML_OMCB_WAL_GROUP: "16",
      OCAML_OMCB_WAL_GROUP_DELAY_US: "10000",
      OCAML_OMCB_SNAPSHOT_MOVES: "0",
      OCAML_OMCB_SNAPSHOT_SECONDS: "0",
      ...env,
    },
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      const text = readLog(logPath);
      fail(`server exited during startup\n${text.slice(-2000)}`);
    }
    try {
      const response = await fetch("http://localhost:8080/metrics", {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return { child, logPath, dataDir: dir };
    } catch (_) {}
    await sleep(100);
  }
  child.kill("SIGKILL");
  fail(`server did not become ready; ${logPath}`);
}

function readLog(logPath) {
  try {
    return fs.readFileSync(logPath, "utf8");
  } catch (_) {
    return "";
  }
}

async function stopServer(child, signal = "SIGKILL", timeoutMs = 5000) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      sleep(timeoutMs),
    ]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }
  return { code: child.exitCode, signal: child.signalCode };
}

async function waitForExit(child, timeoutMs = 5000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(timeoutMs),
  ]);
  return { code: child.exitCode, signal: child.signalCode };
}

async function stateHash() {
  const response = await fetch("http://localhost:8080/state-hash", {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`state-hash ${response.status}`);
  return response.json();
}

async function metrics() {
  const response = await fetch("http://localhost:8080/metrics", {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`metrics ${response.status}`);
  return response.json();
}

function files(dataDir) {
  return fs.readdirSync(dataDir).sort();
}

async function openClients(count) {
  const clients = Array.from(
    { length: count },
    (_, index) => new Client(index, "active")
  );
  await Promise.all(clients.map((client) => client.open()));
  return clients;
}

function closeClients(clients) {
  for (const client of clients) {
    try {
      client.close();
    } catch (_) {}
  }
}

async function moveRound(clients, round, baseX = 300, baseY = 320) {
  return Promise.all(
    clients.map(async (client, index) => {
      const even = round % 2 === 0;
      const boardX = baseX + index;
      try {
        const result = await client.move(
          boardX,
          baseY,
          even ? { x: 1, y: 7 } : { x: 2, y: 5 },
          even ? { x: 2, y: 5 } : { x: 1, y: 7 },
          ((even ? 57 : 42) << 8) | 23
        );
        return { ...result, board_x: boardX };
      } catch (error) {
        return {
          board_x: boardX,
          error: String(error && error.message ? error.message : error),
        };
      }
    })
  );
}

function summarizeMoves(moves) {
  const accepted = moves.filter((move) => move.accepted);
  const rejected = moves.filter(
    (move) => !move.accepted && !move.error && move.rejection !== undefined
  );
  const errors = moves.filter((move) => move.error);
  return {
    accepted: accepted.length,
    rejected: rejected.length,
    errors: errors.length,
    acceptedSequences: accepted.map((move) => move.sequence),
    rejectedCodes: [...new Set(rejected.map((move) => move.rejection))],
  };
}

async function walFailureCase({ name, fault, after, expectedGroup }) {
  const server = await startServer({
    name,
    env: {
      OCAML_OMCB_FAULT: fault,
      OCAML_OMCB_FAULT_AFTER: String(after),
    },
  });
  const watcher = new Client(9000, "probe");
  await watcher.open();
  // All 16 moving boards are inside this window.
  watcher.subscribe_window(307, 320);
  const clients = await openClients(16);
  await sleep(250);
  // First group is allowed to commit and its events are flushed before the
  // second group hits the injected failure.
  const first = await moveRound(clients, 0);
  await sleep(300);
  const second = await moveRound(clients, 1);
  const moves = [...first, ...second];
  const summary = summarizeMoves(moves);
  const exit = await waitForExit(server.child, 5000);
  await sleep(100);

  let missingAcceptedEvents = 0;
  let rejectedEvents = 0;
  for (const move of first) {
    const count = watcher.eventCounts.get(String(move.sequence)) || 0;
    if (move.accepted && count !== 1) missingAcceptedEvents++;
  }
  for (const move of second) {
    const count = watcher.eventCounts.get(String(move.sequence)) || 0;
    if (count !== 0) rejectedEvents++;
  }

  const acknowledgedBeforeFailure = summary.accepted;
  const restarted = await startServer({
    name: `${name}-restart`,
    fresh: false,
    dataDir: server.dataDir,
  });
  const hash = await stateHash();
  const restartMetrics = await metrics();
  const snap = await (async () => {
    const client = new Client(9100, "probe");
    await client.open();
    const board = await client.snapshot(310, 320);
    client.close();
    return board;
  })();
  await stopServer(restarted.child, "SIGKILL");
  closeClients([...clients, watcher]);

  const observed =
    `${summary.accepted} accepted, ${summary.rejected} rejected, ` +
    `${summary.errors} connection errors; server exit ${JSON.stringify(exit)}; ` +
    `missing committed events=${missingAcceptedEvents}; ` +
    `restart sequence ${hash.sequence}, torn tail=` +
    `${restartMetrics.persistence.truncated_wal}, snapshot status ${snap.status}`;
  // A fatal exit closes every connection, so already-committed events may not
  // reach other subscribers. That is transient delivery loss; what must never
  // happen is an event for a move from the failed group.
  const ok =
    acknowledgedBeforeFailure === 16 &&
    summary.accepted + summary.rejected + summary.errors === 32 &&
    exit.code === 70 &&
    missingAcceptedEvents === 0 &&
    rejectedEvents === 0 &&
    BigInt(hash.sequence) >= BigInt(acknowledgedBeforeFailure) &&
    restartMetrics.persistence.truncated_wal === (fault === "wal-append") &&
    snap.status === 1;

  record({
    name,
    injected: `${fault} after ${after}`,
    expected:
      "failed group is not acknowledged or broadcast; worker fail-stops; restart recovers a valid state containing every acknowledged move",
    observed,
    ok,
    details: {
      ...summary,
      exit,
      missingAcceptedEvents,
      rejectedEvents,
      restartSequence: hash.sequence,
      truncatedWal: restartMetrics.persistence.truncated_wal,
      acceptedOnRestart:
        BigInt(hash.sequence) >= BigInt(acknowledgedBeforeFailure),
    },
  });

  fs.rmSync(server.dataDir, { recursive: true, force: true });
  fs.rmSync(path.join(DATA_ROOT, `${name}-restart`), {
    recursive: true,
    force: true,
  });
}

async function rotationFailureCase() {
  const name = "wal-rotate";
  const server = await startServer({
    name,
    env: {
      OCAML_OMCB_FAULT: "wal-rotate",
      // open_wal_segment is also called at startup; fail the first rotation.
      OCAML_OMCB_FAULT_AFTER: "1",
      OCAML_OMCB_SNAPSHOT_MOVES: "10",
    },
  });
  const clients = await openClients(8);
  const moves = [];
  for (let round = 0; round < 5; round++) {
    moves.push(...(await moveRound(clients, round)));
    await sleep(20);
  }
  await sleep(5000);
  const before = await stateHash();
  const m = await metrics();
  const dirFiles = files(server.dataDir);
  const live = server.child.exitCode === null && server.child.signalCode === null;
  const exit = live ? { code: null, signal: null } : await waitForExit(server.child);
  await stopServer(server.child, "SIGKILL");

  const restarted = await startServer({
    name: `${name}-restart`,
    fresh: false,
    dataDir: server.dataDir,
  });
  const after = await stateHash();
  await stopServer(restarted.child, "SIGKILL");
  closeClients(clients);

  const summary = summarizeMoves(moves);
  const partialSegments = dirFiles.filter((file) => file.endsWith(".tmp"));
  const ok =
    summary.rejected === 0 &&
    summary.errors === 0 &&
    summary.accepted === 40 &&
    live &&
    m.persistence.snapshots >= 1 &&
    partialSegments.length === 0 &&
    before.sequence === after.sequence &&
    before.digest === after.digest;

  record({
    name,
    injected: "wal-rotate on the first snapshot rotation",
    expected:
      "snapshot rotation failure leaves the old WAL appendable; writes continue; a later snapshot succeeds; no partial segment remains",
    observed:
      `${summary.accepted}/40 accepted, ${summary.rejected} rejected; ` +
      `live=${live}; snapshots=${m.persistence.snapshots}; ` +
      `files=${dirFiles.join(",")}; restart sequence ${after.sequence}`,
    ok,
    details: { ...summary, files: dirFiles, persistence: m.persistence },
  });
  fs.rmSync(server.dataDir, { recursive: true, force: true });
  fs.rmSync(path.join(DATA_ROOT, `${name}-restart`), {
    recursive: true,
    force: true,
  });
}

async function snapshotFailureCase(fault) {
  const name = fault;
  const server = await startServer({
    name,
    env: {
      OCAML_OMCB_FAULT: fault,
      OCAML_OMCB_FAULT_AFTER: "0",
      OCAML_OMCB_SNAPSHOT_MOVES: "10",
    },
  });
  const clients = await openClients(8);
  const moves = [];
  for (let round = 0; round < 3; round++) {
    moves.push(...(await moveRound(clients, round)));
    await sleep(20);
  }
  await sleep(4500);
  const m = await metrics();
  const dirFiles = files(server.dataDir);
  const before = await stateHash();
  const live = server.child.exitCode === null && server.child.signalCode === null;
  const summary = summarizeMoves(moves);
  const temps = dirFiles.filter((file) => file.includes(".tmp."));
  const ok =
    summary.accepted === 24 &&
    summary.rejected === 0 &&
    summary.errors === 0 &&
    live &&
    m.persistence.snapshot_pending === false &&
    temps.length === 0 &&
    m.persistence.sync_count > 0;
  await stopServer(server.child, "SIGKILL");

  const restarted = await startServer({
    name: `${name}-restart`,
    fresh: false,
    dataDir: server.dataDir,
  });
  const after = await stateHash();
  const recoveryOk = before.sequence === after.sequence && before.digest === after.digest;
  await stopServer(restarted.child, "SIGKILL");
  closeClients(clients);

  record({
    name,
    injected: `${fault} on the first snapshot after 10 commits`,
    expected:
      "snapshot failure is non-fatal; no temporary snapshot remains; later commits continue; restart recovers the same state",
    observed:
      `${summary.accepted}/24 accepted; live=${live}; temps=${temps.length}; ` +
      `snapshots=${m.persistence.snapshots}; ` +
      `before=${before.sequence}/${before.digest}, after=${after.sequence}/${after.digest}`,
    ok: ok && recoveryOk,
    details: { ...summary, files: dirFiles, persistence: m.persistence, recoveryOk },
  });
  fs.rmSync(server.dataDir, { recursive: true, force: true });
  fs.rmSync(path.join(DATA_ROOT, `${name}-restart`), {
    recursive: true,
    force: true,
  });
}

async function shutdownCase(mode) {
  const name = `shutdown-${mode}`;
  const server = await startServer({
    name,
    env: {
      OCAML_OMCB_SNAPSHOT_MOVES: mode === "snapshot" ? "10" : "0",
    },
  });
  const clients = await openClients(8);
  const moves = [];
  const sendAll = async () => {
    for (let round = 0; round < 6; round++) {
      moves.push(...(await moveRound(clients, round)));
    }
  };
  if (mode === "acked") {
    await sendAll();
    await sleep(300);
  } else if (mode === "queued") {
    // Acknowledge the first 16 moves, then kill while the next burst is
    // queued or in group formation.
    for (let round = 0; round < 2; round++) {
      moves.push(...(await moveRound(clients, round)));
    }
    const work = sendAll().catch(() => {});
    await sleep(5);
    const exit = await stopServer(server.child, "SIGTERM");
    await work;
    const summary = summarizeMoves(moves);
    const restarted = await startServer({
      name: `${name}-restart`,
      fresh: false,
      dataDir: server.dataDir,
    });
    const after = await stateHash();
    await stopServer(restarted.child, "SIGKILL");
    closeClients(clients);
    const ok =
      summary.accepted >= 16 &&
      summary.accepted + summary.rejected + summary.errors === 64 &&
      BigInt(after.sequence) >= BigInt(summary.accepted);
    record({
      name,
      injected:
        "SIGTERM after 16 acknowledged moves while a further 48-move burst was queued",
      expected:
        "every acknowledged move survives; unacknowledged requests fail without corrupting recovery",
      observed:
        `${summary.accepted} accepted, ${summary.rejected} rejected, ` +
        `${summary.errors} errors; restart sequence ${after.sequence}`,
      ok,
      details: { ...summary, exit, restartSequence: after.sequence },
    });
    fs.rmSync(server.dataDir, { recursive: true, force: true });
    fs.rmSync(path.join(DATA_ROOT, `${name}-restart`), {
      recursive: true,
      force: true,
    });
    return;
  } else {
    // snapshot: stop while the snapshot is pending/writing.
    await sendAll();
    for (let i = 0; i < 50; i++) {
      const m = await metrics().catch(() => null);
      if (m && (m.persistence.snapshot_pending || m.persistence.snapshot_writing)) {
        break;
      }
      await sleep(100);
    }
  }
  const before = await stateHash();
  const m = await metrics();
  const exit = await stopServer(server.child, "SIGTERM");
  const restarted = await startServer({
    name: `${name}-restart`,
    fresh: false,
    dataDir: server.dataDir,
  });
  const after = await stateHash();
  const tempsBefore = files(server.dataDir).filter((file) => file.includes(".tmp."));
  const tempsAfter = files(server.dataDir).filter((file) => file.includes(".tmp."));
  await stopServer(restarted.child, "SIGKILL");
  closeClients(clients);
  const summary = summarizeMoves(moves);
  // A hard stop during a snapshot write may leave a temp file; recovery must
  // remove it and still recover the exact pre-shutdown state.
  const ok =
    summary.rejected === 0 &&
    summary.errors === 0 &&
    before.sequence === after.sequence &&
    before.digest === after.digest &&
    tempsAfter.length === 0;
  record({
    name,
    injected:
      mode === "acked"
        ? "SIGTERM with an empty queue after 48 acknowledged moves"
        : "SIGTERM while a snapshot was pending/writing",
    expected:
      "acknowledged moves survive; restart recovers the exact pre-shutdown digest; no temporary snapshot remains",
    observed:
      `${summary.accepted} accepted; snapshot pending=${m.persistence.snapshot_pending} ` +
      `writing=${m.persistence.snapshot_writing}; restart ${after.sequence}/${after.digest}; ` +
      `temps before=${tempsBefore.length}, after=${tempsAfter.length}`,
    ok,
    details: { ...summary, persistence: m.persistence, exit, tempsBefore, tempsAfter },
  });
  fs.rmSync(server.dataDir, { recursive: true, force: true });
  fs.rmSync(path.join(DATA_ROOT, `${name}-restart`), {
    recursive: true,
    force: true,
  });
}

async function main() {
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  try {
    await walFailureCase({ name: "wal-fsync-group", fault: "wal-fsync", after: 1 });
    // Two groups of 16: append the first four moves of the second group, then
    // fail and leave a torn fifth record.
    await walFailureCase({ name: "wal-partial-append", fault: "wal-append", after: 20 });
    await rotationFailureCase();
    for (const fault of [
      "snapshot-write",
      "snapshot-fsync",
      "snapshot-rename",
      "snapshot-dir-fsync",
    ]) {
      await snapshotFailureCase(fault);
    }
    for (const mode of ["acked", "queued", "snapshot"]) {
      await shutdownCase(mode);
    }
  } finally {
    fs.rmSync(DATA_ROOT, { recursive: true, force: true });
  }

  const generated = new Date().toISOString();
  const payload = { generated, results };
  const out = path.join(ROOT, "bench", "failure_audit_results.json");
  fs.writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");

  const lines = [];
  lines.push("# Failure-injection audit results\n");
  lines.push(`Generated: ${generated}\n`);
  lines.push("| Test | Injected | Expected | Observed | Result |");
  lines.push("|---|---|---|---|---|");
  for (const entry of results) {
    lines.push(
      `| ${entry.name} | ${entry.injected} | ${entry.expected} | ${entry.observed} | ${entry.ok ? "pass" : "FAIL"} |`
    );
  }
  fs.writeFileSync(
    path.join(ROOT, "bench", "failure_audit_results.md"),
    lines.join("\n") + "\n"
  );
  const failed = results.filter((entry) => !entry.ok).length;
  console.log(`\nFailure audit: ${results.length - failed}/${results.length} passed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  fs.rmSync(DATA_ROOT, { recursive: true, force: true });
  process.exit(1);
});
