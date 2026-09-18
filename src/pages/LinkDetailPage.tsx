import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ApiError } from "../lib/api";
import { useToast } from "../lib/toast";
import type { AnalyticsResponse, LinkItem } from "../lib/types";
import { IconChart, IconCheck, IconCopy, IconExternal, IconTrash } from "../components/Icons";

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function BreakdownCard({ title, rows }: { title: string; rows: { key: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 truncate text-slate-600">{row.key}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">{row.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LinkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [link, setLink] = useState<LinkItem | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [range, setRange] = useState("30d");
  const [destination, setDestination] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const l = await api.get<LinkItem>(`/links/${id}`);
    setLink(l);
    setDestination(l.destination_url);
  }

  async function loadAnalytics() {
    const a = await api.get<AnalyticsResponse>(`/links/${id}/analytics?range=${range}`);
    setAnalytics(a);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, range]);

  async function saveDestination() {
    if (!link) return;
    setSaving(true);
    try {
      await api.patch(`/links/${link.id}`, { destination_url: destination });
      toast("Destination updated", "success");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!link) return;
    await api.patch(`/links/${link.id}`, { is_active: link.is_active !== 1 });
    load();
  }

  async function deleteLink() {
    if (!link) return;
    if (!confirm(`Delete ${link.domain_hostname}/${link.slug}? This cannot be undone.`)) return;
    await api.del(`/links/${link.id}`);
    toast("Link deleted", "success");
    navigate("/links");
  }

  function copyShortUrl() {
    if (!link?.short_url) return;
    navigator.clipboard.writeText(link.short_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  if (!link) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div>
      <RouterLink to="/links" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
        ← Back to links
      </RouterLink>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              {link.domain_hostname}/{link.slug}
            </h1>
            {!link.is_active && <span className="badge bg-slate-100 text-slate-500">Disabled</span>}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span>{link.short_url}</span>
            <button onClick={copyShortUrl} className="text-slate-400 hover:text-slate-700">
              {copied ? <IconCheck className="h-3.5 w-3.5 text-emerald-600" /> : <IconCopy className="h-3.5 w-3.5" />}
            </button>
            <a href={link.destination_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-700">
              <IconExternal className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleActive} className="btn-secondary">
            {link.is_active ? "Disable" : "Enable"}
          </button>
          <button onClick={deleteLink} className="btn-danger">
            <IconTrash className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card p-5">
          <span className="text-sm font-medium text-slate-500">Total clicks</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{link.total_clicks}</p>
        </div>
        <div className="card p-5">
          <span className="text-sm font-medium text-slate-500">Unique clicks</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{link.unique_clicks}</p>
        </div>
        <div className="card col-span-2 p-5">
          <label className="label">Destination URL</label>
          <div className="flex gap-2">
            <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} />
            <button
              onClick={saveDestination}
              disabled={saving || destination === link.destination_url}
              className="btn-primary shrink-0"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <IconChart className="h-4 w-4" /> Clicks over time
        </h2>
        <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                range === r.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-6 p-5">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={analytics?.timeseries ?? []}>
            <defs>
              <linearGradient id="total" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6f57ff" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6f57ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="unique" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
              labelStyle={{ fontWeight: 600 }}
            />
            <Area type="monotone" dataKey="total" name="Total clicks" stroke="#6f57ff" fill="url(#total)" strokeWidth={2} />
            <Area
              type="monotone"
              dataKey="unique_count"
              name="Unique clicks"
              stroke="#22c55e"
              fill="url(#unique)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard title="Top referrers" rows={analytics?.top_referrers ?? []} />
        <BreakdownCard title="Top countries" rows={analytics?.top_countries ?? []} />
        <BreakdownCard title="Devices" rows={analytics?.top_devices ?? []} />
        <BreakdownCard title="Browsers" rows={analytics?.top_browsers ?? []} />
      </div>
    </div>
  );
}
