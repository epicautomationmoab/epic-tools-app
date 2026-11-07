"use client";
import {useEffect,useState} from "react";
import LeadWorkModal from "../leads/LeadWorkModal";
import type {SalesLead} from "../leads/LeadsClient";
function fmtDate(v:string|null){if(!v)return"—";const d=new Date(v.length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString(undefined,{month:"short",day:"numeric"});}
function fmtShopped(v:string|null){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).replace(" at "," ");}
function dateWindow(l:SalesLead){if(!l.activity_window_start)return"No dates yet";if(!l.activity_window_end||l.activity_window_end===l.activity_window_start)return fmtDate(l.activity_window_start);return`${fmtDate(l.activity_window_start)} – ${fmtDate(l.activity_window_end)}`;}
function timestamp(v:string|null){if(!v)return Number.POSITIVE_INFINITY;const t=new Date(v.length===10?`${v}T12:00:00`:v).getTime();return Number.isNaN(t)?Number.POSITIVE_INFINITY:t;}
function firstName(v:string|null|undefined){return (v||"").trim().split(/\s+/)[0]||"there";}
function interestDescription(l:SalesLead){
  const draft=l.drafts?.[0];
  const parts=[draft?.option_name,draft?.experience_name].filter(Boolean) as string[];
  let description=parts.length?Array.from(new Set(parts)).join(" "):(l.interest_label||"an Epic 4X4 experience");
  const date=draft?.activity_date||l.activity_window_start;
  if(date)description+=` for ${fmtDate(date)}`;
  return description;
}
function activeDraftBookingUrl(l:SalesLead){
  const draft=(l.drafts||[]).find(d=>d.is_current_draft!==false&&!d.converted_at&&d.last_trip_status!=="converted"&&d.confirmation_code);
  return draft?.confirmation_code?`https://epic4x4.tripworks.com/widgets/tripBuilder?trip=${encodeURIComponent(draft.confirmation_code)}`:null;
}
const REP_AVAILABILITY:Record<string,string>={
  "Price Baker":"My office hours are Monday through Thursday, 8:00 AM–6:00 PM Mountain Time.",
  "Lonnie Laidman":"My office hours are Thursday through Sunday, 8:00 AM–6:00 PM Mountain Time.",
  "Kim Halls":"My office hours are Wednesday through Saturday, 8:00 AM–6:00 PM Mountain Time.",
  "Jenna McAllister":"My office hours are Sunday through Wednesday, 8:00 AM–6:00 PM Mountain Time.",
};
function repAvailability(name:string){return REP_AVAILABILITY[name]||"Call us during regular business hours and ask for me.";}


export default function LeadWorkspaceAccess({opportunityId}:{opportunityId:string}){
 const [lead,setLead]=useState<SalesLead|null>(null);
 const [profileName,setProfileName]=useState("");
 const [mode,setMode]=useState<"work"|"intro"|null>(null);
 const [introLead,setIntroLead]=useState<SalesLead|null>(null);
 const [introPersonalNote,setIntroPersonalNote]=useState("");
 const [busyId,setBusyId]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [queued,setQueued]=useState(false);
 const [introSentAt,setIntroSentAt]=useState<string|null>(null);
 const [checkingIntro,setCheckingIntro]=useState(true);
 useEffect(()=>{let active=true;(async()=>{try{const r=await fetch("/api/sales/lead-workspace",{cache:"no-store"});const p=await r.json();if(!r.ok)throw Error(p.error||"Unable to load lead");if(active){setLead((p.leads||[]).find((l:SalesLead)=>l.id===opportunityId)||null);setProfileName(p.profile?.display_name||"");}}catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load lead");}})();return()=>{active=false}},[opportunityId]);
 useEffect(()=>{let active=true;setCheckingIntro(true);setIntroSentAt(null);fetch("/api/sales/sales-introduction-email?opportunity_id="+encodeURIComponent(opportunityId),{cache:"no-store"}).then(async r=>{const p=await r.json();if(!r.ok)throw Error(p.error||"Introduction status unavailable");if(active)setIntroSentAt(p.sentAt||null);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to check introduction status");}).finally(()=>{if(active)setCheckingIntro(false)});return()=>{active=false}},[opportunityId]);
 function openIntroduction(l:SalesLead){setError("");setIntroLead(l);setIntroPersonalNote("");setMode("intro");}
 async function queueIntroduction(){if(!introLead)return;setBusyId(introLead.id);setError("");try{const response=await fetch("/api/sales/sales-introduction-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({opportunity_id:introLead.id,personal_message:introPersonalNote.trim()})});const p=await response.json().catch(()=>({}));if(!response.ok)throw Error(p.error||"Unable to send introduction");setQueued(true);setIntroSentAt(new Date().toISOString());setIntroLead(null);setMode(null);}catch(e){setError(e instanceof Error?e.message:"Unable to send introduction");}finally{setBusyId(null)}}
 if(!lead)return error?<span role="alert" style={{color:"#b42318"}}>{error}</span>:<span style={{fontSize:12}}>Loading lead actions…</span>;
 const owner=lead.claimed_by_name||lead.assigned_rep_name;
 const canWork=owner===profileName;
 return <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
  <button type="button" onClick={()=>setMode("work")}>Work Lead</button><button type="button" className="epic-btn" disabled={checkingIntro||queued||!!introSentAt||!lead.email||!canWork} onClick={()=>openIntroduction(lead)}>{introSentAt?"✓ Introduction Sent · "+new Date(introSentAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):queued?"✓ Introduction Sent":checkingIntro?"Checking introduction…":"Email Introduction"}</button>{!canWork?<span style={{fontSize:12}}>Assigned to {owner||"no one"} · Introduction email can be sent by the assigned rep.</span>:null}
  {error?<span role="alert" style={{color:"#b42318"}}>{error}</span>:null}
  {mode==="work"?<LeadWorkModal lead={lead} profileName={profileName} onClose={()=>setMode(null)} onOpenIntroduction={()=>openIntroduction(lead)} onOpenCustomer360={()=>setMode(null)} onLeadUpdated={()=>window.location.reload()}/>:null}
      {introLead?<div style={{position:"fixed",inset:0,background:"rgba(16,24,40,.42)",zIndex:1400,display:"grid",placeItems:"center",padding:24,overflowY:"auto"}} onMouseDown={e=>{if(e.currentTarget===e.target)setIntroLead(null);setMode(null);}}>
      <section role="dialog" aria-modal="true" aria-label="Email introduction" style={{width:"min(760px,100%)",background:"#fff",borderRadius:18,boxShadow:"0 24px 70px rgba(0,0,0,.24)",padding:24,display:"grid",gap:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}><div><div style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",opacity:.55}}>Claimed Lead</div><h2 style={{margin:"4px 0 2px"}}>Email Introduction</h2><div style={{fontSize:13,opacity:.7}}>To {introLead.customer_name||introLead.email} · {introLead.email}</div></div><button type="button" onClick={()=>setIntroLead(null)} aria-label="Close" style={{border:0,background:"transparent",fontSize:28,cursor:"pointer"}}>×</button></div>

        <div style={{border:"1px solid #e1e5ea",borderRadius:14,overflow:"hidden",background:"#eeeae3"}}>
          <div style={{background:"#171717",padding:"18px 24px",textAlign:"center",color:"#fff",fontWeight:900,letterSpacing:".03em"}}>EPIC 4X4 ADVENTURES</div>
          <div style={{height:4,background:"#c6492d"}} />
          <div style={{background:"#fff",padding:"28px 30px",display:"grid",gap:16}}>
            <div style={{fontSize:12,fontWeight:900,letterSpacing:".11em",color:"#b9432b"}}>PERSONAL HELP WITH YOUR MOAB PLANS</div>
            <div style={{fontSize:30,lineHeight:1.15,fontWeight:900,color:"#171717"}}>I’m happy to help.</div>
            <div style={{fontSize:16,lineHeight:1.65,color:"#444"}}>
              <p style={{margin:"0 0 14px"}}>Hi {firstName(introLead.customer_name)},</p>
              <p style={{margin:"0 0 14px"}}>Thank you for visiting our website and considering Epic 4X4 Adventures for your time in Moab.</p>
              <p style={{margin:"0 0 14px"}}>I’m {firstName(profileName)} with Epic. You were considering <strong>{interestDescription(introLead)}</strong>, and I’d be happy to personally help you finalize your plans.</p>
              <p style={{margin:"0 0 14px"}}>I can help with choosing the right vehicle or experience, how much time to allow, trail options, planning for your group, or any other questions you have about exploring Moab. If you’re not quite sure which option is the best fit, that’s exactly what I’m here for.</p>
              {introPersonalNote.trim()?<p style={{margin:"0 0 14px"}}>{introPersonalNote.trim()}</p>:null}
              {activeDraftBookingUrl(introLead)?<><p style={{margin:"0 0 14px"}}>I’ve also included a link to help you pick up where you left off if you prefer our 24/7 self-service online booking.</p><div style={{display:"inline-block",background:"#bf452d",color:"#fff",fontWeight:900,borderRadius:9,padding:"12px 18px"}}>Continue Your Booking</div></>:null}
            </div>
            <div style={{background:"#f6f3ee",borderRadius:12,padding:"18px 20px"}}>
              <div style={{fontWeight:900,marginBottom:7}}>Have a question? Call or reply.</div>
              <div style={{fontSize:14,lineHeight:1.55,color:"#555"}}>You’re welcome to reply directly to this email or call us at <strong>435-220-2700</strong> and ask for me.<br/><br/>{repAvailability(profileName)}<br/><br/>If you don’t reach me, anyone on our team will be happy to help you with your plans.</div>
            </div>
            <div><strong>{firstName(profileName)}</strong><br/><span style={{fontSize:13,color:"#666"}}>Epic 4X4 Adventures</span></div>
          </div>
        </div>

        <label style={{display:"grid",gap:6,fontSize:12,fontWeight:800}}>Personal Note <span style={{fontWeight:500,opacity:.62}}>(optional)</span><textarea value={introPersonalNote} onChange={e=>setIntroPersonalNote(e.target.value)} rows={4} maxLength={4000} placeholder="Add anything specific you’d like to say to this guest…" style={{border:"1px solid #d9e0e6",borderRadius:9,padding:"12px",resize:"vertical",font:"inherit",lineHeight:1.5}}/></label>
        <div style={{fontSize:12,opacity:.65}}>Claiming the lead does not send anything. Queue Email is the final approval and sends the branded Resend email shown above.</div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:9}}><button type="button" onClick={()=>setIntroLead(null)}>Cancel</button><button type="button" disabled={busyId===introLead.id} onClick={()=>void queueIntroduction()}>{busyId===introLead.id?"Sending…":"Queue Email"}</button></div>
      </section>
    </div>:null}

 </div>;
}
