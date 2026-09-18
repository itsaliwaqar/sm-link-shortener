import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import StatCard from "../components/StatCard";
import { IconChart, IconFolder, IconGlobe, IconLink } from "../components/Icons";
import type { LinkItem } from "../lib/types";

interface Overview {
  total_links: number;
  total_clicks: number;
  total_unique_clicks: number;
  total_domains: number;
  total_folders: number;
  clicks_last_24h: number;
  recent_links: (LinkItem & { domain_hostname: string })[];
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api.get<Overview>("/stats/overview").then(setData);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-500">A snapshot of your links across every connected domain.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total links" value={data?.total_links ?? "—"} icon={IconLink} />
        <StatCard label="Total clicks" value={data?.total_clicks ?? "—"} icon={IconChart} />
        <StatCard label="Unique clicks" value={data?.total_unique_clicks ?? "—"} icon={IconChart} />
        <StatCard label="Connected domains" value={data?.total_domains ?? "—"} icon={IconGlobe} />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent links</h2>
          <Link to="/links" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View all
          </Link>
        </div>
        <div className="card divide-y divide-slate-100">
          {data?.recent_links.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">
              No links yet. Head to{" "}
              <Link to="/links" className="font-medium text-brand-600">
                Links
              </Link>{" "}
              to create your first one.
            </p>
          )}
          {data?.recent_links.map((link) => (
            <Link
              key={link.id}
              to={`/links/${link.id}`}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-brand-700">
                  {link.domain_hostname}/{link.slug}
                </p>
                <p className="truncate text-xs text-slate-500">{link.destination_url}</p>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-1 text-sm text-slate-500">
                <IconChart className="h-3.5 w-3.5" />
                {link.total_clicks}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {data && data.total_folders > 0 && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
          <IconFolder className="h-3.5 w-3.5" />
          {data.total_folders} folder{data.total_folders === 1 ? "" : "s"} organizing your links
        </div>
      )}
    </div>
  );
}
