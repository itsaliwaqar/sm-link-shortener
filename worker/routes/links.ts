import { Hono } from "hono";
import type { AuthVars } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import type { DomainRow, Env, LinkRow } from "../types";
import { newId } from "../lib/crypto";
import { fail, ok } from "../lib/http";
import { randomSlug, validateCustomSlug, type SlugLength } from "../lib/slug";
import { deleteCachedLink, setCachedLink } from "../lib/cache";

const links = new Hono<{ Bindings: Env; Variables: AuthVars }>();
links.use("*", requireAuth);

const VALID_SLUG_LENGTHS: SlugLength[] = [4, 6, 8, 10];

function normalizeDestination(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function attachLinkToCache(env: Env, hostname: string, link: LinkRow) {
  await setCachedLink(env, hostname, link.slug, {
    linkId: link.id,
    destinationUrl: link.destination_url,
    isActive: link.is_active === 1,
  });
}

links.get("/", async (c) => {
  const url = new URL(c.req.url);
  const folderId = url.searchParams.get("folder_id");
  const domainId = url.searchParams.get("domain_id");
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 25, 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (folderId === "root") {
    clauses.push("links.folder_id IS NULL");
  } else if (folderId) {
    clauses.push("links.folder_id = ?");
    params.push(folderId);
  }
  if (domainId) {
    clauses.push("links.domain_id = ?");
    params.push(domainId);
  }
  if (q) {
    clauses.push("(links.destination_url LIKE ? OR links.slug LIKE ? OR links.title LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM links ${where}`)
    .bind(...params)
    .first<{ n: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT links.*, domains.hostname as domain_hostname FROM links
     JOIN domains ON domains.id = links.domain_id
     ${where}
     ORDER BY links.created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...params, limit, offset)
    .all();

  return ok(c, { items: results ?? [], total: countRow?.n ?? 0, limit, offset });
});

links.post("/", async (c) => {
  const body = await c
    .req.json<{
      domain_id?: string;
      destination_url?: string;
      slug_type?: "random" | "custom";
      slug_length?: number;
      custom_slug?: string;
      folder_id?: string | null;
      title?: string | null;
    }>()
    .catch(() => ({}) as Record<string, never>);

  const destination = body.destination_url ? normalizeDestination(body.destination_url) : null;
  if (!destination) return fail(c, "Enter a valid destination URL (including https://).", 422);

  if (!body.domain_id) return fail(c, "Select a domain for this link.", 422);
  const domain = await c.env.DB.prepare("SELECT * FROM domains WHERE id = ? AND is_active = 1")
    .bind(body.domain_id)
    .first<DomainRow>();
  if (!domain) return fail(c, "Selected domain was not found or is inactive.", 404);

  if (body.folder_id) {
    const folder = await c.env.DB.prepare("SELECT id FROM folders WHERE id = ?").bind(body.folder_id).first();
    if (!folder) return fail(c, "Selected folder was not found.", 404);
  }

  const slugType = body.slug_type === "custom" ? "custom" : "random";
  let slug: string;

  if (slugType === "custom") {
    const custom = body.custom_slug?.trim().replace(/^\/+/, "").replace(/\/+$/, "") ?? "";
    const validation = validateCustomSlug(custom);
    if (!validation.ok) return fail(c, validation.error, 422);
    slug = custom;

    const existing = await c.env.DB.prepare("SELECT id FROM links WHERE domain_id = ? AND slug = ?")
      .bind(domain.id, slug)
      .first();
    if (existing) return fail(c, "That custom path is already taken on this domain.", 409);
  } else {
    const length = VALID_SLUG_LENGTHS.includes(body.slug_length as SlugLength)
      ? (body.slug_length as SlugLength)
      : 6;
    let attempt = 0;
    let candidate = randomSlug(length);
    while (attempt < 8) {
      const existing = await c.env.DB.prepare("SELECT id FROM links WHERE domain_id = ? AND slug = ?")
        .bind(domain.id, candidate)
        .first();
      if (!existing) break;
      candidate = randomSlug(length);
      attempt++;
    }
    slug = candidate;
  }

  const id = newId();
  const now = Date.now();
  const link: LinkRow = {
    id,
    domain_id: domain.id,
    slug,
    destination_url: destination,
    folder_id: body.folder_id || null,
    title: body.title?.trim() || null,
    slug_type: slugType,
    created_by: c.get("authUserId"),
    total_clicks: 0,
    unique_clicks: 0,
    is_active: 1,
    created_at: now,
    updated_at: now,
  };

  await c.env.DB.prepare(
    `INSERT INTO links
      (id, domain_id, slug, destination_url, folder_id, title, slug_type, created_by, total_clicks, unique_clicks, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`,
  )
    .bind(id, domain.id, slug, destination, link.folder_id, link.title, slugType, link.created_by, now, now)
    .run();

  await attachLinkToCache(c.env, domain.hostname, link);

  return ok(c, { ...link, domain_hostname: domain.hostname, short_url: `https://${domain.hostname}/${slug}` }, 201);
});

async function loadLinkWithDomain(env: Env, id: string) {
  return env.DB.prepare(
    `SELECT links.*, domains.hostname as domain_hostname FROM links
     JOIN domains ON domains.id = links.domain_id
     WHERE links.id = ?`,
  )
    .bind(id)
    .first<LinkRow & { domain_hostname: string }>();
}

links.get("/:id", async (c) => {
  const link = await loadLinkWithDomain(c.env, c.req.param("id"));
  if (!link) return fail(c, "Link not found.", 404);
  return ok(c, { ...link, short_url: `https://${link.domain_hostname}/${link.slug}` });
});

links.patch("/:id", async (c) => {
  const link = await loadLinkWithDomain(c.env, c.req.param("id"));
  if (!link) return fail(c, "Link not found.", 404);

  const body = await c
    .req.json<{
      destination_url?: string;
      folder_id?: string | null;
      title?: string | null;
      is_active?: boolean;
    }>()
    .catch(() => ({}) as Record<string, never>);

  let destination = link.destination_url;
  if (body.destination_url !== undefined) {
    const normalized = normalizeDestination(body.destination_url);
    if (!normalized) return fail(c, "Enter a valid destination URL (including https://).", 422);
    destination = normalized;
  }

  if (body.folder_id) {
    const folder = await c.env.DB.prepare("SELECT id FROM folders WHERE id = ?").bind(body.folder_id).first();
    if (!folder) return fail(c, "Selected folder was not found.", 404);
  }

  const folderId = body.folder_id !== undefined ? body.folder_id : link.folder_id;
  const title = body.title !== undefined ? body.title?.trim() || null : link.title;
  const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : link.is_active;

  await c.env.DB.prepare(
    "UPDATE links SET destination_url = ?, folder_id = ?, title = ?, is_active = ?, updated_at = ? WHERE id = ?",
  )
    .bind(destination, folderId, title, isActive, Date.now(), link.id)
    .run();

  await attachLinkToCache(c.env, link.domain_hostname, {
    ...link,
    destination_url: destination,
    folder_id: folderId,
    title,
    is_active: isActive,
  });

  return ok(c, { success: true });
});

links.delete("/:id", async (c) => {
  const link = await loadLinkWithDomain(c.env, c.req.param("id"));
  if (!link) return fail(c, "Link not found.", 404);

  await c.env.DB.prepare("DELETE FROM links WHERE id = ?").bind(link.id).run();
  await deleteCachedLink(c.env, link.domain_hostname, link.slug);

  return ok(c, { success: true });
});

const RANGE_TO_DAYS: Record<string, number | null> = { "7d": 7, "30d": 30, "90d": 90, all: null };

links.get("/:id/analytics", async (c) => {
  const link = await loadLinkWithDomain(c.env, c.req.param("id"));
  if (!link) return fail(c, "Link not found.", 404);

  const range = new URL(c.req.url).searchParams.get("range") ?? "30d";
  const days = RANGE_TO_DAYS[range] ?? 30;
  const sinceMs = days ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;

  const [timeseries, referrers, countries, devices, browsers] = await Promise.all([
    c.env.DB.prepare(
      `SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') as day,
              COUNT(*) as total,
              SUM(is_unique) as unique_count
       FROM clicks WHERE link_id = ? AND ts >= ?
       GROUP BY day ORDER BY day ASC`,
    )
      .bind(link.id, sinceMs)
      .all(),
    c.env.DB.prepare(
      `SELECT COALESCE(referrer_host, 'Direct') as key, COUNT(*) as count FROM clicks
       WHERE link_id = ? AND ts >= ? GROUP BY key ORDER BY count DESC LIMIT 8`,
    )
      .bind(link.id, sinceMs)
      .all(),
    c.env.DB.prepare(
      `SELECT COALESCE(country, 'Unknown') as key, COUNT(*) as count FROM clicks
       WHERE link_id = ? AND ts >= ? GROUP BY key ORDER BY count DESC LIMIT 8`,
    )
      .bind(link.id, sinceMs)
      .all(),
    c.env.DB.prepare(
      `SELECT device as key, COUNT(*) as count FROM clicks
       WHERE link_id = ? AND ts >= ? GROUP BY key ORDER BY count DESC`,
    )
      .bind(link.id, sinceMs)
      .all(),
    c.env.DB.prepare(
      `SELECT browser as key, COUNT(*) as count FROM clicks
       WHERE link_id = ? AND ts >= ? GROUP BY key ORDER BY count DESC LIMIT 8`,
    )
      .bind(link.id, sinceMs)
      .all(),
  ]);

  return ok(c, {
    total_clicks: link.total_clicks,
    unique_clicks: link.unique_clicks,
    range,
    timeseries: timeseries.results ?? [],
    top_referrers: referrers.results ?? [],
    top_countries: countries.results ?? [],
    top_devices: devices.results ?? [],
    top_browsers: browsers.results ?? [],
  });
});

export default links;
