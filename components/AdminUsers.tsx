"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

type Branch = { id: string; name: string };
type User = { id: string; email: string; name: string; mobileNumber: string | null; mobileE164: string | null; role: string; active: boolean; branchId: string | null; branch: Branch | null };

export function AdminUsers({ initialUsers, branches }: { initialUsers: User[]; branches: Branch[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", mobileNumber: "", role: "STORE_MANAGER", branchId: branches[0]?.id || "", password: "", active: true });
  const [mobileDrafts, setMobileDrafts] = useState<Record<string, string>>(() => Object.fromEntries(initialUsers.map(user => [user.id, user.mobileNumber || ""])));

  async function send(payload: object) {
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setNotice(body.error || "Unable to update user"); return; }
    setNotice("User access updated and recorded in the audit trail.");
    router.refresh();
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, branchId: form.branchId || null }) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setNotice(body.error || "Unable to create user"); return; }
    setNotice("Store Manager created successfully.");
    setForm(current => ({ ...current, email: "", name: "", mobileNumber: "", password: "" }));
    router.refresh();
  }

  return <div className="admin-user-layout">
    <form className="panel admin-user-form" onSubmit={create}>
      <UserPlus/><span className="section-kicker">ADMIN CONTROL</span><h2>Add Store Manager</h2>
      <label className="field"><span>Name</span><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required/></label>
      <label className="field"><span>Email</span><input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required/></label>
      <label className="field"><span>Role</span><select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="STORE_MANAGER">Store Manager</option><option value="ADMIN">Admin</option></select></label>
      {form.role === "STORE_MANAGER" && <label className="field"><span>Mobile Number</span><input type="tel" inputMode="tel" placeholder="079 514 4898" value={form.mobileNumber} onChange={event => setForm({ ...form, mobileNumber: event.target.value })} required/></label>}
      {form.role === "ADMIN" && <label className="field"><span>Temporary password</span><input type="password" minLength={12} maxLength={128} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required/></label>}
      <label className="field"><span>Branch</span><select value={form.branchId} onChange={event => setForm({ ...form, branchId: event.target.value })}>{form.role === "ADMIN" && <option value="">All branches</option>}{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      {notice && <p className="form-message" role="status">{notice}</p>}
      <button className="primary-button" disabled={busy}>Create user</button>
      <small>Accounts are provisioned by admins only; public signup is disabled.</small>
    </form>
    <section className="panel user-list">
      <span className="section-kicker">USER DIRECTORY</span><h2>{initialUsers.length} users</h2>
      {initialUsers.map(user => <article key={user.id}>
        <div><strong>{user.name}</strong><span>{user.email}</span><span>{user.mobileE164 || "No mobile assigned"}</span></div>
        <div className="user-controls">
          <input aria-label={`Mobile number for ${user.name}`} type="tel" value={mobileDrafts[user.id] ?? ""} disabled={busy} onChange={event => setMobileDrafts(current => ({ ...current, [user.id]: event.target.value }))}/>
          <button type="button" disabled={busy || (mobileDrafts[user.id] ?? "") === (user.mobileNumber || "")} onClick={() => void send({ id: user.id, mobileNumber: mobileDrafts[user.id] || null })}>Save mobile</button>
          <select aria-label={`Role for ${user.name}`} value={user.role} disabled={busy} onChange={event => void send({ id: user.id, role: event.target.value })}><option value="STORE_MANAGER">Store Manager</option><option value="ADMIN">Admin</option></select>
          <select aria-label={`Branch for ${user.name}`} value={user.branchId || ""} disabled={busy} onChange={event => void send({ id: user.id, branchId: event.target.value || null })}><option value="">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        </div>
        <button className={user.active ? "active-user" : "inactive-user"} disabled={busy} onClick={() => void send({ id: user.id, active: !user.active })}>{user.active ? "ACTIVE" : "INACTIVE"}</button>
      </article>)}
    </section>
  </div>;
}
