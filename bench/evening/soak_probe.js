#!/usr/bin/env node
/*
 * Long-running write soak.
 *
 * Opens N connections, each owning a fresh board and alternating a knight.
 * Samples /metrics once per second and reports throughput/latency drift, WAL
 * growth, group-commit behaviour, RSS and queue depth. At the end it snapshots
 * every board and verifies the final piece placement.
 *
 * Environment:
 *   SOAK_CLIENTS=64 SOAK_MOVES=500000 SOAK_SECONDS=0
 *   SOAK_BASE_X=600 SOAK_BASE_Y=600 SOAK_LABEL=... SOAK_OUTPUT=...
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("../ws_client");

const CLIENTS = Number(process.env.SOAK_CLIENTS || 64);
const MOVES = Number(process.env.SOAK_MOVES || 500_000);
const SECONDS = Number(process.env.SOAK_SECONDS || 0);
const BASE_X = Number(process.env.SOAK_BASE_X || 600);
const BASE_Y = Number(process.env.SOAK_BASE_Y || 600);
const LABEL = process.env.SOAK_LABEL || `${CLIENTS}c-${MOVES}m`;
const OUTPUT = process.env.SOAK_OUTPUT || "soak";
const METRICS_URL = process.env.SOAK_METRICS_URL || "http://127.0.0.1:8080/metrics";
const B1 = { x: 1, y: 7 };
const C3 = { x: 2, y: 5 };
const KNIGHT_BYTE = 23;
const squareId = (square) => square.y * 8 + square.x;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index];
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50_ms: percentile(sorted, 0.5),
    p95_ms: percentile(sorted, 0.95),
    p99_ms: percentile(sorted, 0.99),
    max_ms: sorted[sorted.length - 1] || 0,
  };
}

async function metrics() {
  try {
    return await (await fetch(METRICS_URL)).json();
  } catch (_) {
    return null;
  }
}

async function main() {
  const clients = [];
  for (let index = 0; index < CLIENTS; index++) {
    clients.push({
      index,
      boardX: BASE_X + (index % 40),
      boardY: BASE_Y + Math.floor(index / 40),
      client: new Client(index, "probe"),
      accepted: 0,
      rejected: 0,
      lastMove: -1,
      sequences: [],
    });
  }
  for (const entry of clients) {
    entry.client.record_events = false;
    await entry.client.open();
  }

  const before = await metrics();
  const deadline = SECONDS > 0 ? performance.now() + SECONDS * 1000 : null;
  const perClientTarget = Math.ceil(MOVES / CLIENTS);
  let stop = false;
  const samples = [];

  const sampler = (async () => {
    while (!stop) {
      const sample = await metrics();
      if (sample) {
        samples.push({
          at_ms: performance.now(),
          sequence: Number(sample.persistence?.sequence || 0),
          rss_kb: sample.memory?.rss_kb || 0,
          queue_depth: sample.worker?.queue_depth || 0,
          moves_processed: sample.worker?.moves_processed || 0,
          fsync_p50_us: sample.adaptive?.fsync_p50_us || 0,
          fsync_p95_us: sample.adaptive?.fsync_p95_us || 0,
          sync_count: sample.persistence?.sync_count || 0,
          average_group_size: sample.persistence?.average_group_size || 0,
          wal_bytes: Number(sample.persistence?.wal_bytes || 0),
          classification: sample.adaptive?.classification || null,
        });
      }
      await sleep(1000);
    }
  })();

  const started = performance.now();
  await Promise.all(
    clients.map(async (entry) => {
      let moves = 0;
      while (!stop) {
        if (deadline !== null) {
          if (performance.now() >= deadline) break;
        } else if (moves >= perClientTarget) break;
        const from = moves % 2 === 0 ? B1 : C3;
        const to = moves % 2 === 0 ? C3 : B1;
        const result = await entry.client.move(
          entry.boardX,
          entry.boardY,
          from,
          to,
          (squareId(from) << 8) | KNIGHT_BYTE
        );
        entry.lastMove = moves;
        moves++;
        if (result.accepted) {
          entry.accepted++;
          entry.sequences.push(result.sequence);
        } else {
          entry.rejected++;
        }
      }
    })
  );
  const duration = performance.now() - started;
  stop = true;
  await sampler;
  const after = await metrics();

  const verification = [];
  for (const entry of clients) {
    const snapshot = await entry.client.snapshot(entry.boardX, entry.boardY);
    const moves = entry.lastMove + 1;
    const expected = moves % 2 === 0 ? B1 : C3;
    const observed = snapshot.board[squareId(expected)];
    verification.push({
      board_x: entry.boardX,
      board_y: entry.boardY,
      moves,
      expected: squareId(expected),
      observed_byte: observed,
      ok: observed === KNIGHT_BYTE,
    });
  }

  const latencies = clients.flatMap((entry) => entry.client.moveRtts);
  const accepted = clients.reduce((sum, entry) => sum + entry.accepted, 0);
  const rejected = clients.reduce((sum, entry) => sum + entry.rejected, 0);
  const sequences = clients.flatMap((entry) => entry.sequences);
  const uniqueSequences = new Set(sequences).size;

  for (const entry of clients) entry.client.close();
  await sleep(200);

  const result = {
    label: LABEL,
    generated: new Date().toISOString(),
    clients: CLIENTS,
    moves_requested: deadline === null ? CLIENTS * perClientTarget : null,
    duration_ms: duration,
    moves: accepted + rejected,
    accepted,
    rejected,
    moves_per_second: ((accepted + rejected) * 1000) / duration,
    duplicate_sequences: sequences.length - uniqueSequences,
    latency: stats(latencies),
    samples,
    before: before
      ? {
          sequence: before.persistence?.sequence,
          rss_kb: before.memory?.rss_kb,
          gc: before.memory?.gc,
        }
      : null,
    after: after
      ? {
          sequence: after.persistence?.sequence,
          rss_kb: after.memory?.rss_kb,
          gc: after.memory?.gc,
          persistence: after.persistence,
          worker: after.worker,
          counters: after.counters,
        }
      : null,
    verification_ok: verification.every((item) => item.ok),
    verification_failures: verification.filter((item) => !item.ok),
  };
  fs.writeFileSync(
    path.join(__dirname, `${OUTPUT}_results.json`),
    JSON.stringify(result, null, 2) + "\n"
  );
  console.log(
    `${LABEL}: ${result.moves} moves in ${(duration / 1000).toFixed(1)} s, ` +
      `${result.moves_per_second.toFixed(0)} moves/s, ` +
      `p50 ${result.latency.p50_ms.toFixed(2)} ms, ` +
      `p95 ${result.latency.p95_ms.toFixed(2)} ms, ` +
      `accepted ${accepted}, rejected ${rejected}, ` +
      `verify ${result.verification_ok ? "ok" : "FAILED"}`
  );
  process.exit(result.verification_ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
