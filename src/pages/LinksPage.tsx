import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useToast } from "../lib/toast";
import type { Domain, Folder, LinkItem } from "../lib/types";
import FolderTree from "../components/FolderTree";
import CreateLinkModal from "../components/CreateLinkModal";
import Modal from "../components/Modal";
import { IconChart, IconCopy, IconExternal, IconPlus, IconSearch, IconTrash } from "../components/Icons";

export default function LinksPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const folderParam = searchParams.get("folder");

  const [domains, setDomains] = useState<Domain[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<LinkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [folderModal, setFolderModal] = useState<{ mode: "create" | "rename"; parentId: string | null; folder?: Folder } | null>(
    null,
  );
  const [folderName, setFolderName] = useState("");

  async function loadRefs() {
    const [d, f] = await Promise.all([api.get<Domain[]>("/domains"), api.get<Folder[]>("/folders")]);
    setDomains(d);
    setFolders(f);
  }

  async function loadLinks() {
    setLoading(true);
    const params = new URLSearchParams();
    if (folderParam) params.set("folder_id", folderParam);
    if (q) params.set("q", q);
    params.set("limit", "50");
    const res = await api.get<{ items: LinkItem[]; total: number }>(`/links?${params.toString()}`);
    setItems(res.items);
    setTotal(res.total);
    setLoading(false);
  }

  useEffect(() => {
    loadRefs();
  }, []);

  useEffect(() => {
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderParam, q]);

  function selectFolder(id: string | null) {
    if (id) setSearchParams({ folder: id });
    else setSearchParams({});
  }

  function copyLink(link: LinkItem) {
    if (!link.short_url) return;
    navigator.clipboard.writeText(link.short_url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1200);
  }

  async function deleteLink(link: LinkItem) {
    if (!confirm(`Delete ${link.domain_hostname}/${link.slug}? This cannot be undone.`)) return;
    await api.del(`/links/${link.id}`);
    toast("Link deleted", "success");
    loadLinks();
  }

  async function submitFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!folderModal) return;
    try {
      if (folderModal.mode === "create") {
        await api.post("/folders", { name: folderName, parent_id: folderModal.parentId });
        toast("Folder created", "success");
      } else if (folderModal.folder) {
        await api.patch(`/folders/${folderModal.folder.id}`, { name: folderName });
        toast("Folder renamed", "success");
      }
      setFolderModal(null);
      setFolderName("");
      loadRefs();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong.", "error");
    }
  }

  async function deleteFolder(folder: Folder) {
    if (!confirm(`Delete folder "${folder.name}"? Links inside will move to "All links".`)) return;
    await api.del(`/folders/${folder.id}`);
    toast("Folder deleted", "success");
    if (folderParam === folder.id) selectFolder(null);
    loadRefs();
  }

  const currentFolderName = useMemo(
    () => (folderParam ? folders.find((f) => f.id === folderParam)?.name : null),
    [folderParam, folders],
  );

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Links</h1>
          <p className="mt-1 text-sm text-slate-500">
            {currentFolderName ? `Folder: ${currentFolderName}` : `${total} link${total === 1 ? "" : "s"} across all domains`}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <IconPlus className="h-4 w-4" />
          New link
        </button>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-6">
        <div className="card p-3">
          <FolderTree
            folders={folders}
            selected={folderParam}
            onSelect={selectFolder}
            onCreate={(parentId) => {
              setFolderModal({ mode: "create", parentId });
              setFolderName("");
            }}
            onRename={(folder) => {
              setFolderModal({ mode: "rename", parentId: null, folder });
              setFolderName(folder.name);
            }}
            onDelete={deleteFolder}
          />
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search by URL, slug or title…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No links here yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Link</th>
                    <th className="px-5 py-3">Destination</th>
                    <th className="px-5 py-3 text-right">Clicks</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((link) => (
                    <tr key={link.id} className="group hover:bg-slate-50">
                      <td className="px-5 py-3.5">
                        <Link to={`/links/${link.id}`} className="font-medium text-brand-700 hover:underline">
                          {link.domain_hostname}/{link.slug}
                        </Link>
                        {!link.is_active && (
                          <span className="badge ml-2 bg-slate-100 text-slate-500">Disabled</span>
                        )}
                        {link.title && <p className="text-xs text-slate-400">{link.title}</p>}
                      </td>
                      <td className="max-w-xs truncate px-5 py-3.5 text-slate-500">{link.destination_url}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-slate-700">
                        <div className="flex items-center justify-end gap-1">
                          <IconChart className="h-3.5 w-3.5 text-slate-400" />
                          {link.total_clicks}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            title="Copy short link"
                            onClick={() => copyLink(link)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          >
                            {copiedId === link.id ? (
                              <span className="text-xs font-medium text-emerald-600">✓</span>
                            ) : (
                              <IconCopy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <a
                            title="Open destination"
                            href={link.destination_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          >
                            <IconExternal className="h-3.5 w-3.5" />
                          </a>
                          <button
                            title="Delete"
                            onClick={() => deleteLink(link)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-red-600"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateLinkModal
          domains={domains}
          folders={folders}
          defaultFolderId={folderParam}
          onClose={() => setShowCreate(false)}
          onCreated={() => loadLinks()}
        />
      )}

      {folderModal && (
        <Modal title={folderModal.mode === "create" ? "New folder" : "Rename folder"} onClose={() => setFolderModal(null)}>
          <form onSubmit={submitFolder} className="space-y-4">
            <div>
              <label className="label">Folder name</label>
              <input className="input" value={folderName} onChange={(e) => setFolderName(e.target.value)} autoFocus required />
            </div>
            <button type="submit" className="btn-primary w-full">
              {folderModal.mode === "create" ? "Create folder" : "Save"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
