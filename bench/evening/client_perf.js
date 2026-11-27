#!/usr/bin/env node
/*
 * Browser client performance probe.
 *
 * Launches headless Chromium through CDP and measures navigation, resource
 * transfer, WASM boot, idle/pan/zoom frame rate, JS heap and mobile layout.
 *
 * Environment:
 *   CLIENT_URL=http://127.0.0.1:8080/?x=500&y=500 CLIENT_LABEL=local
 *   CLIENT_MOBILE=1 CLIENT_OUTPUT=client_perf
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const URL =
  process.env.CLIENT_URL || "http://127.0.0.1:8080/?x=500&y=500";
const LABEL = process.env.CLIENT_LABEL || "local";
const OUTPUT = process.env.CLIENT_OUTPUT || "client_perf";
const MOBILE = process.env.CLIENT_MOBILE === "1";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return sorted[index];
}

async function main() {
  const cdpPort = 9800 + Math.floor(Math.random() * 100);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-clientperf-"));
  const chrome = spawn(
    "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  try {
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).ok) break;
      } catch (_) {}
      await sleep(100);
    }
    const page = await (
      await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, {
        method: "PUT",
      })
    ).json();
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (message) => {
      const event = JSON.parse(message.data);
      if (event.id && pending.has(event.id)) {
        const entry = pending.get(event.id);
        pending.delete(event.id);
        event.error
          ? entry.reject(new Error(JSON.stringify(event.error)))
          : entry.resolve(event.result);
      }
    };
    await new Promise((resolve) => (ws.onopen = resolve));
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, { resolve, reject });
        ws.send(JSON.stringify({ id: requestId, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
      });
      return result.result.value;
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Performance.enable");
    if (MOBILE) {
      await send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        mobile: true,
      });
      await send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 5,
      });
    } else {
      await send("Emulation.setDeviceMetricsOverride", {
        width: 1200,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
    }
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source:
        "try { localStorage.setItem('ocaml-omcb.player-colour','white'); localStorage.setItem('ocaml-omcb.seen-intro','1'); } catch (_) {}",
    });

    const navigationStarted = performance.now();
    await send("Page.navigate", { url: URL });
    let loaded = false;
    let boards = 0;
    for (let i = 0; i < 300; i++) {
      boards = Number(await evaluate("document.body?.dataset.loadedBoards || 0"));
      if (boards > 0) {
        loaded = true;
        break;
      }
      await sleep(25);
    }
    const boardsLoadedAt = performance.now() - navigationStarted;
    const readyState = await evaluate("document.readyState");
    const timing = JSON.parse(
      await evaluate(`JSON.stringify((() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource').map((entry) => ({
          name: entry.name,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
          duration: entry.duration,
          initiatorType: entry.initiatorType,
        }));
        return {
          navigation: nav ? {
            duration: nav.duration,
            domContentLoaded: nav.domContentLoadedEventEnd,
            load: nav.loadEventEnd,
            responseEnd: nav.responseEnd,
            transferSize: nav.transferSize,
          } : null,
          resources,
          memory: performance.memory ? {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          } : null,
          canvas: (() => {
            const c = document.getElementById('game');
            return c ? { width: c.width, height: c.height } : null;
          })(),
        };
      })())`)
    );
    const perfMetrics = await send("Performance.getMetrics");
    const metricMap = Object.fromEntries(
      perfMetrics.metrics.map((metric) => [metric.name, metric.value])
    );

    const frameRate = async (durationMs, action) => {
      await evaluate(`window.__frames = 0; window.__raf = requestAnimationFrame(function tick(){ window.__frames++; window.__raf = requestAnimationFrame(tick); });`);
      const started = performance.now();
      if (action) await action();
      while (performance.now() - started < durationMs) await sleep(20);
      await evaluate("cancelAnimationFrame(window.__raf)");
      const frames = Number(await evaluate("window.__frames"));
      return {
        frames,
        seconds: (performance.now() - started) / 1000,
        fps: frames / ((performance.now() - started) / 1000),
      };
    };

    const idle = await frameRate(1500);
    const rect = JSON.parse(
      await evaluate("JSON.stringify(document.getElementById('game').getBoundingClientRect())")
    );
    const pan = await frameRate(1500, async () => {
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: cx,
        y: cy,
        button: "left",
        buttons: 1,
        clickCount: 1,
      });
      for (let step = 0; step < 15; step++) {
        await send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: cx - step * 8,
          y: cy - step * 3,
          button: "left",
          buttons: 1,
        });
        await sleep(20);
      }
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: cx - 120,
        y: cy - 45,
        button: "left",
        buttons: 0,
        clickCount: 1,
      });
    });
    const zoom = await frameRate(1500, async () => {
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      for (let step = 0; step < 6; step++) {
        await send("Input.dispatchMouseEvent", {
          type: "mouseWheel",
          x: cx,
          y: cy,
          deltaX: 0,
          deltaY: step % 2 === 0 ? -120 : 120,
        });
        await sleep(40);
      }
    });

    const heap = await send("Runtime.getHeapUsage");
    const result = {
      label: LABEL,
      generated: new Date().toISOString(),
      url: URL,
      mobile: MOBILE,
      loaded,
      boards,
      boards_loaded_ms: boardsLoadedAt,
      ready_state: readyState,
      timing,
      perf_metrics: {
        JSHeapUsedSize: metricMap.JSHeapUsedSize,
        JSHeapTotalSize: metricMap.JSHeapTotalSize,
        Nodes: metricMap.Nodes,
        LayoutCount: metricMap.LayoutCount,
        RecalcStyleCount: metricMap.RecalcStyleCount,
        TaskDuration: metricMap.TaskDuration,
        ScriptDuration: metricMap.ScriptDuration,
      },
      heap,
      frame_rate: { idle, pan, zoom },
    };
    fs.writeFileSync(
      path.join(__dirname, `${OUTPUT}_results.json`),
      JSON.stringify(result, null, 2) + "\n"
    );
    console.log(
      `${LABEL}: loaded ${loaded} (${boards} boards) in ${boardsLoadedAt.toFixed(0)} ms; ` +
        `idle ${idle.fps.toFixed(1)} fps, pan ${pan.fps.toFixed(1)} fps, zoom ${zoom.fps.toFixed(1)} fps; ` +
        `heap ${(heap.usedSize / 1024 / 1024).toFixed(1)} MiB`
    );
    await send("Browser.close").catch(() => {});
    ws.close();
  } finally {
    chrome.kill("SIGTERM");
    await sleep(300);
    chrome.kill("SIGKILL");
    fs.rmSync(profile, { recursive: true, force: true });
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
