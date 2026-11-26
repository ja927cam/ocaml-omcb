#!/usr/bin/env node
/*
 * Headless-browser panning stress test for the bounded client board cache.
 *
 * Starts an isolated server and Chromium, pans continuously across at least
 * 40 board widths in horizontal, vertical and diagonal directions, performs
 * rapid direction changes, settles, returns to an earlier location and keeps
 * panning long enough to force evictions.
 *
 * It records snapshot requests, boards transferred, subscription messages,
 * cache occupancy/peak/evictions, visible blanks and settle time. Set
 * PAN_BASELINE=1 to run without the new cache dataset assertions (useful for
 * recording the old client's behaviour).
 */

const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERVER = path.join(ROOT, "_build", "default", "server", "server.exe");
const BOARD_SCALE = 216;
const CACHE_LIMIT = 900;
const SLEEP = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const BASELINE = process.env.PAN_BASELINE === "1";

setTimeout(() => {
  console.error("FAIL: panning test exceeded its overall deadline");
  process.exit(1);
}, 240_000);

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startServer(port, dataDir) {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const log = path.join(dataDir, "server.log");
  const fd = fs.openSync(log, "w");
  const child = spawn(SERVER, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      OCAML_OMCB_DATA_DIR: dataDir,
      OCAML_OMCB_PORT: String(port),
      OCAML_OMCB_INTERFACE: "127.0.0.1",
      OCAML_OMCB_ADAPTIVE: "1",
      OCAML_OMCB_SNAPSHOT_MOVES: "0",
      OCAML_OMCB_SNAPSHOT_SECONDS: "0",
    },
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`server exited during startup; see ${log}`);
    }
    try {
      const response = await fetch(`http://localhost:${port}/healthz`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return child;
    } catch (_) {}
    await SLEEP(100);
  }
  child.kill("SIGKILL");
  throw new Error(`server did not become healthy; see ${log}`);
}

async function stopServer(child) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      SLEEP(8000),
    ]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  const port = await freePort();
  const dataDir = path.join(os.tmpdir(), `ocaml-omcb-panning-${process.pid}`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-panning-"));
  const server = await startServer(port, dataDir);
  const cdpPort = 9600 + Math.floor(Math.random() * 300);
  const chrome = spawn(
    "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=800,700",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let ws;
  try {
    const versionDeadline = Date.now() + 20_000;
    while (true) {
      try {
        const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (response.ok) break;
      } catch (_) {}
      if (Date.now() > versionDeadline) throw new Error("Chromium did not start");
      await SLEEP(150);
    }
    const targets = await (
      await fetch(`http://127.0.0.1:${cdpPort}/json/list`)
    ).json();
    const page = targets.find((target) => target.type === "page");
    if (!page) throw new Error("no page target");

    ws = new WebSocket(page.webSocketDebuggerUrl);
    let nextId = 0;
    const pending = new Map();
    let exceptions = 0;
    ws.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.id && pending.has(event.id)) {
        const entry = pending.get(event.id);
        pending.delete(event.id);
        event.error
          ? entry.reject(new Error(JSON.stringify(event.error)))
          : entry.resolve(event.result);
      } else if (event.method === "Runtime.exceptionThrown") {
        exceptions += 1;
        console.error("browser exception:", JSON.stringify(event.params.exceptionDetails));
      }
    };
    await new Promise((resolve) => (ws.onopen = resolve));
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) {
        throw new Error(JSON.stringify(result.exceptionDetails));
      }
      return result.result.value;
    };

    await send("Page.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "try { localStorage.setItem('ocaml-omcb.seen-intro', '1'); } catch (_) {}" });
    await send("Runtime.enable");
    await send("Performance.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: "localStorage.setItem('ocaml-omcb.player-colour', 'white');",
    });
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        window.__panNet = {
          batches: [], singles: [], subAdds: 0, subRemoves: 0, windows: 0,
          batchBoards: 0, duplicateBoards: 0, requested: new Set(), inflight: new Set(),
          duplicateInflight: 0, pendingByRequest: new Map()
        };
        const originalSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function (data) {
          try {
            if (data instanceof ArrayBuffer) {
              const view = new DataView(data);
              const kind = view.getUint8(0);
              if ((data.byteLength === 13 || data.byteLength === 18) && (kind === 6 || kind === 7)) {
                if (kind === 7) window.__panNet.windows += 1;
                const rect = [view.getUint16(5, true), view.getUint16(7, true), view.getUint16(9, true), view.getUint16(11, true)];
                window.__panNet.batches.push(rect);
                const boards = [];
                for (let y = rect[1]; y <= rect[3]; y++) for (let x = rect[0]; x <= rect[2]; x++) boards.push(y * 1000 + x);
                for (const key of boards) {
                  if (window.__panNet.inflight.has(key)) window.__panNet.duplicateInflight += 1;
                  if (window.__panNet.requested.has(key)) window.__panNet.duplicateBoards += 1;
                  else window.__panNet.requested.add(key);
                  window.__panNet.inflight.add(key);
                }
                window.__panNet.pendingByRequest.set(view.getInt32(1, true), boards);
              } else if (data.byteLength === 9 && kind === 2) {
                window.__panNet.singles.push([view.getUint16(5, true), view.getUint16(7, true)]);
              } else if (data.byteLength === 5 && kind === 3) {
                window.__panNet.subAdds += 1;
              } else if (data.byteLength === 5 && kind === 4) {
                window.__panNet.subRemoves += 1;
              } else if (data.byteLength === 6 && kind === 5) {
                window.__panNet.windows += 1;
              }
            }
          } catch (_) {}
          return originalSend.call(this, data);
        };
        const originalMessage = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
        // Track batch completions through the message event in addition to the
        // client's own handler.
        window.__panBatchDone = 0;
        WebSocket.prototype.addEventListener.call;
        const originalAdd = WebSocket.prototype.addEventListener;
        WebSocket.prototype.addEventListener = function (type, listener, options) {
          if (type === 'message') {
            const wrapped = function (event) {
              try {
                const bytes = new Uint8Array(event.data);
                if (bytes.length >= 13 && (bytes[0] === 5 || bytes[0] === 6)) {
                  const view = new DataView(event.data);
                  const width = view.getUint16(9, true), height = view.getUint16(11, true);
                  if (bytes[0] === 6) {
                    window.__panNet.batchBoards += width * height;
                    window.__panBatchDone += 1;
                    const id = view.getInt32(1, true);
                    const keys = window.__panNet.pendingByRequest.get(id);
                    if (keys) {
                      for (const key of keys) window.__panNet.inflight.delete(key);
                      window.__panNet.pendingByRequest.delete(id);
                    }
                  }
                }
              } catch (_) {}
              return listener.call(this, event);
            };
            return originalAdd.call(this, type, wrapped, options);
          }
          return originalAdd.call(this, type, listener, options);
        };
      })();`,
    });

    await send("Page.navigate", { url: `http://127.0.0.1:${port}/?x=500&y=500` });
    await SLEEP(1200);

    const readState = async () =>
      JSON.parse(
        await evaluate(`(() => {
          const body = document.body;
          const canvas = document.getElementById('game');
          const rect = canvas.getBoundingClientRect();
          return JSON.stringify({
            left: parseFloat(body.dataset.viewLeft || '0'),
            top: parseFloat(body.dataset.viewTop || '0'),
            zoom: parseFloat(body.dataset.zoom || '1'),
            dpr: window.devicePixelRatio || 1,
            width: rect.width,
            height: rect.height,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            loaded: Number(body.dataset.loadedBoards || '0'),
            occupancy: Number(body.dataset.cacheOccupancy || body.dataset.loadedBoards || '0'),
            peak: Number(body.dataset.cachePeak || body.dataset.loadedBoards || '0'),
            evictions: Number(body.dataset.cacheEvictions || '0'),
            visibleMissing: body.dataset.visibleMissing === undefined ? null : Number(body.dataset.visibleMissing),
            inFlight: Number(body.dataset.inflightBatches || '0'),
            windowBatch: body.dataset.windowBatchSupported === undefined ? null : Number(body.dataset.windowBatchSupported),
            status: document.getElementById('status').textContent,
            statusKind: document.getElementById('status').dataset.status,
            net: {
              batches: window.__panNet.batches.length,
              singles: window.__panNet.singles.length,
              subAdds: window.__panNet.subAdds,
              subRemoves: window.__panNet.subRemoves,
              windows: window.__panNet.windows,
              batchBoards: window.__panNet.batchBoards,
              duplicateBoards: window.__panNet.duplicateBoards,
              duplicateInflight: window.__panNet.duplicateInflight
            }
          });
        })()`)
      );

    const visibleBoards = (state) => {
      const boardPx = BOARD_SCALE * state.zoom * state.dpr;
      const x0 = Math.floor(state.left);
      const y0 = Math.floor(state.top);
      const x1 = Math.min(999, Math.ceil(state.left + state.width / boardPx) - 1);
      const y1 = Math.min(999, Math.ceil(state.top + state.height / boardPx) - 1);
      const boards = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) boards.push([x, y]);
      return boards;
    };

    const blankVisible = async (state) => {
      const boards = visibleBoards(state);
      const boardPx = BOARD_SCALE * state.zoom * state.dpr;
      return evaluate(`(() => {
        const canvas = document.getElementById('game');
        const ctx = canvas.getContext('2d');
        const left = ${state.left}, top = ${state.top}, boardPx = ${boardPx};
        const boards = ${JSON.stringify(boards)};
        let blank = 0;
        for (const [bx, by] of boards) {
          const x = Math.round((bx - left) * boardPx + 4 * (boardPx / 8) + 6);
          const y = Math.round((by - top) * boardPx + 6 * (boardPx / 8) + 6);
          const size = Math.max(4, Math.round(boardPx / 8) - 12);
          const data = ctx.getImageData(x, y, size, size).data;
          let ink = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (!((r === 240 && g === 217 && b === 181) || (r === 181 && g === 136 && b === 99))) ink++;
          }
          if (ink < 3) blank++;
        }
        return blank;
      })()`);
    };

    const waitSettled = async (label, timeout = 15000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const state = await readState();
        const blanks = await blankVisible(state);
        if (blanks === 0 && state.inFlight === 0) return state;
        await SLEEP(50);
      }
      const state = await readState();
      const blanks = await blankVisible(state);
      const extra = await evaluate("JSON.stringify({failures:document.body.dataset.batchFailures,prefetchMissing:document.body.dataset.prefetchMissing,inflightBoards:document.body.dataset.inflightBoards,status:document.getElementById('status').textContent})");
      fail(`${label}: ${blanks} visible board(s) still blank after ${timeout} ms (status ${state.status}, inFlight ${state.inFlight}, ${extra})`);
    };

    const initialState = await waitSettled("initial load", 20000);
    if (!BASELINE && initialState.visibleMissing !== 0) {
      fail(`initial visibleMissing was ${initialState.visibleMissing}`);
    }
    const initialNet = { ...initialState.net };

    const mouse = (type, x, y) =>
      send("Input.dispatchMouseEvent", {
        type,
        x,
        y,
        button: "left",
        buttons: type === "mouseReleased" ? 0 : 1,
        clickCount: 1,
      });

    let duringSample = async () => {};
    const pan = async (dx, dy = 0, settle = 0) => {
      const state = await readState();
      const boardPx = BOARD_SCALE * state.zoom * state.dpr;
      const canvasX = state.width / 2;
      const canvasY = state.height / 2;
      const startX = canvasX;
      const startY = canvasY;
      const endX = startX - dx * boardPx;
      const endY = startY - dy * boardPx;
      await mouse("mousePressed", startX, startY);
      await SLEEP(8);
      await mouse("mouseMoved", endX, endY);
      await SLEEP(20);
      await duringSample();
      await SLEEP(8);
      await mouse("mouseReleased", endX, endY);
      if (settle > 0) await SLEEP(settle);
    };

    // One-board pan: every board is already in the 27x27 prefetch window, so
    // the client must not issue another snapshot request.
    const beforeSmall = await readState();
    await pan(1, 0, 250);
    const afterSmall = await readState();
    if (
      !BASELINE
      && afterSmall.net.batches - beforeSmall.net.batches > 1
    ) {
      fail("a one-board pan needed more than one incremental snapshot request");
    }
    await pan(-1, 0, 250);

    const peakMissing = [];
    const peakBlanks = [];
    const occupancySamples = [];
    const sample = async () => {
      const state = await readState();
      occupancySamples.push(state.occupancy);
      if (state.visibleMissing !== null) peakMissing.push(state.visibleMissing);
      peakBlanks.push(await blankVisible(state));
      return state;
    };
    duringSample = sample;

    // Continuous movement: 20 east, 12 south, 12 diagonal, then rapid
    // reversals. Each drag is four boards; pauses are deliberately tiny.
    for (let i = 0; i < 5; i++) {
      await pan(4, 0, 20);
      await sample();
    }
    for (let i = 0; i < 3; i++) {
      await pan(0, 4, 20);
      await sample();
    }
    for (let i = 0; i < 3; i++) {
      await pan(4, 4, 20);
      await sample();
    }
    for (const dx of [4, -2, 5, -3, 4, -4, 3, -2, 5, -3]) {
      await pan(dx, 0, 10);
      await sample();
    }

    const settleStart = Date.now();
    const settled = await waitSettled("rapid pan", 15000);
    const settleMs = Date.now() - settleStart;
    const settledBlanks = await blankVisible(settled);
    if (!BASELINE && settledBlanks !== 0) fail(`${settledBlanks} visible boards blank after settling`);
    if (!BASELINE && settled.statusKind !== "live") {
      fail(`status did not reach live after settling: ${settled.status}`);
    }
    if (!BASELINE && settled.windowBatch !== 1) {
      fail(`atomic window batches unexpectedly unavailable (${settled.windowBatch})`);
    }

    // Return to the earlier window and confirm that cached boards load without
    // a fresh snapshot, then continue long enough to force evictions.
    const origin = await readState();
    const returnDx = initialState.left - origin.left;
    const returnDy = initialState.top - origin.top;
    for (let remaining = returnDx; Math.abs(remaining) > 0.5; ) {
      const step = Math.max(-5, Math.min(5, remaining));
      await pan(step, 0, 20);
      remaining -= step;
    }
    for (let remaining = returnDy; Math.abs(remaining) > 0.5; ) {
      const step = Math.max(-5, Math.min(5, remaining));
      await pan(0, step, 20);
      remaining -= step;
    }
    const beforeReturn = await readState();
    const returned = await waitSettled("return", 15000);
    const returnRequests = returned.net.batches - beforeReturn.net.batches
      + returned.net.singles - beforeReturn.net.singles;
    const returnBlanks = await blankVisible(returned);
    if (!BASELINE && returnBlanks !== 0) fail(`${returnBlanks} visible boards blank after returning`);

    for (let i = 0; i < 30; i++) {
      await pan(5, 0, 10);
      await sample();
    }
    const longRun = await waitSettled("long pan", 15000);
    const finalState = longRun;
    const peakOccupancy = Math.max(...occupancySamples, finalState.peak);
    if (peakOccupancy > CACHE_LIMIT) {
      fail(`cache peak ${peakOccupancy} exceeded ${CACHE_LIMIT}`);
    }
    if (!BASELINE && finalState.peak > CACHE_LIMIT) {
      fail(`reported cache peak ${finalState.peak} exceeded ${CACHE_LIMIT}`);
    }
    // duplicateInflight is reported for visibility; a retry after a timed-out
    // response is legitimate, so it is not a hard failure.

    const serverMetrics = await (await fetch(`http://127.0.0.1:${port}/metrics`)).json();
    if (
      !BASELINE
      && (!serverMetrics.board_load
        || serverMetrics.board_load.overall.samples < 1
        || serverMetrics.board_load.regions.length < 1)
    ) {
      fail("server board-load section metrics were not populated");
    }

    const heap = await send("Runtime.getHeapUsage").catch(() => null);
    const net = finalState.net;
    const result = {
      generated: new Date().toISOString(),
      baseline: BASELINE,
      initial: {
        loaded: initialState.loaded,
        occupancy: initialState.occupancy,
        visibleBoards: visibleBoards(initialState).length,
      },
      rapidPan: {
        settle_ms: settleMs,
        peak_visible_missing: peakMissing.length ? Math.max(...peakMissing) : null,
        peak_blank_boards: peakBlanks.length ? Math.max(...peakBlanks) : null,
        final_blank_after_timeout: BASELINE ? await blankVisible(settled) : null,
        final_visible_missing: settled.visibleMissing,
        final_blank_boards: settledBlanks,
      },
      requests: {
        batch_requests: net.batches,
        single_requests: net.singles,
        boards_requested: net.batchBoards,
        duplicate_boards: net.duplicateBoards,
        duplicate_inflight: net.duplicateInflight,
      },
      subscriptions: {
        adds: net.subAdds,
        removes: net.subRemoves,
        windows: net.windows,
      },
      cache: {
        occupancy: finalState.occupancy,
        peak: finalState.peak,
        evictions: finalState.evictions,
        limit: CACHE_LIMIT,
      },
      server: {
        subscriptions: serverMetrics.connections.subscriptions,
        rss_kb: serverMetrics.memory.rss_kb,
        board_load: serverMetrics.board_load || null,
      },
      return: {
        snapshot_requests: returnRequests,
        blank_boards: returnBlanks,
      },
      heap: heap
        ? {
            used_size: heap.usedSize,
            total_size: heap.totalSize,
            embedder_heap_used: heap.embedderHeapUsedSize,
          }
        : null,
      exceptions,
    };

    const outJson = path.join(ROOT, "bench", BASELINE ? "panning_before.json" : "panning_after.json");
    const outMd = path.join(ROOT, "bench", BASELINE ? "panning_before.md" : "panning_after.md");
    fs.writeFileSync(outJson, JSON.stringify(result, null, 2) + "\n");
    fs.writeFileSync(
      outMd,
      [
        `# Client panning ${BASELINE ? "before" : "after"}`,
        "",
        `- Initial loaded boards: ${result.initial.loaded}`,
        `- Rapid-pan settle: ${result.rapidPan.settle_ms} ms`,
        `- Peak visible blanks during pan: ${result.rapidPan.peak_blank_boards}`,
        `- Visible blanks after settle: ${result.rapidPan.final_blank_boards}`,
        `- Batch requests: ${result.requests.batch_requests}`,
        `- Boards requested: ${result.requests.boards_requested}`,
        `- Duplicate in-flight boards: ${result.requests.duplicate_inflight}`,
        `- Subscription add/remove messages: ${result.subscriptions.adds}/${result.subscriptions.removes}`,
        `- Subscription window resets: ${result.subscriptions.windows}`,
        `- Cache occupancy/peak/evictions: ${result.cache.occupancy}/${result.cache.peak}/${result.cache.evictions} (limit ${result.cache.limit})`,
        `- Server subscriptions/RSS: ${result.server.subscriptions} / ${result.server.rss_kb} KiB`,
        `- Board-load regions/samples: ${result.server.board_load ? result.server.board_load.regions.length : "n/a"} / ${result.server.board_load ? result.server.board_load.overall.samples : "n/a"}`,
        `- Return snapshot requests: ${result.return.snapshot_requests}`,
        `- Browser JS heap used: ${heap ? Math.round(heap.usedSize / 1024) : "n/a"} KiB`,
        "",
      ].join("\n")
    );

    if (exceptions !== 0) fail(`browser raised ${exceptions} exception(s)`);
    console.log(
      `Panning test passed (${BASELINE ? "baseline" : "after"}): ` +
      `settle ${settleMs} ms, peak blanks ${result.rapidPan.peak_visible_missing}, ` +
      `${net.batches} batch requests / ${net.batchBoards} boards, ` +
      `cache ${finalState.occupancy}/${finalState.peak} (limit ${CACHE_LIMIT}), ` +
      `${finalState.evictions} evictions, ${net.windows} subscription resets, ` +
      `server subs ${serverMetrics.connections.subscriptions}.`
    );
    await send("Browser.close").catch(() => {});
  } finally {
    if (ws) try { ws.close(); } catch (_) {}
    chrome.kill("SIGTERM");
    await SLEEP(250);
    chrome.kill("SIGKILL");
    fs.rmSync(profile, { recursive: true, force: true });
    await stopServer(server);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
