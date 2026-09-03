"use client";

import { useEffect, useMemo, useState } from "react";

type Dashboard = {
  profile: { display_name: string; role: string };
  partner: { name: string; slug: string; reward_mode: string; partner_reward_cents: number; guest_discount_cents: number; promo_code: string | null; attribution_window_days: number };
  metrics: { visits: number; bookings: number; traveled: number; total_revenue_cents: number; pending_rewards_cents: number; earned_rewards_cents: number };
  bookings: Array<{ id: string; confirmation_code: string | null; customer_name: string | null; experience_name: string | null; booked_at: string | null; activity_start_at: string | null; booking_status: string; booking_revenue_cents: number; partner_reward_cents: number; reward_status: string }>;
};

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((cents || 0) / 100);
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—";

export default function AmbassadorDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

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

  const metrics = [
    ["Referral Visits", data.metrics.visits.toLocaleString()],
    ["Bookings", data.metrics.bookings.toLocaleString()],
    ["Traveled", data.metrics.traveled.toLocaleString()],
    ["Booked Revenue", money(data.metrics.total_revenue_cents)],
    ["Pending Rewards", money(data.metrics.pending_rewards_cents)],
    ["Earned Rewards", money(data.metrics.earned_rewards_cents)],
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#f1f3f5", color: "#202733", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "230px minmax(0,1fr)", minHeight: "100vh" }}>
        <aside style={{ background: "#202733", color: "white", padding: "26px 18px", display: "flex", flexDirection: "column" }}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ width: 165, filter: "brightness(0) invert(1)", marginBottom: 28 }} />
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".12em", opacity: .62, marginBottom: 8 }}>Ambassador Portal</div>
          <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3, marginBottom: 28 }}>{data.partner.name}</div>
          <nav style={{ display: "grid", gap: 8 }}>
            <div style={{ background: "#d5521d", borderRadius: 9, padding: "11px 12px", fontWeight: 800 }}>Overview</div>
            <div style={{ padding: "11px 12px", opacity: .82 }}>Referrals</div>
            <div style={{ padding: "11px 12px", opacity: .82 }}>Rewards</div>
            <div style={{ padding: "11px 12px", opacity: .82 }}>My Link</div>
          </nav>
          <div style={{ marginTop: "auto", fontSize: 12, opacity: .66 }}>{data.profile.display_name}<br />{data.profile.role}</div>
        </aside>

        <section style={{ minWidth: 0 }}>
          <header style={{ background: "white", borderBottom: "1px solid #dfe4ea", padding: "18px 28px" }}>
            <h1 style={{ margin: 0, fontSize: 26 }}>{data.partner.name}</h1>
            <p style={{ margin: "5px 0 0", color: "#68717d" }}>Referral performance and rewards</p>
          </header>

          <div style={{ padding: 28 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
              {metrics.map(([label, value]) => (
                <div key={label} style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 20 }}>
                  <div style={{ color: "#68717d", fontSize: 13, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, marginBottom: 22 }}>
              <div style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 20 }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Your referral link</h2>
                <div style={{ display: "flex", gap: 10 }}>
                  <input value={referralUrl} readOnly style={{ flex: 1, height: 42, border: "1px solid #cfd6de", borderRadius: 8, padding: "0 10px" }} />
                  <button onClick={() => navigator.clipboard.writeText(referralUrl)} style={{ border: 0, borderRadius: 8, background: "#202733", color: "white", padding: "0 16px", fontWeight: 800 }}>Copy</button>
                </div>
                <p style={{ color: "#68717d", fontSize: 13, marginBottom: 0 }}>This link sends guests directly to Epic4X4Adventures.com. Attribution window: {data.partner.attribution_window_days} days.</p>
              </div>

              <div style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 20 }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Program setup</h2>
                <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                  <strong>Reward type:</strong> {data.partner.reward_mode.replaceAll("_", " ")}<br />
                  <strong>Partner reward:</strong> {money(data.partner.partner_reward_cents)}<br />
                  <strong>Guest discount:</strong> {money(data.partner.guest_discount_cents)}<br />
                  <strong>Promo code:</strong> {data.partner.promo_code || "—"}
                </div>
              </div>
            </div>

            <div style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e9ee" }}><h2 style={{ margin: 0, fontSize: 18 }}>Recent referrals</h2></div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead><tr style={{ background: "#f8f9fa", textAlign: "left" }}>{["Guest","Experience","Booked","Travel Date","Revenue","Status","Reward"].map((h) => <th key={h} style={{ padding: "11px 14px", color: "#68717d" }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.bookings.length ? data.bookings.map((row) => (
                      <tr key={row.id} style={{ borderTop: "1px solid #eef1f4" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 700 }}>{row.customer_name || row.confirmation_code || "Guest"}</td>
                        <td style={{ padding: "12px 14px" }}>{row.experience_name || "—"}</td>
                        <td style={{ padding: "12px 14px" }}>{date(row.booked_at)}</td>
                        <td style={{ padding: "12px 14px" }}>{date(row.activity_start_at)}</td>
                        <td style={{ padding: "12px 14px" }}>{money(row.booking_revenue_cents)}</td>
                        <td style={{ padding: "12px 14px", textTransform: "capitalize" }}>{row.booking_status}</td>
                        <td style={{ padding: "12px 14px" }}>{money(row.partner_reward_cents)} · {row.reward_status}</td>
                      </tr>
                    )) : <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "#68717d" }}>No referral bookings yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
