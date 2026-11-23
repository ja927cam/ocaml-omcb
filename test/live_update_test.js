#!/usr/bin/env node
/*
 * Live move broadcast integration test.
 *
 * Requires the game server at http://localhost:8080. Exercises real
 * WebSocket subscriptions, same-board fan-out, unrelated-board isolation,
 * cross-board events and disconnection. Event contents for capture, castling,
 * en passant and promotion are covered by the state-worker unit tests.
 */

const SERVER = "http://localhost:8080/";
const WS = "ws://localhost:8080/ws";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

function parsePayload(bytes, offset) {
  const sequence = bytes.readBigInt64LE(offset);
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
  return { event: { sequence, requestId, boards }, next: cursor };
}

function parseEvent(bytes) {
  return parsePayload(bytes, 1).event;
}

class Client {
  constructor(name) {
    this.name = name;
    this.ws = new WebSocket(WS);
    this.ws.binaryType = "arraybuffer";
    this.events = [];
    this.eventWaiters = [];
    this.responses = new Map();
    this.nextId = 1;
  }

  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error(`${this.name} ws error`));
      this.ws.onmessage = (message) => {
        const bytes = Buffer.from(message.data);
        if (bytes.length !== 4096) return;
        const record = (event) => {
          this.events.push(event);
          this.eventWaiters = this.eventWaiters.filter((waiter) => {
            if (waiter.predicate(event)) {
              waiter.resolve(event);
              return false;
            }
            return true;
          });
        };
        if (bytes[0] === 3) {
          record(parseEvent(bytes));
        } else if (bytes[0] === 4) {
          let offset = 2;
          for (let i = 0; i < bytes[1]; i++) {
            const parsed = parsePayload(bytes, offset);
            record(parsed.event);
            offset = parsed.next;
          }
        } else {
          const id = bytes.readInt32LE(2);
          const key = `${bytes[0]}:${id}`;
          const resolve = this.responses.get(key);
          if (resolve) {
            this.responses.delete(key);
            resolve(bytes);
          }
        }
      };
    });
  }

  send(bytes) {
    this.ws.send(bytes);
  }

  request(bytes, kind, id) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.responses.delete(`${kind}:${id}`);
        reject(new Error(`${this.name} response ${kind}:${id} timed out`));
      }, 4000);
      this.responses.set(`${kind}:${id}`, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      this.send(bytes);
    });
  }

  subscribe(boardX, boardY) {
    const bytes = Buffer.alloc(5);
    bytes[0] = 3;
    bytes.writeUInt16LE(boardX, 1);
    bytes.writeUInt16LE(boardY, 3);
    this.send(bytes);
  }

  snapshot(boardX, boardY) {
    const id = this.nextId++;
    const bytes = Buffer.alloc(9);
    bytes[0] = 2;
    bytes.writeInt32LE(id, 1);
    bytes.writeUInt16LE(boardX, 5);
    bytes.writeUInt16LE(boardY, 7);
    return this.request(bytes, 2, id).then((data) => ({
      revision: Number(data.readBigInt64LE(10)),
      board: data.subarray(18, 82),
    }));
  }

  async moveTo(srcBoardX, srcBoardY, srcX, srcY, dstBoardX, dstBoardY, dstX, dstY) {
    const snap = await this.snapshot(srcBoardX, srcBoardY);
    const srcSquare = srcY * 8 + srcX;
    const piece = snap.board[srcSquare];
    if (piece === 0) throw new Error("move source is empty");
    const id = this.nextId++;
    const bytes = Buffer.alloc(14);
    const position =
      (srcBoardX & 0x3ff) |
      ((srcBoardY & 0x3ff) << 10) |
      ((srcX & 7) << 20) |
      ((srcY & 7) << 23);
    const dx = (dstBoardX * 8 + dstX) - (srcBoardX * 8 + srcX);
    const dy = (dstBoardY * 8 + dstY) - (srcBoardY * 8 + srcY);
    const packed =
      BigInt(position) |
      ((BigInt(dx) & 0x1ffn) << 26n) |
      ((BigInt(dy) & 0x1ffn) << 35n);
    bytes.writeBigUInt64LE(packed, 0);
    bytes.writeInt32LE((srcSquare << 8) | piece, 6);
    bytes.writeInt32LE(id, 10);
    const response = await this.request(bytes, 1, id);
    if (response[1] !== 1) throw new Error(`move rejected code ${response[26]}`);
    return response;
  }

  move(boardX, boardY, srcX, srcY, dstX, dstY) {
    return this.moveTo(boardX, boardY, srcX, srcY, boardX, boardY, dstX, dstY);
  }

  waitEvent(predicate, timeout = 4000) {
    const found = this.events.findIndex(predicate);
    if (found >= 0) return Promise.resolve(this.events.splice(found, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve };
      this.eventWaiters.push(waiter);
      setTimeout(() => {
        this.eventWaiters = this.eventWaiters.filter((w) => w !== waiter);
        reject(new Error(`${this.name} event timed out`));
      }, timeout);
    });
  }

  expectNoEvent(timeout = 500) {
    return sleep(timeout).then(() => {
      if (this.events.length !== 0) {
        fail(`${this.name} received an unexpected event`);
      }
    });
  }

  close() {
    this.ws.close();
  }
}

async function freshBoard(client) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = 100 + Math.floor(Math.random() * 800);
    const y = 100 + Math.floor(Math.random() * 800);
    const snap = await client.snapshot(x, y);
    if (snap.board[52] === 19 && snap.board[12] === 18) return { x, y };
  }
  throw new Error("could not find a fresh board");
}

async function main() {
  const check = await fetch(SERVER, { signal: AbortSignal.timeout(3000) });
  if (!check.ok) throw new Error(`server returned ${check.status}`);

  const a = new Client("A");
  const b = new Client("B");
  const c = new Client("C");
  await Promise.all([a.open(), b.open(), c.open()]);
  try {
    const board = await freshBoard(a);
    const east = board.x + 1;
    a.subscribe(board.x, board.y);
    b.subscribe(board.x, board.y);
    c.subscribe(east, board.y);
    // A snapshot after the subscription acts as a barrier: messages on one
    // WebSocket are processed in order.
    const before = await a.snapshot(board.x, board.y);

    await a.move(board.x, board.y, 4, 6, 4, 4);
    const eventA = await a.waitEvent(
      (event) => event.boards.some((x) => x.board_x === board.x && x.board_y === board.y)
    );
    const eventB = await b.waitEvent(
      (event) => event.boards.some((x) => x.board_x === board.x && x.board_y === board.y)
    );
    await c.expectNoEvent();
    if (eventA.sequence !== eventB.sequence) fail("clients saw different sequences");
    const eventBoard = eventA.boards[0];
    if (eventBoard.revision !== before.revision + 1) fail("wrong board revision");
    const source = eventBoard.changes.find((change) => change.square === 52);
    const dest = eventBoard.changes.find((change) => change.square === 36);
    if (!source || source.piece !== 0) fail("normal source not cleared");
    if (!dest || dest.piece === 0) fail("normal destination missing");

    // A board X-only move must not reach C, subscribed only to X+1.
    c.events = [];

    // Set up a quiet cross-board rook move from X+1 to X.
    await c.move(east, board.y, 0, 6, 0, 4);
    await c.waitEvent((event) => event.boards.some((x) => x.board_x === east));
    await c.move(east, board.y, 0, 7, 0, 5);
    await c.waitEvent((event) => event.boards.some((x) => x.board_x === east));
    c.events = [];
    a.events = [];
    b.events = [];

    await c.moveTo(east, board.y, 0, 5, board.x, board.y, 7, 5);
    const crossA = await a.waitEvent((event) => event.boards.length === 2);
    const crossB = await b.waitEvent((event) => event.boards.length === 2);
    const crossC = await c.waitEvent((event) => event.boards.length === 2);
    if (crossA.sequence !== crossB.sequence || crossA.sequence !== crossC.sequence) {
      fail("cross-board clients saw different sequences");
    }
    const boards = new Set(crossA.boards.map((x) => `${x.board_x},${x.board_y}`));
    if (!boards.has(`${board.x},${board.y}`) || !boards.has(`${east},${board.y}`)) {
      fail("cross-board event did not contain both boards");
    }

    // Disconnect C; A and B must still receive subsequent events.
    c.close();
    await sleep(300);
    a.events = [];
    b.events = [];
    await a.move(board.x, board.y, 3, 6, 3, 4);
    await a.waitEvent((event) => event.boards.some((x) => x.board_x === board.x));
    await b.waitEvent((event) => event.boards.some((x) => x.board_x === board.x));

    console.log("Live update test passed: same-board fan-out, isolation, cross-board and disconnect.");
    process.exit(0);
  } finally {
    a.close();
    b.close();
    c.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
