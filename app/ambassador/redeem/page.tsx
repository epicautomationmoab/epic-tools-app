"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CatalogItem = {
  id: string; slug: string; category: string; display_name: string; image_status: string; image_url: string | null;
  redemption_type: string; amount_type: "fixed" | "custom"; allowed_amounts_cents: number[]; min_amount_cents: number; max_amount_cents: number | null;
  fee_cents: number; fee_note: string | null; sort_order: number;
};
type Wallet = {
  earned_cents: number; committed_cents: number; available_cents: number; catalog: CatalogItem[];
  redemptions: Array<{ id: string; amount_cents: number; method: string; method_details: Record<string, unknown>; status: string; requested_at: string; sent_at?: string | null; completed_at?: string | null }>;
};
type Dashboard = { profile: { display_name: string; role: string }; partner: { name: string } };

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—";
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
const categoryOrder = ["Moab & Local", "Moab Dining", "Outdoor & Local Retail", "Travel & Lodging", "National Brands", "Cash & Digital", "Open Loop Cards"];

function placeholderGradient(slug: string) {
  const variants = ["linear-gradient(135deg,#202733,#56606d)", "linear-gradient(135deg,#9f3f21,#d5521d)", "linear-gradient(135deg,#173b2e,#2b7457)", "linear-gradient(135deg,#32396b,#5962a0)", "linear-gradient(135deg,#5a412c,#a77d54)"];
  let score = 0; for (const ch of slug) score += ch.charCodeAt(0); return variants[score % variants.length];
}

export default function AmbassadorRedeemPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [rewardValue, setRewardValue] = useState("");
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

  const selected = useMemo(() => wallet?.catalog.find((item) => item.id === selectedId) || null, [wallet, selectedId]);
  const rewardValueCents = selected?.amount_type === "fixed" ? Number(rewardValue || 0) : Math.round(Number(rewardValue || 0) * 100);
  const feeCents = selected?.fee_cents || 0;
  const totalDeduction = Math.max(0, rewardValueCents + feeCents);

  function choose(item: CatalogItem) {
    setSelectedId(item.id); setMessage(""); setError(""); setHandle(""); setPaypalEmail(""); setPayee(""); setAddress("");
    setRewardValue(item.amount_type === "fixed" && item.allowed_amounts_cents.length ? String(item.allowed_amounts_cents[0]) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setError(""); setMessage(""); setSubmitting(true);
    const details = selected.redemption_type === "venmo" ? { handle } : selected.redemption_type === "paypal" ? { email: paypalEmail } : selected.redemption_type === "check" ? { payee, address } : {};
    try {
      const response = await fetch("/api/ambassador/redemptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ catalog_id: selected.id, reward_value_cents: rewardValueCents, method_details: details }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to request redemption.");
      setMessage("Redemption request submitted."); setSelectedId(""); setRewardValue(""); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to request redemption."); }
    finally { setSubmitting(false); }
  }

  if (!dashboard || !wallet) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f1f3f5", color: "#68717d" }}>{error || "Loading rewards…"}</main>;

  const grouped = categoryOrder.map((category) => ({ category, items: wallet.catalog.filter((item) => item.category === category) })).filter((group) => group.items.length);

  return <main style={{ minHeight: "100vh", background: "#f1f3f5", color: "#202733", fontFamily: "Arial, sans-serif" }}>
    <div style={{ display: "grid", gridTemplateColumns: "230px minmax(0,1fr)", minHeight: "100vh" }}>
      <aside style={{ background: "#202733", color: "white", padding: "26px 18px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", boxSizing: "border-box" }}>
        <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ width: 165, filter: "brightness(0) invert(1)", marginBottom: 28 }} />
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".12em", opacity: .62, marginBottom: 8 }}>Ambassador Portal</div><div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3, marginBottom: 28 }}>{dashboard.partner.name}</div>
        <nav style={{ display: "grid", gap: 8 }}>{["Overview","Referrals","Rewards","My Link"].map((label)=><button key={label} onClick={()=>window.location.href="/ambassador"} style={{ textAlign:"left",border:0,cursor:"pointer",color:"white",background:"transparent",padding:"11px 12px",fontSize:16,opacity:.82 }}>{label}</button>)}<button style={{ textAlign:"left",border:0,color:"white",background:"#d5521d",borderRadius:9,padding:"11px 12px",fontWeight:800,fontSize:16 }}>Redeem Rewards</button></nav>
        <div style={{ marginTop:"auto",fontSize:12,opacity:.66 }}>{dashboard.profile.display_name}<br />{titleCase(dashboard.profile.role)}</div>
      </aside>

      <section style={{ minWidth: 0 }}>
        <header style={{ background:"white",borderBottom:"1px solid #dfe4ea",padding:"18px 28px" }}><h1 style={{ margin:0,fontSize:28 }}>Redeem Rewards</h1><p style={{ margin:"5px 0 0",color:"#68717d" }}>Pick something fun from your earned rewards.</p></header>
        <div style={{ padding: 28 }}>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginBottom:22 }}>{[["Earned Rewards",wallet.earned_cents],["In Redemption",wallet.committed_cents],["Available to Redeem",wallet.available_cents]].map(([label,value])=><div key={String(label)} style={{ background:"white",border:"1px solid #dfe4ea",borderRadius:14,padding:20 }}><div style={{ color:"#68717d",fontSize:13,fontWeight:700 }}>{label}</div><div style={{ fontSize:28,fontWeight:900,marginTop:6 }}>{money(Number(value))}</div></div>)}</div>

          {selected ? <form onSubmit={submit} style={{ background:"white",border:"2px solid #d5521d",borderRadius:16,padding:20,marginBottom:26,display:"grid",gridTemplateColumns:"220px minmax(0,1fr)",gap:22 }}>
            <div style={{ height:135,borderRadius:14,overflow:"hidden",background:selected.image_url?"#fff":placeholderGradient(selected.slug),display:"grid",placeItems:"center",color:"white",fontWeight:900,fontSize:24,textAlign:"center",padding:12,boxSizing:"border-box" }}>{selected.image_url?<img src={selected.image_url} alt={selected.display_name} style={{ width:"100%",height:"100%",objectFit:"cover" }}/>:selected.display_name}</div>
            <div><div style={{ display:"flex",justifyContent:"space-between",gap:12,alignItems:"start" }}><div><div style={{ color:"#68717d",fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em" }}>Your Selection</div><h2 style={{ margin:"4px 0 2px" }}>{selected.display_name}</h2><div style={{ color:"#68717d" }}>{selected.category}</div></div><button type="button" onClick={()=>{setSelectedId("");setRewardValue("");}} style={{ border:"1px solid #d7dde5",background:"white",borderRadius:8,padding:"8px 11px",cursor:"pointer" }}>Clear</button></div>
              <div style={{ marginTop:16 }}>{selected.amount_type === "fixed" ? <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>{selected.allowed_amounts_cents.map((amount)=><button type="button" key={amount} onClick={()=>setRewardValue(String(amount))} style={{ border:rewardValue===String(amount)?"2px solid #d5521d":"1px solid #d7dde5",background:rewardValue===String(amount)?"#fff4ef":"white",borderRadius:8,padding:"9px 14px",fontWeight:800,cursor:"pointer" }}>{money(amount)}</button>)}</div> : <label style={{ display:"grid",gap:6,fontSize:13,fontWeight:800,maxWidth:260 }}>Amount<input type="number" min={(selected.min_amount_cents/100).toFixed(2)} max={selected.max_amount_cents?(selected.max_amount_cents/100).toFixed(2):undefined} step="1" value={rewardValue} onChange={(e)=>setRewardValue(e.target.value)} style={{ height:42,border:"1px solid #cfd6de",borderRadius:8,padding:"0 10px" }}/></label>}</div>
              {selected.redemption_type === "venmo" && <input placeholder="Venmo username, phone, or email" value={handle} onChange={(e)=>setHandle(e.target.value)} style={{ marginTop:14,width:"100%",height:42,border:"1px solid #cfd6de",borderRadius:8,padding:"0 10px",boxSizing:"border-box" }}/>} 
              {selected.redemption_type === "paypal" && <input type="email" placeholder="PayPal email" value={paypalEmail} onChange={(e)=>setPaypalEmail(e.target.value)} style={{ marginTop:14,width:"100%",height:42,border:"1px solid #cfd6de",borderRadius:8,padding:"0 10px",boxSizing:"border-box" }}/>} 
              {selected.redemption_type === "check" && <div style={{ display:"grid",gridTemplateColumns:"1fr 1.5fr",gap:10,marginTop:14 }}><input placeholder="Pay check to" value={payee} onChange={(e)=>setPayee(e.target.value)} style={{ height:42,border:"1px solid #cfd6de",borderRadius:8,padding:"0 10px" }}/><input placeholder="Mailing address" value={address} onChange={(e)=>setAddress(e.target.value)} style={{ height:42,border:"1px solid #cfd6de",borderRadius:8,padding:"0 10px" }}/></div>}
              {selected.fee_note ? <div style={{ marginTop:14,background:"#fff7e8",border:"1px solid #f1c779",borderRadius:9,padding:"10px 12px",color:"#744b12",fontSize:13 }}><strong>Fees apply.</strong> {selected.fee_note}</div>:null}
              <div style={{ marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"end",gap:16,flexWrap:"wrap" }}><div style={{ fontSize:13,color:"#68717d" }}>Reward value: <strong style={{ color:"#202733" }}>{money(rewardValueCents)}</strong>{feeCents>0?<><br/>Fee: <strong style={{ color:"#202733" }}>{money(feeCents)}</strong><br/>Total deduction: <strong style={{ color:"#d5521d" }}>{money(totalDeduction)}</strong></>:null}</div><button disabled={submitting||rewardValueCents<=0||totalDeduction>wallet.available_cents} style={{ border:0,borderRadius:9,background:rewardValueCents>0&&totalDeduction<=wallet.available_cents?"#d5521d":"#b8bec6",color:"white",padding:"12px 22px",fontWeight:900,cursor:"pointer" }}>{submitting?"Submitting…":"Redeem This Reward"}</button></div>
              {error?<div style={{ marginTop:10,color:"#b42318",fontWeight:700 }}>{error}</div>:null}{message?<div style={{ marginTop:10,color:"#18794e",fontWeight:700 }}>{message}</div>:null}
            </div>
          </form>:null}

          {grouped.map((group)=><section key={group.category} style={{ marginBottom:30 }}><h2 style={{ margin:"0 0 14px",fontSize:20 }}>{group.category}</h2><div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:16 }}>{group.items.map((item)=><article key={item.id} style={{ background:"white",border:selectedId===item.id?"2px solid #d5521d":"1px solid #dfe4ea",borderRadius:14,padding:12,boxShadow:"0 3px 10px rgba(32,39,51,.04)" }}><div style={{ aspectRatio:"1.58/1",borderRadius:11,overflow:"hidden",background:item.image_url?"#fff":placeholderGradient(item.slug),display:"grid",placeItems:"center",color:"white",fontWeight:900,fontSize:20,textAlign:"center",padding:12,boxSizing:"border-box" }}>{item.image_url?<img src={item.image_url} alt={item.display_name} style={{ width:"100%",height:"100%",objectFit:"cover" }}/>:<span>{item.display_name}<br/><small style={{ fontSize:11,opacity:.75 }}>IMAGE COMING SOON</small></span>}</div><div style={{ padding:"10px 2px 2px" }}><strong style={{ display:"block",fontSize:14,minHeight:34 }}>{item.display_name}</strong><div style={{ color:"#68717d",fontSize:12,minHeight:31 }}>{item.amount_type==="fixed"?item.allowed_amounts_cents.map(money).join(" · "):`Custom amount from ${money(item.min_amount_cents)}`}</div>{item.fee_note?<div style={{ color:"#9f5a13",fontSize:11,fontWeight:700,marginTop:5 }}>* Fees apply</div>:null}<button onClick={()=>choose(item)} style={{ width:"100%",marginTop:10,border:0,borderRadius:8,background:"#202733",color:"white",padding:"9px 10px",fontWeight:800,cursor:"pointer" }}>Select</button></div></article>)}</div></section>)}

          <div style={{ background:"white",border:"1px solid #dfe4ea",borderRadius:14,overflow:"hidden",marginTop:24 }}><div style={{ padding:"18px 20px",borderBottom:"1px solid #e5e9ee" }}><h2 style={{ margin:0,fontSize:18 }}>Redemption history</h2></div><div style={{ overflowX:"auto" }}><table style={{ width:"100%",borderCollapse:"collapse",fontSize:14 }}><thead><tr style={{ background:"#f8f9fa",textAlign:"left" }}>{["Requested","Amount","Reward","Status","Sent/Completed"].map((h)=><th key={h} style={{ padding:"11px 14px",color:"#68717d" }}>{h}</th>)}</tr></thead><tbody>{wallet.redemptions.length?wallet.redemptions.map((row)=><tr key={row.id} style={{ borderTop:"1px solid #eef1f4" }}><td style={{ padding:"12px 14px" }}>{date(row.requested_at)}</td><td style={{ padding:"12px 14px",fontWeight:800 }}>{money(row.amount_cents)}</td><td style={{ padding:"12px 14px" }}>{String(row.method_details?.brand||titleCase(row.method))}</td><td style={{ padding:"12px 14px" }}>{titleCase(row.status)}</td><td style={{ padding:"12px 14px" }}>{date(row.completed_at||row.sent_at)}</td></tr>):<tr><td colSpan={5} style={{ padding:28,textAlign:"center",color:"#68717d" }}>No redemption requests yet.</td></tr>}</tbody></table></div></div>
        </div>
      </section>
    </div>
  </main>;
}
