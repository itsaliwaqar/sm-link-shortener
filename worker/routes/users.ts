import { Hono } from "hono";
import type { AuthVars } from "../middleware/auth";
import { requireAdmin, requireAuth } from "../middleware/auth";
import type { Env, PublicUser, UserRow } from "../types";
import { hashPassword, newId } from "../lib/crypto";
import { fail, ok } from "../lib/http";

const users = new Hono<{ Bindings: Env; Variables: AuthVars }>();
users.use("*", requireAuth);

function toPublicUser(u: UserRow): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at };
}

users.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM users ORDER BY created_at ASC").all<UserRow>();
  return ok(c, (results ?? []).map(toPublicUser));
});

users.post("/", requireAdmin, async (c) => {
  const body = await c
    .req.json<{ email?: string; password?: string; name?: string; role?: string }>()
    .catch(() => ({}) as Record<string, never>);
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const name = body.name?.trim();
  const role = body.role === "admin" ? "admin" : "member";
  if (!email || !email.includes("@")) return fail(c, "A valid email is required.", 422);
  if (!name) return fail(c, "Name is required.", 422);
  if (password.length < 8) return fail(c, "Password must be at least 8 characters.", 422);

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return fail(c, "A user with that email already exists.", 409);

  const id = newId();
  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, email, passwordHash, name, role, Date.now())
    .run();

  return ok(c, { id, email, name, role, created_at: Date.now() }, 201);
});

users.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  if (id === c.get("authUserId")) return fail(c, "You cannot delete your own account.", 400);
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return ok(c, { success: true });
});

export default users;
