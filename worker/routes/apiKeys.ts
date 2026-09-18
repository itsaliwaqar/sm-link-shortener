import { Hono } from "hono";
import type { AuthVars } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import type { ApiKeyRow, Env } from "../types";
import { generateApiKey, newId } from "../lib/crypto";
import { fail, ok } from "../lib/http";

const apiKeys = new Hono<{ Bindings: Env; Variables: AuthVars }>();
apiKeys.use("*", requireAuth);

function toPublic(row: ApiKeyRow) {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
  };
}

apiKeys.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
  )
    .bind(c.get("authUserId"))
    .all<ApiKeyRow>();
  return ok(c, (results ?? []).map(toPublic));
});

apiKeys.post("/", async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}) as Record<string, never>);
  const name = body.name?.trim() || "API key";

  const { raw, prefix, hash } = await generateApiKey();
  const id = newId();
  const createdAt = Date.now();

  await c.env.DB.prepare(
    "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, c.get("authUserId"), name, hash, prefix, createdAt)
    .run();

  // The raw key is only ever returned here — it cannot be recovered afterwards.
  return ok(c, { id, name, key: raw, key_prefix: prefix, created_at: createdAt }, 201);
});

apiKeys.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?")
    .bind(id, c.get("authUserId"))
    .run();
  return ok(c, { success: true });
});

export default apiKeys;
