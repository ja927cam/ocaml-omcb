#!/usr/bin/env node
/*
 * End-user load test for the game server.
 *
 * What it does
 * ------------
 * - Opens N active WebSocket clients and S silent clients.
 * - Every active client subscribes to a 25x25 window around a freshly chosen
 *   block of boards, then requests a snapshot of 10 boards in that block.
 * - Silent clients subscribe to a window far away and request a few snapshots;
 *   they must never receive a move event.
 * - D drivers then move a pawn on M distinct fresh boards. Every active client
 *   must receive exactly one event per move, for the right board, revision,
 *   request ID and squares.
 * - Reports request latency percentiles, event delivery lag, throughput,
 *   accuracy, server CPU/RSS/fd usage, and post-exit resource usage.
 *
 * The script assumes the server is already running on localhost:8080. Start a
 * fresh server for an official run so the boards used by the moves still have
 * their starting pawns. See bench/README.md for the exact commands.
 *
 * Configuration (environment variables):
 *   LOAD_PROFILE=default   default (40 clients, 100 moves) or stress (80, 200)
 *   LOAD_CLIENTS=40        active clients
 *   LOAD_SILENT=4          silent clients used for subscription isolation
 *   LOAD_SNAPSHOTS=10      snapshot requests per active client
 *   LOAD_MOVES=100         moves, one per fresh board
 *   LOAD_DRIVERS=20        clients that drive the moves
 *   LOAD_BLOCK=10          fresh block is LOAD_BLOCK x LOAD_BLOCK boards
 *   LOAD_LABEL=default     label shown on the dashboard
 *   LOAD_OUTPUT=load_default  output prefix in bench/
 */

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Named profiles make the official runs reproducible while individual values
// can still be overridden from the environment.
const PROFILES = {
  default: {
    clients: 40,
    silent: 4,
    snapshots: 10,
    moves: 100,
    drivers: 20,
    block: 10,
    label: "default",
    output: "load_default",
  },
  stress: {
    clients: 80,
    silent: 4,
    snapshots: 10,
    moves: 200,
    drivers: 40,
    block: 15,
    label: "stress",
    output: "load_stress",
  },
};

const PROFILE_NAME = process.env.LOAD_PROFILE || "default";
const PRESET = PROFILES[PROFILE_NAME] || {};
const CLIENTS = number_env("LOAD_CLIENTS", PRESET.clients ?? 40);
const SILENT_CLIENTS = number_env("LOAD_SILENT", PRESET.silent ?? 4);
const SNAPSHOTS_PER_CLIENT = number_env("LOAD_SNAPSHOTS", PRESET.snapshots ?? 10);
const MOVES = number_env("LOAD_MOVES", PRESET.moves ?? 100);
const DRIVERS = number_env("LOAD_DRIVERS", PRESET.drivers ?? 20);
const BLOCK = number_env("LOAD_BLOCK", PRESET.block ?? 10);
const LABEL = process.env.LOAD_LABEL || PRESET.label || PROFILE_NAME;
const OUTPUT = path.join(
  __dirname,
  `${process.env.LOAD_OUTPUT || PRESET.output || "load"}_results`
);
const WINDOW_RADIUS = 12;
const WS_URL = "ws://localhost:8080/ws";
const WIRE_FRAME = 4096;
const EVENT_KIND = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function number_env(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function stats(values) {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    n: values.length,
    mean_ms: sum / values.length,
    p50_ms: percentile(values, 50),
    p95_ms: percentile(values, 95),
    p99_ms: percentile(values, 99),
    max_ms: Math.max(...values),
  };
}

function parse_event(bytes) {
  const sequence = bytes.readBigInt64LE(1).toString();
  const requestId = bytes.readInt32LE(9);
  const boardCount = bytes[13];
  let offset = 14;
  const boards = [];
  for (let i = 0; i < boardCount; i++) {
    const board_x = bytes.readUInt16LE(offset);
    const board_y = bytes.readUInt16LE(offset + 2);
    const revision = bytes.readInt32LE(offset + 4);
    const changeCount = bytes[offset + 8];
    offset += 9;
    const changes = [];
    for (let j = 0; j < changeCount; j++) {
      changes.push({ square: bytes[offset], piece: bytes[offset + 1] });
      offset += 2;
    }
    boards.push({ board_x, board_y, revision, changes });
  }
  return { sequence, requestId, boards };
}

class Client {
  constructor(index, kind) {
    this.index = index;
    this.kind = kind; // "active", "silent" or "probe"
    this.ws = new WebSocket(WS_URL);
    this.ws.binaryType = "arraybuffer";
    this.pending = new Map();
    this.nextId = 1 + ((index + 1) * 1_000_003) % 2_000_000_000;
    this.events = [];
    this.eventFirstAt = new Map();
    this.eventCounts = new Map();
    this.snapshotRtts = [];
    this.moveRtts = [];
    this.moveResults = [];
    this.closed = false;
    this.intentionalClose = false;
  }

  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error(`client ${this.index} WebSocket error`));
      this.ws.onclose = () => {
        this.closed = true;
        for (const { reject: rejectRequest, timer } of this.pending.values()) {
          clearTimeout(timer);
          rejectRequest(new Error(`client ${this.index} closed during a request`));
        }
        this.pending.clear();
      };
      this.ws.onmessage = (message) => {
        const bytes = Buffer.from(message.data);
        if (bytes.length !== WIRE_FRAME) return;
        if (bytes[0] === EVENT_KIND) {
          const event = parse_event(bytes);
          const at = performance.now();
          this.events.push(event);
          if (!this.eventFirstAt.has(event.sequence)) {
            this.eventFirstAt.set(event.sequence, at);
          }
          this.eventCounts.set(
            event.sequence,
            (this.eventCounts.get(event.sequence) || 0) + 1
          );
          return;
        }
        const id = bytes.readInt32LE(2);
        const entry = this.pending.get(id);
        if (!entry) return;
        this.pending.delete(id);
        clearTimeout(entry.timer);
        entry.resolve(bytes);
      };
    });
  }

  request(bytes, id) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`client ${this.index} request ${id} timed out`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(bytes);
    });
  }

  subscribe_window(cx, cy) {
    const bytes = Buffer.alloc(6);
    bytes[0] = 5;
    bytes.writeUInt16LE(cx, 1);
    bytes.writeUInt16LE(cy, 3);
    bytes[5] = WINDOW_RADIUS;
    this.ws.send(bytes);
  }

  async snapshot(x, y) {
    const id = this.nextId++;
    const bytes = Buffer.alloc(9);
    bytes[0] = 2;
    bytes.writeInt32LE(id, 1);
    bytes.writeUInt16LE(x, 5);
    bytes.writeUInt16LE(y, 7);
    const start = performance.now();
    const response = await this.request(bytes, id);
    const rtt = performance.now() - start;
    this.snapshotRtts.push(rtt);
    return {
      rtt,
      request_id: response.readInt32LE(2),
      status: response[1],
      board_x: response.readUInt16LE(6),
      board_y: response.readUInt16LE(8),
      revision: response.readInt32LE(10),
      board: response.subarray(14, 78),
    };
  }

  async move_e2e4(boardX, boardY) {
    const id = this.nextId++;
    const bytes = Buffer.alloc(14);
    const source =
      (boardX & 0x3ff) |
      ((boardY & 0x3ff) << 10) |
      (4 << 20) |
      (6 << 23);
    const packed =
      BigInt(source) |
      (0n << 26n) |
      ((-2n & 0x1ffn) << 35n);
    bytes.writeBigUInt64LE(packed, 0);
    // White pawn on e2, original board: type 1, white, on-original -> 19.
    bytes.writeInt32LE((52 << 8) | 19, 6);
    bytes.writeInt32LE(id, 10);
    const start = performance.now();
    const response = await this.request(bytes, id);
    const rtt = performance.now() - start;
    this.moveRtts.push(rtt);
    const result = {
      request_id: id,
      board_x: boardX,
      board_y: boardY,
      rtt,
      start,
      accepted: response[1] === 1,
      response_request_id: response.readInt32LE(2),
      sequence: response.readBigInt64LE(6).toString(),
      moved_piece: response.readBigInt64LE(14),
      captured_piece_id: response.readInt32LE(22),
      rejection: response[26],
    };
    this.moveResults.push(result);
    return result;
  }

  close() {
    this.intentionalClose = true;
    if (!this.closed) {
      try {
        this.ws.close();
      } catch (_) {}
    }
  }
}

function server_pid() {
  try {
    return Number(execSync("pgrep -n -x server.exe", { encoding: "utf8" }).trim());
  } catch (_) {
    throw new Error("server.exe is not running; start a fresh server first");
  }
}

function read_rss_kb(pid) {
  const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
  const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
  return match ? Number(match[1]) : 0;
}

function read_cpu_ticks(pid) {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8").trim();
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return Number(fields[11]) + Number(fields[12]);
}

function read_fds(pid) {
  return fs.readdirSync(`/proc/${pid}/fd`).length;
}

async function find_fresh_block(probe) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const cx = BLOCK + Math.floor(Math.random() * (1000 - 2 * BLOCK));
    const cy = BLOCK + Math.floor(Math.random() * (1000 - 2 * BLOCK));
    const x0 = cx - Math.floor(BLOCK / 2);
    const y0 = cy - Math.floor(BLOCK / 2);
    const boards = [];
    for (let y = 0; y < BLOCK; y++) {
      for (let x = 0; x < BLOCK; x++) {
        boards.push({ x: x0 + x, y: y0 + y });
      }
    }
    let fresh = true;
    for (const board of boards) {
      const snap = await probe.snapshot(board.x, board.y);
      if (
        snap.status !== 1 ||
        snap.revision !== 0 ||
        snap.board[52] !== 19 ||
        snap.board[12] !== 18
      ) {
        fresh = false;
        break;
      }
    }
    if (fresh) return { cx, cy, boards };
  }
  throw new Error(
    "could not find a fresh block of boards; restart the server and try again"
  );
}

function far_center(cx, cy) {
  return {
    cx: (cx + 400) % 1000,
    cy: (cy + 400) % 1000,
  };
}

function validate_event(event, move, expected) {
  const result = {
    wrong_board: 0,
    wrong_revision: 0,
    wrong_changes: 0,
    wrong_request_id: 0,
    wrong_board_count: 0,
  };
  if (event.boards.length !== 1) {
    result.wrong_board_count += 1;
    return result;
  }
  const board = event.boards[0];
  if (board.board_x !== move.board_x || board.board_y !== move.board_y) {
    result.wrong_board += 1;
  }
  if (board.revision !== expected.revision) result.wrong_revision += 1;
  if (event.requestId !== move.request_id) result.wrong_request_id += 1;
  const source = board.changes.find((change) => change.square === 52);
  const destination = board.changes.find((change) => change.square === 36);
  if (
    board.changes.length !== 2 ||
    !source ||
    source.piece !== 0 ||
    !destination ||
    destination.piece !== 19
  ) {
    result.wrong_changes += 1;
  }
  return result;
}

function add_counts(target, source) {
  for (const key of Object.keys(source)) target[key] += source[key];
}

async function main() {
  if (BLOCK < 1 || BLOCK > 25) throw new Error("LOAD_BLOCK must be between 1 and 25");
  if (MOVES > BLOCK * BLOCK) {
    throw new Error("LOAD_MOVES cannot exceed LOAD_BLOCK squared");
  }
  if (DRIVERS > CLIENTS) {
    throw new Error("LOAD_DRIVERS cannot exceed LOAD_CLIENTS");
  }
  if (MOVES > 0 && DRIVERS === 0) {
    throw new Error("LOAD_DRIVERS must be positive when moves are requested");
  }

  const pid = server_pid();
  const clkTck = Number(execSync("getconf CLK_TCK", { encoding: "utf8" }).trim());

  const probe = new Client(-1, "probe");
  await probe.open();
  const block = await find_fresh_block(probe);
  probe.close();
  await sleep(100);

  const baselineRss = read_rss_kb(pid);
  const baselineFds = read_fds(pid);
  const active = Array.from({ length: CLIENTS }, (_, index) => new Client(index, "active"));
  const silent = Array.from(
    { length: SILENT_CLIENTS },
    (_, index) => new Client(CLIENTS + index, "silent")
  );
  const clients = [...active, ...silent];
  await Promise.all(clients.map((client) => client.open()));

  const far = far_center(block.cx, block.cy);
  for (const client of active) client.subscribe_window(block.cx, block.cy);
  for (const client of silent) client.subscribe_window(far.cx, far.cy);

  const rssBefore = read_rss_kb(pid);
  const fdsBefore = read_fds(pid);
  const ticksStart = read_cpu_ticks(pid);
  const started = performance.now();

  let peakRss = rssBefore;
  let peakFds = fdsBefore;
  let peakCpu = 0;
  let peakTicks = null;
  let peakSample = null;
  const sampler = setInterval(() => {
    try {
      const now = performance.now();
      const ticks = read_cpu_ticks(pid);
      // Linux CPU accounting has 10 ms resolution, so short windows report
      // single ticks as hundreds of percent. Use ~100 ms windows for the peak.
      if (peakTicks === null) {
        peakTicks = ticks;
        peakSample = now;
      } else if (now - peakSample >= 100) {
        const cpu =
          ((ticks - peakTicks) / clkTck) / ((now - peakSample) / 1000) * 100;
        if (cpu > peakCpu) peakCpu = cpu;
        peakTicks = ticks;
        peakSample = now;
      }
      peakRss = Math.max(peakRss, read_rss_kb(pid));
      peakFds = Math.max(peakFds, read_fds(pid));
    } catch (_) {}
  }, 5);

  const snapshotErrors = [];
  const snapshotReferences = new Map();
  await Promise.all(
    active.map(async (client, clientIndex) => {
      for (let i = 0; i < SNAPSHOTS_PER_CLIENT; i++) {
        const board = block.boards[(clientIndex * 7 + i) % block.boards.length];
        const snap = await client.snapshot(board.x, board.y);
        const key = `${board.x},${board.y}`;
        const reference = snapshotReferences.get(key);
        if (snap.status !== 1 || snap.revision !== 0 || snap.board[52] !== 19) {
          snapshotErrors.push({ client: clientIndex, board, reason: "invalid" });
        } else if (reference && Buffer.compare(reference, snap.board) !== 0) {
          snapshotErrors.push({ client: clientIndex, board, reason: "different" });
        } else if (!reference) {
          snapshotReferences.set(key, Buffer.from(snap.board));
        }
      }
    })
  );

  const silentSnapshotErrors = [];
  await Promise.all(
    silent.map(async (client) => {
      for (let i = 0; i < 2; i++) {
        const x = (far.cx + i * 3) % 1000;
        const y = (far.cy + i * 3) % 1000;
        const snap = await client.snapshot(x, y);
        if (snap.status !== 1) silentSnapshotErrors.push({ x, y });
      }
    })
  );

  // Assign one distinct fresh board per move. Drivers take boards from a shared
  // queue and send their moves sequentially, so moves are concurrent across
  // drivers but ordered per connection.
  let nextBoard = 0;
  await Promise.all(
    Array.from({ length: DRIVERS }, async (_, driverIndex) => {
      const client = active[driverIndex];
      for (;;) {
        const boardIndex = nextBoard++;
        if (boardIndex >= MOVES) return;
        const board = block.boards[boardIndex];
        const result = await client.move_e2e4(board.x, board.y);
        if (result.response_request_id !== result.request_id) {
          result.request_id_mismatch = true;
        }
      }
    })
  );

  const moveResults = active.flatMap((client) => client.moveResults);
  const moveBySequence = new Map();
  for (const move of moveResults) {
    if (moveBySequence.has(move.sequence)) {
      move.duplicate_sequence = true;
    }
    moveBySequence.set(move.sequence, move);
  }

  // Wait for every active client to see every move, then give duplicates time
  // to show up so the deduplication check is meaningful.
  const deadline = Date.now() + 20000;
  while (
    Date.now() < deadline &&
    active.some((client) => client.events.length < MOVES)
  ) {
    await sleep(25);
  }
  await sleep(250);

  const finished = performance.now();
  clearInterval(sampler);
  const ticksEnd = read_cpu_ticks(pid);
  const durationMs = finished - started;

  const expectedSequences = new Set(moveBySequence.keys());
  const accuracy = {
    snapshots_ok: active.length * SNAPSHOTS_PER_CLIENT - snapshotErrors.length,
    snapshot_errors: snapshotErrors.length,
    silent_snapshots_ok: silent.length * 2 - silentSnapshotErrors.length,
    silent_snapshot_errors: silentSnapshotErrors.length,
    moves_accepted: moveResults.filter((move) => move.accepted).length,
    moves_rejected: moveResults.filter((move) => !move.accepted).length,
    move_request_id_mismatches: moveResults.filter((m) => m.request_id_mismatch).length,
    duplicate_move_sequences: moveResults.filter((m) => m.duplicate_sequence).length,
    events: {
      expected_per_client: MOVES,
      min_events: active.length ? Math.min(...active.map((c) => c.events.length)) : 0,
      max_events: active.length ? Math.max(...active.map((c) => c.events.length)) : 0,
      missing_clients: 0,
      duplicate_clients: 0,
      extra_clients: 0,
      wrong_board_events: 0,
      wrong_revision_events: 0,
      wrong_change_events: 0,
      wrong_request_id_events: 0,
      wrong_board_count_events: 0,
      silent_events: silent.reduce((sum, client) => sum + client.events.length, 0),
      unexpected_closes: clients.filter((c) => c.closed && !c.intentionalClose).length,
    },
  };

  const eventLatencies = [];
  for (const client of active) {
    const seen = client.eventCounts;
    if ([...expectedSequences].some((sequence) => !seen.has(sequence))) {
      accuracy.events.missing_clients += 1;
    }
    if ([...seen.keys()].some((sequence) => !expectedSequences.has(sequence))) {
      accuracy.events.extra_clients += 1;
    }
    if ([...seen.values()].some((count) => count > 1)) {
      accuracy.events.duplicate_clients += 1;
    }
    for (const event of client.events) {
      const move = moveBySequence.get(event.sequence);
      if (move) {
        add_counts(accuracy.events, validate_event(event, move, { revision: 1 }));
        const eventAt = client.eventFirstAt.get(event.sequence);
        if (eventAt !== undefined) {
          eventLatencies.push(eventAt - move.start);
        }
      }
    }
  }

  const totalRequests =
    clients.length +
    clients.length + // one set-window subscription per client
    active.length * SNAPSHOTS_PER_CLIENT +
    silent.length * 2 +
    moveResults.length;

  const result = {
    generated: new Date().toISOString(),
    label: LABEL,
    profile: {
      clients: CLIENTS,
      silent_clients: SILENT_CLIENTS,
      snapshots_per_client: SNAPSHOTS_PER_CLIENT,
      moves: MOVES,
      drivers: DRIVERS,
      block: BLOCK,
      window_radius: WINDOW_RADIUS,
    },
    totals: {
      connections: clients.length,
      subscriptions: clients.length,
      snapshots: active.length * SNAPSHOTS_PER_CLIENT + silent.length * 2,
      moves: moveResults.length,
      requests: totalRequests,
    },
    duration_ms: durationMs,
    throughput_requests_per_second: totalRequests / (durationMs / 1000),
    snapshot_rtt: stats(active.flatMap((client) => client.snapshotRtts)),
    silent_snapshot_rtt: stats(silent.flatMap((client) => client.snapshotRtts)),
    move_rtt: stats(moveResults.map((move) => move.rtt)),
    event_delivery_lag: stats(eventLatencies),
    accuracy,
    resources: {
      rss_baseline_kb: baselineRss,
      rss_before_kb: rssBefore,
      rss_peak_kb: peakRss,
      fds_baseline: baselineFds,
      fds_before: fdsBefore,
      fds_peak: peakFds,
      cpu_average_percent:
        ((ticksEnd - ticksStart) / clkTck) / (durationMs / 1000) * 100,
      cpu_peak_percent: peakCpu,
      cpu_peak_window_ms: 100,
    },
  };

  for (const client of clients) client.close();
  await sleep(1000);
  result.resources.fds_after_close_requests = read_fds(pid);
  result.resources.rss_after_close_requests_kb = read_rss_kb(pid);
  const idleStart = read_cpu_ticks(pid);
  await sleep(1000);
  result.resources.cpu_idle_ticks_per_second = read_cpu_ticks(pid) - idleStart;

  write_outputs(result);

  const bad =
    accuracy.snapshot_errors !== 0 ||
    accuracy.silent_snapshot_errors !== 0 ||
    accuracy.moves_rejected !== 0 ||
    accuracy.move_request_id_mismatches !== 0 ||
    accuracy.duplicate_move_sequences !== 0 ||
    accuracy.events.missing_clients !== 0 ||
    accuracy.events.duplicate_clients !== 0 ||
    accuracy.events.extra_clients !== 0 ||
    accuracy.events.silent_events !== 0 ||
    accuracy.events.unexpected_closes !== 0 ||
    accuracy.events.wrong_board_events !== 0 ||
    accuracy.events.wrong_revision_events !== 0 ||
    accuracy.events.wrong_change_events !== 0 ||
    accuracy.events.wrong_request_id_events !== 0 ||
    accuracy.events.wrong_board_count_events !== 0;
  if (bad) fail("accuracy check failed; see the generated results files");

  console.log(render_markdown(result));
  console.log(`Wrote ${OUTPUT}.json, ${OUTPUT}.md and ${OUTPUT}.js`);

  // The server deliberately does not schedule Dream's WebSocket close frame, so
  // clean client closes are released when the client process exits. Measure
  // that from a detached process after this one has gone away.
  spawn(
    process.execPath,
    [path.join(__dirname, "load_after.js"), String(pid), `${OUTPUT}.json`],
    { detached: true, stdio: "ignore" }
  ).unref();
  process.exit(0);
}

function render_markdown(result) {
  const p = result.profile;
  const a = result.accuracy;
  const e = a.events;
  const r = result.resources;
  return [
    "# Live load test results",
    "",
    `Profile: ${result.label}`,
    "",
    `Generated: ${result.generated}`,
    "",
    "## Load",
    "",
    `- ${p.clients} active clients, ${p.silent_clients} silent clients`,
    `- ${result.totals.requests} requests: ${result.totals.connections} connections, ${result.totals.subscriptions} subscriptions, ${result.totals.snapshots} snapshots, ${result.totals.moves} moves`,
    `- ${p.drivers} move drivers on a ${p.block} x ${p.block} fresh block, ${p.window_radius * 2 + 1} x ${p.window_radius * 2 + 1} subscriptions`,
    `- Duration: ${result.duration_ms.toFixed(0)} ms, throughput ${result.throughput_requests_per_second.toFixed(0)} requests/s`,
    "",
    "## Latency",
    "",
    `- Snapshot RTT: p50 ${result.snapshot_rtt.p50_ms.toFixed(1)} ms, p95 ${result.snapshot_rtt.p95_ms.toFixed(1)} ms, p99 ${result.snapshot_rtt.p99_ms.toFixed(1)} ms, max ${result.snapshot_rtt.max_ms.toFixed(1)} ms`,
    `- Move RTT: p50 ${result.move_rtt.p50_ms.toFixed(1)} ms, p95 ${result.move_rtt.p95_ms.toFixed(1)} ms, p99 ${result.move_rtt.p99_ms.toFixed(1)} ms, max ${result.move_rtt.max_ms.toFixed(1)} ms`,
    `- Event delivery lag: p50 ${result.event_delivery_lag.p50_ms.toFixed(1)} ms, p95 ${result.event_delivery_lag.p95_ms.toFixed(1)} ms, p99 ${result.event_delivery_lag.p99_ms.toFixed(1)} ms, max ${result.event_delivery_lag.max_ms.toFixed(1)} ms`,
    "",
    "## Accuracy",
    "",
    `- Moves: ${a.moves_accepted}/${result.totals.moves} accepted, ${a.moves_rejected} rejected, ${a.move_request_id_mismatches} request-ID mismatches, ${a.duplicate_move_sequences} duplicate sequences`,
    `- Snapshots: ${a.snapshots_ok}/${result.totals.snapshots - a.silent_snapshots_ok - a.silent_snapshot_errors} active valid, ${a.silent_snapshots_ok} silent valid, ${a.silent_snapshot_errors} silent failures`,
    `- Events: ${e.min_events}-${e.max_events} per active client, ${e.missing_clients} missing, ${e.duplicate_clients} duplicate, ${e.extra_clients} extra`,
    `- Event contents: ${e.wrong_board_events} wrong board, ${e.wrong_revision_events} wrong revision, ${e.wrong_change_events} wrong changes, ${e.wrong_request_id_events} wrong request ID, ${e.wrong_board_count_events} wrong board count`,
    `- Isolation: ${e.silent_events} events leaked to silent clients, ${e.unexpected_closes} unexpected closes`,
    "",
    "## Server resources",
    "",
    `- RSS: ${(r.rss_baseline_kb / 1024).toFixed(0)} MiB baseline, ${(r.rss_peak_kb / 1024).toFixed(0)} MiB peak, ${(r.rss_after_close_requests_kb / 1024).toFixed(0)} MiB after close requests`,
    `- fds: ${r.fds_baseline} baseline, ${r.fds_before} with clients, ${r.fds_peak} peak, ${r.fds_after_close_requests} after close requests`,
    `- CPU: ${r.cpu_average_percent.toFixed(1)}% average, ${r.cpu_peak_percent.toFixed(1)}% peak; ${r.cpu_idle_ticks_per_second} idle ticks/s after close requests`,
    "",
    "Post-exit fds/RSS/CPU are appended by `bench/load_after.js`.",
    "",
  ].join("\n");
}

function write_outputs(result) {
  fs.writeFileSync(`${OUTPUT}.json`, JSON.stringify(result, null, 2) + "\n");
  fs.writeFileSync(`${OUTPUT}.md`, render_markdown(result));
  fs.writeFileSync(
    `${OUTPUT}.js`,
    "window.LOAD_RESULTS = window.LOAD_RESULTS || {};\n" +
      "window.LOAD_RESULTS[" +
      JSON.stringify(result.label) +
      "] = " +
      JSON.stringify(result, null, 2) +
      ";\n"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
