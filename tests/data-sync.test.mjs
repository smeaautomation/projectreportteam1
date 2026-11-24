import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadSync() {
  const source = await readFile(new URL("../dist/data-sync.js", import.meta.url), "utf8");
  const context = vm.createContext({
    console,
    globalThis: {},
    structuredClone,
    setTimeout,
    clearTimeout,
    URL,
  });
  vm.runInContext(source, context, { filename: "data-sync.js" });
  return context.globalThis.Team1DataSync;
}

function project(name = "Server Project") {
  return [{ id: "project-1", name, tasks: [] }];
}

function payload(revision = 1, name = "Server Project", overrides = {}) {
  return {
    projects: project(name),
    revision,
    updatedAt: `2026-11-19T08:0${revision}:00.000Z`,
    updatedBy: "Dita Octaviana",
    realtime: {
      url: "https://project-ref.supabase.co",
      publishableKey: "sb_publishable_test",
      table: "dashboard_state",
      rowId: "team1",
    },
    ...overrides,
  };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key); },
  };
}

function queuedFetch(items, calls = []) {
  return Object.assign(async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!items.length) throw new Error("Unexpected fetch");
    const next = items.shift();
    if (typeof next === "function") return next(url, options);
    if (next instanceof Error) throw next;
    return next;
  }, { calls });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("loads server state first and stores only the confirmed response", async () => {
  const Team1DataSync = await loadSync();
  const storage = memoryStorage({
    "team1-shared-cache-v1": JSON.stringify(payload(1, "Cached Project")),
  });
  const fetchImpl = queuedFetch([Response.json(payload(2, "Fresh Server Project"))]);
  const states = [];
  const controller = Team1DataSync.create({
    fetchImpl,
    storage,
    deployed: { projects: project("Deployed Project"), updatedAt: "2026-11-10T00:00:00.000Z" },
    realtimeFactory: () => ({ unsubscribe() {} }),
  });
  controller.subscribe((state) => states.push(state));

  await controller.start();

  assert.equal(controller.isReady(), true);
  assert.equal(states.at(-1).status, "ready");
  assert.equal(states.at(-1).projects[0].name, "Fresh Server Project");
  assert.equal(JSON.parse(storage.value("team1-shared-cache-v1")).revision, 2);
});

test("falls back to confirmed cache and disables live editing when initial load fails", async () => {
  const Team1DataSync = await loadSync();
  const storage = memoryStorage({
    "team1-shared-cache-v1": JSON.stringify(payload(2, "Cached Project")),
  });
  const controller = Team1DataSync.create({
    fetchImpl: queuedFetch([new Error("offline")]),
    storage,
    deployed: { projects: project("Deployed Project"), updatedAt: "2026-11-10T00:00:00.000Z" },
  });

  const state = await controller.start();

  assert.equal(state.status, "offline");
  assert.equal(state.projects[0].name, "Cached Project");
  assert.equal(controller.isReady(), false);
  await assert.rejects(() => controller.save(project("Cannot Save")), /not ready/i);
});

test("serializes writes and coalesces rapid edits to the newest pending snapshot", async () => {
  const Team1DataSync = await loadSync();
  const firstWrite = deferred();
  const calls = [];
  const fetchImpl = queuedFetch([
    Response.json(payload(1)),
    () => firstWrite.promise,
    Response.json(payload(3, "Third Edit")),
  ], calls);
  const controller = Team1DataSync.create({
    fetchImpl,
    storage: memoryStorage(),
    realtimeFactory: () => ({ unsubscribe() {} }),
  });
  await controller.start();

  const first = controller.save(project("First Edit"));
  const second = controller.save(project("Second Edit"));
  const third = controller.save(project("Third Edit"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls.length, 2);
  firstWrite.resolve(Response.json(payload(2, "First Edit")));
  await Promise.all([first, second, third]);

  const writeCalls = calls.filter((call) => call.options.method === "PUT");
  assert.equal(writeCalls.length, 2);
  assert.equal(JSON.parse(writeCalls[0].options.body).projects[0].name, "First Edit");
  assert.equal(JSON.parse(writeCalls[0].options.body).baseRevision, 1);
  assert.equal(JSON.parse(writeCalls[1].options.body).projects[0].name, "Third Edit");
  assert.equal(JSON.parse(writeCalls[1].options.body).baseRevision, 2);
  assert.equal(controller.getState().updatedAt, payload(3).updatedAt);
});

test("keeps queued policy counts and weekly obstacles when a project edit arrives", async () => {
  const Team1DataSync = await loadSync();
  const firstWrite = deferred();
  const counts = { "2026-11-23": 0 };
  const obstacles = { "2026-11-23": "Menunggu konfirmasi" };
  const fetchImpl = queuedFetch([
    Response.json(payload(1)),
    () => firstWrite.promise,
    Response.json(payload(3, "Latest Project", { weeklyPolicyCounts: counts, weeklyObstacles: obstacles })),
  ]);
  const controller = Team1DataSync.create({ fetchImpl, storage: memoryStorage() });
  await controller.start();

  const original = controller.save(project("First Project"));
  const policy = controller.save(undefined, { weeklyPolicyCounts: counts });
  const report = controller.save(undefined, { weeklyObstacles: obstacles });
  const latest = controller.save(project("Latest Project"));
  firstWrite.resolve(Response.json(payload(2, "First Project")));
  await Promise.all([original, policy, report, latest]);

  assert.deepEqual(JSON.parse(fetchImpl.calls[2].options.body), {
    projects: project("Latest Project"),
    weeklyPolicyCounts: counts,
    weeklyObstacles: obstacles,
    baseRevision: 2,
  });
  assert.equal(controller.getState().weeklyPolicyCounts["2026-11-23"], 0);
  assert.equal(controller.getState().weeklyObstacles["2026-11-23"], obstacles["2026-11-23"]);
});

test("refreshes from the server when Realtime announces a newer row", async () => {
  const Team1DataSync = await loadSync();
  let onChange;
  let unsubscribed = false;
  const fetchImpl = queuedFetch([
    Response.json(payload(1)),
    Response.json(payload(2, "Realtime Project")),
  ]);
  const controller = Team1DataSync.create({
    fetchImpl,
    storage: memoryStorage(),
    realtimeFactory: (_config, changeHandler) => {
      onChange = changeHandler;
      return { unsubscribe() { unsubscribed = true; } };
    },
  });
  await controller.start();

  await onChange({ new: { id: "team1", revision: 2 } });

  assert.equal(controller.getState().revision, 2);
  assert.equal(controller.getState().projects[0].name, "Realtime Project");
  controller.stop();
  assert.equal(unsubscribed, true);
});

test("refreshes server state and re-enables editing after Realtime reconnects", async () => {
  const Team1DataSync = await loadSync();
  let onStatus;
  const fetchImpl = queuedFetch([
    Response.json(payload(1)),
    Response.json(payload(1)),
  ]);
  const controller = Team1DataSync.create({
    fetchImpl,
    storage: memoryStorage(),
    realtimeFactory: (_config, _changeHandler, statusHandler) => {
      onStatus = statusHandler;
      return { unsubscribe() {} };
    },
  });
  await controller.start();

  onStatus("CHANNEL_ERROR");
  assert.equal(controller.getState().status, "stale");
  assert.equal(controller.isReady(), false);

  await onStatus("SUBSCRIBED");
  assert.equal(controller.getState().status, "ready");
  assert.equal(controller.isReady(), true);
  assert.equal(fetchImpl.calls.length, 2);
});

test("rolls back to confirmed state and reports offline when a save fails", async () => {
  const Team1DataSync = await loadSync();
  const controller = Team1DataSync.create({
    fetchImpl: queuedFetch([Response.json(payload(1)), new Error("network failed")]),
    storage: memoryStorage(),
    realtimeFactory: () => ({ unsubscribe() {} }),
  });
  await controller.start();

  await assert.rejects(() => controller.save(project("Unsaved Edit")), /network failed/i);

  assert.equal(controller.getState().status, "offline");
  assert.equal(controller.getState().projects[0].name, "Server Project");
  assert.equal(controller.isReady(), false);
});

test("adopts the server snapshot and clears queued edits after a revision conflict", async () => {
  const Team1DataSync = await loadSync();
  const controller = Team1DataSync.create({
    fetchImpl: queuedFetch([
      Response.json(payload(1)),
      Response.json(payload(4, "Restu Server Edit", { updatedBy: "Restu Aji Nugroho" }), { status: 409 }),
    ]),
    storage: memoryStorage(),
    realtimeFactory: () => ({ unsubscribe() {} }),
  });
  await controller.start();

  const state = await controller.save(project("Dita Local Edit"));

  assert.equal(state.status, "conflict");
  assert.equal(state.revision, 4);
  assert.equal(state.projects[0].name, "Restu Server Edit");
  assert.equal(state.updatedBy, "Restu Aji Nugroho");
});
