#!/usr/bin/env node
/* Shared browser-like WebSocket client for the load harnesses. */

const WS_URL = process.env.SIM_MAP_WS_URL || "ws://localhost:8080/ws";
const WIRE_FRAME = 4096;
const EVENT_KIND = 3;
const EVENT_BATCH_KIND = 4;
const WINDOW_RADIUS = 12;

function parse_event_payload(bytes, offset) {
  const sequence = bytes.readBigInt64LE(offset).toString();
  const requestId = bytes.readInt32LE(offset + 8);
  const boardCount = bytes[offset + 12];
  let cursor = offset + 13;
  const boards = [];
  for (let i = 0; i < boardCount; i++) {
    const board_x = bytes.readUInt16LE(cursor);
    const board_y = bytes.readUInt16LE(cursor + 2);
    const revision = Number(bytes.readBigInt64LE(cursor + 4));
    const changeCount = bytes[cursor + 12];
    cursor += 13;
    const changes = [];
    for (let j = 0; j < changeCount; j++) {
      changes.push({ square: bytes[cursor], piece: bytes[cursor + 1] });
      cursor += 2;
    }
    boards.push({ board_x, board_y, revision, changes });
  }
  return {
    event: { sequence, requestId, boards },
    next: cursor,
  };
}

function parse_event(bytes) {
  return parse_event_payload(bytes, 1).event;
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
    this.message_log = [];
    // Long-running subscribers can disable per-event history; they still
    // consume and parse frames, but do not retain millions of event objects.
    this.record_events = true;
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
        const record = (event, at) => {
          this.events.push(event);
          if (!this.eventFirstAt.has(event.sequence)) {
            this.eventFirstAt.set(event.sequence, at);
          }
          this.eventCounts.set(
            event.sequence,
            (this.eventCounts.get(event.sequence) || 0) + 1
          );
        };
        if (bytes[0] === EVENT_KIND) {
          const event = parse_event_payload(bytes, 1).event;
          if (this.record_events) {
            record(event, performance.now());
            this.message_log.push({ type: "event", event, at: performance.now() });
          }
          return;
        }
        if (bytes[0] === EVENT_BATCH_KIND) {
          const at = performance.now();
          let offset = 2;
          for (let i = 0; i < bytes[1]; i++) {
            const parsed = parse_event_payload(bytes, offset);
            if (this.record_events) {
              record(parsed.event, at);
              this.message_log.push({ type: "event", event: parsed.event, at });
            }
            offset = parsed.next;
          }
          return;
        }
        const id = bytes.readInt32LE(2);
        if (bytes[0] === 2) {
          this.message_log.push({
            type: "snapshot",
            request_id: id,
            revision: Number(bytes.readBigInt64LE(10)),
            board_x: bytes.readUInt16LE(6),
            board_y: bytes.readUInt16LE(8),
            at: performance.now(),
          });
        }
        const entry = this.pending.get(id);
        if (!entry) return;
        this.pending.delete(id);
        clearTimeout(entry.timer);
        entry.resolve(bytes);
      };
      if (this.ws.readyState === 1) resolve();
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
      revision: Number(response.readBigInt64LE(10)),
      board: response.subarray(18, 82),
    };
  }

  async move(boardX, boardY, from, to, expected_piece_id) {
    const id = this.nextId++;
    const bytes = Buffer.alloc(14);
    const source =
      (boardX & 0x3ff) |
      ((boardY & 0x3ff) << 10) |
      ((from.x & 7) << 20) |
      ((from.y & 7) << 23);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const packed =
      BigInt(source) |
      ((BigInt(dx) & 0x1ffn) << 26n) |
      ((BigInt(dy) & 0x1ffn) << 35n);
    bytes.writeBigUInt64LE(packed, 0);
    bytes.writeInt32LE(expected_piece_id, 6);
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

  async move_e2e4(boardX, boardY, expected_piece_id = (52 << 8) | 19) {
    // White pawn on e2, original board: type 1, white, on-original -> 19.
    return this.move(
      boardX,
      boardY,
      { x: 4, y: 6 },
      { x: 4, y: 4 },
      expected_piece_id
    );
  }

  async move_e4e2(boardX, boardY, expected_piece_id = (36 << 8) | 19) {
    return this.move(
      boardX,
      boardY,
      { x: 4, y: 4 },
      { x: 4, y: 6 },
      expected_piece_id
    );
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

module.exports = {
  Client,
  parse_event,
  parse_event_payload,
  WIRE_FRAME,
  EVENT_KIND,
  EVENT_BATCH_KIND,
  WS_URL,
};

