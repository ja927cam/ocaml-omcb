#!/usr/bin/env node
/*
 * Conflict and ordering probe.
 *
 * Measures how the single-writer state machine resolves simultaneous,
 * contradictory requests and how order-sensitive dependent moves behave.
 *
 * Scenarios:
 *   same-piece-race        N clients move the same knight at once
 *   stale-after-success    replay an old source square after a successful move
 *   independent-boards     N clients move on N boards at once
 *   dependent-capture      black d7-d5 races white e4xd5
 *
 * Environment:
 *   CP_CLIENTS=32 CP_TRIALS=40 CP_BASE_X=500 CP_BASE_Y=500
 *   CP_LABEL=... CP_OUTPUT=...
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("../ws_client");

const CLIENTS = Number(process.env.CP_CLIENTS || 32);
const TRIALS = Number(process.env.CP_TRIALS || 40);
const BASE_X = Number(process.env.CP_BASE_X || 500);
const BASE_Y = Number(process.env.CP_BASE_Y || 500);
const LABEL = process.env.CP_LABEL || "conflict";
const OUTPUT = process.env.CP_OUTPUT || "conflict_probe";

const B1 = { x: 1, y: 7 };
const C3 = { x: 2, y: 5 };
const A3 = { x: 0, y: 5 };
const E2 = { x: 4, y: 6 };
const E4 = { x: 4, y: 4 };
const D7 = { x: 3, y: 1 };
const D5 = { x: 3, y: 3 };
const KNIGHT_BYTE = 23;
const WHITE_PAWN = 19;
const BLACK_PAWN = 18;
const squareId = (square) => square.y * 8 + square.x;
const signature = (square, byte) => (squareId(square) << 8) | byte;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openClients(count, offset) {
  const clients = [];
  for (let index = 0; index < count; index++) {
    const client = new Client(offset + index, "probe");
    client.record_events = false;
    await client.open();
    clients.push(client);
  }
  return clients;
}

async function samePieceRace() {
  const clients = await openClients(CLIENTS, 0);
  const outcomes = [];
  for (let trial = 0; trial < TRIALS; trial++) {
    const boardX = BASE_X + (trial % 20);
    const boardY = BASE_Y + Math.floor(trial / 20);
    const requests = clients.map((client) =>
      client.move(boardX, boardY, B1, C3, signature(B1, KNIGHT_BYTE))
    );
    const results = await Promise.all(requests);
    outcomes.push({
      accepted: results.filter((result) => result.accepted).length,
      rejected: results.filter((result) => !result.accepted).length,
      rejection_codes: results
        .filter((result) => !result.accepted)
        .map((result) => result.rejection),
    });
  }
  for (const client of clients) client.close();
  const accepted = outcomes.reduce((sum, item) => sum + item.accepted, 0);
  const rejected = outcomes.reduce((sum, item) => sum + item.rejected, 0);
  const codes = {};
  for (const item of outcomes) {
    for (const code of item.rejection_codes) codes[code] = (codes[code] || 0) + 1;
  }
  return {
    scenario: "same-piece-race",
    trials: TRIALS,
    concurrent_requests: CLIENTS,
    moves: TRIALS * CLIENTS,
    accepted,
    rejected,
    accepted_per_trial: outcomes.map((item) => item.accepted),
    rejection_codes: codes,
  };
}

async function staleAfterSuccess() {
  const client = new Client(9001, "probe");
  client.record_events = false;
  await client.open();
  const boardX = BASE_X + 30;
  const boardY = BASE_Y + 30;
  const first = await client.move(
    boardX,
    boardY,
    B1,
    C3,
    signature(B1, KNIGHT_BYTE)
  );
  const second = await client.move(
    boardX,
    boardY,
    B1,
    A3,
    signature(B1, KNIGHT_BYTE)
  );
  client.close();
  return {
    scenario: "stale-after-success",
    first_accepted: first.accepted,
    second_accepted: second.accepted,
    second_rejection: second.rejection,
  };
}

async function independentBoards() {
  const clients = await openClients(CLIENTS, 2000);
  const started = performance.now();
  const results = await Promise.all(
    clients.map((client, index) =>
      client.move(
        BASE_X + 100 + (index % 20),
        BASE_Y + 100 + Math.floor(index / 20),
        E2,
        E4,
        signature(E2, WHITE_PAWN)
      )
    )
  );
  const duration = performance.now() - started;
  for (const client of clients) client.close();
  return {
    scenario: "independent-boards",
    requests: CLIENTS,
    accepted: results.filter((result) => result.accepted).length,
    rejected: results.filter((result) => !result.accepted).length,
    duration_ms: duration,
    unique_sequences: new Set(results.map((result) => result.sequence)).size,
  };
}

async function dependentCapture() {
  const setup = new Client(9100, "probe");
  setup.record_events = false;
  const black = new Client(9101, "probe");
  black.record_events = false;
  const white = new Client(9102, "probe");
  white.record_events = false;
  await Promise.all([setup.open(), black.open(), white.open()]);

  const trials = [];
  for (let trial = 0; trial < TRIALS; trial++) {
    const boardX = BASE_X + 200 + (trial % 20);
    const boardY = BASE_Y + 200 + Math.floor(trial / 20);
    const setupResult = await setup.move(
      boardX,
      boardY,
      E2,
      E4,
      signature(E2, WHITE_PAWN)
    );
    if (!setupResult.accepted) {
      throw new Error(`setup move failed on ${boardX},${boardY}`);
    }
    // Randomise which request reaches the worker first.
    const blackFirst = trial % 2 === 0;
    const blackRequest = () =>
      black.move(boardX, boardY, D7, D5, signature(D7, BLACK_PAWN));
    const whiteRequest = () =>
      white.move(boardX, boardY, E4, D5, signature(E4, WHITE_PAWN | 32));
    let blackResult;
    let whiteResult;
    if (blackFirst) {
      blackResult = await blackRequest();
      whiteResult = await whiteRequest();
    } else {
      whiteResult = await whiteRequest();
      blackResult = await blackRequest();
    }
    trials.push({
      order: blackFirst ? "black-first" : "white-first",
      black_accepted: blackResult.accepted,
      white_accepted: whiteResult.accepted,
      white_rejection: whiteResult.accepted ? 0 : whiteResult.rejection,
    });
  }
  setup.close();
  black.close();
  white.close();
  const bothAccepted = trials.filter(
    (item) => item.black_accepted && item.white_accepted
  ).length;
  return {
    scenario: "dependent-capture",
    trials: TRIALS,
    both_accepted: bothAccepted,
    black_only: trials.filter(
      (item) => item.black_accepted && !item.white_accepted
    ).length,
    white_only: trials.filter(
      (item) => !item.black_accepted && item.white_accepted
    ).length,
    details: trials,
  };
}

async function main() {
  const results = [];
  results.push(await samePieceRace());
  results.push(await staleAfterSuccess());
  results.push(await independentBoards());
  results.push(await dependentCapture());
  const payload = {
    label: LABEL,
    generated: new Date().toISOString(),
    results,
  };
  fs.writeFileSync(
    path.join(__dirname, `${OUTPUT}_results.json`),
    JSON.stringify(payload, null, 2) + "\n"
  );
  for (const result of results) {
    console.log(JSON.stringify(result));
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
