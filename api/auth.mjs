import { createAuthService, json, sameOrigin } from "./_auth.mjs";

function authService() {
  return createAuthService({ env: process.env });
}

export async function GET(request) {
  try {
    const user = authService().readSessionUser(request);
    if (!user) return json({ authenticated: false });
    return json({ authenticated: true, user: { id: user.id, name: user.name }, expiresAt: user.expiresAt });
  } catch (error) {
    console.error("Team 1 authentication configuration failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Login belum dikonfigurasi." }, 500);
  }
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak valid." }, 403);
  try {
    const body = await request.json();
    const userId = typeof body.user === "string" ? body.user : "";
    const password = typeof body.password === "string" ? body.password : "";
    const service = authService();
    const user = service.authenticate(userId, password);
    if (!user) {
      return json({ error: "User atau password tidak sesuai." }, 401);
    }
    const session = service.createSession(userId);
    return json(
      { authenticated: true, user, expiresAt: session.expiresAt },
      200,
      { "Set-Cookie": service.sessionCookie(session.token) },
    );
  } catch (error) {
    console.error("Team 1 authentication failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Login belum dapat diproses. Silakan coba lagi." }, 500);
  }
}

export async function DELETE(request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak valid." }, 403);
  try {
    return json({ authenticated: false }, 200, { "Set-Cookie": authService().sessionCookie("", 0) });
  } catch (error) {
    console.error("Team 1 authentication configuration failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Logout belum dapat diproses." }, 500);
  }
}
