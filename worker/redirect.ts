import type { CachedLink, Env, LinkRow } from "./types";
import { getCachedLink, setCachedLink } from "./lib/cache";
import { visitorHash } from "./lib/crypto";
import { parseUserAgent, refererHost } from "./lib/ua";

interface CfProps {
  country?: string;
}

function notFoundPage(hostname: string): Response {
  return new Response(renderMessagePage("Link not found", "This short link doesn't exist or has been removed."), {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function disabledPage(): Response {
  return new Response(renderMessagePage("Link disabled", "This short link has been turned off by its owner."), {
    status: 410,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function renderMessagePage(title: string, message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b0f19; color: #e6e9f0;
    display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
  .card { text-align: center; max-width: 28rem; padding: 2.5rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
  p { color: #9aa3b5; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

async function recordClick(
  env: Env,
  linkId: string,
  request: Request,
): Promise<void> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  const ua = request.headers.get("User-Agent");
  const referer = request.headers.get("Referer");
  const cf = (request as unknown as { cf?: CfProps }).cf;

  const hash = await visitorHash(ip, ua ?? "", env.VISITOR_HASH_SALT);
  const visitResult = await env.DB.prepare(
    "INSERT OR IGNORE INTO link_visitors (link_id, visitor_hash, first_seen_at) VALUES (?, ?, ?)",
  )
    .bind(linkId, hash, Date.now())
    .run();
  const isUnique = (visitResult.meta.changes ?? 0) > 0;

  const { device, browser, os } = parseUserAgent(ua);
  const clickId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO clicks (id, link_id, ts, is_unique, country, referrer, referrer_host, device, browser, os)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      clickId,
      linkId,
      Date.now(),
      isUnique ? 1 : 0,
      cf?.country ?? null,
      referer,
      refererHost(referer),
      device,
      browser,
      os,
    ),
    env.DB.prepare(
      `UPDATE links SET total_clicks = total_clicks + 1, unique_clicks = unique_clicks + ? WHERE id = ?`,
    ).bind(isUnique ? 1 : 0, linkId),
  ]);
}

export async function handleRedirect(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
): Promise<Response> {
  if (url.pathname === "/" || url.pathname === "") {
    return Response.redirect(env.APP_URL, 302);
  }

  const slug = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const hostname = url.hostname;

  let cached: CachedLink | null = await getCachedLink(env, hostname, slug);

  if (!cached) {
    const row = await env.DB.prepare(
      `SELECT links.* FROM links
       JOIN domains ON domains.id = links.domain_id
       WHERE domains.hostname = ? AND domains.is_active = 1 AND links.slug = ?`,
    )
      .bind(hostname, slug)
      .first<LinkRow>();

    if (!row) return notFoundPage(hostname);

    cached = { linkId: row.id, destinationUrl: row.destination_url, isActive: row.is_active === 1 };
    ctx.waitUntil(setCachedLink(env, hostname, slug, cached));
  }

  if (!cached.isActive) return disabledPage();

  ctx.waitUntil(recordClick(env, cached.linkId, request));

  return Response.redirect(cached.destinationUrl, 302);
}
