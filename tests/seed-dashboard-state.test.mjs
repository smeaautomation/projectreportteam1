import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseChromeExport,
  parseLatestDataSource,
  seedDashboardState,
  selectNewestSnapshot,
} from "../scripts/seed-dashboard-state.mjs";

function project(name = "Project A") {
  return {
    id: "project-a",
    name,
    owner: "Dita",
    category: "Web Automation",
    source: "Test",
    start: "2026-11-01",
    end: "2026-11-30",
    urgency: "High",
    tasks: [{
      key: "task-a",
      name: "Aktivitas A",
      short: "A",
      context: "Test",
      status: "active",
      startedAt: "2026-11-01",
      dueAt: "2026-11-30",
      completedAt: "",
    }],
  };
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, nested]) => [key, reverseObjectKeys(nested)]),
  );
}

test("parses deployed JavaScript and Chrome localStorage export envelopes", () => {
  const deployed = parseLatestDataSource(`globalThis.TEAM1_PROJECT_DATA = ${JSON.stringify({ projects: [project()], lastUpdate: "2026-11-10T00:00:00.000Z" })};`);
  const chrome = parseChromeExport({
    localStorage: {
      "team1-weekly-progress-v4": JSON.stringify([project("Chrome")]),
      "team1-weekly-progress-last-update": "2026-11-19T08:00:00.000Z",
    },
  });

  assert.equal(deployed.projects[0].name, "Project A");
  assert.equal(deployed.updatedAt, "2026-11-10T00:00:00.000Z");
  assert.equal(chrome.projects[0].name, "Chrome");
  assert.equal(chrome.updatedAt, "2026-11-19T08:00:00.000Z");
});

test("selects the newest valid source and refuses an ambiguous equal timestamp", () => {
  const deployed = { projects: [project("Deployed")], updatedAt: "2026-11-10T00:00:00.000Z", source: "deployed" };
  const chrome = { projects: [project("Chrome")], updatedAt: "2026-11-19T00:00:00.000Z", source: "chrome" };
  assert.equal(selectNewestSnapshot([deployed, chrome]).source, "chrome");
  assert.throws(() => selectNewestSnapshot([
    deployed,
    { ...chrome, updatedAt: deployed.updatedAt },
  ]), /ambiguous/i);
});

test("inserts revision one once and verifies full read-back equality", async () => {
  const calls = [];
  const now = "2026-11-19T09:00:00.000Z";
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!options.method) return Response.json([]);
    const body = JSON.parse(options.body);
    return Response.json([{ id: "team1", ...body }], { status: 201 });
  };
  const result = await seedDashboardState({
    projects: [project()],
    env: {
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_test",
    },
    fetchImpl,
    now: () => now,
  });

  assert.equal(result.revision, 1);
  assert.equal(result.projectCount, 1);
  assert.equal(result.activityCount, 1);
  assert.equal(result.updatedAt, now);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body).projects, [project()]);
  assert.equal(calls[1].options.headers.apikey, "sb_secret_test");
  assert.equal(calls[1].options.headers.Authorization, undefined);
});

test("is idempotent for identical data and protects different existing rows", async () => {
  const existing = {
    id: "team1",
    projects: reverseObjectKeys([project()]),
    revision: 4,
    updated_at: "2026-11-18T00:00:00.000Z",
    updated_by: "Dita Octaviana",
  };
  let writes = 0;
  const fetchImpl = async (_url, options = {}) => {
    if (options.method) writes += 1;
    return Response.json([existing]);
  };
  const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" };

  const noOp = await seedDashboardState({ projects: [project()], env, fetchImpl });
  assert.equal(noOp.revision, 4);
  assert.equal(noOp.changed, false);
  assert.equal(writes, 0);
  await assert.rejects(
    () => seedDashboardState({ projects: [project("Different")], env, fetchImpl }),
    /already exists/i,
  );
  await assert.rejects(
    () => seedDashboardState({ projects: [project("Different")], expectRevision: 3, env, fetchImpl }),
    /revision/i,
  );
  assert.equal(writes, 0);
});

test("schema enables RLS, read-only browser access, and idempotent Realtime publication", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202611190001_dashboard_state.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.dashboard_state/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for select\s+to anon, authenticated/i);
  assert.match(sql, /revoke (insert|all).*anon/i);
  assert.match(sql, /grant select, insert, update, delete.*service_role/i);
  assert.match(sql, /supabase_realtime/i);
  assert.match(sql, /if not exists/i);
});
