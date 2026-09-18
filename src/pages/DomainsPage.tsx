import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { useToast } from "../lib/toast";
import { useAuth } from "../lib/auth";
import type { Domain } from "../lib/types";
import { IconGlobe, IconPlus, IconTrash } from "../components/Icons";

export default function DomainsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [hostname, setHostname] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setDomains(await api.get<Domain[]>("/domains"));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      await api.post("/domains", { hostname, label: label || undefined });
      setHostname("");
      setLabel("");
      toast("Domain added", "success");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(domain: Domain) {
    await api.patch(`/domains/${domain.id}`, { is_active: domain.is_active !== 1 });
    load();
  }

  async function makeDefault(domain: Domain) {
    await api.patch(`/domains/${domain.id}`, { is_default: true });
    load();
  }

  async function remove(domain: Domain) {
    if (!confirm(`Remove ${domain.hostname}? Links must be moved or deleted first.`)) return;
    try {
      await api.del(`/domains/${domain.id}`);
      toast("Domain removed", "success");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong.", "error");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Domains</h1>
        <p className="mt-1 text-sm text-slate-500">
          Connect the subdomains you want to use for short links, then pick one when creating a link.
        </p>
      </div>

      {user?.role === "admin" && (
        <form onSubmit={handleAdd} className="card mb-6 space-y-3 p-5">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <div>
              <label className="label">Hostname</label>
              <input
                className="input"
                placeholder="go.example.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Label (optional)</label>
              <input className="input" placeholder="Marketing" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <button type="submit" disabled={adding} className="btn-primary">
              <IconPlus className="h-4 w-4" />
              Add domain
            </button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-slate-100">
        {domains.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">
            No domains connected yet. Add one above, then point its DNS at Cloudflare — see the README for setup steps.
          </p>
        )}
        {domains.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <IconGlobe className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{d.hostname}</span>
                  {d.is_default === 1 && <span className="badge bg-brand-50 text-brand-700">Default</span>}
                  {d.is_active !== 1 && <span className="badge bg-slate-100 text-slate-500">Inactive</span>}
                </div>
                {d.label && <p className="text-xs text-slate-400">{d.label}</p>}
              </div>
            </div>
            {user?.role === "admin" && (
              <div className="flex items-center gap-2">
                {d.is_default !== 1 && (
                  <button onClick={() => makeDefault(d)} className="btn-ghost text-xs">
                    Make default
                  </button>
                )}
                <button onClick={() => toggleActive(d)} className="btn-secondary text-xs">
                  {d.is_active === 1 ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => remove(d)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-600"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
