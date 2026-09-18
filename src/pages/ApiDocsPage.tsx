import { useEffect, useState } from "react";
import CodeBlock from "../components/CodeBlock";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-sky-50 text-sky-700",
  POST: "bg-emerald-50 text-emerald-700",
  PATCH: "bg-amber-50 text-amber-700",
  DELETE: "bg-red-50 text-red-700",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`badge font-mono font-semibold ${METHOD_COLORS[method]}`}>{method}</span>
  );
}

interface Endpoint {
  id: string;
  method: keyof typeof METHOD_COLORS;
  path: string;
  summary: string;
  description?: string;
  params?: { name: string; type: string; required?: boolean; description: string }[];
  body?: { name: string; type: string; required?: boolean; description: string }[];
  curl: (base: string) => string;
  response: string;
}

const SECTIONS: { title: string; endpoints: Endpoint[] }[] = [
  {
    title: "Links",
    endpoints: [
      {
        id: "list-links",
        method: "GET",
        path: "/api/links",
        summary: "List links",
        description: "Returns links, newest first. Filter by folder, domain, or search text.",
        params: [
          { name: "folder_id", type: "string", description: "Filter to a folder ID, or \"root\" for links with no folder." },
          { name: "domain_id", type: "string", description: "Filter to links on a specific domain." },
          { name: "q", type: "string", description: "Search destination URL, slug and title." },
          { name: "limit", type: "number", description: "Page size, 1–100 (default 25)." },
          { name: "offset", type: "number", description: "Pagination offset (default 0)." },
        ],
        curl: (base) => `curl "${base}/api/links?limit=10" \\\n  -H "Authorization: Bearer sml_your_api_key"`,
        response: `{
  "items": [
    {
      "id": "b6f0...",
      "domain_hostname": "go.example.com",
      "slug": "summer-sale",
      "destination_url": "https://example.com/promo",
      "folder_id": null,
      "title": "Summer campaign",
      "total_clicks": 128,
      "unique_clicks": 97,
      "is_active": 1,
      "created_at": 1737000000000
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}`,
      },
      {
        id: "create-link",
        method: "POST",
        path: "/api/links",
        summary: "Create a link",
        description: "Creates a short link on one of your connected domains. Choose a random slug or provide a custom path.",
        body: [
          { name: "destination_url", type: "string", required: true, description: "The URL to redirect to (must include http:// or https://)." },
          { name: "domain_id", type: "string", required: true, description: "ID of an active domain — see GET /api/domains." },
          { name: "slug_type", type: "\"random\" | \"custom\"", description: "Defaults to \"random\"." },
          { name: "slug_length", type: "4 | 6 | 8 | 10", description: "Length for a random slug (default 6)." },
          { name: "custom_slug", type: "string", description: "Required when slug_type is \"custom\". Letters, numbers, - _ and / (for nested paths)." },
          { name: "folder_id", type: "string", description: "Folder to file this link under." },
          { name: "title", type: "string", description: "Optional label shown in the dashboard." },
        ],
        curl: (base) =>
          `curl -X POST "${base}/api/links" \\\n  -H "Authorization: Bearer sml_your_api_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "destination_url": "https://example.com/promo",\n    "domain_id": "dom_123",\n    "slug_type": "custom",\n    "custom_slug": "summer-sale"\n  }'`,
        response: `{
  "id": "b6f0...",
  "domain_hostname": "go.example.com",
  "slug": "summer-sale",
  "destination_url": "https://example.com/promo",
  "short_url": "https://go.example.com/summer-sale",
  "slug_type": "custom",
  "total_clicks": 0,
  "unique_clicks": 0,
  "is_active": 1
}`,
      },
      {
        id: "get-link",
        method: "GET",
        path: "/api/links/:id",
        summary: "Get a link",
        curl: (base) => `curl "${base}/api/links/b6f0..." \\\n  -H "Authorization: Bearer sml_your_api_key"`,
        response: `{
  "id": "b6f0...",
  "domain_hostname": "go.example.com",
  "slug": "summer-sale",
  "destination_url": "https://example.com/promo",
  "short_url": "https://go.example.com/summer-sale",
  "total_clicks": 128,
  "unique_clicks": 97
}`,
      },
      {
        id: "update-link",
        method: "PATCH",
        path: "/api/links/:id",
        summary: "Update a link",
        description: "Change the destination, move it to a folder, rename it, or enable/disable it. The slug and domain cannot be changed after creation.",
        body: [
          { name: "destination_url", type: "string", description: "New destination URL." },
          { name: "folder_id", type: "string | null", description: "Move to a different folder, or null to remove from folder." },
          { name: "title", type: "string | null", description: "New label." },
          { name: "is_active", type: "boolean", description: "Set false to disable the redirect (returns HTTP 410)." },
        ],
        curl: (base) =>
          `curl -X PATCH "${base}/api/links/b6f0..." \\\n  -H "Authorization: Bearer sml_your_api_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "is_active": false }'`,
        response: `{ "success": true }`,
      },
      {
        id: "delete-link",
        method: "DELETE",
        path: "/api/links/:id",
        summary: "Delete a link",
        curl: (base) => `curl -X DELETE "${base}/api/links/b6f0..." \\\n  -H "Authorization: Bearer sml_your_api_key"`,
        response: `{ "success": true }`,
      },
      {
        id: "link-analytics",
        method: "GET",
        path: "/api/links/:id/analytics",
        summary: "Get click analytics",
        description: "Total and unique clicks, a daily time series, and breakdowns by referrer, country, device and browser.",
        params: [{ name: "range", type: "7d | 30d | 90d | all", description: "Defaults to 30d." }],
        curl: (base) =>
          `curl "${base}/api/links/b6f0.../analytics?range=30d" \\\n  -H "Authorization: Bearer sml_your_api_key"`,
        response: `{
  "total_clicks": 128,
  "unique_clicks": 97,
  "timeseries": [
    { "day": "2026-09-01", "total": 12, "unique_count": 9 }
  ],
  "top_referrers": [{ "key": "twitter.com", "count": 40 }],
  "top_countries": [{ "key": "US", "count": 63 }],
  "top_devices": [{ "key": "mobile", "count": 71 }],
  "top_browsers": [{ "key": "Chrome", "count": 58 }]
}`,
      },
    ],
  },
  {
    title: "Domains",
    endpoints: [
      {
        id: "list-domains",
        method: "GET",
        path: "/api/domains",
        summary: "List connected domains",
        description: "Use the returned IDs as domain_id when creating links.",
        curl: (base) => `curl "${base}/api/domains" \\\n  -H "Authorization: Bearer sml_your_api_key"`,
        response: `[
  { "id": "dom_123", "hostname": "go.example.com", "is_active": 1, "is_default": 1 }
]`,
      },
      {
        id: "create-domain",
        method: "POST",
        path: "/api/domains",
        summary: "Connect a domain",
        description: "Admin only. The hostname must also be added to Cloudflare — see the README's domain setup guide.",
        body: [
          { name: "hostname", type: "string", required: true, description: "e.g. go.example.com" },
          { name: "label", type: "string", description: "Optional display name." },
        ],
        curl: (base) =>
          `curl -X POST "${base}/api/domains" \\\n  -H "Authorization: Bearer sml_your_api_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "hostname": "go.example.com" }'`,
        response: `{ "id": "dom_123", "hostname": "go.example.com", "is_active": 1 }`,
      },
    ],
  },
  {
    title: "Folders",
    endpoints: [
      {
        id: "list-folders",
        method: "GET",
        path: "/api/folders",
        summary: "List folders",
        description: "Returns a flat list; each folder has a parent_id to reconstruct the nested tree.",
        curl: (base) => `curl "${base}/api/folders" \\\n  -H "Authorization: Bearer sml_your_api_key"`,
        response: `[
  { "id": "fld_1", "name": "Campaigns", "parent_id": null },
  { "id": "fld_2", "name": "Q4", "parent_id": "fld_1" }
]`,
      },
      {
        id: "create-folder",
        method: "POST",
        path: "/api/folders",
        summary: "Create a folder",
        body: [
          { name: "name", type: "string", required: true, description: "Folder name." },
          { name: "parent_id", type: "string", description: "Nest this folder inside another one." },
        ],
        curl: (base) =>
          `curl -X POST "${base}/api/folders" \\\n  -H "Authorization: Bearer sml_your_api_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "name": "Campaigns" }'`,
        response: `{ "id": "fld_1", "name": "Campaigns", "parent_id": null }`,
      },
    ],
  },
];

export default function ApiDocsPage() {
  const [base, setBase] = useState("https://app.yourdomain.com");

  useEffect(() => {
    setBase(window.location.origin);
  }, []);

  return (
    <div className="grid grid-cols-[200px_1fr] gap-10">
      <aside className="sticky top-8 hidden self-start md:block">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">On this page</p>
        <nav className="space-y-4 text-sm">
          <a href="#getting-started" className="block font-medium text-slate-600 hover:text-brand-600">
            Getting started
          </a>
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <p className="font-medium text-slate-800">{s.title}</p>
              <div className="mt-1 space-y-1 border-l border-slate-200 pl-3">
                {s.endpoints.map((e) => (
                  <a key={e.id} href={`#${e.id}`} className="block text-slate-500 hover:text-brand-600">
                    {e.summary}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900">API Reference</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create and manage short links programmatically. Every endpoint below also works with your dashboard
          session, so you can try requests straight from the browser console while signed in.
        </p>

        <section id="getting-started" className="mt-8">
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Getting started</h2>
          <p className="mb-3 text-sm text-slate-600">
            Generate a key from{" "}
            <a href="/api-keys" className="font-medium text-brand-600">
              API Keys
            </a>
            , then send it as a bearer token on every request.
          </p>
          <CodeBlock code={`Authorization: Bearer sml_your_api_key`} lang="header" />
          <p className="mb-2 mt-4 text-sm text-slate-600">Base URL for this deployment:</p>
          <CodeBlock code={base} lang="url" />
        </section>

        {SECTIONS.map((section) => (
          <section key={section.title} className="mt-10">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{section.title}</h2>
            <div className="space-y-8">
              {section.endpoints.map((e) => (
                <div key={e.id} id={e.id} className="scroll-mt-8 border-t border-slate-200 pt-6">
                  <div className="mb-1.5 flex items-center gap-2">
                    <MethodBadge method={e.method} />
                    <code className="text-sm font-medium text-slate-800">{e.path}</code>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{e.summary}</h3>
                  {e.description && <p className="mt-1 text-sm text-slate-600">{e.description}</p>}

                  {e.params && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Query parameters
                      </p>
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        {e.params.map((p) => (
                          <div key={p.name} className="flex gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-0">
                            <code className="w-28 shrink-0 font-mono text-brand-700">{p.name}</code>
                            <span className="w-24 shrink-0 text-slate-400">{p.type}</span>
                            <span className="text-slate-600">{p.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {e.body && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Body parameters
                      </p>
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        {e.body.map((p) => (
                          <div key={p.name} className="flex gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-0">
                            <code className="w-28 shrink-0 font-mono text-brand-700">
                              {p.name}
                              {p.required && <span className="text-red-500">*</span>}
                            </code>
                            <span className="w-32 shrink-0 text-slate-400">{p.type}</span>
                            <span className="text-slate-600">{p.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 grid gap-3">
                    <CodeBlock code={e.curl(base)} lang="curl" />
                    <CodeBlock code={e.response} lang="json response" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
