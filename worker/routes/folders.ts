import { Hono } from "hono";
import type { AuthVars } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import type { Env, FolderRow } from "../types";
import { newId } from "../lib/crypto";
import { fail, ok } from "../lib/http";

const folders = new Hono<{ Bindings: Env; Variables: AuthVars }>();
folders.use("*", requireAuth);

folders.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM folders ORDER BY name ASC").all<FolderRow>();
  return ok(c, results ?? []);
});

folders.post("/", async (c) => {
  const body = await c.req.json<{ name?: string; parent_id?: string | null }>().catch(() => ({}) as Record<string, never>);
  const name = body.name?.trim();
  if (!name) return fail(c, "Folder name is required.", 422);

  if (body.parent_id) {
    const parent = await c.env.DB.prepare("SELECT id FROM folders WHERE id = ?").bind(body.parent_id).first();
    if (!parent) return fail(c, "Parent folder not found.", 404);
  }

  const id = newId();
  await c.env.DB.prepare(
    "INSERT INTO folders (id, name, parent_id, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, name, body.parent_id || null, c.get("authUserId"), Date.now())
    .run();

  return ok(c, { id, name, parent_id: body.parent_id ?? null }, 201);
});

folders.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const folder = await c.env.DB.prepare("SELECT * FROM folders WHERE id = ?").bind(id).first<FolderRow>();
  if (!folder) return fail(c, "Folder not found.", 404);

  const body = await c.req.json<{ name?: string; parent_id?: string | null }>().catch(() => ({}) as Record<string, never>);

  if (body.parent_id !== undefined && body.parent_id === id) {
    return fail(c, "A folder cannot be its own parent.", 422);
  }

  const name = body.name?.trim() || folder.name;
  const parentId = body.parent_id !== undefined ? body.parent_id : folder.parent_id;

  await c.env.DB.prepare("UPDATE folders SET name = ?, parent_id = ? WHERE id = ?")
    .bind(name, parentId, id)
    .run();

  return ok(c, { success: true });
});

folders.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(id).run();
  return ok(c, { success: true });
});

export default folders;
