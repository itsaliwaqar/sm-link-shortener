import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useToast } from "../lib/toast";
import type { ApiKey } from "../lib/types";
import Modal from "../components/Modal";
import { IconCheck, IconCopy, IconKey, IconPlus, IconTrash } from "../components/Icons";

function formatDate(ms: number | null) {
  if (!ms) return "Never";
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setKeys(await api.get<ApiKey[]>("/api-keys"));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post<{ key: string }>("/api-keys", { name: name || "API key" });
      setNewKey(res.key);
      setName("");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(key: ApiKey) {
    if (!confirm(`Revoke "${key.name}"? Any integration using it will stop working immediately.`)) return;
    await api.del(`/api-keys/${key.id}`);
    toast("Key revoked", "success");
    load();
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function closeModal() {
    setShowCreate(false);
    setNewKey(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
          <p className="mt-1 text-sm text-slate-500">
            Use a key to create and manage links from your own scripts. See the{" "}
            <Link to="/docs" className="font-medium text-brand-600">
              API docs
            </Link>{" "}
            for endpoints and examples.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <IconPlus className="h-4 w-4" />
          New key
        </button>
      </div>

      <div className="card divide-y divide-slate-100">
        {keys.length === 0 && (
          <p className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
            <IconKey className="h-4 w-4" /> No API keys yet.
          </p>
        )}
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium text-slate-900">{k.name}</p>
              <p className="font-mono text-xs text-slate-400">
                {k.key_prefix}••••••••••••••••••••
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Created {formatDate(k.created_at)} · Last used {formatDate(k.last_used_at)}
              </p>
            </div>
            <button
              onClick={() => revoke(k)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-600"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {showCreate && (
        <Modal title={newKey ? "API key created" : "New API key"} onClose={closeModal}>
          {newKey ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Copy this key now — for your security, it won't be shown again.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="flex-1 truncate font-mono text-sm text-slate-800">{newKey}</span>
                <button onClick={copyKey} className="text-slate-400 hover:text-slate-700">
                  {copied ? <IconCheck className="h-4 w-4 text-emerald-600" /> : <IconCopy className="h-4 w-4" />}
                </button>
              </div>
              <button className="btn-primary w-full" onClick={closeModal}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Key name</label>
                <input
                  className="input"
                  placeholder="e.g. Marketing site integration"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? "Creating…" : "Create key"}
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
