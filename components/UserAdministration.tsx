"use client";
import { useEffect, useState, type FormEvent } from "react";
import { USER_ROLES, type UserRole } from "@/lib/user-role";
type User = { id: string; name: string; email: string; role: UserRole; active: boolean; authProvider: string | null };
export function UserAdministration({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<User[]>([]), [q, setQ] = useState(""), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(search = q) {
    try { const response = await fetch(`/api/users?q=${encodeURIComponent(search)}`); if (!response.ok) throw Error(); setUsers(await response.json()); }
    catch { setMessage("Unable to load users."); }
  }
  useEffect(() => { void load(""); }, []);
  async function save(event: FormEvent<HTMLFormElement>, user: User) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: data.get("role"), active: data.get("active") === "on" }) });
      if (!response.ok) throw Error();
      setMessage("User access updated and recorded in the audit trail."); await load();
    } catch { setMessage("Unable to update this user."); }
    finally { setBusy(false); }
  }
  return <section className="panel user-administration">
    <form onSubmit={e => { e.preventDefault(); void load(); }} className="user-search"><label>Search users<input value={q} onChange={e => setQ(e.target.value)} placeholder="Email or name" maxLength={100}/></label><button className="secondary-button">Search</button></form>
    <p>Showing up to 100 matches. Accounts retain their history when deactivated. Your own role and access cannot be changed here.</p>
    {message && <p role="status">{message}</p>}
    {users.map(user => <form key={`${user.id}-${user.role}-${user.active}`} onSubmit={e => save(e, user)} className="user-access-row">
      <div><strong>{user.name}</strong><span>{user.email}</span><small>{user.authProvider ? "Linked account" : "Provider account not linked"}{user.id === currentUserId ? " · You" : ""}</small></div>
      <label>Role<select name="role" defaultValue={user.role} disabled={busy || user.id === currentUserId}>{USER_ROLES.map(role => <option key={role}>{role}</option>)}</select></label>
      <label><input type="checkbox" name="active" defaultChecked={user.active} disabled={busy || user.id === currentUserId}/> Active</label>
      <button className="secondary-button" disabled={busy || user.id === currentUserId}>Save access</button>
    </form>)}
    <h2>Invite a new user</h2><p>An operator sends a Supabase invitation and links its provider ID using the documented onboarding command. Public signup is disabled; an unlinked account cannot enter the studio.</p>
  </section>;
}
