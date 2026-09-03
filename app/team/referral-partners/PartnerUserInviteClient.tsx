"use client";

import { FormEvent, useEffect, useState } from "react";

type Partner = { id: string; name: string; status: string };

const field: React.CSSProperties = { width: "100%", border: "1px solid #cfd5dc", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "white", boxSizing: "border-box" };
const label: React.CSSProperties = { display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "#39414b" };

export default function PartnerUserInviteClient() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send invitation.");
    } finally { setSending(false); }
  }

  return (
    <section style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 12, padding: 20 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Ambassador Portal Access</h2>
      <p style={{ margin: "6px 0 18px", color: "#68717d", fontSize: 13 }}>Invite an owner, manager, or viewer from a referral partner. Their account can see only their own company’s referrals and rewards.</p>
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.2fr .7fr auto", gap: 12, alignItems: "end" }}>
        <label style={label}>Partner<select style={field} value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label style={label}>Name<input style={field} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>
        <label style={label}>Email<input style={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label style={label}>Access<select style={field} value={role} onChange={(e) => setRole(e.target.value)}><option value="owner">Owner</option><option value="manager">Manager</option><option value="viewer">Viewer</option></select></label>
        <button type="submit" disabled={sending || !partners.length} style={{ height: 40, border: 0, borderRadius: 8, padding: "0 16px", background: "#d5521d", color: "white", fontWeight: 900 }}>{sending ? "Sending…" : "Send Invite"}</button>
      </form>
      {message ? <p style={{ color: "#256b3e", fontWeight: 700, fontSize: 13, marginBottom: 0 }}>{message}</p> : null}
      {error ? <p style={{ color: "#a52323", fontWeight: 700, fontSize: 13, marginBottom: 0 }}>{error}</p> : null}
    </section>
  );
}
