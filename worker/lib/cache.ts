import type { CachedLink, Env } from "../types";

function linkCacheKey(hostname: string, slug: string): string {
  return `link:${hostname.toLowerCase()}:${slug}`;
}

function domainCacheKey(hostname: string): string {
  return `domain:${hostname.toLowerCase()}`;
}

export async function getCachedLink(env: Env, hostname: string, slug: string): Promise<CachedLink | null> {
  const raw = await env.LINKS_KV.get(linkCacheKey(hostname, slug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedLink;
  } catch {
    return null;
  }
}

export async function setCachedLink(
  env: Env,
  hostname: string,
  slug: string,
  data: CachedLink,
): Promise<void> {
  await env.LINKS_KV.put(linkCacheKey(hostname, slug), JSON.stringify(data));
}

export async function deleteCachedLink(env: Env, hostname: string, slug: string): Promise<void> {
  await env.LINKS_KV.delete(linkCacheKey(hostname, slug));
}

export async function setDomainConfigured(env: Env, hostname: string, active: boolean): Promise<void> {
  if (active) {
    await env.LINKS_KV.put(domainCacheKey(hostname), "1");
  } else {
    await env.LINKS_KV.delete(domainCacheKey(hostname));
  }
}

export async function isDomainConfigured(env: Env, hostname: string): Promise<boolean> {
  const v = await env.LINKS_KV.get(domainCacheKey(hostname));
  return v === "1";
}
