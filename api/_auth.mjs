import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "team1_edit_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const USERS = {
  dita: {
    name: "Dita Octaviana",
    envKey: "DITA_PASSWORD",
    salt: "cc1ff78441aa65d733ea5f73adcf6f10",
    passwordHash: "c1e709e8eb9f5f32220dd3b7ec13d628d1974cad3789da630e968f93157844f2",
  },
  restu: {
    name: "Restu Aji Nugroho",
    envKey: "RESTU_PASSWORD",
    salt: "b45b63497d12bb3ee770ce1dd9d368d4",
    passwordHash: "03751eb509586739f644132d1b91a0cad65899970d2286ea06bb9b88db28911a",
  },
};

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Cookie",
      ...extraHeaders,
    },
  });
}

export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function credentialMatches(password, record, env) {
  const configuredPassword = env[record.envKey];
  if (configuredPassword) return safeEqual(password, configuredPassword);
  const hash = pbkdf2Sync(password, Buffer.from(record.salt, "hex"), 210000, 32, "sha256").toString("hex");
  return safeEqual(hash, record.passwordHash);
}

function readCookie(request) {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1)) : "";
}

export function createAuthService({ env = process.env, now = () => Date.now() } = {}) {
  const signingSecret = String(env.AUTH_SESSION_SECRET || "").trim();
  if (!signingSecret) throw new Error("AUTH_SESSION_SECRET is required");

  function sign(value) {
    return createHmac("sha256", signingSecret).update(value).digest("base64url");
  }

  function authenticate(userId, password) {
    const record = USERS[userId];
    if (!record || typeof password !== "string" || !password || password.length > 64) return null;
    if (!credentialMatches(password, record, env)) return null;
    return { id: userId, name: record.name };
  }

  function createSession(userId) {
    if (!USERS[userId]) throw new Error("Unknown editor user");
    const expiresAt = now() + SESSION_TTL_SECONDS * 1000;
    const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString("base64url");
    return { token: `${payload}.${sign(payload)}`, expiresAt };
  }

  function readSessionUser(request) {
    try {
      const token = readCookie(request);
      const separator = token.lastIndexOf(".");
      if (separator < 1) return null;
      const payload = token.slice(0, separator);
      const signature = token.slice(separator + 1);
      if (!safeEqual(signature, sign(payload))) return null;
      const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      const record = USERS[session.userId];
      if (!record || !Number.isFinite(session.expiresAt) || session.expiresAt <= now()) return null;
      return { id: session.userId, name: record.name, expiresAt: session.expiresAt };
    } catch {
      return null;
    }
  }

  function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
    return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  }

  return { authenticate, createSession, readSessionUser, sessionCookie };
}
