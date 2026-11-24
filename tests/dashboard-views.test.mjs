import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const files = await Promise.all(["data-sync.js", "dashboard-data-bridge.js", "app.js"].map(async (file) => ({
  file,
  source: await readFile(new URL(`../dist/${file}`, import.meta.url), "utf8"),
})));

const boardProjects = [
  { id: "high-priority", name: "Proyek prioritas", urgency: "Very High", status: "todo" },
  { id: "previously-urgent", name: "Proyek dari Urgent", urgency: "Medium", status: "active" },
  { id: "previously-this-week", name: "Proyek dari This Week", urgency: "High", status: "active" },
  { id: "previously-reviewed", name: "Proyek dari Review", urgency: "Medium", status: "active" },
  { id: "finished-project", name: "Proyek rampung", urgency: "Medium", status: "done" },
].map(({ status, ...project }) => ({
  ...project, owner: "Dita", end: "2026-11-29",
  tasks: [{ key: "activity", name: "Review dokumen", status }],
}));

async function renderDashboard({ now = "2026-11-23T07:00:00Z", counts, obstacles, view = "board", projects = boardProjects, hostname = "127.0.0.1" } = {}) {
  const elements = new Map();
  const storage = new Map([["team1-execution-board-stage-v1", JSON.stringify({
    "previously-urgent": "urgent",
    "previously-this-week": "this-week",
    "previously-reviewed": "review",
  })]]);
  const context = vm.createContext({
    document: {
      addEventListener() {},
      body: { classList: { toggle() {} } },
      getElementById(id) {
        if (!elements.has(id)) {
          elements.set(id, {
            classList: { add() {}, remove() {}, toggle() {} },
            dataset: {},
            style: { setProperty() {} },
            addEventListener() {},
            setAttribute() {},
            querySelector() { return {}; },
          });
        }
        return elements.get(id);
      },
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    window: { addEventListener() {}, scrollTo() {} },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
    },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    location: { search: `?view=${view}`, hash: "", hostname },
    fetch: async (url) => url === "/api/data"
      ? Response.json({ projects, revision: 1, weeklyPolicyCounts: counts, weeklyObstacles: obstacles })
      : Response.json({ authenticated: false }),
    setInterval() {},
    setTimeout() {},
    clearTimeout() {},
    structuredClone,
    URL,
    URLSearchParams,
    TEAM1_PROJECT_DATA: { projects },
  });
  for (const { file, source } of files) vm.runInContext(source, context, { filename: file });
  await new Promise(setImmediate);
  return elements;
}

async function renderBoard(options) {
  return (await renderDashboard(options)).get("boardColumns").innerHTML;
}

test("uses the three project stages and places projects from retired columns by task status", async () => {
  const board = await renderBoard({ counts: { "2026-11-16": 22, "2026-11-23": 1234 } });
  assert.match(board, /<h2[^>]*>Entry Data Polis<\/h2>[\s\S]*?17–23 Nov 2026[\s\S]*?1\.234[\s\S]*?Polis dientri/i);
  assert.match(board, /<button\b[^>]*data-edit-policy-count[^>]*aria-label="Edit jumlah polis"[^>]*>\s*<span\b[^>]*aria-hidden="true"[^>]*>edit<\/span>\s*<\/button>/);
  assert.deepEqual([...board.matchAll(/data-board-stage="([^"]+)"/g)].map((match) => match[1]), ["not-started", "in-progress", "done"]);
  const notStarted = board.match(/data-board-stage="not-started"[\s\S]*?<\/section>/)?.[0];
  const inProgress = board.match(/data-board-stage="in-progress"[\s\S]*?<\/section>/)?.[0];
  const done = board.match(/data-board-stage="done"[\s\S]*?<\/section>/)?.[0];
  assert.match(notStarted, /<h2>Not Started<\/h2>[\s\S]*?Proyek prioritas/);
  for (const retired of ["Urgent", "This Week", "Review"]) assert.match(inProgress, new RegExp(`Proyek dari ${retired}`));
  assert.match(done, /Proyek rampung/);
});

test("uses the WIB week boundary and distinguishes zero from missing counts", async () => {
  const now = "2026-11-22T17:00:00Z";
  const board = await renderBoard({ now, counts: { "2026-11-16": 22, "2026-11-23": 0 } });
  assert.match(board, /<h2[^>]*>Entry Data Polis<\/h2>[\s\S]*?>0<\/strong>[\s\S]*?Polis dientri/i);
  const example = await renderBoard({ now });
  assert.match(example, /<h2[^>]*>Entry Data Polis<\/h2>[\s\S]*?Data contoh/i);
  const missing = await renderBoard({ now: "2026-11-30T00:00:00Z", counts: { "2026-11-23": 22 } });
  assert.match(missing, /<h2[^>]*>Entry Data Polis<\/h2>[\s\S]*?Belum ada data/i);
});

test("shows an empty weekly policy metric in production until a live count is saved", async () => {
  const hostname = "projectreport-team1-smea.vercel.app";
  const board = await renderBoard({ hostname });
  assert.match(board, /<h2[^>]*>Entry Data Polis<\/h2>[\s\S]*?Belum ada data/i);
  assert.doesNotMatch(board, /Data contoh/);
  const report = await renderDashboard({ hostname, view: "report", counts: { "2026-11-23": 50 } });
  assert.match(report.get("weeklyResultSummary").innerHTML, /Total 50 Polis/);
});

test("leaves the metric out of the archive view", async () => {
  const archive = await renderBoard({ view: "archive" });
  assert.match(archive, /Arsip Project/);
  assert.doesNotMatch(archive, /Entry Data Polis/);
});

const reportProjects = [
  {
    id: "report-first", name: "Project A & Tim", owner: "Dita", start: "2026-11-01", end: "2026-12-10",
    tasks: [
      { name: "Selesai pada Selasa awal", status: "done", completedAt: "2026-11-17", dueAt: "2026-12-01" },
      { name: "Selesai pada Senin akhir", status: "done", completedAt: "2026-11-23", dueAt: "2026-11-16" },
      { name: "Selesai sebelum periode", status: "done", completedAt: "2026-11-16", dueAt: "2026-11-17" },
      { name: "Tanpa tanggal selesai", status: "done", dueAt: "2026-11-20" },
      { name: "Target pada Selasa awal", status: "active", dueAt: "2026-11-24" },
      { name: "Deadline sebelum target", status: "active", dueAt: "2026-11-23" },
      { name: "Deadline setelah target", status: "todo", dueAt: "2026-12-01" },
      ...Array.from({ length: 7 }, (_, index) => ({ name: `Subtask target ${index + 1}`, status: "todo", dueAt: "2026-11-25" })),
    ],
  },
  {
    id: "report-second", name: "Project B", owner: "Restu", start: "2026-11-01", end: "2026-12-10",
    tasks: [
      { name: "Selesai setelah periode", status: "done", completedAt: "2026-11-24", dueAt: "2026-11-26" },
      { name: "Target pada Senin akhir", status: "todo", dueAt: "2026-11-30" },
    ],
  },
].map((project) => ({ ...project, tasks: project.tasks.map((task, index) => ({ key: `task-${index}`, ...task })) }));

test("renders completions and targets by date, with the matching policy total on the final day", async () => {
  const counts = { "2026-11-16": 11, "2026-11-23": 50, "2026-11-30": 60 };
  const report = await renderDashboard({ projects: reportProjects, view: "report", counts });
  assert.equal(report.get("weeklyResultPeriod")?.textContent, "17–23 Nov 2026");
  assert.equal(report.get("weeklyTargetPeriod")?.textContent, "24–30 Nov 2026");

  const completed = report.get("weeklyResultSummary").innerHTML;
  assert.deepEqual([...completed.matchAll(/<time datetime="([^"]+)"/g)].map((match) => match[1]), ["2026-11-17", "2026-11-23"]);
  assert.match(completed, /Project A &amp; Tim[\s\S]*?PIC: <strong>Dita<\/strong>[\s\S]*?Selesai pada Selasa awal[\s\S]*?Selesai pada Senin akhir/);
  assert.match(completed, /datetime="2026-11-23"[\s\S]*?Entry Data Polis[\s\S]*?PIC: <strong>Restu<\/strong>[\s\S]*?Total 50 Polis/);
  assert.equal(completed.match(/Entry Data Polis/g)?.length, 1);
  assert.doesNotMatch(completed, /sebelum periode|setelah periode|Tanpa tanggal selesai|Deadline sebelum target/);

  const targets = report.get("weeklyCarryOver").innerHTML;
  assert.deepEqual([...targets.matchAll(/<time datetime="([^"]+)"/g)].map((match) => match[1]), ["2026-11-24", "2026-11-25", "2026-11-30"]);
  assert.match(targets, /Project A &amp; Tim[\s\S]*?PIC: <strong>Dita<\/strong>[\s\S]*?Target pada Selasa awal/);
  assert.match(targets, /Project B[\s\S]*?PIC: <strong>Restu<\/strong>[\s\S]*?Target pada Senin akhir/);
  assert.equal(targets.match(/Subtask target \d/g)?.length, 7);
  assert.doesNotMatch(targets, /sebelum target|setelah target|Selesai setelah periode|Entry Data Polis/);
});

test("renders only the obstacle note for the report period as plain multiline text", async () => {
  const note = "Menunggu konfirmasi <TI>\nJadwal pengujian bergeser.";
  const obstacles = { "2026-11-23": note, "2026-11-30": "Kendala minggu berikutnya" };
  const report = await renderDashboard({ view: "report", obstacles });
  assert.equal(report.get("weeklyObstaclesPeriod")?.textContent, "17–23 Nov 2026");
  assert.equal(report.get("weeklyObstaclesText")?.textContent, note);
  assert.equal(report.get("weeklyObstaclesText")?.innerHTML, undefined);
});

test("keeps the report windows fixed until the next Monday in WIB", async () => {
  const sunday = await renderDashboard({ now: "2026-11-29T16:59:59Z", projects: reportProjects, view: "report" });
  const monday = await renderDashboard({ now: "2026-11-29T17:00:00Z", projects: reportProjects, view: "report", counts: { "2026-11-30": 0 } });

  assert.equal(sunday.get("weeklyResultPeriod")?.textContent, "17–23 Nov 2026");
  assert.equal(monday.get("weeklyResultPeriod")?.textContent, "24–30 Nov 2026");
  assert.equal(monday.get("weeklyTargetPeriod")?.textContent, "1–7 Des 2026");
  assert.match(monday.get("weeklyResultSummary").innerHTML, /Selesai setelah periode/);
  assert.match(monday.get("weeklyResultSummary").innerHTML, /datetime="2026-11-30"[\s\S]*?Total 0 Polis/);
  assert.match(monday.get("weeklyCarryOver").innerHTML, /Deadline setelah target/);
});
