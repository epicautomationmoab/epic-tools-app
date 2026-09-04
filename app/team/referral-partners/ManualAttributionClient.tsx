"use client";

import { FormEvent, useEffect, useState } from "react";

type Partner = { id: string; name: string; slug: string; reward_basis: "flat" | "percent"; partner_reward_cents: number; partner_reward_percent: number };
type Reservation = { id: string; confirmation_code: string; customer_name: string | null; customer_email: string | null; experience_name: string | null; business_line: string | null; booked_at: string | null; activity_start_at: string | null; total_sales_cents: number; is_cancelled: boolean; cancellation_status: string | null };

const fieldStyle: React.CSSProperties = { width: "100%", border: "1px solid #cfd5dc", borderRadius: 8, padding: "10px 12px", fontSize: 14, background: "white" };
const labelStyle: React.CSSProperties = { display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "#39414b" };
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";

export default function ManualAttributionClient() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [existing, setExisting] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/team/referral-partners/manual-attribution", { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load Ambassadors."); setPartners(data.partners || []); })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load Ambassadors."));
  }, []);

  async function lookup(event?: FormEvent) {
    event?.preventDefault();
    const code = confirmation.trim().toUpperCase();
    if (!code) return;
    setLoading(true); setError(""); setSuccess(""); setReservation(null); setExisting(null);
    try {
      const response = await fetch(`/api/team/referral-partners/manual-attribution?confirmation_code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to find reservation.");
      setReservation(data.reservation || null);
      setExisting(data.existing_attribution || null);
      if (Array.isArray(data.partners)) setPartners(data.partners);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to find reservation."); }
    finally { setLoading(false); }
  }

  async function attribute() {
    if (!reservation || !partnerId) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/team/referral-partners/manual-attribution", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation_code: reservation.confirmation_code, partner_id: partnerId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to attribute reservation.");
      setSuccess(`${reservation.confirmation_code} was credited to ${data.partner?.name || "the selected Ambassador"}. Attribution recorded under ${data.attributed_by?.display_name || "your Epic Tools login"}.`);
      setExisting(data.referral_booking || { id: "created" });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to attribute reservation."); }
    finally { setSaving(false); }
  }

  const selected = partners.find((partner) => partner.id === partnerId);
  const reward = selected ? (selected.reward_basis === "percent" ? `${selected.partner_reward_percent || 0}%` : money(selected.partner_reward_cents)) : "—";

  return (
    <section style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 12, padding: 20 }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Credit a Phone Reservation</h2>
        <p style={{ margin: "6px 0 0", color: "#68717d", fontSize: 13, lineHeight: 1.5 }}>Use this when a guest calls and identifies a known Ambassador. Epic Tools will pull the TripWorks reservation, apply that Ambassador’s reward rules, and permanently record which logged-in team member added the attribution.</p>
      </div>

      <form onSubmit={lookup} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) auto", gap: 10, alignItems: "end", maxWidth: 620 }}>
        <label style={labelStyle}>TripWorks Confirmation ID<input style={fieldStyle} value={confirmation} onChange={(e) => setConfirmation(e.target.value.toUpperCase())} placeholder="ABCD-EFGH" /></label>
        <button type="submit" disabled={loading} style={{ height: 40, border: 0, borderRadius: 8, background: "#202733", color: "white", padding: "0 18px", fontWeight: 900 }}>{loading ? "Looking up…" : "Look Up"}</button>
      </form>

      {reservation ? (
        <div style={{ marginTop: 18, border: "1px solid #e3e7ec", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ background: "#f7f8fa", padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 16 }}><strong>{reservation.customer_name || "Guest"}</strong><strong>{reservation.confirmation_code}</strong></div>
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, fontSize: 13 }}>
            <div><span style={{ color: "#68717d" }}>Experience</span><br /><strong>{reservation.experience_name || "—"}</strong></div>
            <div><span style={{ color: "#68717d" }}>Travel</span><br /><strong>{date(reservation.activity_start_at)}</strong></div>
            <div><span style={{ color: "#68717d" }}>Current pre-tax sales</span><br /><strong>{money(reservation.total_sales_cents)}</strong></div>
            <div><span style={{ color: "#68717d" }}>Business line</span><br /><strong style={{ textTransform: "capitalize" }}>{reservation.business_line || "—"}</strong></div>
          </div>
          <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "minmax(220px,1fr) minmax(140px,.5fr) auto", gap: 10, alignItems: "end" }}>
            <label style={labelStyle}>Confirmed Ambassador<select style={fieldStyle} value={partnerId} onChange={(e) => setPartnerId(e.target.value)} disabled={Boolean(existing)}><option value="">Select Ambassador…</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>
            <div style={{ fontSize: 12, color: "#68717d", paddingBottom: 8 }}>Partner reward<br /><strong style={{ color: "#202733", fontSize: 16 }}>{reward}</strong></div>
            <button type="button" onClick={attribute} disabled={!partnerId || saving || Boolean(existing) || reservation.is_cancelled} style={{ height: 40, border: 0, borderRadius: 8, background: (!partnerId || existing || reservation.is_cancelled) ? "#b8bec6" : "#d5521d", color: "white", padding: "0 18px", fontWeight: 900 }}>{saving ? "Crediting…" : existing ? "Already Credited" : "Credit Ambassador"}</button>
          </div>
          {existing ? <div style={{ margin: "0 14px 14px", background: "#fff4e8", border: "1px solid #f1c99e", borderRadius: 8, padding: "10px 12px", color: "#7a4517", fontSize: 13 }}>This reservation already has Ambassador attribution. It cannot be credited a second time.</div> : null}
        </div>
      ) : null}

      {error ? <div style={{ marginTop: 14, color: "#a52323", fontWeight: 700, fontSize: 13 }}>{error}</div> : null}
      {success ? <div style={{ marginTop: 14, color: "#18794e", fontWeight: 700, fontSize: 13 }}>{success}</div> : null}
    </section>
  );
}
