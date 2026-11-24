#!/usr/bin/env node
/*
 * Render the adaptive-commit transition experiment as a standalone HTML report
 * plus a Markdown summary. Reads bench/adaptive_commit_results.json.
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const input = path.join(ROOT, "adaptive_commit_results.json");
if (!fs.existsSync(input)) {
  console.error("Missing adaptive_commit_results.json; run adaptive_commit_test.js first.");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const modes = data.modes;
const reps = data.reps || 1;

function median(values) {
  const sorted = values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
function mostCommon(values) {
  const counts = new Map();
  for (const value of values) {
    if (value === null || value === undefined) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  let best = null;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

const firstAdaptive = data.runs.find((entry) => entry.mode === "adaptive");
const phaseNames = firstAdaptive
  ? firstAdaptive.phases.map((phase) => phase.name)
  : [];

function buildAggregates() {
  return modes.map((mode) => {
    const modeRuns = data.runs.filter((entry) => entry.mode === mode);
    const phases = phaseNames
      .map((name) => {
        const entries = modeRuns
          .map((entry) => entry.phases.find((phase) => phase.name === name))
          .filter(Boolean);
        if (entries.length === 0) return null;
        const out = { name, runs: entries.length };
        for (const field of [
          "moves",
          "duration_ms",
          "move_p50_ms",
          "move_p95_ms",
          "move_p99_ms",
          "moves_per_second",
          "average_group_size",
          "syncs",
          "fsync_p95_us",
          "event_lag_p95_ms",
          "client_event_lag_p50_ms",
          "client_event_lag_p95_ms",
          "adaptive_batch_start",
          "adaptive_batch_end",
          "adaptive_delay_start",
          "adaptive_delay_end",
        ]) {
          out[field] = median(entries.map((entry) => entry[field]));
        }
        out.classification_end = mostCommon(
          entries.map((entry) => entry.classification_end)
        );
        return out;
      })
      .filter(Boolean);
    const correctnessRuns = modeRuns.map((entry) => entry.correctness);
    const sum = (field) =>
      correctnessRuns.reduce(
        (total, entry) => total + (Number(entry[field]) || 0),
        0
      );
    return {
      mode,
      runs: modeRuns.length,
      phases,
      ok: modeRuns.length > 0 && modeRuns.every((entry) => entry.ok),
      correctness: {
        accepted: sum("accepted"),
        errors: sum("errors"),
        missing: sum("missing"),
        duplicates: sum("duplicates"),
        unexpected: sum("unexpected"),
        outbox_dropped: sum("outbox_dropped"),
        send_failures: sum("send_failures"),
        full_outbox_unregisters: sum("full_outbox_unregisters"),
        hot_moves: sum("hot_moves"),
        retained_snapshots: sum("retained_snapshots"),
        snapshot_samples: sum("snapshot_samples"),
        last_snapshot_sequence: mostCommon(
          correctnessRuns.map((entry) => entry.last_snapshot_sequence)
        ),
        fanout_clients: correctnessRuns[0]
          ? correctnessRuns[0].fanout_clients
          : 0,
        event_lag_p50_ms: median(
          correctnessRuns.map((entry) => entry.event_lag_p50_ms)
        ),
        event_lag_p95_ms: median(
          correctnessRuns.map((entry) => entry.event_lag_p95_ms)
        ),
      },
    };
  });
}

const aggregates = buildAggregates();
const adaptive = aggregates.find((entry) => entry.mode === "adaptive");
const colors = ["#e06c75", "#61afef", "#98c379", "#e5c07b", "#c678dd"];

function run(mode) {
  return aggregates.find((entry) => entry.mode === mode);
}
function representative(mode) {
  const modeRuns = data.runs.filter((entry) => entry.mode === mode);
  if (modeRuns.length === 0) return null;
  const sorted = [...modeRuns].sort(
    (a, b) => a.correctness.accepted - b.correctness.accepted
  );
  return sorted[Math.floor(sorted.length / 2)];
}
function phase(mode, name) {
  const entry = run(mode);
  return entry ? entry.phases.find((value) => value.name === name) : null;
}
function series(field) {
  return modes.map((mode) => ({
    name: mode,
    values: phaseNames.map((name) => {
      const value = phase(mode, name);
      return value && value[field] !== undefined && value[field] !== null
        ? value[field]
        : null;
    }),
  }));
}

const categoricalCharts = [
  {
    id: "move-p50",
    title: "Move p50 by phase",
    yLabel: "milliseconds",
    labels: phaseNames,
    series: series("move_p50_ms"),
  },
  {
    id: "move-p95",
    title: "Move p95 by phase",
    yLabel: "milliseconds",
    labels: phaseNames,
    series: series("move_p95_ms"),
  },
  {
    id: "throughput",
    title: "Writer move throughput by phase",
    yLabel: "moves / second",
    labels: phaseNames,
    series: series("moves_per_second"),
  },
  {
    id: "group-size",
    title: "Average actual group size by phase",
    yLabel: "moves / fsync",
    labels: phaseNames,
    series: series("average_group_size"),
  },
  {
    id: "client-lag",
    title: "Client-observed event lag p50 by phase",
    yLabel: "milliseconds",
    labels: phaseNames,
    series: series("client_event_lag_p50_ms"),
  },
];

function timelineSeries(field, scale = 1) {
  return modes.map((mode) => {
    const entry = representative(mode);
    const points = entry
      ? entry.samples
          .filter((sample) => sample[field] !== null && sample[field] !== undefined)
          .map((sample) => [sample.t / 1000, sample[field] / scale])
      : [];
    return { name: mode, points };
  });
}

const maxTime = Math.max(
  1,
  ...modes.flatMap((mode) => {
    const entry = representative(mode);
    return entry && entry.samples.length
      ? [entry.samples[entry.samples.length - 1].t / 1000]
      : [];
  })
);

const timelineCharts = [
  {
    id: "policy-batch",
    title: "Adaptive batch policy over the phase transitions",
    yLabel: "max moves / commit",
    phases: adaptive ? adaptive.phases : [],
    maxTime,
    series: [
      {
        name: "adaptive",
        points: representative("adaptive")
          ? representative("adaptive").samples
              .filter((sample) => sample.adaptive)
              .map((sample) => [sample.t / 1000, sample.adaptive.max_batch_size])
          : [],
      },
      {
        name: "fixed-16",
        points: [
          [0, 16],
          [maxTime, 16],
        ],
      },
      {
        name: "fixed-64",
        points: [
          [0, 64],
          [maxTime, 64],
        ],
      },
    ],
  },
  {
    id: "policy-delay",
    title: "Adaptive group-formation delay",
    yLabel: "microseconds",
    phases: adaptive ? adaptive.phases : [],
    maxTime,
    series: [
      {
        name: "adaptive",
        points: representative("adaptive")
          ? representative("adaptive").samples
              .filter((sample) => sample.adaptive)
              .map((sample) => [sample.t / 1000, sample.adaptive.max_batch_delay_us])
          : [],
      },
      {
        name: "fixed (0)",
        points: [
          [0, 0],
          [maxTime, 0],
        ],
      },
    ],
  },
  {
    id: "fsync-p95",
    title: "Recent WAL fsync p95",
    yLabel: "milliseconds",
    phases: adaptive ? adaptive.phases : [],
    maxTime,
    series: timelineSeries("fsync_p95_us", 1000),
  },
  {
    id: "server-lag",
    title: "Server end-to-end broadcast p95",
    yLabel: "milliseconds",
    phases: adaptive ? adaptive.phases : [],
    maxTime,
    series: timelineSeries("event_lag_p95_ms"),
  },
  {
    id: "queue-depth",
    title: "Worker move queue depth",
    yLabel: "queued moves",
    phases: adaptive ? adaptive.phases : [],
    maxTime,
    series: timelineSeries("move_queue_depth"),
  },
];

function tableRows() {
  const rows = [];
  for (const phaseName of phaseNames) {
    for (const mode of modes) {
      const value = phase(mode, phaseName);
      if (!value) continue;
      rows.push(
        `<tr><td>${phaseName}</td><td>${mode}</td><td>${value.moves}</td>` +
          `<td>${value.move_p50_ms.toFixed(1)} ms</td>` +
          `<td>${value.move_p95_ms.toFixed(1)} ms</td>` +
          `<td>${value.moves_per_second.toFixed(0)}</td>` +
          `<td>${value.average_group_size === null ? "-" : value.average_group_size.toFixed(1)}</td>` +
          `<td>${value.adaptive_batch_start === null ? "-" : Math.round(value.adaptive_batch_start)}</td>` +
          `<td>${value.adaptive_batch_end === null ? "-" : Math.round(value.adaptive_batch_end)}</td>` +
          `<td>${value.client_event_lag_p50_ms === null ? "-" : value.client_event_lag_p50_ms.toFixed(1) + " ms"}</td></tr>`
      );
    }
  }
  return rows.join("\n");
}

const correctnessRows = aggregates
  .map((entry) => {
    const c = entry.correctness;
    return (
      `<tr><td>${entry.mode}</td><td>${c.accepted}</td>` +
      `<td>${c.errors}</td><td>${c.missing}</td><td>${c.duplicates}</td>` +
      `<td>${c.unexpected}</td><td>${c.outbox_dropped}</td>` +
      `<td>${c.event_lag_p50_ms.toFixed(1)} ms</td>` +
      `<td>${c.event_lag_p95_ms.toFixed(1)} ms</td>` +
      `<td>${c.last_snapshot_sequence ?? "-"}</td>` +
      `<td>${c.snapshot_samples}</td>` +
      `<td>${entry.ok ? "pass" : "FAIL"}</td></tr>`
    );
  })
  .join("\n");

function chartScript() {
  return `
const CATEGORICAL = ${JSON.stringify(categoricalCharts, null, 2)};
const TIMELINE = ${JSON.stringify(timelineCharts, null, 2)};
const COLORS = ${JSON.stringify(colors)};

function frame(canvas, title, yLabel) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const pad = { left: 70, right: 25, top: 50, bottom: 55 };
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#1e222a"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#e6e9ef"; ctx.font = "bold 16px sans-serif";
  ctx.fillText(title, pad.left, 24);
  ctx.fillStyle = "#aab2c0"; ctx.font = "12px sans-serif";
  ctx.fillText(yLabel, pad.left, 42);
  return { ctx, W, H, pad, plotW: W - pad.left - pad.right, plotH: H - pad.top - pad.bottom };
}

function yGrid(ctx, W, pad, plotH, yMax) {
  ctx.strokeStyle = "#3a4050"; ctx.lineWidth = 1; ctx.fillStyle = "#aab2c0";
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + (i * plotH) / 5;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    const value = yMax * (1 - i / 5);
    ctx.fillText(value >= 100 ? value.toFixed(0) : value.toFixed(1), 8, y + 4);
  }
}

function drawCategorical(canvas, cfg) {
  const { ctx, W, H, pad, plotW, plotH } = frame(canvas, cfg.title, cfg.yLabel);
  const values = cfg.series.flatMap((s) => s.values).filter((v) => v !== null);
  const yMax = Math.max(1, ...values) * 1.12;
  yGrid(ctx, W, pad, plotH, yMax);
  const n = cfg.labels.length;
  const xAt = (i) => pad.left + (i * plotW) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = "#c9d1d9";
    ctx.fillText(cfg.labels[i], xAt(i) - 20, H - 25);
  }
  cfg.series.forEach((s, index) => {
    const color = COLORS[index % COLORS.length];
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.2;
    ctx.beginPath(); let started = false;
    s.values.forEach((v, i) => {
      if (v === null) { started = false; return; }
      const x = xAt(i), y = pad.top + plotH - (v / yMax) * plotH;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    s.values.forEach((v, i) => {
      if (v === null) return;
      ctx.beginPath(); ctx.arc(xAt(i), pad.top + plotH - (v / yMax) * plotH, 4, 0, Math.PI * 2); ctx.fill();
    });
    const lx = pad.left + index * 130;
    ctx.fillRect(lx, H - 10, 12, 3);
    ctx.fillStyle = "#c9d1d9"; ctx.fillText(s.name, lx + 18, H - 5);
  });
}

function drawTimeline(canvas, cfg) {
  const { ctx, W, H, pad, plotW, plotH } = frame(canvas, cfg.title, cfg.yLabel);
  const values = cfg.series.flatMap((s) => s.points.map((p) => p[1]));
  const yMax = Math.max(1, ...values) * 1.12;
  yGrid(ctx, W, pad, plotH, yMax);
  const xAt = (t) => pad.left + (t / cfg.maxTime) * plotW;
  const phases = cfg.phases || [];
  phases.forEach((phase, index) => {
    const x0 = xAt(phase.start_t / 1000), x1 = xAt(phase.end_t / 1000);
    ctx.fillStyle = index % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.10)";
    ctx.fillRect(x0, pad.top, x1 - x0, plotH);
    ctx.strokeStyle = "#4a5365"; ctx.beginPath(); ctx.moveTo(x0, pad.top); ctx.lineTo(x0, pad.top + plotH); ctx.stroke();
    ctx.fillStyle = "#8892a4"; ctx.font = "11px sans-serif";
    ctx.fillText(phase.name, x0 + 4, pad.top - 8);
  });
  ctx.fillStyle = "#aab2c0";
  for (let i = 0; i <= 5; i++) {
    const t = (cfg.maxTime * i) / 5;
    ctx.fillText(t.toFixed(1) + "s", xAt(t) - 10, H - 25);
  }
  cfg.series.forEach((s, index) => {
    const color = COLORS[index % COLORS.length];
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); let started = false;
    s.points.forEach(([t, v]) => {
      if (v === null) { started = false; return; }
      const x = xAt(t), y = pad.top + plotH - (v / yMax) * plotH;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    s.points.forEach(([t, v]) => {
      if (v === null) return;
      ctx.beginPath(); ctx.arc(xAt(t), pad.top + plotH - (v / yMax) * plotH, 2.5, 0, Math.PI * 2); ctx.fill();
    });
    const lx = pad.left + index * 130;
    ctx.fillRect(lx, H - 10, 12, 3);
    ctx.fillStyle = "#c9d1d9"; ctx.fillText(s.name, lx + 18, H - 5);
  });
}

for (const cfg of CATEGORICAL) {
  const canvas = document.getElementById(cfg.id); if (canvas) drawCategorical(canvas, cfg);
}
for (const cfg of TIMELINE) {
  const canvas = document.getElementById(cfg.id); if (canvas) drawTimeline(canvas, cfg);
}
`;
}

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>sim-map adaptive commit</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 28px; background: #14171c; color: #e6e9ef; font: 15px/1.5 system-ui, sans-serif; }
  h1 { font-size: 26px; margin: 0 0 4px; } h2 { font-size: 19px; margin: 28px 0 8px; }
  .sub { color: #aab2c0; margin-bottom: 20px; }
  .cards { display: flex; flex-wrap: wrap; gap: 14px; margin: 18px 0; }
  .card { background: #1e222a; border: 1px solid #303746; border-radius: 10px; padding: 14px 18px; min-width: 195px; }
  .card b { display: block; font-size: 24px; color: #fff; } .card span { color: #aab2c0; font-size: 13px; }
  .chart { background: #1e222a; border: 1px solid #303746; border-radius: 10px; padding: 10px; margin: 14px 0; }
  canvas { width: 100%; height: auto; display: block; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
  th, td { padding: 7px 8px; border-bottom: 1px solid #303746; text-align: right; }
  th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) { text-align: left; }
  th { color: #aab2c0; font-weight: 600; } .ok { color: #98c379; } .bad { color: #e06c75; }
  .note { color: #aab2c0; max-width: 1050px; }
</style></head><body>
<h1>sim-map: adaptive group-commit transition experiment</h1>
<div class="sub">${modes.length} modes × ${reps} repetitions · ${data.generated} · phases: ${phaseNames.join(" → ")}</div>
<div class="cards">
  <div class="card"><b>${adaptive?.correctness.event_lag_p50_ms.toFixed(1) ?? "-"} ms</b><span>adaptive client event lag p50 (fan-out phases)</span></div>
  <div class="card"><b>${adaptive?.correctness.missing ?? "-"}</b><span>adaptive missing events</span></div>
  <div class="card"><b>${adaptive?.correctness.duplicates ?? "-"}</b><span>adaptive duplicate events</span></div>
  <div class="card"><b class="${aggregates.every((entry) => entry.ok) ? "ok" : "bad"}">${aggregates.filter((entry) => entry.ok).length}/${aggregates.length}</b><span>modes passing every client check</span></div>
</div>
<div class="note">
The controller is fed 100 ms samples of move rate, pending moves, recent fsync p50/p95,
outbox backlog, event lag p95 and snapshot activity. It never touches validation,
ordering or durability: each group is still fsynced before responses/events are
published. Quiet phases should drive it toward small batches with no delay; heavy
writes raise the batch; high fan-out and snapshot activity hold it down.
Categorical values are medians across repetitions; the timelines show the run
whose move count is closest to the median for that mode.
</div>
${timelineCharts.map((chart) => `<div class="chart"><canvas id="${chart.id}" width="1000" height="360"></canvas></div>`).join("\n")}
${categoricalCharts.map((chart) => `<div class="chart"><canvas id="${chart.id}" width="1000" height="360"></canvas></div>`).join("\n")}
<h2>Phase details</h2>
<table><tr><th>Phase</th><th>Mode</th><th>Moves</th><th>p50</th><th>p95</th><th>Moves/s</th><th>Avg group</th><th>Batch start</th><th>Batch end</th><th>Client lag p50</th></tr>
${tableRows()}
</table>
<h2>Correctness</h2>
<table><tr><th>Mode</th><th>Moves</th><th>Errors</th><th>Missing</th><th>Duplicate</th><th>Unexpected</th><th>Drops</th><th>Client lag p50</th><th>Client lag p95</th><th>Last snapshot seq</th><th>Snapshot samples</th><th>Result</th></tr>
${correctnessRows}
</table>
<script>${chartScript()}</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, "adaptive_commit_report.html"), html);

const lines = [];
lines.push("# Adaptive group-commit transition experiment\n");
lines.push(`Generated: ${data.generated}\n`);
lines.push(`Modes: ${modes.join(", ")} (${reps} repetitions each).\n`);
lines.push("## Adaptive policy by phase\n");
lines.push("| Phase | Batch start | Batch end | Delay end (µs) | Classification | Avg group | Syncs |");
lines.push("|---|---:|---:|---:|---|---:|---:|");
for (const phaseName of phaseNames) {
  const p = phase("adaptive", phaseName);
  if (!p) continue;
  lines.push(
    `| ${phaseName} | ${p.adaptive_batch_start ?? "-"} | ${p.adaptive_batch_end ?? "-"} | ` +
      `${p.adaptive_delay_end ?? "-"} | ${p.classification_end ?? "-"} | ` +
      `${p.average_group_size === null ? "-" : p.average_group_size.toFixed(1)} | ${p.syncs ?? "-"} |`
  );
}
lines.push("\n## Move p50 by phase (ms)\n");
lines.push(`| Phase | ${modes.join(" | ")} |`);
lines.push(`|---|${modes.map(() => "---:").join("|")}|`);
for (const phaseName of phaseNames) {
  lines.push(
    `| ${phaseName} | ${modes
      .map((mode) => {
        const p = phase(mode, phaseName);
        return p ? p.move_p50_ms.toFixed(1) : "-";
      })
      .join(" | ")} |`
  );
}
lines.push("\n## Correctness\n");
lines.push("| Mode | Runs | Moves | Errors | Missing | Duplicates | Unexpected | Drops | Event lag p50 | Event lag p95 | Last snapshot seq | Snapshot samples | Result |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|");
for (const entry of aggregates) {
  const c = entry.correctness;
  lines.push(
    `| ${entry.mode} | ${entry.runs} | ${c.accepted} | ${c.errors} | ${c.missing} | ${c.duplicates} | ` +
      `${c.unexpected} | ${c.outbox_dropped} | ${c.event_lag_p50_ms.toFixed(1)} ms | ` +
      `${c.event_lag_p95_ms.toFixed(1)} ms | ${c.last_snapshot_sequence ?? "-"} | ` +
      `${c.snapshot_samples} | ${entry.ok ? "pass" : "FAIL"} |`
  );
}
fs.writeFileSync(path.join(ROOT, "adaptive_commit_results.md"), lines.join("\n") + "\n");
console.log("Wrote bench/adaptive_commit_report.html and bench/adaptive_commit_results.md");
