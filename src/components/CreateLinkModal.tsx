import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import { api, ApiError } from "../lib/api";
import type { Domain, Folder, LinkItem } from "../lib/types";
import { IconCheck, IconCopy, IconShuffle } from "./Icons";

const SLUG_LENGTHS = [
  { value: 4, label: "Short (4)" },
  { value: 6, label: "Medium (6)" },
  { value: 8, label: "Long (8)" },
  { value: 10, label: "Extra long (10)" },
];

export default function CreateLinkModal({
  domains,
  folders,
  defaultFolderId,
  onClose,
  onCreated,
}: {
  domains: Domain[];
  folders: Folder[];
  defaultFolderId: string | null;
  onClose: () => void;
  onCreated: (link: LinkItem) => void;
}) {
  const activeDomains = domains.filter((d) => d.is_active);

  const [destination, setDestination] = useState("");
  const [domainId, setDomainId] = useState(
    activeDomains.find((d) => d.is_default)?.id ?? activeDomains[0]?.id ?? "",
  );
  const [folderId, setFolderId] = useState(defaultFolderId ?? "");
  const [title, setTitle] = useState("");
  const [slugType, setSlugType] = useState<"random" | "custom">("random");
  const [slugLength, setSlugLength] = useState(6);
  const [customSlug, setCustomSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<LinkItem | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const link = await api.post<LinkItem>("/links", {
        destination_url: destination,
        domain_id: domainId,
        folder_id: folderId || null,
        title: title || null,
        slug_type: slugType,
        slug_length: slugLength,
        custom_slug: slugType === "custom" ? customSlug : undefined,
      });
      setCreated(link);
      onCreated(link);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function copyShortUrl() {
    if (!created?.short_url) return;
    navigator.clipboard.writeText(created.short_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (created) {
    return (
      <Modal title="Link created" onClose={onClose}>
        <div className="space-y-4">
          <div className="flex items-center justify-center rounded-full bg-emerald-50 py-4">
            <IconCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="label">Your short link</p>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="flex-1 truncate font-mono text-sm text-slate-800">{created.short_url}</span>
              <button onClick={copyShortUrl} className="text-slate-400 hover:text-slate-700">
                {copied ? <IconCheck className="h-4 w-4 text-emerald-600" /> : <IconCopy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button className="btn-primary w-full" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Create short link" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div>
          <label className="label">Destination URL</label>
          <input
            className="input"
            type="url"
            placeholder="https://example.com/some/long/path"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Domain</label>
            <select className="input" value={domainId} onChange={(e) => setDomainId(e.target.value)} required>
              {activeDomains.length === 0 && <option value="">No domains yet</option>}
              {activeDomains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.hostname}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Folder</label>
            <select className="input" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Title (optional)</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Campaign name" />
        </div>

        <div>
          <label className="label">Short link path</label>
          <div className="mb-2 flex rounded-lg bg-slate-100 p-1 text-sm">
            <button
              type="button"
              onClick={() => setSlugType("random")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                slugType === "random" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Random
            </button>
            <button
              type="button"
              onClick={() => setSlugType("custom")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                slugType === "custom" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Custom
            </button>
          </div>

          {slugType === "random" ? (
            <div className="flex items-center gap-2">
              <IconShuffle className="h-4 w-4 shrink-0 text-slate-400" />
              <select
                className="input"
                value={slugLength}
                onChange={(e) => setSlugLength(Number(e.target.value))}
              >
                {SLUG_LENGTHS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
              <span className="whitespace-nowrap bg-slate-50 px-3 py-2 text-sm text-slate-500">
                {domains.find((d) => d.id === domainId)?.hostname ?? "domain"}/
              </span>
              <input
                className="w-full border-0 px-2 py-2 text-sm focus:outline-none focus:ring-0"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="summer-sale"
                required
              />
            </div>
          )}
        </div>

        <button type="submit" disabled={loading || !domainId} className="btn-primary w-full">
          {loading ? "Creating…" : "Create link"}
        </button>
      </form>
    </Modal>
  );
}
