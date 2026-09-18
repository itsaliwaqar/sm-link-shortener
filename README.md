# Snip — multi-domain link shortener on Cloudflare Workers

A self-hosted link shortener built entirely on Cloudflare: **Workers** (API + redirects), **D1** (data), **KV**
(fast redirect cache) and **Workers Static Assets** (the dashboard UI). One Worker serves everything —
the React dashboard, the JSON API, and the short-link redirects themselves.

## Features

- **Multiple domains** — connect as many subdomains as you like and pick which one a link uses when you create it.
- **Custom slugs** — generate a random slug (choose the length) or set an exact custom path, including nested paths like `promo/summer`.
- **Folders with subfolders** — organize links into a nested folder tree.
- **Click analytics** — total *and* unique clicks per link, a daily chart, plus breakdowns by referrer, country, device and browser. "Unique" is a salted hash of IP + user agent, deduped per link forever — nothing personally identifiable is stored.
- **Full API** — everything you can do in the dashboard is available over a documented REST API, authenticated with a personal API key.
- **Built-in API docs** — a styled reference at `/docs` inside the app, with copyable `curl` examples.
- **Team accounts** — no public sign-up; admins create teammate accounts from the dashboard.

## Tech stack

- [Hono](https://hono.dev) for the Worker API and redirect handler
- [D1](https://developers.cloudflare.com/d1/) for links, domains, folders, users, clicks
- [Workers KV](https://developers.cloudflare.com/kv/) as a write-through cache in front of D1 for the redirect hot path
- React 18 + React Router + Tailwind CSS + Recharts for the dashboard, served via [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) and the [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)

## How domain routing works

The Worker inspects the `Host` header on every request:

- If the host matches your dashboard's own URL (`APP_URL`), or is a local/`workers.dev` preview host, it serves the React dashboard and `/api/*` routes.
- Any other host is treated as a short-link domain: the path is looked up as a slug and the visitor is redirected (302) to the destination, with a click recorded in the background.

This means you don't configure per-domain logic in code — you just point DNS + a Worker route at each hostname you want to use, then add it from the **Domains** page in the dashboard.

## 1. Prerequisites

- A Cloudflare account with at least one domain you can add DNS records and Workers routes for.
- Node.js 18+ and npm.
- `wrangler` (installed as a dev dependency — no global install needed). Run `npx wrangler login` once to authenticate.

## 2. Install and create resources

```bash
npm install

# Create the D1 database, then copy the returned database_id into wrangler.jsonc
npx wrangler d1 create sm-link-shortener-db

# Create the KV namespace, then copy the returned id into wrangler.jsonc
npx wrangler kv namespace create LINKS_KV
```

Open `wrangler.jsonc` and replace:

- `d1_databases[0].database_id` with the ID from `wrangler d1 create`
- `kv_namespaces[0].id` with the ID from `wrangler kv namespace create`
- `vars.APP_URL` with the URL your dashboard will live at (see step 5) — you can leave the placeholder for now and come back to it

## 3. Set secrets

Two secrets are required. Generate strong random values (e.g. `openssl rand -hex 32`):

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put VISITOR_HASH_SALT
```

- `AUTH_SECRET` signs dashboard session cookies.
- `VISITOR_HASH_SALT` salts the visitor fingerprint used for unique-click counting.

For local development, copy `.dev.vars.example` to `.dev.vars` and fill in any values (they don't need to match production).

## 4. Run migrations

```bash
npm run db:migrations:apply:local    # for `npm run dev`
npm run db:migrations:apply:remote   # for the deployed Worker, run once before first deploy
```

## 5. Connect your domains

You need at least one hostname for the **dashboard/API** and one or more hostnames for **short links**. They can
all be subdomains of the same zone.

1. In the Cloudflare dashboard, make sure the zone (e.g. `example.com`) is active on Cloudflare.
2. Add a DNS record for each hostname you want to use, proxied (orange cloud) — the target doesn't matter since the Worker intercepts the request before it reaches any origin. A simple `A` record pointing to `192.0.2.1`, proxied, works fine.
   - One record for your dashboard, e.g. `app.example.com`
   - One record per short-link domain, e.g. `go.example.com`, `promo.example.com`
3. Add Worker routes so those hostnames reach this Worker. Easiest via the CLI:
   ```bash
   npx wrangler deploy \
     --route "app.example.com/*" \
     --route "go.example.com/*" \
     --route "promo.example.com/*"
   ```
   Or add a single wildcard route for an entire zone's subdomains (`*.example.com/*`) if you'd rather not list each one — you can still keep specific ones for the same hostnames, wrangler dedupes correctly. Routes can also be added later from the Cloudflare dashboard under **Workers Routes**.
4. Set `vars.APP_URL` in `wrangler.jsonc` to `https://app.example.com` (your dashboard hostname) and redeploy.
5. Sign in to the dashboard and go to **Domains** → **Add domain** for each short-link hostname (`go.example.com`, `promo.example.com`, …). This is what makes them selectable when creating a link — the DNS/route setup above only makes the hostname reachable, the dashboard record is what activates it.

If you don't want a dedicated dashboard hostname, you can skip the `app.example.com` route entirely and just use
the Worker's own `https://sm-link-shortener.<your-subdomain>.workers.dev` URL as `APP_URL` — it works out of the box with no DNS setup.

## 6. Deploy

```bash
npm run deploy
```

On first visit to your dashboard URL, you'll be prompted to create the initial admin account (this only happens
once — there's no public sign-up after that). From **Team**, the admin can create accounts for anyone else who
needs access.

## Local development

```bash
npm run dev
```

This runs the Worker and dashboard together via the Cloudflare Vite plugin, against a local D1/KV simulation. To
exercise a short-link redirect locally, send a request with a spoofed `Host` header:

```bash
curl -H "Host: go.example.com" http://localhost:5173/your-slug
```

## Project structure

```
worker/            Hono API + redirect handler (the Worker)
  routes/           /api/* route handlers (auth, users, domains, folders, links, api-keys, stats)
  middleware/        session + API key auth
  lib/                crypto, slugs, KV cache, JWT session, user-agent parsing
  redirect.ts        host/slug lookup, click recording
  index.ts           entry point: routes /api/*, short-link hosts, and falls back to static assets

src/                React dashboard (Vite)
  pages/              Setup, Login, Overview, Links, Link detail, Domains, Team, API Keys, API Docs
  components/         Layout, folder tree, modals, charts, icons
  lib/                fetch client, auth context, toast notifications

migrations/         D1 schema
```

## API

Every dashboard action is available over the API — see the **API Docs** page inside the app (`/docs`) once
deployed, or read `worker/routes/*.ts` directly. In short: generate a key from **API Keys**, then send
`Authorization: Bearer sml_...` on requests to `/api/links`, `/api/domains`, `/api/folders`, etc.
