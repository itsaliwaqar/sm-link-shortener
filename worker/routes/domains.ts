import { Hono } from "hono";
import type { AuthVars } from "../middleware/auth";
import { requireAdmin, requireAuth } from "../middleware/auth";
import type { DomainRow, Env } from "../types";
import { newId } from "../lib/crypto";
import { fail, ok } from "../lib/http";
import { setDomainConfigured } from "../lib/cache";

const domains = new Hono<{ Bindings: Env; Variables: AuthVars }>();
domains.use("*", requireAuth);

const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

domains.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM domains ORDER BY created_at ASC").all<DomainRow>();
  return ok(c, results ?? []);
});

domains.post("/", requireAdmin, async (c) => {
  const body = await c.req.json<{ hostname?: string; label?: string }>().catch(() => ({}) as Record<string, never>);
  const hostname = body.hostname?.trim().toLowerCase();
  if (!hostname || !HOSTNAME_RE.test(hostname)) {
    return fail(c, "Enter a valid domain or subdomain, e.g. go.example.com.", 422);
  }
  if (hostname === new URL(c.env.APP_URL).hostname) {
    return fail(c, "This hostname is already used by the dashboard app.", 422);
  }

  const existing = await c.env.DB.prepare("SELECT id FROM domains WHERE hostname = ?").bind(hostname).first();
  if (existing) return fail(c, "That domain has already been added.", 409);

  const id = newId();
  const countRow = await c.env.DB.prepare("SELECT COUNT(*) as n FROM domains").first<{ n: number }>();
  const isDefault = (countRow?.n ?? 0) === 0 ? 1 : 0;

  await c.env.DB.prepare(
    "INSERT INTO domains (id, hostname, label, is_active, is_default, created_by, created_at) VALUES (?, ?, ?, 1, ?, ?, ?)",
  )
    .bind(id, hostname, body.label?.trim() || null, isDefault, c.get("authUserId"), Date.now())
    .run();

  await setDomainConfigured(c.env, hostname, true);

  return ok(c, { id, hostname, label: body.label ?? null, is_active: 1, is_default: isDefault }, 201);
});

domains.patch("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const domain = await c.env.DB.prepare("SELECT * FROM domains WHERE id = ?").bind(id).first<DomainRow>();
  if (!domain) return fail(c, "Domain not found.", 404);

  const body = await c.req.json<{ label?: string; is_active?: boolean; is_default?: boolean }>().catch(() => ({}) as Record<string, never>);

  const label = body.label !== undefined ? body.label?.trim() || null : domain.label;
  const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : domain.is_active;

  await c.env.DB.prepare("UPDATE domains SET label = ?, is_active = ? WHERE id = ?")
    .bind(label, isActive, id)
    .run();

  if (body.is_default) {
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE domains SET is_default = 0"),
      c.env.DB.prepare("UPDATE domains SET is_default = 1 WHERE id = ?").bind(id),
    ]);
  }

  await setDomainConfigured(c.env, domain.hostname, isActive === 1);

  return ok(c, { success: true });
});

domains.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const domain = await c.env.DB.prepare("SELECT * FROM domains WHERE id = ?").bind(id).first<DomainRow>();
  if (!domain) return fail(c, "Domain not found.", 404);

  const linkCount = await c.env.DB.prepare("SELECT COUNT(*) as n FROM links WHERE domain_id = ?")
    .bind(id)
    .first<{ n: number }>();
  if ((linkCount?.n ?? 0) > 0) {
    return fail(c, "Delete or move the links on this domain before removing it.", 409);
  }

  await c.env.DB.prepare("DELETE FROM domains WHERE id = ?").bind(id).run();
  await setDomainConfigured(c.env, domain.hostname, false);

  return ok(c, { success: true });
});

export default domains;
