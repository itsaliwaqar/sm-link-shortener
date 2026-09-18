import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { AuthVars } from "../middleware/auth";
import { SESSION_COOKIE, requireAuth } from "../middleware/auth";
import type { Env, PublicUser, UserRow } from "../types";
import { hashPassword, newId, verifyPassword } from "../lib/crypto";
import { signSession } from "../lib/jwt";
import { fail, ok } from "../lib/http";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const auth = new Hono<{ Bindings: Env; Variables: AuthVars }>();

function toPublicUser(u: UserRow): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at };
}

async function setSessionCookie(c: any, userId: string, role: string) {
  const token = await signSession({ sub: userId, role }, c.env.AUTH_SECRET, SESSION_TTL_SECONDS);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

// Whether any user exists yet — drives the one-time bootstrap screen.
auth.get("/status", async (c) => {
  const row = await c.env.DB.prepare("SELECT COUNT(*) as n FROM users").first<{ n: number }>();
  return ok(c, { needsSetup: (row?.n ?? 0) === 0 });
});

auth.post("/setup", async (c) => {
  const existing = await c.env.DB.prepare("SELECT COUNT(*) as n FROM users").first<{ n: number }>();
  if ((existing?.n ?? 0) > 0) {
    return fail(c, "Setup has already been completed.", 409);
  }
  const body = await c.req.json<{ email?: string; password?: string; name?: string }>().catch(() => ({}) as Record<string, never>);
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const name = body.name?.trim();
  if (!email || !email.includes("@")) return fail(c, "A valid email is required.", 422);
  if (!name) return fail(c, "Name is required.", 422);
  if (password.length < 8) return fail(c, "Password must be at least 8 characters.", 422);

  const id = newId();
  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)",
  )
    .bind(id, email, passwordHash, name, Date.now())
    .run();

  await setSessionCookie(c, id, "admin");
  return ok(c, { id, email, name, role: "admin" }, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}) as Record<string, never>);
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) return fail(c, "Email and password are required.", 422);

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
  if (!user) return fail(c, "Invalid email or password.", 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return fail(c, "Invalid email or password.", 401);

  await setSessionCookie(c, user.id, user.role);
  return ok(c, toPublicUser(user));
});

auth.post("/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return ok(c, { success: true });
});

auth.get("/me", requireAuth, async (c) => {
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(c.get("authUserId"))
    .first<UserRow>();
  if (!user) return fail(c, "User not found.", 404);
  return ok(c, toPublicUser(user));
});

export default auth;
