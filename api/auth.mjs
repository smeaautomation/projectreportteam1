import { createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "team1_edit_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const FALLBACK_SESSION_SECRET = "98ec0b85835bb6f76b8969b9182d9cabc06c21e2ace8387a6cde615c58d260bc70db6c3d9880f7471445ee8a2900b8b0";
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

function json(body, status = 200, extraHeaders = {}) {
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

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function credentialMatches(password, record) {
  const configuredPassword = typeof process !== "undefined" ? process.env[record.envKey] : undefined;
  if (configuredPassword) return safeEqual(password, configuredPassword);
  const hash = pbkdf2Sync(password, Buffer.from(record.salt, "hex"), 210000, 32, "sha256").toString("hex");
  return safeEqual(hash, record.passwordHash);
}

function signingSecret() {
  return (typeof process !== "undefined" && process.env.AUTH_SESSION_SECRET) || FALLBACK_SESSION_SECRET;
}

function sign(value) {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function createSession(userId) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

function readCookie(request) {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : "";
}

function verifySession(token) {
  try {
    const separator = token.lastIndexOf(".");
    if (separator < 1) return null;
    const payload = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    if (!safeEqual(signature, sign(payload))) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!USERS[session.userId] || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET(request) {
  const session = verifySession(readCookie(request));
  if (!session) return json({ authenticated: false });
  const user = USERS[session.userId];
  return json({ authenticated: true, user: { id: session.userId, name: user.name }, expiresAt: session.expiresAt });
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak valid." }, 403);
  try {
    const body = await request.json();
    const userId = typeof body.user === "string" ? body.user : "";
    const password = typeof body.password === "string" ? body.password : "";
    const record = USERS[userId];
    if (!record || !password || password.length > 64 || !credentialMatches(password, record)) {
      return json({ error: "User atau password tidak sesuai." }, 401);
    }
    const session = createSession(userId);
    const cookie = `${COOKIE_NAME}=${encodeURIComponent(session.token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
    return json({ authenticated: true, user: { id: userId, name: record.name }, expiresAt: session.expiresAt }, 200, { "Set-Cookie": cookie });
  } catch (error) {
    console.error("Team 1 authentication failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Login belum dapat diproses. Silakan coba lagi." }, 500);
  }
}

export async function DELETE(request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak valid." }, 403);
  return json({ authenticated: false }, 200, { "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
}
