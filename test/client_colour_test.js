#!/usr/bin/env node
/*
 * Per-device colour identity test.
 *
 * A browser is assigned white or black once and must keep that colour across
 * reloads. The assignment lives in localStorage and is mirrored to a
 * long-lived cookie, so clearing either store alone does not change it.
 *
 * Requires the game server at http://localhost:8080 (override with
 * OCAML_OMCB_TEST_URL) and chromium on PATH. It spawns its own headless browser.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CDP_PORT = 9400 + Math.floor(Math.random() * 400);
const SERVER = process.env.OCAML_OMCB_TEST_URL || process.env.SIM_MAP_TEST_URL || "http://localhost:8080/";
const STORAGE_KEY = "ocaml-omcb.player-colour";
const COOKIE_NAME = "ocaml-omcb-colour";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

setTimeout(() => {
  console.error("FAIL: colour identity test exceeded its overall deadline");
  process.exit(1);
}, 120_000);

async function waitForEndpoint(url, retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (_) {}
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${url}`);
}

function parseCookie(cookie, name) {
  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return null;
}

async function main() {
  try {
    const check = await fetch(SERVER, { signal: AbortSignal.timeout(3000) });
    if (!check.ok) throw new Error(`server returned ${check.status}`);
  } catch (error) {
    console.error(`Server is not available at ${SERVER}. Start it first.`);
    throw error;
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omc-colour-test-"));
  const chrome = spawn(
    "chromium",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1000,800",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let ws;
  try {
    await waitForEndpoint(`http://127.0.0.1:${CDP_PORT}/json/version`);
    const targets = await (
      await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
    ).json();
    const page = targets.find((target) => target.type === "page");
    if (!page) throw new Error("no page target");

    ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
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
        console.error(
          "browser exception:",
          JSON.stringify(event.params.exceptionDetails)
        );
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
        awaitPromise: true,
      });
      if (result.exceptionDetails) {
        throw new Error(JSON.stringify(result.exceptionDetails));
      }
      return result.result.value;
    };
    const waitFor = async (condition, message, timeout = 6000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await condition()) return;
        await sleep(50);
      }
      fail(message);
    };

    const load = async () => {
      await send("Page.navigate", { url: `${SERVER}?x=0&y=0` });
      await waitFor(
        async () =>
          (await evaluate("document.body.dataset.colour || ''")) !== "",
        "the client did not assign a colour"
      );
    };
    const read = async () =>
      JSON.parse(
        await evaluate(`JSON.stringify({
          body: document.body.dataset.colour,
          pill: document.getElementById('colour').dataset.colour,
          text: document.getElementById('colour').textContent.trim().toLowerCase(),
          stored: localStorage.getItem(${JSON.stringify(STORAGE_KEY)}),
          cookie: document.cookie
        })`)
      );
    const assertIdentity = async (label) => {
      const value = await read();
      if (value.body !== "white" && value.body !== "black") {
        fail(`${label}: invalid colour ${JSON.stringify(value.body)}`);
      }
      if (value.pill !== value.body || value.text !== value.body) {
        fail(`${label}: badge does not match body colour (${JSON.stringify(value)})`);
      }
      if (value.stored !== value.body) {
        fail(`${label}: localStorage does not match body colour (${JSON.stringify(value)})`);
      }
      const cookie = parseCookie(value.cookie, COOKIE_NAME);
      if (cookie !== value.body) {
        fail(`${label}: cookie does not match body colour (${JSON.stringify(value)})`);
      }
      return value.body;
    };

    await send("Page.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "try { localStorage.setItem('ocaml-omcb.seen-intro', '1'); } catch (_) {}" });
    await send("Runtime.enable");

    // Start from a clean device so the first assertion covers assignment.
    await load();
    await evaluate(
      `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)});` +
        `document.cookie='${COOKIE_NAME}=; Max-Age=0; Path=/'; 'ok'`
    );
    await load();
    const assigned = await assertIdentity("initial assignment");

    await load();
    if ((await assertIdentity("reload")) !== assigned) {
      fail("colour changed on reload");
    }

    await evaluate(
      `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)}); 'ok'`
    );
    await load();
    if ((await assertIdentity("localStorage cleared")) !== assigned) {
      fail("colour changed after clearing localStorage; cookie fallback failed");
    }

    await evaluate(
      `document.cookie='${COOKIE_NAME}=; Max-Age=0; Path=/'; 'ok'`
    );
    await load();
    if ((await assertIdentity("cookie cleared")) !== assigned) {
      fail("colour changed after clearing the cookie; localStorage fallback failed");
    }

    await evaluate(
      `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)});` +
        `document.cookie='${COOKIE_NAME}=; Max-Age=0; Path=/'; 'ok'`
    );
    await load();
    const reassigned = await assertIdentity("reassignment");
    await load();
    if ((await assertIdentity("reassignment reload")) !== reassigned) {
      fail("newly assigned colour did not persist");
    }

    if (exceptions !== 0) fail(`browser raised ${exceptions} exception(s)`);
    console.log(
      `Colour identity test passed: assigned ${assigned}, stable across ` +
        `reloads and single-store clears, reassigned ${reassigned} after both ` +
        `were cleared.`
    );
    await send("Browser.close");
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
