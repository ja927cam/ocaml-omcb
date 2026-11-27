#!/usr/bin/env node
/*
 * Pipelined write-path probe.
 *
 * Each connection owns one fresh board and alternates a knight between b1 and
 * c3 with a fixed number of moves in flight. There are no subscriptions, so
 * this isolates validation + WAL commit + response from event fan-out.
 *
 * Environment:
 *   PP_CLIENTS=64 PP_MOVES=200 PP_WINDOW=16
 *   PP_BASE_X=300 PP_BASE_Y=300 PP_LABEL=... PP_OUTPUT=...
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("../ws_client");

const CLIENTS = Number(process.env.PP_CLIENTS || 64);
const MOVES = Number(process.env.PP_MOVES || 200);
const WINDOW = Number(process.env.PP_WINDOW || 16);
const BASE_X = Number(process.env.PP_BASE_X || 300);
const BASE_Y = Number(process.env.PP_BASE_Y || 300);
const LABEL = process.env.PP_LABEL || `${CLIENTS}x${MOVES}`;
const OUTPUT = process.env.PP_OUTPUT || "pipeline_probe";
const METRICS_URL = process.env.PP_METRICS_URL || "http://127.0.0.1:8080/metrics";
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

async function main() {
  const clients = [];
  for (let index = 0; index < CLIENTS; index++) {
    const boardX = BASE_X + (index % 40);
    const boardY = BASE_Y + Math.floor(index / 40);
    clients.push({
      index,
      boardX,
      boardY,
      client: new Client(index, "probe"),
      accepted: 0,
      rejected: 0,
      sequences: [],
    });
  }
  for (const entry of clients) {
    entry.client.record_events = false;
    await entry.client.open();
  }

  let sequence = 0;
  const started = performance.now();
  await Promise.all(
    clients.map(async (entry) => {
      let next = 0;
      const pump = async () => {
        while (true) {
          const moveIndex = next++;
          if (moveIndex >= MOVES) return;
          const from = moveIndex % 2 === 0 ? B1 : C3;
          const to = moveIndex % 2 === 0 ? C3 : B1;
          const expected = (squareId(from) << 8) | KNIGHT_BYTE;
          const result = await entry.client.move(
            entry.boardX,
            entry.boardY,
            from,
            to,
            expected
          );
          if (result.accepted) {
            entry.accepted++;
            entry.sequences.push(result.sequence);
          } else {
            entry.rejected++;
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(WINDOW, MOVES) }, () => pump())
      );
    })
  );
  const duration = performance.now() - started;

  const latencies = clients.flatMap((entry) => entry.client.moveRtts);
  const accepted = clients.reduce((sum, entry) => sum + entry.accepted, 0);
  const rejected = clients.reduce((sum, entry) => sum + entry.rejected, 0);
  const sequences = clients.flatMap((entry) => entry.sequences);
  const uniqueSequences = new Set(sequences).size;

  let metrics = null;
  try {
    metrics = await (await fetch(METRICS_URL)).json();
  } catch (_) {}

  for (const entry of clients) entry.client.close();
  await sleep(200);

  const result = {
    label: LABEL,
    generated: new Date().toISOString(),
    clients: CLIENTS,
    moves: CLIENTS * MOVES,
    window: WINDOW,
    duration_ms: duration,
    moves_per_second: (CLIENTS * MOVES * 1000) / duration,
    accepted,
    rejected,
    unique_sequences: uniqueSequences,
    duplicate_sequences: sequences.length - uniqueSequences,
    latency: stats(latencies),
    persistence: metrics ? metrics.persistence : null,
    worker: metrics ? metrics.worker : null,
    memory: metrics ? metrics.memory : null,
  };
  fs.writeFileSync(
    path.join(__dirname, `${OUTPUT}_results.json`),
    JSON.stringify(result, null, 2) + "\n"
  );
  console.log(
    `${LABEL}: ${result.moves_per_second.toFixed(0)} moves/s, ` +
      `p50 ${result.latency.p50_ms.toFixed(2)} ms, ` +
      `p95 ${result.latency.p95_ms.toFixed(2)} ms, ` +
      `accepted ${accepted}/${CLIENTS * MOVES}, rejected ${rejected}`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
