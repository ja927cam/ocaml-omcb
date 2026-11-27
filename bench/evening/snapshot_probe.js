#!/usr/bin/env node
/*
 * Snapshot throughput probe.
 *
 * Sends 0x06 snapshot-batch requests for square regions of increasing size and
 * measures round-trip latency, payload size and boards/s. Cold regions are
 * never requested twice; warm regions are repeated.
 *
 * Environment:
 *   SP_CLIENTS=1 SP_REPEATS=10 SP_SIZES=1,5,15,25,50,64
 *   SP_BASE_X=400 SP_BASE_Y=400 SP_LABEL=... SP_OUTPUT=...
 */

const fs = require("fs");
const path = require("path");

const CLIENTS = Number(process.env.SP_CLIENTS || 1);
const REPEATS = Number(process.env.SP_REPEATS || 10);
const SIZES = (process.env.SP_SIZES || "1,5,15,25,50,64")
  .split(",")
  .map(Number);
const BASE_X = Number(process.env.SP_BASE_X || 400);
const BASE_Y = Number(process.env.SP_BASE_Y || 400);
const LABEL = process.env.SP_LABEL || `${CLIENTS}c`;
const OUTPUT = process.env.SP_OUTPUT || "snapshot_probe";
const URL = process.env.OCAML_OMCB_WS_URL || "ws://127.0.0.1:8080/ws";

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
    mean_ms: sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1),
  };
}

class BatchClient {
  constructor(index) {
    this.index = index;
    this.ws = new WebSocket(URL);
    this.ws.binaryType = "arraybuffer";
    this.pending = new Map();
    this.nextId = 1 + index * 100_000;
    this.closed = false;
  }

  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error(`client ${this.index} error`));
      this.ws.onclose = () => {
        this.closed = true;
        for (const { reject: fail } of this.pending.values()) {
          fail(new Error("closed"));
        }
        this.pending.clear();
      };
      this.ws.onmessage = (message) => {
        const bytes = Buffer.from(message.data);
        const id = bytes.length >= 5 ? bytes.readInt32LE(1) : 0;
        const entry = this.pending.get(id);
        if (!entry) return;
        this.pending.delete(id);
        clearTimeout(entry.timer);
        entry.resolve({ bytes, at: performance.now() });
      };
    });
  }

  batch(x0, y0, x1, y1) {
    const id = this.nextId++;
    const request = Buffer.alloc(13);
    request[0] = 6;
    request.writeInt32LE(id, 1);
    request.writeUInt16LE(x0, 5);
    request.writeUInt16LE(y0, 7);
    request.writeUInt16LE(x1, 9);
    request.writeUInt16LE(y1, 11);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`batch ${x0},${y0}-${x1},${y1} timed out`));
      }, 30_000);
      this.pending.set(id, {
        resolve: (value) => resolve({ ...value, request_id: id }),
        reject,
        timer,
      });
      this.ws.send(request);
    });
  }

  close() {
    try {
      this.ws.close();
    } catch (_) {}
  }
}

async function main() {
  const clients = [];
  for (let index = 0; index < CLIENTS; index++) {
    const client = new BatchClient(index);
    await client.open();
    clients.push(client);
  }

  const cases = [];
  // Each client gets a disjoint block so concurrent cold reads do not overlap.
  const block = 70;
  for (const size of SIZES) {
    const latencies = [];
    const payloads = [];
    let boards = 0;
    const started = performance.now();
    await Promise.all(
      clients.map(async (client, index) => {
        const baseX = BASE_X + (index % 10) * block;
        const baseY = BASE_Y + Math.floor(index / 10) * block;
        for (let repeat = 0; repeat < REPEATS; repeat++) {
          const x0 = Math.min(999 - size + 1, baseX + repeat);
          const y0 = Math.min(999 - size + 1, baseY + repeat);
          const x1 = x0 + size - 1;
          const y1 = y0 + size - 1;
          const before = performance.now();
          const response = await client.batch(x0, y0, x1, y1);
          const elapsed = performance.now() - before;
          latencies.push(elapsed);
          payloads.push(response.bytes.length);
          boards += size * size;
          if (response.bytes[0] !== 6) {
            throw new Error(`unexpected snapshot frame kind ${response.bytes[0]}`);
          }
        }
      })
    );
    const duration = performance.now() - started;
    cases.push({
      size,
      boards_per_request: size * size,
      requests: CLIENTS * REPEATS,
      boards,
      duration_ms: duration,
      boards_per_second: (boards * 1000) / duration,
      requests_per_second: (CLIENTS * REPEATS * 1000) / duration,
      payload_bytes: stats(payloads),
      latency: stats(latencies),
    });
  }

  for (const client of clients) client.close();
  await sleep(100);
  const result = {
    label: LABEL,
    generated: new Date().toISOString(),
    clients: CLIENTS,
    repeats: REPEATS,
    cases,
  };
  fs.writeFileSync(
    path.join(__dirname, `${OUTPUT}_results.json`),
    JSON.stringify(result, null, 2) + "\n"
  );
  for (const item of cases) {
    console.log(
      `${LABEL} ${item.size}x${item.size}: ${item.requests_per_second.toFixed(0)} req/s, ` +
        `${item.boards_per_second.toFixed(0)} boards/s, ` +
        `p50 ${item.latency.p50_ms.toFixed(2)} ms, ` +
        `payload ${item.payload_bytes.mean_ms.toFixed(0)} B`
    );
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
