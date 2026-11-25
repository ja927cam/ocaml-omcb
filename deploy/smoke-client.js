#!/usr/bin/env node
/* Minimal live WebSocket check used by deploy/smoke-test.sh. */

process.env.SIM_MAP_WS_URL =
  process.env.SIM_MAP_WS_URL || process.argv[2] || "ws://127.0.0.1:8080/ws";

const path = require("path");
const { Client } = require(path.join(__dirname, "..", "bench", "ws_client.js"));

async function main() {
  const client = new Client(1, "active");
  await client.open();
  try {
    let board = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 100 + Math.floor(Math.random() * 800);
      const y = 100 + Math.floor(Math.random() * 800);
      const snapshot = await client.snapshot(x, y);
      if (
        snapshot.revision === 0 &&
        snapshot.board[52] === 19 &&
        snapshot.board[12] === 18
      ) {
        board = { x, y };
        break;
      }
    }
    if (!board) throw new Error("could not find a pristine board");
    const result = await client.move_e2e4(board.x, board.y);
    if (!result.accepted) {
      throw new Error(`move rejected with code ${result.rejection}`);
    }
    console.log(`smoke: websocket move accepted on board (${board.x}, ${board.y})`);
  } finally {
    client.close();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("smoke:", error);
    process.exit(1);
  }
);
