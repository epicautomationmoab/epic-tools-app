"use client";

import { FormEvent, useEffect, useState } from "react";

type Partner = { id: string; name: string; status: string };
type PortalUser = { id: string; partner_id: string; user_id: string | null; display_name: string; email: string; role: string; active: boolean; invited_at: string | null; last_login_at: string | null };

const field: React.CSSProperties = { width: "100%", border: "1px solid #cfd5dc", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "white", boxSizing: "border-box" };
const label: React.CSSProperties = { display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "#39414b" };
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—";

export default function PartnerUserInviteClient() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingId, setUpdatingId] = useState("");

  async function loadUsers(id: string) {
    if (!id) { setUsers([]); return; }
    const response = await fetch(`/api/team/referral-partners/users?partner_id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load portal users.");
    setUsers(data.users || []);
  }

  useEffect(() => {
    fetch("/api/team/referral-partners", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const active = (d.partners || []).filter((p: Partner) => p.status === "active");
        setPartners(active);
        if (active[0]) setPartnerId(active[0].id);
      })
      .catch(() => setError("Unable to load referral partners."));
  }, []);

  useEffect(() => {
    if (!partnerId) return;
    setError("");
    loadUsers(partnerId).catch((e) => setError(e instanceof Error ? e.message : "Unable to load portal users."));
  }, [partnerId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/team/referral-partners/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId, display_name: displayName, email, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send invitation.");
      setMessage(`Invitation sent to ${email}.`);
      setDisplayName(""); setEmail(""); setRole("manager");
      await loadUsers(partnerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send invitation.");
    } finally { setSending(false); }
  }

  async function setAccess(user: PortalUser, active: boolean) {
    setUpdatingId(user.id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/team/referral-partners/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: user.id, active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update access.");
      setMessage(active ? `Access restored for ${user.display_name}.` : `Access revoked for ${user.display_name}.`);
      await loadUsers(partnerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update access.");
    } finally { setUpdatingId(""); }
  }

  return (
    <section style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 12, padding: 20 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Ambassador Portal Access</h2>
      <p style={{ margin: "6px 0 18px", color: "#68717d", fontSize: 13 }}>Invite and manage the people who can access each Ambassador portal.</p>
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.2fr .7fr auto", gap: 12, alignItems: "end" }}>
        <label style={label}>Partner<select style={field} value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label style={label}>Name<input style={field} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>
        <label style={label}>Email<input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label style={label}>Access<select style={field} value={role} onChange={(e) => setRole(e.target.value)}><option value="owner">Owner</option><option value="manager">Manager</option><option value="viewer">Viewer</option></select></label>
        <button type="submit" disabled={sending || !partners.length} style={{ height: 40, border: 0, borderRadius: 8, padding: "0 16px", background: "#d5521d", color: "white", fontWeight: 900 }}>{sending ? "Sending…" : "Send Invite"}</button>
      </form>

      {message ? <p style={{ color: "#256b3e", fontWeight: 700, fontSize: 13, marginBottom: 0 }}>{message}</p> : null}
      {error ? <p style={{ color: "#a52323", fontWeight: 700, fontSize: 13, marginBottom: 0 }}>{error}</p> : null}

      <div style={{ marginTop: 22, borderTop: "1px solid #e7ebef", paddingTop: 18 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Portal Users</h3>
        {!partnerId ? <p style={{ color: "#68717d", fontSize: 13 }}>Select a partner to view portal users.</p> : users.length === 0 ? <p style={{ color: "#68717d", fontSize: 13 }}>No portal users for this Ambassador yet.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ textAlign: "left", background: "#f7f8fa" }}>{["Name","Email","Role","Status","Invited","Last Login","Access"].map((h) => <th key={h} style={{ padding: "10px 12px", color: "#68717d" }}>{h}</th>)}</tr></thead>
              <tbody>
                {users.map((user) => {
                  const status = !user.active ? "Revoked" : user.user_id ? "Active" : "Invited";
                  return <tr key={user.id} style={{ borderTop: "1px solid #edf0f3" }}>
                    <td style={{ padding: "11px 12px", fontWeight: 700 }}>{user.display_name}</td>
                    <td style={{ padding: "11px 12px" }}>{user.email}</td>
                    <td style={{ padding: "11px 12px", textTransform: "capitalize" }}>{user.role}</td>
                    <td style={{ padding: "11px 12px", fontWeight: 700 }}>{status}</td>
                    <td style={{ padding: "11px 12px" }}>{date(user.invited_at)}</td>
                    <td style={{ padding: "11px 12px" }}>{date(user.last_login_at)}</td>
                    <td style={{ padding: "11px 12px" }}><button onClick={() => void setAccess(user, !user.active)} disabled={updatingId === user.id} style={{ border: 0, borderRadius: 7, padding: "8px 11px", background: user.active ? "#fff0f0" : "#eefaf2", color: user.active ? "#a52323" : "#18794e", fontWeight: 800, cursor: "pointer" }}>{updatingId === user.id ? "Saving…" : user.active ? "Revoke Access" : "Reactivate"}</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
