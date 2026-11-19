import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import vm from "node:vm";

import { validateSnapshot } from "../api/_snapshot.mjs";

const STORAGE_KEY = "team1-weekly-progress-v4";
const LAST_UPDATE_KEY = "team1-weekly-progress-last-update";
const ROW_ID = "team1";
const TABLE = "dashboard_state";
const SELECT = "id,projects,revision,updated_at,updated_by";

function validTimestamp(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} timestamp is invalid`);
  }
  return new Date(value).toISOString();
}

function normalizedSource(projects, updatedAt, source) {
  return {
    projects: validateSnapshot(projects),
    updatedAt: validTimestamp(updatedAt, source),
    source,
  };
}

export function parseLatestDataSource(source) {
  const context = {};
  context.globalThis = context;
  vm.runInNewContext(source, context, { timeout: 1000, filename: "latest-data.js" });
  const data = context.TEAM1_PROJECT_DATA;
  if (!data || !Array.isArray(data.projects)) throw new Error("Deployed snapshot is missing");
  return normalizedSource(data.projects, data.lastUpdate, "deployed");
}

export function parseChromeExport(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object") throw new Error("Chrome export is invalid");
  const storage = parsed.localStorage && typeof parsed.localStorage === "object" ? parsed.localStorage : parsed;
  let projects = storage[STORAGE_KEY] ?? parsed.projects;
  if (typeof projects === "string") projects = JSON.parse(projects);
  const updatedAt = storage[LAST_UPDATE_KEY] ?? parsed.updatedAt ?? parsed.lastUpdate;
  return normalizedSource(projects, updatedAt, "chrome");
}

export function selectNewestSnapshot(sources) {
  const valid = sources.map((source) => normalizedSource(source.projects, source.updatedAt, source.source || "snapshot"));
  if (!valid.length) throw new Error("No valid snapshots were supplied");
  valid.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  if (valid[1] && valid[0].updatedAt === valid[1].updatedAt) {
    const first = JSON.stringify(valid[0].projects);
    const second = JSON.stringify(valid[1].projects);
    if (first !== second) throw new Error("Snapshot selection is ambiguous at the newest timestamp");
  }
  return valid[0];
}

function countSnapshot(projects) {
  return {
    projectCount: projects.length,
    activityCount: projects.reduce((total, project) => total + project.tasks.length, 0),
  };
}

function config(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const secretKey = String(env.SUPABASE_SECRET_KEY || "");
  if (!url || !secretKey) throw new Error("Supabase URL and secret key are required");
  try { new URL(url); } catch { throw new Error("SUPABASE_URL is invalid"); }
  return { url, secretKey };
}

function endpoint(baseUrl, params = {}) {
  const url = new URL(`${baseUrl}/rest/v1/${TABLE}`);
  url.searchParams.set("id", `eq.${ROW_ID}`);
  url.searchParams.set("select", SELECT);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function rows(response) {
  if (!response?.ok) throw new Error(`Supabase migration request failed (${response?.status || 0})`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error("Supabase migration response is invalid");
  return body;
}

function sameProjects(left, right) {
  return isDeepStrictEqual(left, right);
}

function resultFromRow(row, changed) {
  const projects = validateSnapshot(row.projects);
  return {
    changed,
    revision: Number(row.revision),
    updatedAt: validTimestamp(row.updated_at, "Supabase"),
    ...countSnapshot(projects),
  };
}

export async function seedDashboardState({ projects, expectRevision, env = process.env, fetchImpl = fetch, now = () => new Date().toISOString() }) {
  const normalized = validateSnapshot(projects);
  const { url, secretKey } = config(env);
  const headers = { apikey: secretKey, "Content-Type": "application/json" };
  const currentRows = await rows(await fetchImpl(endpoint(url, { limit: "1" }), { headers }));
  const current = currentRows[0];

  if (current && sameProjects(validateSnapshot(current.projects), normalized)) {
    return resultFromRow(current, false);
  }
  if (current && expectRevision === undefined) {
    throw new Error("Dashboard state already exists with different data; --expect-revision is required");
  }
  if (current && Number(current.revision) !== expectRevision) {
    throw new Error(`Dashboard revision does not match expected revision ${expectRevision}`);
  }

  const updatedAt = now();
  const body = {
    id: ROW_ID,
    projects: normalized,
    revision: current ? expectRevision + 1 : 1,
    updated_at: updatedAt,
    updated_by: "migration",
  };
  const method = current ? "PATCH" : "POST";
  const urlParams = current ? { revision: `eq.${expectRevision}` } : {};
  const written = await rows(await fetchImpl(endpoint(url, urlParams), {
    method,
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  }));
  if (written.length !== 1 || !sameProjects(validateSnapshot(written[0].projects), normalized)) {
    throw new Error("Supabase read-back did not match the selected snapshot");
  }
  return resultFromRow(written[0], true);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const input = argument("--input");
  if (!input) throw new Error("Usage: node scripts/seed-dashboard-state.mjs --input <ignored-json-path> [--expect-revision N]");
  const selected = parseChromeExport(await readFile(input, "utf8"));
  const rawExpected = argument("--expect-revision");
  const expectRevision = rawExpected === undefined ? undefined : Number(rawExpected);
  if (rawExpected !== undefined && (!Number.isInteger(expectRevision) || expectRevision < 1)) {
    throw new Error("--expect-revision must be a positive integer");
  }
  const result = await seedDashboardState({ projects: selected.projects, expectRevision });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
