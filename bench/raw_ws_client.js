#!/usr/bin/env node
/*
 * Minimal raw WebSocket client used by the slow-client tests.
 *
 * It speaks just enough RFC 6455 (server -> client unmasked binary frames,
 * client -> server masked binary frames) to subscribe, request snapshots and
 * receive move events. More importantly, it can stop reading or read at a
 * deliberately poor rate so TCP backpressure reaches the server.
 */

const net = require("net");
const crypto = require("crypto");

const WIRE_FRAME = 4096;
const EVENT_KIND = 3;

function mask_frame(payload) {
  const mask = crypto.randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x82, 0x80 | payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x82;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x82;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    masked[i] = payload[i] ^ mask[i % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

class RawClient {
  constructor({ mode = "flow", slow_delay_ms = 200 } = {}) {
    this.mode = mode;
    this.slow_delay_ms = slow_delay_ms;
    this.socket = null;
    this.upgraded = false;
    this.handshake_buffer = Buffer.alloc(0);
    this.frame_buffer = Buffer.alloc(0);
    this.pending_snapshots = new Map();
    this.next_id = 1;
    this.events = 0;
    this.event_sequences = new Set();
    this.last_revision = new Map();
    this.revision_gaps = 0;
    this.bytes_received = 0;
    this.upgrade_at = null;
  }

  connect(timeout_ms = 5000) {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString("base64");
      this.socket = net.connect(8080, "::1", () => {
        this.socket.write(
          "GET /ws HTTP/1.1\r\n" +
            "Host: localhost:8080\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            `Sec-WebSocket-Key: ${key}\r\n` +
            "Sec-WebSocket-Version: 13\r\n\r\n"
        );
      });
      const timer = setTimeout(() => {
        reject(new Error("raw WebSocket handshake timed out"));
      }, timeout_ms);
      this.socket.on("data", (chunk) => {
        try {
          this.on_data(chunk);
        } catch (error) {
          clearTimeout(timer);
          reject(error);
        }
        if (this.upgraded) {
          clearTimeout(timer);
          resolve();
        }
      });
      this.socket.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  on_data(chunk) {
    this.bytes_received += chunk.length;
    if (!this.upgraded) {
      this.handshake_buffer = Buffer.concat([this.handshake_buffer, chunk]);
      const end = this.handshake_buffer.indexOf("\r\n\r\n");
      if (end < 0) return;
      const status = this.handshake_buffer.subarray(0, end).toString();
      if (!status.startsWith("HTTP/1.1 101")) {
        throw new Error(`unexpected handshake: ${status.split("\r\n")[0]}`);
      }
      this.upgraded = true;
      this.upgrade_at = performance.now();
      const rest = this.handshake_buffer.subarray(end + 4);
      this.handshake_buffer = Buffer.alloc(0);
      if (rest.length > 0) this.frame_buffer = Buffer.concat([this.frame_buffer, rest]);
      this.apply_mode();
    } else {
      this.frame_buffer = Buffer.concat([this.frame_buffer, chunk]);
    }
    if (this.mode === "slow") {
      this.socket.pause();
      setTimeout(() => {
        if (this.mode === "slow" && this.socket) this.socket.resume();
      }, this.slow_delay_ms);
    }
    this.parse_frames();
  }

  apply_mode() {
    if (!this.upgraded) return;
    if (this.mode === "paused" || this.mode === "delayed" || this.mode === "slow") {
      this.socket.pause();
    }
    if (this.mode === "delayed") {
      setTimeout(() => this.resume_full(), 500);
    }
  }

  pause() {
    this.mode = "paused";
    if (this.socket) this.socket.pause();
  }

  resume_full() {
    this.mode = "flow";
    if (this.socket) this.socket.resume();
  }

  parse_frames() {
    for (;;) {
      if (this.frame_buffer.length < 2) return;
      const b0 = this.frame_buffer[0];
      const b1 = this.frame_buffer[1];
      let length = b1 & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (this.frame_buffer.length < 4) return;
        length = this.frame_buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.frame_buffer.length < 10) return;
        length = Number(this.frame_buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (this.frame_buffer.length < offset + length) return;
      const opcode = b0 & 0x0f;
      const payload = this.frame_buffer.subarray(offset, offset + length);
      this.frame_buffer = this.frame_buffer.subarray(offset + length);
      if (opcode === 2 && payload.length === WIRE_FRAME) {
        this.on_wire_frame(payload);
      }
    }
  }

  on_wire_frame(payload) {
    const kind = payload[0];
    if (kind === EVENT_KIND) {
      const sequence = payload.readBigInt64LE(1).toString();
      const board_count = payload[13];
      // The payload is a subarray of frame_buffer; use it directly.
      let cursor = 14;
      this.events += 1;
      this.event_sequences.add(sequence);
      for (let i = 0; i < board_count; i++) {
        const board_x = payload.readUInt16LE(cursor);
        const board_y = payload.readUInt16LE(cursor + 2);
        const revision = Number(payload.readBigInt64LE(cursor + 4));
        const change_count = payload[cursor + 12];
        cursor += 13 + change_count * 2;
        const key = `${board_x},${board_y}`;
        const last = this.last_revision.get(key) || 0;
        if (revision !== last + 1) this.revision_gaps += 1;
        this.last_revision.set(key, revision);
      }
    } else if (kind === 4) {
      let cursor = 2;
      for (let i = 0; i < payload[1]; i++) {
        const sequence = payload.readBigInt64LE(cursor).toString();
        const board_count = payload[cursor + 12];
        let board_cursor = cursor + 13;
        this.events += 1;
        this.event_sequences.add(sequence);
        for (let j = 0; j < board_count; j++) {
          const board_x = payload.readUInt16LE(board_cursor);
          const board_y = payload.readUInt16LE(board_cursor + 2);
          const revision = Number(payload.readBigInt64LE(board_cursor + 4));
          const change_count = payload[board_cursor + 12];
          board_cursor += 13 + change_count * 2;
          const key = `${board_x},${board_y}`;
          const last = this.last_revision.get(key) || 0;
          if (revision !== last + 1) this.revision_gaps += 1;
          this.last_revision.set(key, revision);
        }
        cursor = board_cursor;
      }
    } else if (kind === 2) {
      const request_id = payload.readInt32LE(2);
      const resolver = this.pending_snapshots.get(request_id);
      if (resolver) {
        this.pending_snapshots.delete(request_id);
        resolver({
          request_id,
          status: payload[1],
          board_x: payload.readUInt16LE(6),
          board_y: payload.readUInt16LE(8),
          revision: Number(payload.readBigInt64LE(10)),
          board: payload.subarray(18, 82),
        });
      }
    }
  }

  send(payload) {
    this.socket.write(mask_frame(payload));
  }

  subscribe_window(cx, cy, radius = 12) {
    const bytes = Buffer.alloc(6);
    bytes[0] = 5;
    bytes.writeUInt16LE(cx, 1);
    bytes.writeUInt16LE(cy, 3);
    bytes[5] = radius;
    this.send(bytes);
  }

  snapshot(x, y, timeout_ms = 5000) {
    const id = this.next_id++;
    const bytes = Buffer.alloc(9);
    bytes[0] = 2;
    bytes.writeInt32LE(id, 1);
    bytes.writeUInt16LE(x, 5);
    bytes.writeUInt16LE(y, 7);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending_snapshots.delete(id);
        reject(new Error("raw snapshot timed out"));
      }, timeout_ms);
      this.pending_snapshots.set(id, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
      this.send(bytes);
    });
  }

  close() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}

module.exports = { RawClient };
