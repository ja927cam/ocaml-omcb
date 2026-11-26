#!/usr/bin/env node
/* Moves during an atomic subscription-window replacement. */
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

setTimeout(() => {
  console.error("FAIL: subscription transition test exceeded its deadline");
  process.exit(1);
}, 120_000);

async function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function start(port, data) {
  fs.rmSync(data, { recursive: true, force: true });
  fs.mkdirSync(data, { recursive: true });
  const fd = fs.openSync(path.join(data, "server.log"), "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      OCAML_OMCB_DATA_DIR: data,
      OCAML_OMCB_PORT: String(port),
      OCAML_OMCB_INTERFACE: "127.0.0.1",
      OCAML_OMCB_SNAPSHOT_MOVES: "0",
      OCAML_OMCB_SNAPSHOT_SECONDS: "0",
    },
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  for (let i = 0; i < 300; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return child;
    } catch (_) {}
    await sleep(100);
  }
  child.kill("SIGKILL");
  throw new Error("server did not start");
}

class Client {
  constructor(port) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.binaryType = "arraybuffer";
    this.pending = new Map();
    this.events = [];
    this.id = 1;
    this.ws.onmessage = (message) => {
      const bytes = Buffer.from(message.data);
      if (bytes[0] === 4) this.events.push(bytes);
      let id = bytes[0] === 6 ? bytes.readInt32LE(1) : bytes.readInt32LE(2);
      const resolve = this.pending.get(id);
      if (resolve) {
        this.pending.delete(id);
        resolve(bytes);
      }
    };
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  request(bytes, id, label, timeout = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout ${label}`));
      }, timeout);
      this.pending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      this.ws.send(bytes);
    });
  }
  batchWindow(cx, cy) {
    const id = this.id++;
    const bytes = Buffer.alloc(18);
    bytes[0] = 7;
    bytes.writeInt32LE(id, 1);
    bytes.writeUInt16LE(cx - 14, 5);
    bytes.writeUInt16LE(cy - 14, 7);
    bytes.writeUInt16LE(cx + 14, 9);
    bytes.writeUInt16LE(cy + 14, 11);
    bytes.writeUInt16LE(cx, 13);
    bytes.writeUInt16LE(cy, 15);
    bytes[17] = 14;
    return { id, promise: this.request(bytes, id, "batch") };
  }
  snapshot(bx, by) {
    const id = this.id++;
    const bytes = Buffer.alloc(9);
    bytes[0] = 2;
    bytes.writeInt32LE(id, 1);
    bytes.writeUInt16LE(bx, 5);
    bytes.writeUInt16LE(by, 7);
    return this.request(bytes, id, "snapshot");
  }
  move(bx, by) {
    const id = this.id++;
    const bytes = Buffer.alloc(14);
    const source = (bx & 0x3ff) | ((by & 0x3ff) << 10) | (4 << 20) | (6 << 23);
    const packed = BigInt(source) | ((0n & 0x1ffn) << 26n) | ((-2n & 0x1ffn) << 35n);
    bytes.writeBigUInt64LE(packed, 0);
    bytes.writeInt32LE((52 << 8) | 19, 6);
    bytes.writeInt32LE(id, 10);
    return this.request(bytes, id, "move");
  }
  close() { try { this.ws.close(); } catch (_) {} }
}

(async () => {
  const port = await freePort();
  const data = path.join(os.tmpdir(), `ocaml-omcb-transition-${process.pid}`);
  const server = await start(port, data);
  const observer = new Client(port);
  const mover = new Client(port);
  await Promise.all([observer.open(), mover.open()]);
  try {
    for (let i = 0; i < 30; i++) {
      const cx = 200 + (i % 10) * 40;
      const cy = 200 + Math.floor(i / 10) * 40;
      const batch = observer.batchWindow(cx, cy);
      // Fire the move without waiting for the window replacement or snapshot.
      const move = mover.move(cx + 3, cy + 3);
      await Promise.all([batch.promise, move]);
      const snapshot = await observer.snapshot(cx + 3, cy + 3);
      const revision = Number(snapshot.readBigInt64LE(10));
      const eventSeen = observer.events.some((bytes) => bytes.includes(Buffer.from([cx + 3, cy + 3])));
      if (snapshot[1] !== 1 || (revision < 1 && !eventSeen)) {
        throw new Error(`iteration ${i}: move not reflected after window transition (revision ${revision})`);
      }
      const metrics = await (await fetch(`http://127.0.0.1:${port}/metrics`)).json();
      if (metrics.connections.subscriptions > 841) {
        throw new Error(`iteration ${i}: subscriptions ${metrics.connections.subscriptions} exceeded window`);
      }
    }
    console.log("Subscription transition test passed: 30 atomic window replacements with concurrent moves.");
  } finally {
    observer.close();
    mover.close();
    server.kill("SIGTERM");
    await sleep(500);
    try { server.kill("SIGKILL"); } catch (_) {}
    fs.rmSync(data, { recursive: true, force: true });
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
