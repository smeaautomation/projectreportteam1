import { createAuthService, json, sameOrigin } from "./_auth.mjs";
import { MAX_SNAPSHOT_BYTES, SnapshotValidationError, validateSnapshot, validateWeeklyObstacles, validateWeeklyPolicyCounts } from "./_snapshot.mjs";
import {
  RevisionConflictError,
  SupabaseConfigurationError,
  SupabaseRequestError,
  createSupabaseStore,
} from "./_supabase-store.mjs";

function publicPayload(state, realtime) {
  return { ...state, realtime };
}

export function createDataHandlers({ env = process.env, fetchImpl = fetch, now = () => new Date().toISOString(), logger = console } = {}) {
  function store() {
    return createSupabaseStore({ env, fetchImpl, now });
  }

  async function GET() {
    try {
      const dataStore = store();
      return json(publicPayload(await dataStore.read(), dataStore.realtimeConfig()));
    } catch (error) {
      if (error instanceof SupabaseConfigurationError) return json({ error: "Data bersama belum dikonfigurasi." }, 503);
      logger.error("Team 1 shared data read failed", error instanceof Error ? error.message : "unknown error");
      return json({ error: "Data bersama belum dapat dimuat." }, 502);
    }
  }

  async function PUT(request) {
    if (!sameOrigin(request)) return json({ error: "Permintaan tidak valid." }, 403);
    try {
      const auth = createAuthService({ env });
      const user = auth.readSessionUser(request);
      if (!user) return json({ error: "Login editor diperlukan." }, 401);

      const declaredLength = Number(request.headers.get("content-length") || 0);
      if (declaredLength > MAX_SNAPSHOT_BYTES + 10000) return json({ error: "Data terlalu besar." }, 413);

      const body = await request.json();
      const hasPolicyCounts = Object.hasOwn(body ?? {}, "weeklyPolicyCounts");
      const hasObstacles = Object.hasOwn(body ?? {}, "weeklyObstacles");
      const hasWeeklyData = hasPolicyCounts || hasObstacles;
      const projects = !hasWeeklyData || Object.hasOwn(body, "projects") ? validateSnapshot(body?.projects) : undefined;
      const weeklyPolicyCounts = hasPolicyCounts ? validateWeeklyPolicyCounts(body.weeklyPolicyCounts) : undefined;
      const weeklyObstacles = hasObstacles ? validateWeeklyObstacles(body.weeklyObstacles) : undefined;
      const baseRevision = body?.baseRevision;
      if (!Number.isInteger(baseRevision) || baseRevision < 1) {
        return json({ error: "Revisi data tidak valid." }, 400);
      }

      const dataStore = store();
      const updated = await dataStore.update({ projects, weeklyPolicyCounts, weeklyObstacles, baseRevision, updatedBy: user.name });
      return json(publicPayload(updated, dataStore.realtimeConfig()));
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        const dataStore = store();
        return json(publicPayload(error.current, dataStore.realtimeConfig()), 409);
      }
      if (error instanceof SnapshotValidationError || (error instanceof SupabaseRequestError && error.status === 400)) {
        return json({ error: "Data dashboard tidak valid." }, 400);
      }
      if (error instanceof SupabaseConfigurationError || /AUTH_SESSION_SECRET/.test(error?.message || "")) {
        return json({ error: "Data bersama belum dikonfigurasi." }, 503);
      }
      if (error instanceof SyntaxError) return json({ error: "Format data tidak valid." }, 400);
      logger.error("Team 1 shared data write failed", error instanceof Error ? error.message : "unknown error");
      return json({ error: "Perubahan belum dapat disimpan ke data bersama." }, 502);
    }
  }

  return { GET, PUT };
}

export async function GET(request) {
  return createDataHandlers().GET(request);
}

export async function PUT(request) {
  return createDataHandlers().PUT(request);
}
