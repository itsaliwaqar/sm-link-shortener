import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { ApiKeyRow, Env, UserRole } from "../types";
import { verifySession } from "../lib/jwt";
import { sha256Hex } from "../lib/crypto";
import { fail } from "../lib/http";

export const SESSION_COOKIE = "sml_session";

export interface AuthVars {
  authUserId: string;
  authRole: UserRole;
  authMethod: "session" | "apikey";
}

/**
 * Accepts either the dashboard session cookie or an `Authorization: Bearer sml_...`
 * API key, so the same route handlers serve both the UI and the public API.
 */
export async function requireAuth(c: Context<{ Bindings: Env; Variables: AuthVars }>, next: Next) {
  const cookieToken = getCookie(c, SESSION_COOKIE);
  if (cookieToken) {
    const payload = await verifySession(cookieToken, c.env.AUTH_SECRET);
    if (payload) {
      c.set("authUserId", payload.sub);
      c.set("authRole", payload.role as UserRole);
      c.set("authMethod", "session");
      return next();
    }
  }

  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const raw = authHeader.slice("Bearer ".length).trim();
    if (raw.startsWith("sml_")) {
      const hash = await sha256Hex(raw);
      const row = await c.env.DB.prepare(
        `SELECT api_keys.*, users.role as user_role FROM api_keys
         JOIN users ON users.id = api_keys.user_id
         WHERE api_keys.key_hash = ?`,
      )
        .bind(hash)
        .first<ApiKeyRow & { user_role: UserRole }>();
      if (row) {
        c.set("authUserId", row.user_id);
        c.set("authRole", row.user_role);
        c.set("authMethod", "apikey");
        c.executionCtx.waitUntil(
          c.env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
            .bind(Date.now(), row.id)
            .run(),
        );
        return next();
      }
    }
  }

  return fail(c, "Authentication required.", 401);
}

export async function requireAdmin(c: Context<{ Bindings: Env; Variables: AuthVars }>, next: Next) {
  if (c.get("authRole") !== "admin") {
    return fail(c, "Admin access required.", 403);
  }
  return next();
}
