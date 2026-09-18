import type { Context } from "hono";

export function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json(data as any, status);
}

export function fail(c: Context, message: string, status: 400 | 401 | 403 | 404 | 409 | 422 | 500 = 400) {
  return c.json({ error: message }, status);
}
