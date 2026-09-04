"use client";

import { FormEvent, useEffect, useState } from "react";

type Wallet = {
  earned_cents: number;
  committed_cents: number;
  available_cents: number;
  redemptions: Array<{ id: string; amount_cents: number; method: string; method_details: Record<string, unknown>; status: string; requested_at: string; sent_at?: string | null; completed_at?: string | null }>;
};
type Dashboard = { profile: { display_name: string; role: string }; partner: { name: string } };
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—";
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());

export default function AmbassadorRedeemPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("gift_card");
  const [brand, setBrand] = useState("Visa eGift");
  const [handle, setHandle] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [payee, setPayee] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [dashRes, walletRes] = await Promise.all([fetch("/api/ambassador/dashboard", { cache: "no-store" }), fetch("/api/ambassador/redemptions", { cache: "no-store" })]);
    if (dashRes.status === 401 || walletRes.status === 401) { window.location.href = "/ambassador/login"; return; }
    const dash = await dashRes.json(); const w = await walletRes.json();
    if (!dashRes.ok) throw new Error(dash.error || "Unable to load Ambassador portal.");
    if (!walletRes.ok) throw new Error(w.error || "Unable to load redemption wallet.");
    setDashboard(dash); setWallet(w);
  }
  useEffect(() => { load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load redemption wallet.")); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage(""); setSubmitting(true);
    const amountCents = Math.round(Number(amount) * 100);
    const methodDetails = method === "gift_card" ? { brand } : method === "venmo" ? { handle } : method === "paypal" ? { email: paypalEmail } : { payee, address };
    try {
      const response = await fetch("/api/ambassador/redemptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount_cents: amountCents, method, method_details: methodDetails }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to request redemption.");
      setAmount(""); setMessage("Redemption request submitted."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to request redemption."); }
    finally { setSubmitting(false); }
  }

  if (!dashboard || !wallet) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f1f3f5", color: "#68717d" }}>{error || "Loading rewards…"}</main>;

  return (
    <main style={{ minHeight: "100vh", background: "#f1f3f5", color: "#202733", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "230px minmax(0,1fr)", minHeight: "100vh" }}>
        <aside style={{ background: "#202733", color: "white", padding: "26px 18px", display: "flex", flexDirection: "column" }}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ width: 165, filter: "brightness(0) invert(1)", marginBottom: 28 }} />
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".12em", opacity: .62, marginBottom: 8 }}>Ambassador Portal</div>
          <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3, marginBottom: 28 }}>{dashboard.partner.name}</div>
          <nav style={{ display: "grid", gap: 8 }}>
            <button onClick={() => window.location.href = "/ambassador"} style={{ textAlign: "left", border: 0, cursor: "pointer", color: "white", background: "transparent", padding: "11px 12px", fontSize: 16, opacity: .82 }}>Overview</button>
            <button onClick={() => window.location.href = "/ambassador"} style={{ textAlign: "left", border: 0, cursor: "pointer", color: "white", background: "transparent", padding: "11px 12px", fontSize: 16, opacity: .82 }}>Referrals</button>
            <button onClick={() => window.location.href = "/ambassador"} style={{ textAlign: "left", border: 0, cursor: "pointer", color: "white", background: "transparent", padding: "11px 12px", fontSize: 16, opacity: .82 }}>Rewards</button>
            <button style={{ textAlign: "left", border: 0, cursor: "default", color: "white", background: "#d5521d", borderRadius: 9, padding: "11px 12px", fontWeight: 800, fontSize: 16 }}>Redeem</button>
            <button onClick={() => window.location.href = "/ambassador"} style={{ textAlign: "left", border: 0, cursor: "pointer", color: "white", background: "transparent", padding: "11px 12px", fontSize: 16, opacity: .82 }}>My Link</button>
          </nav>
          <div style={{ marginTop: "auto", fontSize: 12, opacity: .66 }}>{dashboard.profile.display_name}<br />{titleCase(dashboard.profile.role)}</div>
        </aside>

        <section style={{ minWidth: 0 }}>
          <header style={{ background: "white", borderBottom: "1px solid #dfe4ea", padding: "18px 28px" }}><h1 style={{ margin: 0, fontSize: 26 }}>{dashboard.partner.name}</h1><p style={{ margin: "5px 0 0", color: "#68717d" }}>Redeem earned rewards</p></header>
          <div style={{ padding: 28 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 22 }}>
              {[["Earned Rewards", money(wallet.earned_cents)], ["In Redemption", money(wallet.committed_cents)], ["Available to Redeem", money(wallet.available_cents)]].map(([label, value]) => <div key={label} style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 20 }}><div style={{ color: "#68717d", fontSize: 13, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div></div>)}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 22 }}>
              <form onSubmit={submit} style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 22 }}>
                <h2 style={{ margin: "0 0 6px" }}>Request a redemption</h2>
                <p style={{ margin: "0 0 18px", color: "#68717d", lineHeight: 1.5 }}>You can redeem up to your available earned reward balance. Requests are reviewed before fulfillment.</p>
                <label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13 }}>Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0.01" step="0.01" max={(wallet.available_cents / 100).toFixed(2)} required style={{ height: 44, border: "1px solid #cfd6de", borderRadius: 8, padding: "0 10px" }} /></label>
                <label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13, marginTop: 14 }}>How would you like to receive it?<select value={method} onChange={(e) => setMethod(e.target.value)} style={{ height: 44, border: "1px solid #cfd6de", borderRadius: 8, padding: "0 10px" }}><option value="gift_card">Digital Gift Card</option><option value="venmo">Venmo</option><option value="paypal">PayPal</option><option value="check">Mailed Check</option></select></label>
                {method === "gift_card" && <label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13, marginTop: 14 }}>Gift card<select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ height: 44, border: "1px solid #cfd6de", borderRadius: 8, padding: "0 10px" }}><option>Visa eGift</option><option>Amazon</option><option>Walmart</option><option>Target</option><option>Home Depot</option><option>Starbucks</option></select></label>}
                {method === "venmo" && <label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13, marginTop: 14 }}>Venmo username, phone, or email<input value={handle} onChange={(e) => setHandle(e.target.value)} required style={{ height: 44, border: "1px solid #cfd6de", borderRadius: 8, padding: "0 10px" }} /></label>}
                {method === "paypal" && <label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13, marginTop: 14 }}>PayPal email<input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} required style={{ height: 44, border: "1px solid #cfd6de", borderRadius: 8, padding: "0 10px" }} /></label>}
                {method === "check" && <><label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13, marginTop: 14 }}>Pay check to<input value={payee} onChange={(e) => setPayee(e.target.value)} required style={{ height: 44, border: "1px solid #cfd6de", borderRadius: 8, padding: "0 10px" }} /></label><label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13, marginTop: 14 }}>Mailing address<textarea value={address} onChange={(e) => setAddress(e.target.value)} required rows={4} style={{ border: "1px solid #cfd6de", borderRadius: 8, padding: 10 }} /></label></>}
                {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}{message ? <p style={{ color: "#18794e" }}>{message}</p> : null}
                <button type="submit" disabled={submitting || wallet.available_cents <= 0} style={{ width: "100%", height: 46, marginTop: 18, border: 0, borderRadius: 8, background: wallet.available_cents > 0 ? "#d5521d" : "#b8bec6", color: "white", fontWeight: 800 }}>{submitting ? "Submitting…" : "Request Redemption"}</button>
              </form>

              <div style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, padding: 22 }}><h2 style={{ margin: "0 0 10px" }}>How redemption works</h2><p style={{ color: "#68717d", lineHeight: 1.6 }}>Only rewards that have been earned after a completed guest visit are available to redeem. Once you submit a request, that amount is reserved from your available balance so it cannot be requested twice.</p><p style={{ color: "#68717d", lineHeight: 1.6 }}>Gift cards are delivered digitally. Venmo and PayPal payments are sent to the account information you provide. Checks are mailed to the address you provide.</p></div>
            </div>

            <div style={{ background: "white", border: "1px solid #dfe4ea", borderRadius: 14, overflow: "hidden" }}><div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e9ee" }}><h2 style={{ margin: 0, fontSize: 18 }}>Redemption history</h2></div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}><thead><tr style={{ background: "#f8f9fa", textAlign: "left" }}>{["Requested","Amount","Method","Status","Sent/Completed"].map((h) => <th key={h} style={{ padding: "11px 14px", color: "#68717d" }}>{h}</th>)}</tr></thead><tbody>{wallet.redemptions.length ? wallet.redemptions.map((row) => <tr key={row.id} style={{ borderTop: "1px solid #eef1f4" }}><td style={{ padding: "12px 14px" }}>{date(row.requested_at)}</td><td style={{ padding: "12px 14px", fontWeight: 800 }}>{money(row.amount_cents)}</td><td style={{ padding: "12px 14px" }}>{titleCase(row.method)}</td><td style={{ padding: "12px 14px" }}>{titleCase(row.status)}</td><td style={{ padding: "12px 14px" }}>{date(row.completed_at || row.sent_at)}</td></tr>) : <tr><td colSpan={5} style={{ padding: 28, textAlign: "center", color: "#68717d" }}>No redemption requests yet.</td></tr>}</tbody></table></div></div>
          </div>
        </section>
      </div>
    </main>
  );
}
