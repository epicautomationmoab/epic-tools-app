"use client";

import { useEffect, useMemo, useState } from "react";

type Booking = { id:string; confirmation_code:string|null; customer_name:string|null; experience_name:string|null; activity_start_at:string|null; partner_reward_cents:number; reward_status:string; booking_status:string };
type Partner = { id:string; name:string; slug:string; status:string; reward_mode:string; reward_basis:string; partner_reward_cents:number; partner_reward_percent:number; guest_discount_cents:number; guest_discount_percent:number; earned_cents:number; adjustment_total_cents:number; committed_cents:number; available_cents:number; recent_bookings:Booking[] };
type Payload = { partners:Partner[] };

const money=(c:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((c||0)/100);
const date=(v:string|null)=>v?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(v)):"—";

export default function AdminPortalPreview({ params }:{ params:Promise<{partnerId:string}> }){
  const [partnerId,setPartnerId]=useState(""); const [data,setData]=useState<Payload|null>(null); const [error,setError]=useState("");
  useEffect(()=>{params.then(p=>setPartnerId(p.partnerId));},[params]);
  useEffect(()=>{if(!partnerId)return;fetch("/api/ambassador/admin/partners",{cache:"no-store"}).then(async r=>{if(r.status===401||r.status===403){window.location.href="/ambassador/admin/login";return;}const p=await r.json();if(!r.ok)throw new Error(p.error||"Unable to load portal preview.");setData(p);}).catch(e=>setError(e instanceof Error?e.message:"Unable to load portal preview."));},[partnerId]);
  const partner=useMemo(()=>data?.partners.find(p=>p.id===partnerId)||null,[data,partnerId]);
  if(error)return <main style={{padding:40,fontFamily:"Arial,sans-serif"}}>{error}</main>;
  if(!partner)return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#eef2f5",fontFamily:"Arial,sans-serif",color:"#68717d"}}>Loading Ambassador portal preview…</main>;
  const partnerReward=partner.reward_basis==="percent"?`${partner.partner_reward_percent||0}%`:money(partner.partner_reward_cents||0);
  const guestDiscount=partner.reward_basis==="percent"?`${partner.guest_discount_percent||0}%`:money(partner.guest_discount_cents||0);
  return <main style={{minHeight:"100vh",display:"grid",gridTemplateColumns:"250px 1fr",fontFamily:"Arial,sans-serif",background:"#edf1f4",color:"#202733"}}>
    <aside style={{background:"linear-gradient(180deg,#182230 0%,#101722 100%)",color:"white",padding:"26px 20px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,opacity:.11,backgroundImage:"radial-gradient(circle at 20% 20%,#fff 1px,transparent 1px)",backgroundSize:"22px 22px"}}/>
      <div style={{position:"relative"}}><img src="/epic-logo.png" alt="Epic 4X4" style={{width:170,filter:"brightness(0) invert(1)"}}/><div style={{marginTop:24,fontSize:12,letterSpacing:1.5,opacity:.66}}>AMBASSADOR PORTAL</div><div style={{marginTop:8,fontSize:20,fontWeight:900}}>{partner.name}</div>
      <nav style={{display:"grid",gap:8,marginTop:28,fontSize:14}}>{["Overview","Referrals","Rewards","Redeem","My Link"].map((n,i)=><div key={n} style={{padding:"11px 12px",borderRadius:9,background:i===0?"#d5521d":"transparent",fontWeight:i===0?900:700}}>{n}</div>)}</nav></div>
    </aside>
    <section>
      <div style={{background:"#fff4e8",borderBottom:"1px solid #f0c899",padding:"10px 24px",color:"#8a4b12",fontSize:13,fontWeight:800}}>Admin Preview — viewing {partner.name} as they would see their portal. This preview is read-only.</div>
      <header style={{background:"white",padding:"24px 28px",borderBottom:"1px solid #dde3e8"}}><h1 style={{margin:0,fontSize:30}}>{partner.name}</h1><p style={{margin:"4px 0 0",color:"#68717d"}}>Referral performance and rewards</p></header>
      <div style={{padding:28,backgroundImage:"radial-gradient(circle at 90% 0%,rgba(213,82,29,.08),transparent 28%),linear-gradient(180deg,#f4f6f8 0%,#edf1f4 100%)"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:16}}>{[["Available to Redeem",partner.available_cents],["Earned + Adjustments",partner.earned_cents],["In Redemption",partner.committed_cents]].map(([l,v])=><div key={String(l)} style={{background:"white",border:"1px solid #dde3e8",borderRadius:16,padding:20,boxShadow:"0 12px 30px rgba(26,35,48,.06)"}}><div style={{fontSize:12,fontWeight:800,color:"#68717d",textTransform:"uppercase",letterSpacing:.6}}>{l}</div><div style={{fontSize:30,fontWeight:900,marginTop:6}}>{money(Number(v))}</div></div>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:18,marginTop:18}}>
          <div style={{background:"white",border:"1px solid #dde3e8",borderRadius:16,padding:22,boxShadow:"0 12px 30px rgba(26,35,48,.05)"}}><h2 style={{margin:"0 0 12px"}}>Recent referrals</h2>{partner.recent_bookings.length?partner.recent_bookings.slice(0,8).map(b=><div key={b.id} style={{display:"grid",gridTemplateColumns:"1.1fr 1.4fr .8fr .7fr",gap:12,padding:"12px 0",borderTop:"1px solid #edf0f3",fontSize:13}}><strong>{b.customer_name||b.confirmation_code||"Guest"}</strong><span>{b.experience_name||"—"}</span><span>{date(b.activity_start_at)}</span><span style={{fontWeight:800}}>{money(b.partner_reward_cents)}</span></div>):<div style={{color:"#68717d",padding:"24px 0"}}>No referral bookings yet.</div>}</div>
          <div style={{background:"linear-gradient(145deg,#202733,#151c26)",color:"white",borderRadius:16,padding:22,boxShadow:"0 14px 32px rgba(20,28,39,.16)"}}><div style={{fontSize:12,opacity:.7,textTransform:"uppercase",letterSpacing:.7}}>Program setup</div><h2 style={{margin:"8px 0 18px"}}>Referral rewards</h2><div style={{display:"grid",gap:12,fontSize:14}}><div><span style={{opacity:.68}}>Referral code</span><br/><strong>{partner.slug}</strong></div><div><span style={{opacity:.68}}>Partner reward</span><br/><strong>{partnerReward}</strong></div><div><span style={{opacity:.68}}>Guest discount</span><br/><strong>{guestDiscount}</strong></div></div></div>
        </div>
        <button onClick={()=>window.close()} style={{marginTop:18,border:"1px solid #cdd4dc",background:"white",borderRadius:9,padding:"10px 14px",fontWeight:800,cursor:"pointer"}}>Close Preview</button>
      </div>
    </section>
  </main>;
}
