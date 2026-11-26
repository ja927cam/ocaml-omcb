#!/usr/bin/env node
/* First-impression and interaction test for the client UI. */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SERVER = process.env.OCAML_OMCB_TEST_URL || process.env.SIM_MAP_TEST_URL || "http://localhost:8080/";
const CDP_PORT = 9400 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

setTimeout(() => {
  console.error("FAIL: client UI test exceeded its deadline");
  process.exit(1);
}, 180_000);

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-ui-test-"));
  const chrome = spawn(
    "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1440,900",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  let ws;
  try {
    const deadline = Date.now() + 20_000;
    while (true) {
      try {
        if ((await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok) break;
      } catch (_) {}
      if (Date.now() > deadline) throw new Error("Chromium did not start");
      await sleep(150);
    }
    const targets = await (
      await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
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
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async (condition, message, timeout = 8000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await condition()) return;
        await sleep(100);
      }
      fail(message);
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url: `${SERVER}?x=500&y=500` });
    await waitFor(
      async () => Number(await evaluate("document.body.dataset.loadedBoards || 0")) > 0,
      "boards did not load"
    );

    const introVisible = await evaluate(
      "!document.getElementById('intro').hidden"
    );
    if (!introVisible) fail("first-visit introduction was not shown");
    const introTitle = await evaluate(
      "document.getElementById('intro-title').textContent.toLowerCase()"
    );
    if (!introTitle.includes("one million") || !introTitle.includes("chess")) {
      fail(`intro title was unexpected: ${introTitle}`);
    }

    await evaluate("document.getElementById('intro-close').click()");
    await sleep(300);
    if (await evaluate("!document.getElementById('intro').hidden")) {
      fail("introduction did not close");
    }
    if ((await evaluate("localStorage.getItem('ocaml-omcb.seen-intro')")) !== "1") {
      fail("introduction dismissal was not remembered");
    }

    await evaluate("document.getElementById('help-toggle').click()");
    await sleep(200);
    if (await evaluate("document.getElementById('intro').hidden")) {
      fail("help did not reopen the introduction");
    }
    await evaluate("document.getElementById('intro-close').click()");

    const zoomBefore = Number(await evaluate("document.body.dataset.zoom"));
    await evaluate("document.getElementById('zoom-in').click()");
    await sleep(250);
    const zoomAfter = Number(await evaluate("document.body.dataset.zoom"));
    if (!(zoomAfter > zoomBefore + 0.02)) {
      fail(`zoom-in did not change zoom: ${zoomBefore} -> ${zoomAfter}`);
    }
    await evaluate("document.getElementById('zoom-reset').click()");
    await sleep(300);
    const zoomReset = Number(await evaluate("document.body.dataset.zoom"));
    if (Math.abs(zoomReset - 1) > 0.02) fail(`zoom reset was ${zoomReset}`);

    // The minimap is a locator: clicking another region recentres the camera.
    const coordsBefore = await evaluate("document.getElementById('coords').textContent");
    const minimapRect = await evaluate(
      "JSON.stringify(document.getElementById('minimap').getBoundingClientRect())"
    ).then(JSON.parse);
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: minimapRect.x + minimapRect.width * 0.25,
      y: minimapRect.y + minimapRect.height * 0.25,
      button: "left",
      clickCount: 1,
      buttons: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: minimapRect.x + minimapRect.width * 0.25,
      y: minimapRect.y + minimapRect.height * 0.25,
      button: "left",
      clickCount: 1,
      buttons: 0,
    });
    await sleep(700);
    const coordsAfter = await evaluate("document.getElementById('coords').textContent");
    if (coordsBefore === coordsAfter) {
      fail(`minimap click did not move the camera (${coordsBefore})`);
    }

    // Pinch zoom on a phone-sized viewport.
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(400);
    const mobileLayout = JSON.parse(
      await evaluate(`JSON.stringify({
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        minimap: getComputedStyle(document.getElementById('minimap-wrap')).display,
        brandRight: document.getElementById('brand').getBoundingClientRect().right,
        width: window.innerWidth
      })`)
    );
    if (mobileLayout.overflow) fail("mobile layout has horizontal overflow");
    if (mobileLayout.minimap !== "none") fail("minimap should be hidden on mobile");
    if (mobileLayout.brandRight > mobileLayout.width + 1) fail("brand overflows on mobile");

    // Tall/narrow desktop windows used to run the full hint into the status
    // pill. It should be hidden as soon as there is not enough room.
    await send("Emulation.setDeviceMetricsOverride", {
      width: 900,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(350);
    const verticalLayout = JSON.parse(
      await evaluate(`JSON.stringify({
        hint: getComputedStyle(document.getElementById('hint')).display,
        statusRight: document.getElementById('status').getBoundingClientRect().right,
        zoomLeft: document.getElementById('zoom-controls').getBoundingClientRect().left,
        width: window.innerWidth
      })`)
    );
    if (verticalLayout.hint !== "none") fail("hint should be hidden in a narrow vertical window");
    if (verticalLayout.statusRight > verticalLayout.zoomLeft) {
      fail("status and zoom controls overlap in a vertical window");
    }

    await send("Emulation.setDeviceMetricsOverride", {
      width: 320,
      height: 700,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(300);
    const narrow = JSON.parse(
      await evaluate(`JSON.stringify({
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        brandRight: document.getElementById('brand').getBoundingClientRect().right,
        zoomRight: document.getElementById('zoom-controls').getBoundingClientRect().right,
        width: window.innerWidth
      })`)
    );
    if (narrow.overflow) fail("320px layout has horizontal overflow");
    if (narrow.brandRight > narrow.width + 1) fail("brand overflows at 320px");
    if (narrow.zoomRight > narrow.width + 1) fail("zoom controls overflow at 320px");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(250);

    const pinchBefore = Number(await evaluate("document.body.dataset.zoom"));
    const touch = (type, points) =>
      send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map((point, index) => ({
          x: point[0],
          y: point[1],
          id: index,
        })),
      });
    await touch("touchStart", [[120, 420], [270, 420]]);
    await sleep(50);
    await touch("touchMove", [[70, 420], [320, 420]]);
    await sleep(250);
    const pinchAfter = Number(await evaluate("document.body.dataset.zoom"));
    await touch("touchEnd", []);
    if (!(pinchAfter > pinchBefore + 0.02)) {
      fail(`pinch did not zoom: ${pinchBefore} -> ${pinchAfter}`);
    }

    await send("Page.navigate", { url: `${SERVER}status` });
    await sleep(600);
    const statusTitle = await evaluate("document.title");
    if (!statusTitle.includes("Status")) fail(`status page title was ${statusTitle}`);
    const statusLive = await evaluate("document.getElementById('status-text').textContent");
    if (statusLive !== "Live") fail(`status page showed ${statusLive}`);

    if (exceptions !== 0) fail(`browser raised ${exceptions} exception(s)`);
    console.log(
      `Client UI test passed: intro, help, zoom ${zoomBefore.toFixed(2)}→${zoomAfter.toFixed(2)}, ` +
      `minimap recentre ${coordsBefore}→${coordsAfter}, mobile layout, pinch, status page.`
    );
    await send("Browser.close").catch(() => {});
  } finally {
    if (ws) try { ws.close(); } catch (_) {}
    chrome.kill("SIGTERM");
    await sleep(250);
    chrome.kill("SIGKILL");
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
