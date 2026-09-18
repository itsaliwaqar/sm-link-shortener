import { Hono } from "hono";
import type { AuthVars } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import type { Env } from "../types";
import { ok } from "../lib/http";

const stats = new Hono<{ Bindings: Env; Variables: AuthVars }>();
stats.use("*", requireAuth);

stats.get("/overview", async (c) => {
  const [links, domains, folders, clicksToday] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(total_clicks), 0) as total_clicks, COALESCE(SUM(unique_clicks), 0) as unique_clicks FROM links",
    ).first<{ count: number; total_clicks: number; unique_clicks: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM domains WHERE is_active = 1").first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM folders").first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM clicks WHERE ts >= ?")
      .bind(Date.now() - 24 * 60 * 60 * 1000)
      .first<{ count: number }>(),
  ]);

  const { results: recentLinks } = await c.env.DB.prepare(
    `SELECT links.*, domains.hostname as domain_hostname FROM links
     JOIN domains ON domains.id = links.domain_id
     ORDER BY links.created_at DESC LIMIT 6`,
  ).all();

  return ok(c, {
    total_links: links?.count ?? 0,
    total_clicks: links?.total_clicks ?? 0,
    total_unique_clicks: links?.unique_clicks ?? 0,
    total_domains: domains?.count ?? 0,
    total_folders: folders?.count ?? 0,
    clicks_last_24h: clicksToday?.count ?? 0,
    recent_links: recentLinks ?? [],
  });
});

export default stats;
