#!/usr/bin/env node
/*
 * Post-exit resource measurement for bench/load_test.js.
 *
 * The game server intentionally does not schedule Dream's WebSocket close
 * frame, so client sockets are released when the client process exits rather
 * than when it calls WebSocket.close(). load_test.js spawns this helper
 * detached so it can measure the server after the load process has gone away.
 *
 * Usage: node bench/load_after.js <server-pid> <results.json>
 */

const fs = require("fs");

const pid = Number(process.argv[2]);
const jsonPath = process.argv[3];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readRssKb(pid) {
  const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
  const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
  return match ? Number(match[1]) : 0;
}

function readCpuTicks(pid) {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8").trim();
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return Number(fields[11]) + Number(fields[12]);
}

function readFds(pid) {
  return fs.readdirSync(`/proc/${pid}/fd`).length;
}

async function main() {
  await sleep(2500);
  const result = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  result.resources = result.resources || {};

  try {
    const idleStart = readCpuTicks(pid);
    await sleep(1000);
    result.resources.rss_after_exit_kb = readRssKb(pid);
    result.resources.fds_after_exit = readFds(pid);
    result.resources.cpu_idle_after_exit_ticks_per_second =
      readCpuTicks(pid) - idleStart;
    result.post_exit_measured_at = new Date().toISOString();
  } catch (error) {
    result.resources.post_exit_error = String(error.message || error);
  }

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n");
  const jsPath = jsonPath.replace(/\.json$/, ".js");
  fs.writeFileSync(
    jsPath,
    "window.LOAD_RESULTS = window.LOAD_RESULTS || {};\n" +
      "window.LOAD_RESULTS[" +
      JSON.stringify(result.label || "run") +
      "] = " +
      JSON.stringify(result, null, 2) +
      ";\n"
  );

  const mdPath = jsonPath.replace(/\.json$/, ".md");
  const r = result.resources;
  const lines = [
    "",
    "## After the load process exits",
    "",
    r.post_exit_error
      ? `- Measurement failed: ${r.post_exit_error}`
      : `- fds: ${r.fds_after_exit}, RSS: ${(r.rss_after_exit_kb / 1024).toFixed(0)} MiB, idle: ${r.cpu_idle_after_exit_ticks_per_second} ticks/s`,
    "",
  ];
  fs.appendFileSync(mdPath, lines.join("\n"));
}

main().catch(() => process.exit(1));
