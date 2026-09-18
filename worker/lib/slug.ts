// Unambiguous base58-like alphabet: no 0/O/1/l/I.
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

export type SlugLength = 4 | 6 | 8 | 10;

export function randomSlug(length: SlugLength = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

const CUSTOM_SLUG_RE = /^[A-Za-z0-9](?:[A-Za-z0-9\-_/]*[A-Za-z0-9])?$/;
const RESERVED_SLUGS = new Set(["api", "docs", "login", "setup", "assets", "favicon.ico", "robots.txt"]);

export function validateCustomSlug(slug: string): { ok: true } | { ok: false; error: string } {
  if (!slug || slug.length > 190) {
    return { ok: false, error: "Custom path must be between 1 and 190 characters." };
  }
  if (slug.includes("//") || slug.includes("..")) {
    return { ok: false, error: "Custom path cannot contain '//' or '..'." };
  }
  if (!CUSTOM_SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: "Custom path may only contain letters, numbers, '-', '_' and '/' (no leading/trailing slash).",
    };
  }
  if (RESERVED_SLUGS.has(slug.toLowerCase())) {
    return { ok: false, error: `"${slug}" is a reserved path.` };
  }
  return { ok: true };
}
