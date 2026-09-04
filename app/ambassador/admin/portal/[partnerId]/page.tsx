"use client";

import { useEffect, useMemo, useState } from "react";

type Booking = { id:string; confirmation_code:string|null; customer_name:string|null; experience_name:string|null; activity_start_at:string|null; partner_reward_cents:number; reward_status:string; booking_status:string };
type Partner = { id:string; name:string; slug:string; status:string; reward_mode:string; reward_basis:string; partner_reward_cents:number; partner_reward_percent:number; guest_discount_cents:number; guest_discount_percent:number; earned_cents:number; adjustment_total_cents:number; committed_cents:number; available_cents:number; recent_bookings:Booking[] };
type Reward = { id:string; display_name:string; category:string; image_status:string; image_url:string|null; redemption_type:string; amount_type:string; allowed_amounts_cents:number[]; min_amount_cents:number; fee_cents:number; fee_note:string|null; active:boolean };
type Payload = { partners:Partner[] };

type Tab = "Overview"|"Referrals"|"Rewards"|"Redeem"|"My Link";
const tabs:Tab[]=["Overview","Referrals","Rewards","Redeem","My Link"];
const money=(c:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format((c||0)/100);
const date=(v:string|null)=>v?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(v)):"—";
const referralUrl=(slug:string)=>`https://www.epic4x4adventures.com/?ref=${encodeURIComponent(slug)}`;
const iconMap:Record<Tab,string>={Overview:"⌂",Referrals:"↗",Rewards:"★",Redeem:"🎁","My Link":"⌁"};

const card:React.CSSProperties={background:"rgba(255,255,255,.96)",border:"1px solid rgba(214,221,229,.95)",borderRadius:18,boxShadow:"0 16px 42px rgba(26,35,48,.07)"};

export default function AdminPortalPreview({ params }:{ params:Promise<{partnerId:string}> }){
  const [partnerId,setPartnerId]=useState(""); const [data,setData]=useState<Payload|null>(null); const [catalog,setCatalog]=useState<Reward[]>([]); const [error,setError]=useState(""); const [tab,setTab]=useState<Tab>("Overview");
  useEffect(()=>{params.then(p=>setPartnerId(p.partnerId));},[params]);
  useEffect(()=>{if(!partnerId)return;Promise.all([
    fetch("/api/ambassador/admin/partners",{cache:"no-store"}),
    fetch("/api/ambassador/admin/reward-catalog",{cache:"no-store"})
  ]).then(async ([r,c])=>{if(r.status===401||r.status===403){window.location.href="/ambassador/admin/login";return;}const p=await r.json();if(!r.ok)throw new Error(p.error||"Unable to load portal preview.");setData(p);if(c.ok){const cp=await c.json();setCatalog((cp.rewards||[]).filter((x:Reward)=>x.active));}}).catch(e=>setError(e instanceof Error?e.message:"Unable to load portal preview."));},[partnerId]);
  const partner=useMemo(()=>data?.partners.find(p=>p.id===partnerId)||null,[data,partnerId]);
  if(error)return <main style={{padding:40,fontFamily:"Arial,sans-serif"}}>{error}</main>;
  if(!partner)return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#eef2f5",fontFamily:"Arial,sans-serif",color:"#68717d"}}>Loading Ambassador portal preview…</main>;
  const partnerReward=partner.reward_basis==="percent"?`${partner.partner_reward_percent||0}%`:money(partner.partner_reward_cents||0);
  const guestDiscount=partner.reward_basis==="percent"?`${partner.guest_discount_percent||0}%`:money(partner.guest_discount_cents||0);
  const pending=partner.recent_bookings.filter(b=>b.reward_status==="pending").reduce((s,b)=>s+(b.partner_reward_cents||0),0);
  const earned=partner.earned_cents;

  return <main style={{minHeight:"100vh",display:"grid",gridTemplateColumns:"270px 1fr",fontFamily:"Arial,sans-serif",background:"#e9eef2",color:"#202733"}}>
    <aside style={{background:"linear-gradient(180deg,#101923 0%,#121d2a 58%,#0c141e 100%)",color:"white",padding:"28px 20px 24px",position:"relative",overflow:"hidden",minHeight:"100vh"}}>
      <div style={{position:"absolute",inset:0,opacity:.16,backgroundImage:"radial-gradient(ellipse at 18% 10%,transparent 0 28px,rgba(255,255,255,.18) 29px 30px,transparent 31px 52px,rgba(255,255,255,.11) 53px 54px,transparent 55px),radial-gradient(ellipse at 78% 42%,transparent 0 38px,rgba(255,255,255,.14) 39px 40px,transparent 41px 68px,rgba(255,255,255,.08) 69px 70px,transparent 71px)",backgroundSize:"220px 180px,260px 220px"}}/>
      <div style={{position:"relative",zIndex:1}}>
        <img src="/epic-logo.png" alt="Epic 4X4" style={{width:182,filter:"brightness(0) invert(1)"}}/>
        <div style={{marginTop:28,fontSize:11,letterSpacing:2,opacity:.6}}>AMBASSADOR PORTAL</div>
        <div style={{marginTop:8,fontSize:20,fontWeight:900,lineHeight:1.08}}>{partner.name}</div>
        <div style={{fontSize:12,opacity:.6,marginTop:5}}>Referral code · {partner.slug}</div>
        <nav style={{display:"grid",gap:8,marginTop:30,fontSize:14}}>{tabs.map(n=><button key={n} onClick={()=>setTab(n)} style={{display:"grid",gridTemplateColumns:"26px 1fr",alignItems:"center",textAlign:"left",padding:"12px 13px",borderRadius:10,border:0,color:"white",cursor:"pointer",background:tab===n?"linear-gradient(90deg,#e14c22,#d5521d)":"transparent",fontWeight:tab===n?900:700,boxShadow:tab===n?"0 10px 22px rgba(213,82,29,.24)":"none"}}><span style={{opacity:.9}}>{iconMap[n]}</span><span>{n}</span></button>)}</nav>
        <div style={{marginTop:34,padding:"14px",border:"1px solid rgba(255,255,255,.12)",borderRadius:14,background:"rgba(255,255,255,.05)"}}><div style={{fontSize:11,opacity:.6,textTransform:"uppercase",letterSpacing:1}}>Admin support view</div><div style={{fontSize:12,lineHeight:1.45,marginTop:6,opacity:.82}}>Read-only preview of this partner's Ambassador experience.</div></div>
      </div>
    </aside>

    <section style={{minWidth:0}}>
      <div style={{background:"linear-gradient(90deg,#fff1e4,#fff8f1)",borderBottom:"1px solid #efc290",padding:"10px 28px",color:"#8a4b12",fontSize:13,fontWeight:800}}>Admin Preview — viewing {partner.name}. This preview is read-only.</div>
      <header style={{background:"rgba(255,255,255,.96)",padding:"24px 30px",borderBottom:"1px solid #dce2e8",display:"flex",justifyContent:"space-between",gap:18,alignItems:"center"}}><div><div style={{fontSize:12,textTransform:"uppercase",letterSpacing:1.4,color:"#d5521d",fontWeight:900}}>{tab}</div><h1 style={{margin:"4px 0 0",fontSize:32}}>{tab==="Overview"?partner.name:tab}</h1><p style={{margin:"5px 0 0",color:"#68717d"}}>{subtitle(tab)}</p></div><button onClick={()=>window.close()} style={{border:"1px solid #cdd4dc",background:"white",borderRadius:10,padding:"10px 14px",fontWeight:800,cursor:"pointer"}}>Close Preview</button></header>

      <div style={{padding:30,backgroundImage:"radial-gradient(circle at 88% 4%,rgba(213,82,29,.12),transparent 24%),radial-gradient(circle at 12% 68%,rgba(27,72,101,.08),transparent 30%),linear-gradient(180deg,#f7f8fa 0%,#eaf0f4 100%)",minHeight:"calc(100vh - 135px)"}}>
        {tab==="Overview"&&<Overview partner={partner} partnerReward={partnerReward} guestDiscount={guestDiscount} pending={pending}/>}
        {tab==="Referrals"&&<Referrals partner={partner}/>} 
        {tab==="Rewards"&&<Rewards partner={partner} pending={pending} earned={earned}/>} 
        {tab==="Redeem"&&<Redeem catalog={catalog} available={partner.available_cents}/>} 
        {tab==="My Link"&&<MyLink partner={partner}/>} 
      </div>
    </section>
  </main>;
}

function Overview({partner,partnerReward,guestDiscount,pending}:{partner:Partner;partnerReward:string;guestDiscount:string;pending:number}){
  return <div style={{display:"grid",gap:20}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:16}}>{[["Referral Visits","—"],["Bookings",String(partner.recent_bookings.length)],["Pending Rewards",money(pending)],["Available to Redeem",money(partner.available_cents)]].map(([l,v],i)=><div key={l} style={{...card,padding:20,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",width:74,height:74,borderRadius:"50%",right:-18,top:-22,background:i===3?"rgba(213,82,29,.15)":"rgba(32,39,51,.05)"}}/><div style={{fontSize:11,fontWeight:900,color:"#68717d",textTransform:"uppercase",letterSpacing:.8}}>{l}</div><div style={{fontSize:30,fontWeight:900,marginTop:7,color:i===3?"#d5521d":"#202733"}}>{v}</div></div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"1.6fr .9fr",gap:20}}>
      <div style={{...card,padding:24}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><h2 style={{margin:0,fontSize:22}}>Recent referrals</h2><span style={{fontSize:12,color:"#d5521d",fontWeight:800}}>Latest activity</span></div>{partner.recent_bookings.length?partner.recent_bookings.slice(0,8).map(b=><div key={b.id} style={{display:"grid",gridTemplateColumns:"1.15fr 1.45fr .8fr .65fr",gap:12,padding:"14px 0",borderTop:"1px solid #edf0f3",fontSize:13,alignItems:"center"}}><strong>{b.customer_name||b.confirmation_code||"Guest"}</strong><span>{b.experience_name||"—"}</span><span>{date(b.activity_start_at)}</span><span style={{fontWeight:900,color:b.partner_reward_cents>0?"#18794e":"#68717d"}}>{money(b.partner_reward_cents)}</span></div>):<Empty text="No referral bookings yet."/>}</div>
      <div style={{background:"linear-gradient(150deg,#202b39,#111924)",color:"white",borderRadius:18,padding:24,boxShadow:"0 18px 42px rgba(20,28,39,.18)",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",width:180,height:180,borderRadius:"50%",right:-70,top:-70,background:"rgba(213,82,29,.17)"}}/><div style={{fontSize:11,opacity:.62,textTransform:"uppercase",letterSpacing:1.1}}>Program setup</div><h2 style={{margin:"8px 0 22px",fontSize:24}}>Referral rewards</h2><Info label="Referral code" value={partner.slug}/><Info label="Partner reward" value={partnerReward}/><Info label="Guest discount" value={guestDiscount}/></div>
    </div>
  </div>
}

function Referrals({partner}:{partner:Partner}){
  return <div style={{...card,overflow:"hidden"}}><div style={{padding:"20px 24px",borderBottom:"1px solid #e8edf1",display:"flex",justifyContent:"space-between"}}><div><h2 style={{margin:0}}>Referral activity</h2><p style={{margin:"5px 0 0",fontSize:13,color:"#68717d"}}>Bookings attributed to this Ambassador.</p></div><div style={{fontSize:28,fontWeight:900,color:"#d5521d"}}>{partner.recent_bookings.length}</div></div><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:"#f4f6f8",textAlign:"left"}}>{["Guest","Confirmation","Experience","Travel","Reward","Status"].map(h=><th key={h} style={{padding:"12px 14px",fontSize:11,color:"#68717d",textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}</tr></thead><tbody>{partner.recent_bookings.length?partner.recent_bookings.map(b=><tr key={b.id} style={{borderTop:"1px solid #edf0f3"}}><td style={{padding:"14px",fontWeight:800}}>{b.customer_name||"—"}</td><td style={{padding:"14px"}}>{b.confirmation_code||"—"}</td><td style={{padding:"14px"}}>{b.experience_name||"—"}</td><td style={{padding:"14px"}}>{date(b.activity_start_at)}</td><td style={{padding:"14px",fontWeight:900}}>{money(b.partner_reward_cents)}</td><td style={{padding:"14px"}}><Pill text={b.reward_status}/></td></tr>):<tr><td colSpan={6}><Empty text="No referral bookings yet."/></td></tr>}</tbody></table></div>
}

function Rewards({partner,pending,earned}:{partner:Partner;pending:number;earned:number}){
  return <div style={{display:"grid",gap:20}}><div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:16}}>{[["Earned Rewards",earned],["Pending Rewards",pending],["Available to Redeem",partner.available_cents]].map(([l,v],i)=><div key={String(l)} style={{...card,padding:22}}><div style={{fontSize:11,fontWeight:900,color:"#68717d",textTransform:"uppercase",letterSpacing:.8}}>{l}</div><div style={{fontSize:34,fontWeight:900,marginTop:8,color:i===2?"#d5521d":"#202733"}}>{money(Number(v))}</div></div>)}</div><div style={{...card,padding:24}}><h2 style={{margin:"0 0 8px"}}>Reward history</h2><p style={{margin:"0 0 18px",fontSize:13,color:"#68717d"}}>Commission status for recent attributed bookings.</p>{partner.recent_bookings.length?partner.recent_bookings.map(b=><div key={b.id} style={{display:"grid",gridTemplateColumns:"1fr 1.5fr .8fr .7fr",gap:14,padding:"13px 0",borderTop:"1px solid #edf0f3",alignItems:"center",fontSize:13}}><strong>{b.customer_name||b.confirmation_code||"Guest"}</strong><span>{b.experience_name||"—"}</span><Pill text={b.reward_status}/><strong>{money(b.partner_reward_cents)}</strong></div>):<Empty text="No reward history yet."/>}</div></div>
}

function Redeem({catalog,available}:{catalog:Reward[];available:number}){
  const categories=Array.from(new Set(catalog.map(r=>r.category)));
  return <div style={{display:"grid",gap:22}}><div style={{...card,padding:22,display:"grid",gridTemplateColumns:"1fr auto",alignItems:"center"}}><div><div style={{fontSize:11,fontWeight:900,color:"#68717d",textTransform:"uppercase",letterSpacing:.8}}>Available Rewards Balance</div><div style={{fontSize:36,fontWeight:900,color:"#d5521d",marginTop:5}}>{money(available)}</div></div><div style={{background:"#fff2eb",borderRadius:999,padding:"13px 18px",fontWeight:800,color:"#b74419"}}>Choose a reward</div></div>{categories.map(category=><section key={category}><h2 style={{margin:"0 0 12px",fontSize:20}}>{category}</h2><div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14}}>{catalog.filter(r=>r.category===category).map(r=><div key={r.id} style={{...card,overflow:"hidden"}}><div style={{height:126,background:r.image_url?`url(${r.image_url}) center/cover no-repeat`:"linear-gradient(135deg,#f5efe9,#e9edf1)",display:"grid",placeItems:"center",color:"#8b949e",fontWeight:900,fontSize:12}}>{!r.image_url?"GIFT CARD IMAGE":""}</div><div style={{padding:14}}><div style={{fontWeight:900,minHeight:34}}>{r.display_name}</div><div style={{fontSize:11,color:"#68717d",marginTop:4}}>{r.redemption_type.replaceAll("_"," ")}</div><div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:10}}>{r.amount_type==="fixed"?r.allowed_amounts_cents.slice(0,4).map(a=><span key={a} style={{border:"1px solid #d6dde4",borderRadius:7,padding:"5px 8px",fontSize:11,fontWeight:800}}>{money(a).replace(".00","")}</span>):<span style={{fontSize:11,background:"#f2f4f6",borderRadius:7,padding:"5px 8px"}}>Custom amount</span>}</div>{r.fee_note?<div style={{marginTop:9,fontSize:10,color:"#9a591c",lineHeight:1.35}}>＊ {r.fee_note}</div>:null}</div></div>)}</div></section>)}</div>
}

function MyLink({partner}:{partner:Partner}){
  const url=referralUrl(partner.slug);return <div style={{display:"grid",gridTemplateColumns:"1.3fr .7fr",gap:20}}><div style={{...card,padding:26}}><div style={{fontSize:12,fontWeight:900,color:"#d5521d",textTransform:"uppercase",letterSpacing:1}}>Your referral link</div><h2 style={{fontSize:26,margin:"8px 0 8px"}}>Share Epic. Earn rewards.</h2><p style={{color:"#68717d",lineHeight:1.55}}>Guests who begin their Epic visit through this link can be attributed to {partner.name}.</p><div style={{marginTop:18,display:"grid",gridTemplateColumns:"1fr auto",gap:10}}><div style={{border:"1px solid #d8dfe6",borderRadius:10,padding:"12px 14px",background:"#f8fafb",fontSize:13,overflow:"hidden",textOverflow:"ellipsis"}}>{url}</div><button onClick={()=>navigator.clipboard?.writeText(url)} style={{border:0,borderRadius:10,background:"#d5521d",color:"white",fontWeight:900,padding:"0 18px",cursor:"pointer"}}>Copy Link</button></div></div><div style={{background:"linear-gradient(145deg,#202b39,#101821)",borderRadius:18,padding:24,color:"white",boxShadow:"0 18px 42px rgba(20,28,39,.18)"}}><div style={{fontSize:11,opacity:.62,textTransform:"uppercase",letterSpacing:1}}>Referral code</div><div style={{fontSize:34,fontWeight:900,marginTop:9,color:"#ff6a33"}}>{partner.slug}</div><p style={{fontSize:13,lineHeight:1.5,opacity:.75}}>Attribution follows this code when guests arrive through the Epic website.</p></div></div>
}

function Info({label,value}:{label:string;value:string}){return <div style={{marginTop:14}}><div style={{fontSize:12,opacity:.6}}>{label}</div><div style={{fontSize:17,fontWeight:900,marginTop:3}}>{value}</div></div>}
function Empty({text}:{text:string}){return <div style={{padding:"32px 8px",color:"#7b8591",fontSize:13,textAlign:"center"}}>{text}</div>}
function Pill({text}:{text:string}){const good=["earned","sent","redeemed"].includes(String(text).toLowerCase());return <span style={{display:"inline-block",borderRadius:999,padding:"5px 9px",fontSize:11,fontWeight:900,background:good?"#eaf8ef":"#fff3e8",color:good?"#18794e":"#9a591c",textTransform:"capitalize"}}>{text||"pending"}</span>}
function subtitle(tab:Tab){return tab==="Overview"?"Referral performance and rewards":tab==="Referrals"?"Attributed guest bookings":tab==="Rewards"?"Reward balance and commission history":tab==="Redeem"?"Browse the rewards catalog":"Shareable referral link"}
