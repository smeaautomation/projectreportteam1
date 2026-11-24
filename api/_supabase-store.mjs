import { validateSnapshot, validateWeeklyObstacles, validateWeeklyPolicyCounts } from "./_snapshot.mjs";

const ROW_ID = "team1";
const TABLE = "dashboard_state";
const SELECT = "id,projects,weekly_policy_counts,weekly_obstacles,revision,updated_at,updated_by";

export class SupabaseConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

export class SupabaseRequestError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "SupabaseRequestError";
    this.status = status;
  }
}

export class RevisionConflictError extends Error {
  constructor(current) {
    super("Dashboard revision is stale");
    this.name = "RevisionConflictError";
    this.current = current;
  }
}

function requireConfig(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || "");
  const secretKey = String(env.SUPABASE_SECRET_KEY || "");
  if (!url || !publishableKey || !secretKey) {
    throw new SupabaseConfigurationError("Supabase environment variables are required");
  }
  try {
    new URL(url);
  } catch {
    throw new SupabaseConfigurationError("SUPABASE_URL is invalid");
  }
  return { url, publishableKey, secretKey };
}

function rowUrl(baseUrl, filters = {}) {
  const url = new URL(`${baseUrl}/rest/v1/${TABLE}`);
  url.searchParams.set("id", `eq.${ROW_ID}`);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  url.searchParams.set("select", SELECT);
  return url;
}

function mapRow(row) {
  if (!row || row.id !== ROW_ID || !Number.isInteger(Number(row.revision))) {
    throw new SupabaseRequestError("Shared dashboard row is invalid", 502);
  }
  return {
    projects: validateSnapshot(row.projects),
    weeklyPolicyCounts: validateWeeklyPolicyCounts(row.weekly_policy_counts ?? {}),
    weeklyObstacles: validateWeeklyObstacles(row.weekly_obstacles ?? {}),
    revision: Number(row.revision),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function responseRows(response) {
  if (!response?.ok) throw new SupabaseRequestError("Supabase request failed", response?.status || 0);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new SupabaseRequestError("Supabase returned invalid JSON", response.status);
  }
  if (!Array.isArray(body)) throw new SupabaseRequestError("Supabase returned an invalid row set", response.status);
  return body;
}

export function createSupabaseStore({ env = process.env, fetchImpl = fetch, now = () => new Date().toISOString() } = {}) {
  const config = requireConfig(env);
  const headers = { apikey: config.secretKey, "Content-Type": "application/json" };

  async function read() {
    const rows = await responseRows(await fetchImpl(rowUrl(config.url, { limit: "1" }), { headers }));
    if (!rows.length) throw new SupabaseRequestError("Shared dashboard row was not found", 404);
    return mapRow(rows[0]);
  }

  async function update({ projects, weeklyPolicyCounts, weeklyObstacles, baseRevision, updatedBy }) {
    if (!Number.isInteger(baseRevision) || baseRevision < 1) {
      throw new SupabaseRequestError("Base revision is invalid", 400);
    }
    const body = {
      revision: baseRevision + 1,
      updated_at: now(),
      updated_by: updatedBy,
    };
    if (projects !== undefined) body.projects = validateSnapshot(projects);
    if (weeklyPolicyCounts !== undefined) body.weekly_policy_counts = validateWeeklyPolicyCounts(weeklyPolicyCounts);
    if (weeklyObstacles !== undefined) body.weekly_obstacles = validateWeeklyObstacles(weeklyObstacles);
    const response = await fetchImpl(rowUrl(config.url, { revision: `eq.${baseRevision}` }), {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    const rows = await responseRows(response);
    if (!rows.length) throw new RevisionConflictError(await read());
    return mapRow(rows[0]);
  }

  function realtimeConfig() {
    return { url: config.url, publishableKey: config.publishableKey, table: TABLE, rowId: ROW_ID };
  }

  return { read, update, realtimeConfig };
}
