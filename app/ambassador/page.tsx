"use client";

import { useEffect, useMemo, useState } from "react";

type Dashboard = {
  profile: { display_name: string; role: string };
  partner: {
    name: string;
    slug: string;
    reward_mode: string;
    reward_basis: "flat" | "percent";
    partner_reward_cents: number;
    partner_reward_percent: number;
    guest_discount_cents: number;
    guest_discount_percent: number;
    promo_code: string | null;
    attribution_window_days: number;
  };
  metrics: { visits: number; bookings: number; traveled: number; total_revenue_cents: number; pending_rewards_cents: number; earned_rewards_cents: number };
  bookings: Array<{
    id: string;
    confirmation_code: string | null;
    customer_name: string | null;
    experience_name: string | null;
    booked_at: string | null;
    activity_start_at: string | null;
    booking_status: string;
    booking_revenue_cents: number;
    partner_reward_cents: number;
    reward_status: string;
    earned_at?: string | null;
    sent_at?: string | null;
  }>;
};

type View = "overview" | "referrals" | "rewards" | "link";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((cents || 0) / 100);
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—";
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());

export default function AmbassadorDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/ambassador/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (response.status === 401) { window.location.href = "/ambassador/login"; return null; }
        if (!response.ok) throw new Error(payload.error || "Unable to load dashboard.");
        return payload as Dashboard;
      })
      .then((payload) => payload && setData(payload))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load dashboard."));
  }, []);

  const referralUrl = useMemo(() => data ? `https://www.epic4x4adventures.com/?ref=${data.partner.slug}` : "", [data]);

  if (error) return <main style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>{error}</main>;
  if (!data) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f1f3f5", color: "#68717d" }}>Loading Ambassador dashboard…</main>;

  const partnerRewardDisplay = data.partner.reward_basis === "percent" ? `${data.partner.partner_reward_percent || 0}%` : money(data.partner.partner_reward_cents);
  const guestDiscountDisplay = data.partner.reward_basis === "percent" ? `${data.partner.guest_discount_percent || 0}%` : money(data.partner.guest_discount_cents);
  const metrics = [
    ["Referral Visits", data.metrics.visits.toLocaleString()],
    ["Bookings", data.metrics.bookings.toLocaleString()],
    ["Traveled", data.metrics.traveled.toLocaleString()],
    ["Booked Revenue", money(data.metrics.total_revenue_cents)],
    ["Pending Rewards", money(data.metrics.pending_rewards_cents)],
    ["Earned Rewards", money(data.metrics.earned_rewards_cents)],
  ];

  const navItems: Array<[View, string]> = [["overview", "Overview"], ["referrals", "Referrals"], ["rewards", "Rewards"], ["link", "My Link"]];
  const headerSubtitle = view === "overview" ? "Referral performance and rewards" : view === "referrals" ? "Attributed bookings and travel activity" : view === "rewards" ? "Reward status and payout history" : "Your referral link and guest offer";

  const table = (rows: Dashboard["bookings"], rewardOnly = false) => (
    <div style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ background: "#f8f9fa", textAlign: "left" }}>{(rewardOnly ? ["Guest","Confirmation","Travel Date","Reward","Status","Earned","Sent"] : ["Guest","Confirmation","Experience","Booked","Travel Date","Revenue","Status","Reward"]).map((h) => <th key={h} style={{ padding: "11px 14px", color: "#68717d" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => rewardOnly ? (
              <tr key={row.id} style={{ borderTop: "1px solid #eef1f4" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{row.customer_name || "Guest"}</td>
                <td style={{ padding: "12px 14px" }}>{row.confirmation_code || "—"}</td>
                <td style={{ padding: "12px 14px" }}>{date(row.activity_start_at)}</td>
                <td style={{ padding: "12px 14px", fontWeight: 800 }}>{money(row.partner_reward_cents)}</td>
                <td style={{ padding: "12px 14px" }}>{titleCase(row.reward_status)}</td>
                <td style={{ padding: "12px 14px" }}>{date(row.earned_at)}</td>
                <td style={{ padding: "12px 14px" }}>{date(row.sent_at)}</td>
              </tr>
            ) : (
              <tr key={row.id} style={{ borderTop: "1px solid #eef1f4" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{row.customer_name || "Guest"}</td>
                <td style={{ padding: "12px 14px" }}>{row.confirmation_code || "—"}</td>
                <td style={{ padding: "12px 14px" }}>{row.experience_name || "—"}</td>
                <td style={{ padding: "12px 14px" }}>{date(row.booked_at)}</td>
                <td style={{ padding: "12px 14px" }}>{date(row.activity_start_at)}</td>
                <td style={{ padding: "12px 14px" }}>{money(row.booking_revenue_cents)}</td>
                <td style={{ padding: "12px 14px" }}>{titleCase(row.booking_status)}</td>
                <td style={{ padding: "12px 14px" }}>{money(row.partner_reward_cents)} · {titleCase(row.reward_status)}</td>
              </tr>
            )) : <tr><td colSpan={rewardOnly ? 7 : 8} style={{ padding: 32, textAlign: "center", color: "#68717d" }}>No {rewardOnly ? "reward activity" : "referral bookings"} yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <main style={{ minHeight: "100vh", background: "#f1f3f5", color: "#202733", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "230px minmax(0,1fr)", minHeight: "100vh" }}>
        <aside style={{ background: "#202733", color: "white", padding: "26px 18px", display: "flex", flexDirection: "column" }}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ width: 165, filter: "brightness(0) invert(1)", marginBottom: 28 }} />
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".12em", opacity: .62, marginBottom: 8 }}>Ambassador Portal</div>
          <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3, marginBottom: 28 }}>{data.partner.name}</div>
          <nav style={{ display: "grid", gap: 8 }}>
            {navItems.map(([key, label]) => (
              <button key={key} onClick={() => setView(key)} style={{ textAlign: "left", border: 0, cursor: "pointer", color: "white", background: view === key ? "#d5521d" : "transparent", borderRadius: 9, padding: "11px 12px", fontWeight: view === key ? 800 : 500, fontSize: 16, opacity: view === key ? 1 : .82 }}>{label}</button>
            ))}
          </nav>
          <div style={{ marginTop: "auto", fontSize: 12, opacity: .66 }}>{data.profile.display_name}<br />{titleCase(data.profile.role)}</div>
        </aside>

        <section style={{ minWidth: 0 }}>
          <header style={{ background: "white", borderBottom: "1px solid #dfe4ea", padding: "18px 28px" }}>
            <h1 style={{ margin: 0, fontSize: 26 }}>{data.partner.name}</h1>
            <p style={{ margin: "5px 0 0", color: "#68717d" }}>{headerSubtitle}</p>
          </header>

          <div style={{ padding: 28 }}>
            {view === "overview" && <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
                {metrics.map(([label, value]) => <div key={label} style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 20 }}><div style={{ color: "#68717d", fontSize: 13, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div></div>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, marginBottom: 22 }}>
                <div style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 20 }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Your referral link</h2>
                  <div style={{ display: "flex", gap: 10 }}><input value={referralUrl} readOnly style={{ flex: 1, height: 42, border: "1px solid #cfd6de", borderRadius: 8, padding: "0 10px" }} /><button onClick={async () => { await navigator.clipboard.writeText(referralUrl); setCopied(true); setTimeout(() => setCopied(false), 1400); }} style={{ border: 0, borderRadius: 8, background: "#202733", color: "white", padding: "0 16px", fontWeight: 800 }}>{copied ? "Copied" : "Copy"}</button></div>
                  <p style={{ color: "#68717d", fontSize: 13, marginBottom: 0 }}>This link sends guests directly to Epic4X4Adventures.com. Attribution window: {data.partner.attribution_window_days} days.</p>
                </div>
                <div style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 20 }}>
                  <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Program setup</h2>
                  <div style={{ fontSize: 14, lineHeight: 1.7 }}><strong>Reward type:</strong> {titleCase(data.partner.reward_mode)}<br /><strong>Calculation:</strong> {data.partner.reward_basis === "percent" ? "Percentage" : "Flat amount"}<br /><strong>Partner reward:</strong> {partnerRewardDisplay}<br /><strong>Guest discount:</strong> {guestDiscountDisplay}<br /><strong>Promo code:</strong> {data.partner.promo_code || "—"}</div>
                </div>
              </div>
              <div style={{ marginBottom: 10, fontWeight: 800, fontSize: 18 }}>Recent referrals</div>
              {table(data.bookings.slice(0, 8))}
            </>}

            {view === "referrals" && <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
                {[["Referral Visits", data.metrics.visits.toLocaleString()], ["Attributed Bookings", data.metrics.bookings.toLocaleString()], ["Booked Revenue", money(data.metrics.total_revenue_cents)]].map(([label, value]) => <div key={label} style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 20 }}><div style={{ color: "#68717d", fontSize: 13, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div></div>)}
              </div>
              {table(data.bookings)}
            </>}

            {view === "rewards" && <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
                {[["Pending Rewards", money(data.metrics.pending_rewards_cents)], ["Earned Rewards", money(data.metrics.earned_rewards_cents)], ["Traveled Bookings", data.metrics.traveled.toLocaleString()]].map(([label, value]) => <div key={label} style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 20 }}><div style={{ color: "#68717d", fontSize: 13, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div></div>)}
              </div>
              {table(data.bookings.filter((row) => row.partner_reward_cents > 0 || row.reward_status !== "pending"), true)}
            </>}

            {view === "link" && <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 18 }}>
              <div style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 24 }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 21 }}>Your referral link</h2>
                <p style={{ color: "#68717d", lineHeight: 1.55, marginTop: 0 }}>Share this exact link with guests. Visits through it are attributed to {data.partner.name} for {data.partner.attribution_window_days} days.</p>
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}><input value={referralUrl} readOnly style={{ flex: 1, height: 46, border: "1px solid #cfd6de", borderRadius: 8, padding: "0 12px", fontSize: 15 }} /><button onClick={async () => { await navigator.clipboard.writeText(referralUrl); setCopied(true); setTimeout(() => setCopied(false), 1400); }} style={{ border: 0, borderRadius: 8, background: "#202733", color: "white", padding: "0 18px", fontWeight: 800 }}>{copied ? "Copied" : "Copy"}</button></div>
              </div>
              <div style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 24 }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 21 }}>Guest offer</h2>
                <div style={{ lineHeight: 1.8 }}><strong>Guest discount:</strong> {guestDiscountDisplay}<br /><strong>Promo code:</strong> {data.partner.promo_code || "No promo code"}<br /><strong>Partner reward:</strong> {partnerRewardDisplay}</div>
                <p style={{ color: "#68717d", fontSize: 13, lineHeight: 1.5, marginBottom: 0, marginTop: 16 }}>The referral link handles attribution automatically. If a guest discount is part of the arrangement, the promo code is shown here for the Ambassador to share when needed.</p>
              </div>
            </div>}
          </div>
        </section>
      </div>
    </main>
  );
}
