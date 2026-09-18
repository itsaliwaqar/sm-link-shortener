import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { useToast } from "../lib/toast";
import { useAuth } from "../lib/auth";
import type { PublicUser } from "../lib/types";
import Modal from "../components/Modal";
import { IconPlus, IconTrash, IconUsers } from "../components/Icons";

export default function TeamPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setMembers(await api.get<PublicUser[]>("/users"));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/users", { name, email, password, role });
      toast("Account created", "success");
      setShowAdd(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("member");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(member: PublicUser) {
    if (!confirm(`Remove ${member.name} (${member.email})?`)) return;
    try {
      await api.del(`/users/${member.id}`);
      toast("Account removed", "success");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong.", "error");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-500">
            There's no public sign-up — admins create accounts here for teammates who need access.
          </p>
        </div>
        {user?.role === "admin" && (
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <IconPlus className="h-4 w-4" />
            Add teammate
          </button>
        )}
      </div>

      <div className="card divide-y divide-slate-100">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                {m.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{m.name}</span>
                  <span className={`badge ${m.role === "admin" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>
                    {m.role}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{m.email}</p>
              </div>
            </div>
            {user?.role === "admin" && m.id !== user.id && (
              <button
                onClick={() => remove(m)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <p className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
            <IconUsers className="h-4 w-4" /> No teammates yet.
          </p>
        )}
      </div>

      {showAdd && (
        <Modal title="Add teammate" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-4">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div>
              <label className="label">Full name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Temporary password</label>
              <input
                className="input"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? "Creating…" : "Create account"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
