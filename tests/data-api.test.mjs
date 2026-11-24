import assert from "node:assert/strict";
import test from "node:test";

import { createAuthService, SESSION_COOKIE_NAME } from "../api/_auth.mjs";
import { createDataHandlers } from "../api/data.mjs";

const ENV = {
  AUTH_SESSION_SECRET: "test-session-secret-that-is-long-enough-for-hmac-signing-123456",
  DITA_PASSWORD: "dita-test-password",
  RESTU_PASSWORD: "restu-test-password",
  SUPABASE_URL: "https://project-ref.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SECRET_KEY: "sb_secret_test",
};
const SILENT_LOGGER = { error() {} };

function projects() {
  return [
    {
      id: "project-1",
      name: "Project Satu",
      owner: "Dita",
      category: "Web Automation",
      start: "2026-11-01",
      end: "2026-11-30",
      urgency: "High",
      source: "Input dashboard",
      tasks: [
        {
          key: "task-1",
          name: "Aktivitas",
          short: "Aktivitas",
          status: "active",
          context: "",
          startedAt: "2026-11-01",
          dueAt: "2026-11-15",
          completedAt: "",
        },
      ],
    },
  ];
}

function row(overrides = {}) {
  return {
    id: "team1",
    projects: projects(),
    revision: 3,
    updated_at: "2026-11-19T08:00:00.000Z",
    updated_by: "Dita Octaviana",
    ...overrides,
  };
}

function fakeFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetchImpl, calls };
}

function editorCookie(userId = "dita") {
  const service = createAuthService({ env: ENV, now: () => Date.now() });
  const session = service.createSession(userId);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.token)}`;
}

function request(method, body, headers = {}) {
  return new Request("https://dashboard.test/api/data", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("public GET returns shared data and only public Realtime configuration", async () => {
  const fake = fakeFetch([Response.json([row()])]);
  const handlers = createDataHandlers({ env: ENV, fetchImpl: fake.fetchImpl, logger: SILENT_LOGGER });

  const response = await handlers.GET(request("GET"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.revision, 3);
  assert.deepEqual(body.projects, projects());
  assert.deepEqual(body.realtime, {
    url: ENV.SUPABASE_URL,
    publishableKey: ENV.SUPABASE_PUBLISHABLE_KEY,
    table: "dashboard_state",
    rowId: "team1",
  });
  assert.doesNotMatch(JSON.stringify(body), /sb_secret_test/);
  assert.equal(fake.calls[0].options.headers.apikey, ENV.SUPABASE_SECRET_KEY);
  assert.equal(fake.calls[0].options.headers.Authorization, undefined);
});

test("returns a service-unavailable response when Supabase configuration is missing", async () => {
  const handlers = createDataHandlers({ env: { ...ENV, SUPABASE_SECRET_KEY: "" }, fetchImpl: async () => null, logger: SILENT_LOGGER });
  const response = await handlers.GET(request("GET"));

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /belum dikonfigurasi/i);
});

test("rejects anonymous, cross-origin, and malformed writes before Supabase is called", async () => {
  const fake = fakeFetch([]);
  const handlers = createDataHandlers({ env: ENV, fetchImpl: fake.fetchImpl, logger: SILENT_LOGGER });

  const anonymous = await handlers.PUT(request("PUT", { projects: projects(), baseRevision: 3 }));
  assert.equal(anonymous.status, 401);

  const crossOrigin = await handlers.PUT(
    request("PUT", { projects: projects(), baseRevision: 3 }, {
      cookie: editorCookie(),
      origin: "https://attacker.test",
    }),
  );
  assert.equal(crossOrigin.status, 403);

  const malformed = await handlers.PUT(
    request("PUT", { projects: [{ id: "" }], baseRevision: 3 }, {
      cookie: editorCookie(),
      origin: "https://dashboard.test",
    }),
  );
  assert.equal(malformed.status, 400);
  assert.equal(fake.calls.length, 0);
});

test("authenticated PUT updates only the expected revision and records the editor", async () => {
  const updated = row({ revision: 4, updated_at: "2026-11-19T08:05:00.000Z" });
  const fake = fakeFetch([Response.json([updated])]);
  const handlers = createDataHandlers({
    env: ENV,
    fetchImpl: fake.fetchImpl,
    now: () => "2026-11-19T08:05:00.000Z",
    logger: SILENT_LOGGER,
  });

  const response = await handlers.PUT(
    request("PUT", { projects: projects(), baseRevision: 3 }, {
      cookie: editorCookie(),
      origin: "https://dashboard.test",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.revision, 4);
  assert.match(fake.calls[0].url, /id=eq\.team1/);
  assert.match(fake.calls[0].url, /revision=eq\.3/);
  assert.equal(fake.calls[0].options.method, "PATCH");
  assert.equal(fake.calls[0].options.headers.apikey, ENV.SUPABASE_SECRET_KEY);
  assert.equal(fake.calls[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(fake.calls[0].options.body), {
    projects: projects(),
    revision: 4,
    updated_at: "2026-11-19T08:05:00.000Z",
    updated_by: "Dita Octaviana",
  });
});

test("stale revisions return 409 with the current server snapshot", async () => {
  const current = row({ revision: 5, updated_by: "Restu Aji Nugroho" });
  const fake = fakeFetch([Response.json([]), Response.json([current])]);
  const handlers = createDataHandlers({ env: ENV, fetchImpl: fake.fetchImpl, logger: SILENT_LOGGER });

  const response = await handlers.PUT(
    request("PUT", { projects: projects(), baseRevision: 3 }, {
      cookie: editorCookie(),
      origin: "https://dashboard.test",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.revision, 5);
  assert.equal(body.updatedBy, "Restu Aji Nugroho");
  assert.equal(fake.calls.length, 2);
});

test("weekly policy counts use the editor session and persist without changing projects", async () => {
  const counts = { "2026-11-16": 24, "2026-11-23": 0 };
  const fake = fakeFetch([Response.json([row({ weekly_policy_counts: counts, revision: 4 })])]);
  const handlers = createDataHandlers({ env: ENV, fetchImpl: fake.fetchImpl, logger: SILENT_LOGGER });
  const input = { weeklyPolicyCounts: counts, baseRevision: 3 };

  assert.equal((await handlers.PUT(request("PUT", input))).status, 401);
  const headers = { cookie: editorCookie(), origin: "https://dashboard.test" };
  for (const weeklyPolicyCounts of [null, { "2026-11-24": 5 }, { "2026-11-23": -1 }, { "2026-11-23": 1.5 }]) {
    assert.equal((await handlers.PUT(request("PUT", { ...input, weeklyPolicyCounts }, headers))).status, 400);
  }
  const saved = await handlers.PUT(request("PUT", input, headers));
  assert.equal(saved.status, 200);
  assert.deepEqual((await saved.json()).weeklyPolicyCounts, counts);
  assert.equal(fake.calls.length, 1);
  assert.match(fake.calls[0].url, /revision=eq\.3/);
  const patch = JSON.parse(fake.calls[0].options.body);
  assert.deepEqual(patch.weekly_policy_counts, counts);
  assert.equal(Object.hasOwn(patch, "projects"), false);
});

test("weekly obstacles require an editor and round-trip without changing other dashboard fields", async () => {
  const obstacles = { "2026-11-23": "Menunggu konfirmasi.\nJadwal pengujian bergeser." };
  const savedRow = row({ revision: 4, weekly_obstacles: obstacles, weekly_policy_counts: { "2026-11-23": 50 } });
  const fake = fakeFetch([Response.json([savedRow]), Response.json([savedRow])]);
  const handlers = createDataHandlers({ env: ENV, fetchImpl: fake.fetchImpl, logger: SILENT_LOGGER });
  const input = { weeklyObstacles: obstacles, baseRevision: 3 };
  const headers = { cookie: editorCookie(), origin: "https://dashboard.test" };

  assert.equal((await handlers.PUT(request("PUT", input))).status, 401);
  for (const weeklyObstacles of [null, { "2026-11-24": "Selasa" }, { "2026-11-23": 50 }, { "2026-11-23": "a".repeat(2001) }]) {
    assert.equal((await handlers.PUT(request("PUT", { ...input, weeklyObstacles }, headers))).status, 400);
  }
  const saved = await handlers.PUT(request("PUT", input, headers));
  assert.equal(saved.status, 200);
  assert.deepEqual((await saved.json()).weeklyObstacles, obstacles);
  assert.match(fake.calls[0].url, /revision=eq\.3/);
  const patch = JSON.parse(fake.calls[0].options.body);
  assert.deepEqual(patch.weekly_obstacles, obstacles);
  assert.equal(Object.hasOwn(patch, "projects") || Object.hasOwn(patch, "weekly_policy_counts"), false);
  const reloaded = await (await handlers.GET()).json();
  assert.deepEqual(reloaded.weeklyObstacles, obstacles);
  assert.deepEqual(reloaded.weeklyPolicyCounts, { "2026-11-23": 50 });
});

test("maps Supabase failures to a safe gateway error", async () => {
  const fake = fakeFetch([Response.json({ message: "database unavailable" }, { status: 503 })]);
  const handlers = createDataHandlers({ env: ENV, fetchImpl: fake.fetchImpl, logger: SILENT_LOGGER });
  const response = await handlers.GET(request("GET"));

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /data bersama/i);
});
