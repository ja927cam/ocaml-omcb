#!/usr/bin/env node
/*
 * Snapshot/live-move consistency integration test.
 *
 * Requires a running server at http://localhost:8080. It repeatedly races a
 * snapshot request from client A against a move from client B on the same
 * board. Depending on server ordering, either:
 *
 *   - the snapshot contains the move (revision 1), or
 *   - the snapshot is revision 0 and the move event follows it.
 *
 * In both cases, applying the frames in the order received must leave the
 * client with the moved pawn, and any event after a snapshot must be a newer
 * revision. A second phase races several snapshot clients against one move.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("../bench/ws_client");

const SERVER = "http://localhost:8080/";
const BLOCK = 5;
const ROUNDS = 20;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

async function fresh_block(client) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const cx = BLOCK + Math.floor(Math.random() * (1000 - 2 * BLOCK));
    const cy = BLOCK + Math.floor(Math.random() * (1000 - 2 * BLOCK));
    const x0 = cx - Math.floor(BLOCK / 2);
    const y0 = cy - Math.floor(BLOCK / 2);
    const boards = [];
    for (let y = 0; y < BLOCK; y++) {
      for (let x = 0; x < BLOCK; x++) boards.push({ x: x0 + x, y: y0 + y });
    }
    let fresh = true;
    for (const board of boards) {
      const snap = await client.snapshot(board.x, board.y);
      if (snap.status !== 1 || snap.revision !== 0 || snap.board[52] !== 19) {
        fresh = false;
        break;
      }
    }
    if (fresh) return { cx, cy, boards };
  }
  throw new Error("could not find a fresh block");
}

function apply_event(board, event) {
  for (const record of event.boards) {
    if (record.board_x !== board.x || record.board_y !== board.y) continue;
    for (const change of record.changes) {
      board.board[change.square] = change.piece;
    }
    board.revision = record.revision;
  }
}

async function main() {
  const a = new Client(0, "active");
  const b = new Client(1, "active");
  await Promise.all([a.open(), b.open()]);
  const block = await fresh_block(b);
  a.subscribe_window(block.cx, block.cy);
  b.subscribe_window(block.cx, block.cy);

  let buffered_after_snapshot = 0;
  let snapshot_contains_move = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const board = block.boards[round % block.boards.length];
    const before = a.message_log.length;
    const snapshot_promise = a.snapshot(board.x, board.y);
    // Give the server a chance to register the snapshot before the move. If it
    // wins, the event must be buffered and released after the snapshot.
    await sleep(2);
    const move = await b.move_e2e4(board.x, board.y);
    if (!move.accepted) fail(`move rejected on board (${board.x},${board.y})`);
    const snapshot = await snapshot_promise;
    await sleep(80);

    const messages = a.message_log.slice(before);
    const snapshot_index = messages.findLastIndex(
      (message) =>
        message.type === "snapshot" &&
        message.request_id === snapshot.request_id
    );
    if (snapshot_index < 0) fail("snapshot response missing from A's log");
    const snapshot_message = messages[snapshot_index];
    if (snapshot_message.revision !== snapshot.revision) {
      fail("snapshot log revision mismatch");
    }
    const events = messages.filter(
      (message) => message.type === "event" &&
        message.event.boards.some(
          (record) => record.board_x === board.x && record.board_y === board.y
        )
    );
    const after = events.filter(
      (message) => messages.indexOf(message) > snapshot_index
    );
    if (after.length > 0) {
      buffered_after_snapshot += 1;
      const revision = after[0].event.boards.find(
        (record) => record.board_x === board.x && record.board_y === board.y
      ).revision;
      if (revision !== snapshot.revision + 1) {
        fail(`event after snapshot has revision ${revision}, expected ${snapshot.revision + 1}`);
      }
    } else if (snapshot.revision >= 1) {
      snapshot_contains_move += 1;
    } else {
      fail("snapshot revision 0 but no move event followed");
    }

    // Apply everything in arrival order; the final board must show e4 (51).
    const cached = {
      x: board.x,
      y: board.y,
      board: Buffer.from(snapshot.board),
      revision: snapshot.revision,
    };
    for (const message of messages) {
      if (message.type === "event") apply_event(cached, message.event);
    }
    if (cached.board[36] !== 51) {
      fail(
        `board (${board.x},${board.y}) lost the move: e4=${cached.board[36]}, ` +
          `snapshot rev=${snapshot.revision}, events=${events.length}`
      );
    }
  }

  // Several clients race snapshots against one move on a fresh board.
  const many = Array.from({ length: 5 }, (_, index) => new Client(10 + index, "active"));
  await Promise.all(many.map((client) => client.open()));
  many.forEach((client) => client.subscribe_window(block.cx, block.cy));
  let concurrent_ok = 0;
  for (let round = 0; round < 5; round++) {
    const board = block.boards[20 + round];
    const before = many.map((client) => client.message_log.length);
    const snapshots = many.map((client) => client.snapshot(board.x, board.y));
    await sleep(2);
    const move = await b.move_e2e4(board.x, board.y);
    if (!move.accepted) fail("concurrent move rejected");
    const responses = await Promise.all(snapshots);
    await sleep(100);
    for (let index = 0; index < many.length; index++) {
      const client = many[index];
      const response = responses[index];
      const messages = client.message_log.slice(before[index]);
      const cached = { x: board.x, y: board.y, board: Buffer.from(response.board), revision: response.revision };
      for (const message of messages) {
        if (message.type === "event") apply_event(cached, message.event);
      }
      if (cached.board[36] !== 51) {
        fail(`concurrent client ${index} lost the move on (${board.x},${board.y})`);
      }
      concurrent_ok += 1;
    }
  }

  const summary = {
    generated: new Date().toISOString(),
    races: ROUNDS,
    buffered_after_snapshot,
    snapshot_contains_move,
    concurrent_clients: concurrent_ok,
    passed: true,
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "bench", "consistency_results.json"),
    JSON.stringify(summary, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(__dirname, "..", "bench", "consistency_results.js"),
    "window.CONSISTENCY_RESULTS = " + JSON.stringify(summary, null, 2) + ";\n"
  );
  console.log(
    `Snapshot consistency test passed: ${ROUNDS} races, ` +
      `${buffered_after_snapshot} buffered-after-snapshot, ` +
      `${snapshot_contains_move} snapshot-contained, ` +
      `${concurrent_ok} concurrent snapshot clients.`
  );
  a.close();
  b.close();
  many.forEach((client) => client.close());
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
