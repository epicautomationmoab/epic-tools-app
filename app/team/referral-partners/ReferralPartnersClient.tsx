"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Partner = {
  id: string;
  name: string;
  slug: string;
  contact_name: string | null;
  contact_email: string | null;
  status: "active" | "inactive";
  reward_mode: "partner_reward" | "guest_discount" | "split";
  reward_basis: "flat" | "percent";
  partner_reward_cents: number;
  guest_discount_cents: number;
  promo_code: string | null;
  attribution_window_days: number;
  show_promo_popup: boolean;
  popup_heading: string | null;
  popup_body: string | null;
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cfd5dc",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  background: "white",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 800,
  color: "#39414b",
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

function modeLabel(mode: Partner["reward_mode"]) {
  if (mode === "guest_discount") return "Guest Discount";
  if (mode === "split") return "Split Reward";
  return "Partner Reward";
}

export default function ReferralPartnersClient() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [rewardMode, setRewardMode] = useState<Partner["reward_mode"]>("partner_reward");
  const [partnerReward, setPartnerReward] = useState("50");
  const [guestDiscount, setGuestDiscount] = useState("0");
  const [promoCode, setPromoCode] = useState("");
  const [windowDays, setWindowDays] = useState("30");
  const [showPopup, setShowPopup] = useState(false);
  const [popupHeading, setPopupHeading] = useState("");
  const [popupBody, setPopupBody] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/team/referral-partners", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load referral partners.");
      setPartners(data.partners || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load referral partners.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!name || slug) return;
    setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  }, [name, slug]);

  useEffect(() => {
    if (rewardMode === "partner_reward") {
      setGuestDiscount("0");
      setShowPopup(false);
    } else if (rewardMode === "guest_discount") {
      setPartnerReward("0");
      setShowPopup(true);
    }
  }, [rewardMode]);

  const preview = useMemo(() => {
    const code = slug || "partner-code";
    return `https://www.epic4x4adventures.com/?ref=${code}`;
  }, [slug]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/team/referral-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          contact_name: contactName,
          contact_email: contactEmail,
          reward_mode: rewardMode,
          reward_basis: "flat",
          partner_reward_cents: Math.round((Number(partnerReward) || 0) * 100),
          guest_discount_cents: Math.round((Number(guestDiscount) || 0) * 100),
          promo_code: promoCode,
          attribution_window_days: Number(windowDays) || 30,
          show_promo_popup: showPopup,
          popup_heading: popupHeading,
          popup_body: popupBody,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create referral partner.");
      setName("");
      setSlug("");
      setContactName("");
      setContactEmail("");
      setRewardMode("partner_reward");
      setPartnerReward("50");
      setGuestDiscount("0");
      setPromoCode("");
      setWindowDays("30");
      setShowPopup(false);
      setPopupHeading("");
      setPopupBody("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create referral partner.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 12, padding: 20 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Add Referral Partner</h2>
          <p style={{ margin: "6px 0 0", color: "#68717d", fontSize: 13 }}>
            The public domain is intentionally separate from Epic Tools. This link preview uses the main Epic website for now.
          </p>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <label style={labelStyle}>Partner Name<input style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} required /></label>
            <label style={labelStyle}>Referral Code<input style={fieldStyle} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="moab-springs" required /></label>
            <label style={labelStyle}>Contact Name<input style={fieldStyle} value={contactName} onChange={(e) => setContactName(e.target.value)} /></label>
            <label style={labelStyle}>Contact Email<input style={fieldStyle} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></label>
          </div>

          <div style={{ background: "#f5f7f9", borderRadius: 9, padding: "11px 13px", fontSize: 13 }}>
            <strong>Referral link preview:</strong> <span style={{ overflowWrap: "anywhere" }}>{preview}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
            <label style={labelStyle}>Reward Arrangement
              <select style={fieldStyle} value={rewardMode} onChange={(e) => setRewardMode(e.target.value as Partner["reward_mode"])}>
                <option value="partner_reward">Partner Reward</option>
                <option value="guest_discount">Guest Discount</option>
                <option value="split">Split Reward</option>
              </select>
            </label>
            <label style={labelStyle}>Partner Reward ($)<input style={fieldStyle} type="number" min="0" step="1" value={partnerReward} onChange={(e) => setPartnerReward(e.target.value)} /></label>
            <label style={labelStyle}>Guest Discount ($)<input style={fieldStyle} type="number" min="0" step="1" value={guestDiscount} onChange={(e) => setGuestDiscount(e.target.value)} /></label>
            <label style={labelStyle}>Attribution Window (days)<input style={fieldStyle} type="number" min="1" max="365" value={windowDays} onChange={(e) => setWindowDays(e.target.value)} /></label>
            <label style={labelStyle}>TripWorks Promo Code<input style={fieldStyle} value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="MOABSPRINGS50" /></label>
          </div>

          <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}>
            <input type="checkbox" checked={showPopup} onChange={(e) => setShowPopup(e.target.checked)} />
            Show a guest promo popup for visitors arriving through this partner
          </label>

          {showPopup ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              <label style={labelStyle}>Popup Heading<input style={fieldStyle} value={popupHeading} onChange={(e) => setPopupHeading(e.target.value)} placeholder="A special offer from Moab Springs Ranch" /></label>
              <label style={labelStyle}>Popup Message<input style={fieldStyle} value={popupBody} onChange={(e) => setPopupBody(e.target.value)} placeholder="Save $50 on your Epic adventure." /></label>
            </div>
          ) : null}

          {error ? <div style={{ color: "#a52323", fontWeight: 700, fontSize: 13 }}>{error}</div> : null}

          <div><button type="submit" disabled={saving} style={{ border: 0, borderRadius: 8, background: "#202733", color: "white", padding: "11px 18px", fontWeight: 900, cursor: saving ? "wait" : "pointer" }}>{saving ? "Saving…" : "Create Partner"}</button></div>
        </form>
      </section>

      <section style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 12, padding: 20 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>Referral Partners</h2>
        {loading ? <p>Loading…</p> : partners.length === 0 ? <p style={{ color: "#68717d" }}>No referral partners yet.</p> : (
          <div style={{ display: "grid", gap: 10 }}>
            {partners.map((partner) => (
              <div key={partner.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.4fr) minmax(150px, 1fr) minmax(180px, 1.2fr) minmax(120px, .7fr)", gap: 12, alignItems: "center", border: "1px solid #e5e9ee", borderRadius: 9, padding: "12px 14px", fontSize: 13 }}>
                <div><strong style={{ display: "block", fontSize: 14 }}>{partner.name}</strong><span style={{ color: "#68717d" }}>?ref={partner.slug}</span></div>
                <div><strong>{modeLabel(partner.reward_mode)}</strong><br /><span style={{ color: "#68717d" }}>{partner.attribution_window_days}-day attribution</span></div>
                <div>{partner.partner_reward_cents > 0 ? `${money(partner.partner_reward_cents)} partner` : ""}{partner.partner_reward_cents > 0 && partner.guest_discount_cents > 0 ? " + " : ""}{partner.guest_discount_cents > 0 ? `${money(partner.guest_discount_cents)} guest` : ""}{partner.promo_code ? <><br /><span style={{ color: "#68717d" }}>Promo: {partner.promo_code}</span></> : null}</div>
                <div style={{ fontWeight: 800 }}>{partner.status === "active" ? "Active" : "Inactive"}{partner.show_promo_popup ? <><br /><span style={{ color: "#68717d", fontWeight: 600 }}>Popup on</span></> : null}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
