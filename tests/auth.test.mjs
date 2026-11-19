import assert from "node:assert/strict";
import test from "node:test";

import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createAuthService,
  sameOrigin,
} from "../api/_auth.mjs";
import { POST } from "../api/auth.mjs";

const TEST_SECRET = "test-session-secret-that-is-long-enough-for-hmac-signing-123456";
const TEST_NOW = Date.UTC(2026, 10, 19, 8, 0, 0);

function authService(now = TEST_NOW) {
  return createAuthService({
    env: {
      AUTH_SESSION_SECRET: TEST_SECRET,
      DITA_PASSWORD: "dita-test-password",
      RESTU_PASSWORD: "restu-test-password",
    },
    now: () => now,
  });
}

test("authenticates the configured Dita and Restu credentials without exposing passwords", () => {
  const service = authService();

  assert.deepEqual(service.authenticate("dita", "dita-test-password"), {
    id: "dita",
    name: "Dita Octaviana",
  });
  assert.deepEqual(service.authenticate("restu", "restu-test-password"), {
    id: "restu",
    name: "Restu Aji Nugroho",
  });
  assert.equal(service.authenticate("dita", "wrong"), null);
  assert.equal(service.authenticate("unknown", "anything"), null);
});

test("recovers a signed session user and rejects tampered or expired cookies", () => {
  const service = authService();
  const session = service.createSession("dita");
  const validRequest = new Request("https://dashboard.test/api/auth", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.token)}` },
  });

  assert.deepEqual(service.readSessionUser(validRequest), {
    id: "dita",
    name: "Dita Octaviana",
    expiresAt: TEST_NOW + SESSION_TTL_SECONDS * 1000,
  });

  const tampered = `${session.token.slice(0, -1)}x`;
  const tamperedRequest = new Request("https://dashboard.test/api/auth", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(tampered)}` },
  });
  assert.equal(service.readSessionUser(tamperedRequest), null);

  const expiredService = authService(TEST_NOW + SESSION_TTL_SECONDS * 1000 + 1);
  assert.equal(expiredService.readSessionUser(validRequest), null);
});

test("requires a server session secret", () => {
  assert.throws(
    () => createAuthService({ env: {}, now: () => TEST_NOW }),
    /AUTH_SESSION_SECRET/,
  );
});

test("accepts absent or matching origins and rejects cross-origin mutations", () => {
  assert.equal(sameOrigin(new Request("https://dashboard.test/api/auth")), true);
  assert.equal(
    sameOrigin(new Request("https://dashboard.test/api/auth", { headers: { origin: "https://dashboard.test" } })),
    true,
  );
  assert.equal(
    sameOrigin(new Request("https://dashboard.test/api/auth", { headers: { origin: "https://attacker.test" } })),
    false,
  );
});

test("login handler preserves secure editor cookie attributes", async () => {
  const previous = {
    AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
    DITA_PASSWORD: process.env.DITA_PASSWORD,
  };
  process.env.AUTH_SESSION_SECRET = TEST_SECRET;
  process.env.DITA_PASSWORD = "dita-test-password";

  try {
    const request = new Request("https://dashboard.test/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "https://dashboard.test" },
      body: JSON.stringify({ user: "dita", password: "dita-test-password" }),
    });
    const response = await POST(request);
    const cookie = response.headers.get("set-cookie") || "";

    assert.equal(response.status, 200);
    assert.match(cookie, new RegExp(`^${SESSION_COOKIE_NAME}=`));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, new RegExp(`Max-Age=${SESSION_TTL_SECONDS}`));
  } finally {
    if (previous.AUTH_SESSION_SECRET === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = previous.AUTH_SESSION_SECRET;
    if (previous.DITA_PASSWORD === undefined) delete process.env.DITA_PASSWORD;
    else process.env.DITA_PASSWORD = previous.DITA_PASSWORD;
  }
});
