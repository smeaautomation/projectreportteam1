import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadDashboardData() {
  const context = vm.createContext({
    console,
    globalThis: {},
    structuredClone,
    setTimeout,
    clearTimeout,
    URL,
  });
  for (const path of ["../dist/data-sync.js", "../dist/dashboard-data-bridge.js"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    vm.runInContext(source, context, { filename: path });
  }
  return {
    Team1DataSync: context.globalThis.Team1DataSync,
    Team1DashboardData: context.globalThis.Team1DashboardData,
  };
}

function projects(name) {
  return [{ id: "project-1", name, tasks: [] }];
}

function payload(revision, name, overrides = {}) {
  return {
    projects: projects(name),
    revision,
    updatedAt: `2026-11-19T09:0${revision}:00.000Z`,
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

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("forwards confirmed server snapshots and server Last Update to the dashboard", async () => {
  const { Team1DataSync, Team1DashboardData } = await loadDashboardData();
  const calls = [];
  const responses = [Response.json(payload(1, "Server Start")), Response.json(payload(2, "Saved Edit"))];
  const controller = Team1DataSync.create({
    storage: storage(),
    realtimeFactory: () => ({ unsubscribe() {} }),
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      return responses.shift();
    },
  });
  const snapshots = [];
  const statuses = [];
  const bridge = Team1DashboardData.create({
    controller,
    onSnapshot: (snapshot) => snapshots.push(snapshot),
    onStatus: (state) => statuses.push(state.status),
  });

  await bridge.start();
  await bridge.save(projects("Saved Edit"));

  assert.equal(snapshots[0].projects[0].name, "Server Start");
  assert.equal(snapshots.at(-1).projects[0].name, "Saved Edit");
  assert.equal(snapshots.at(-1).updatedAt, "2026-11-19T09:02:00.000Z");
  assert.equal(JSON.parse(calls[1].options.body).projects[0].name, "Saved Edit");
  assert.ok(statuses.includes("saving"));
  assert.ok(statuses.includes("saved"));
  assert.equal(bridge.canEdit(), true);
});

test("keeps confirmed fallback visible and disables edits while offline", async () => {
  const { Team1DataSync, Team1DashboardData } = await loadDashboardData();
  const controller = Team1DataSync.create({
    storage: storage(),
    deployed: { projects: projects("Deployed Fallback"), updatedAt: "2026-11-10T00:00:00.000Z" },
    fetchImpl: async () => { throw new Error("offline"); },
  });
  const snapshots = [];
  const bridge = Team1DashboardData.create({ controller, onSnapshot: (snapshot) => snapshots.push(snapshot) });

  await bridge.start();

  assert.equal(snapshots.at(-1).projects[0].name, "Deployed Fallback");
  assert.equal(bridge.canEdit(), false);
  await assert.rejects(() => bridge.save(projects("Blocked Edit")), /not ready/i);
});

test("adopts conflict data and blocks another edit until live state is refreshed", async () => {
  const { Team1DataSync, Team1DashboardData } = await loadDashboardData();
  const responses = [
    Response.json(payload(1, "Initial")),
    Response.json(payload(3, "Restu Update", { updatedBy: "Restu Aji Nugroho" }), { status: 409 }),
  ];
  const controller = Team1DataSync.create({
    storage: storage(),
    realtimeFactory: () => ({ unsubscribe() {} }),
    fetchImpl: async () => responses.shift(),
  });
  const snapshots = [];
  const bridge = Team1DashboardData.create({ controller, onSnapshot: (snapshot) => snapshots.push(snapshot) });
  await bridge.start();

  await bridge.save(projects("Dita Update"));

  assert.equal(snapshots.at(-1).projects[0].name, "Restu Update");
  assert.equal(snapshots.at(-1).updatedBy, "Restu Aji Nugroho");
  assert.equal(bridge.canEdit(), false);
});

test("loads realtime dependencies before the dashboard and uses the shared API as authority", async () => {
  const index = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../dist/app.js", import.meta.url), "utf8");

  const vendorPosition = index.indexOf("vendor/supabase.min.js");
  const controllerPosition = index.indexOf("data-sync.js");
  const bridgePosition = index.indexOf("dashboard-data-bridge.js");
  const appPosition = index.indexOf("app.js");
  assert.ok(vendorPosition > -1 && vendorPosition < controllerPosition);
  assert.ok(controllerPosition < bridgePosition && bridgePosition < appPosition);
  assert.match(index, /id="syncNotice"[^>]*hidden/);
  assert.match(app, /Team1DataSync\.create/);
  assert.match(app, /Team1DashboardData\.create/);
  assert.match(app, /dashboardData\.save/);
  assert.doesNotMatch(app, /function markDataUpdated/);
});
