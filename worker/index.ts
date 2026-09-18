import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import type { AuthVars } from "./middleware/auth";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import domainRoutes from "./routes/domains";
import folderRoutes from "./routes/folders";
import linkRoutes from "./routes/links";
import apiKeyRoutes from "./routes/apiKeys";
import statsRoutes from "./routes/stats";
import { handleRedirect } from "./redirect";

const api = new Hono<{ Bindings: Env; Variables: AuthVars }>();

api.use(
  "*",
  cors({
    origin: (origin, c) => origin ?? c.env.APP_URL,
    credentials: true,
  }),
);

api.route("/auth", authRoutes);
api.route("/users", userRoutes);
api.route("/domains", domainRoutes);
api.route("/folders", folderRoutes);
api.route("/links", linkRoutes);
api.route("/api-keys", apiKeyRoutes);
api.route("/stats", statsRoutes);

api.notFound((c) => c.json({ error: "Not found." }, 404));

function isAppHost(hostname: string, appUrl: string): boolean {
  const appHostname = new URL(appUrl).hostname;
  return (
    hostname === appHostname ||
    hostname === "localhost" ||
    hostname.startsWith("127.0.0.1") ||
    hostname.endsWith(".workers.dev") ||
    hostname.endsWith(".local")
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const sub = new URL(request.url);
      sub.pathname = sub.pathname.replace(/^\/api/, "") || "/";
      const rewritten = new Request(sub.toString(), request);
      return api.fetch(rewritten, env, ctx);
    }

    if (!isAppHost(url.hostname, env.APP_URL) && (request.method === "GET" || request.method === "HEAD")) {
      return handleRedirect(request, env, ctx, url);
    }

    return env.ASSETS.fetch(request);
  },
};
