"use client";

import { useMemo, useState } from "react";
import Customer360Modal from "../customer-360/Customer360Modal";
import LeadWorkModal from "./LeadWorkModal";
import LostReasonDialog from "../LostReasonDialog";
import CloseReasonDialog from "./CloseReasonDialog";
import ReleaseClaimDialog from "./ReleaseClaimDialog";
import styles from "./Leads.module.css";

export type SalesLead = {
  id:string; customer_name:string|null; email:string|null; phone_e164:string|null; status:string;
  lead_value_cents:number|null; draft_count:number|null; source_method:string|null; assigned_rep_name:string|null;
  claimed_by_name:string|null; claimed_at:string|null; activity_window_start:string|null; activity_window_end:string|null;
  shopping_last_activity_at:string|null; interest_label:string|null; party_needs:string|null; lead_capture_note:string|null;
  is_past_guest:boolean|null; prior_booking_count:number|null; tripworks_customer_code?:string|null; tripworks_is_opt_in?:boolean|null;
  drafts:Array<{id:string;confirmation_code:string|null;experience_name:string|null;option_name:string|null;activity_date:string|null;value_cents:number|null;is_current_draft?:boolean|null;converted_at?:string|null;last_trip_status?:string|null}>;
  notes:Array<{id:string;author_name:string|null;note_text:string|null;created_at:string|null;updated_at:string|null}>;
  assignments:Array<{id:string;assigned_rep_name:string|null;assigned_at:string|null;unassigned_at:string|null;assignment_source:string|null}>;
};

type SortKey="visit"|"shopped";
type SortDir="asc"|"desc";

const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
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

const repColors:Record<string,{solid:string;tint:string}> = {
  "Jennifer Johnson": {solid:"#D71920",tint:"#FFF1F2"},
  "Jenna McAllister": {solid:"#0F766E",tint:"#ECFDF5"},
  "Kim Halls": {solid:"#A16207",tint:"#FFFBEB"},
  "Lonnie Laidman": {solid:"#7C3AED",tint:"#F5F3FF"},
  "Price Baker": {solid:"#2563EB",tint:"#EFF6FF"},
  "Alex Austin": {solid:"#15803D",tint:"#F0FDF4"},
  "Cody Prueitt": {solid:"#C2410C",tint:"#FFF7ED"},
  "Dylan Jochim": {solid:"#475569",tint:"#F8FAFC"},
  "Maggie Goodwin": {solid:"#0E7490",tint:"#ECFEFF"},
  "Randy Stene": {solid:"#4D7C0F",tint:"#F7FEE7"},
  "Taylin McCurdy": {solid:"#B45309",tint:"#FFF7ED"},
};
function repColor(name:string|null){return name?repColors[name]||null:null;}

export default function LeadsClient({leads,profileName}:{leads:SalesLead[];profileName:string}){
  const[query,setQuery]=useState("");
  const[owner,setOwner]=useState("All");
  const[sortKey,setSortKey]=useState<SortKey>("shopped");
  const[sortDir,setSortDir]=useState<SortDir>("desc");
  const[selected,setSelected]=useState<SalesLead|null>(null);
  const[workLead,setWorkLead]=useState<SalesLead|null>(null);
  const[introLead,setIntroLead]=useState<SalesLead|null>(null);
  const[introPersonalNote,setIntroPersonalNote]=useState("");
  const[queuedIntroIds,setQueuedIntroIds]=useState<Set<string>>(new Set());
  const[busyId,setBusyId]=useState<string|null>(null);
  const[error,setError]=useState("");
  const[releaseLead,setReleaseLead]=useState<SalesLead|null>(null);
  const claimedOwners=useMemo(()=>Array.from(new Set(leads.map(l=>l.claimed_by_name||l.assigned_rep_name).filter(Boolean) as string[])).sort(), [leads]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const rows=leads.filter(l=>{
      const leadOwner=l.claimed_by_name||l.assigned_rep_name||"Unclaimed";
      if(owner!=="All"&&leadOwner!==owner)return false;
      if(!q)return true;
      return[l.customer_name,l.email,l.phone_e164,l.interest_label,leadOwner,...(l.drafts||[]).flatMap(d=>[d.confirmation_code,d.experience_name,d.option_name])].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
    });
    return rows.sort((a,b)=>{
      const av=sortKey==="visit"?timestamp(a.activity_window_start):timestamp(a.shopping_last_activity_at);
      const bv=sortKey==="visit"?timestamp(b.activity_window_start):timestamp(b.shopping_last_activity_at);
      if(av===bv)return (a.customer_name||"").localeCompare(b.customer_name||"");
      return sortDir==="asc"?av-bv:bv-av;
    });
  },[leads,owner,query,sortKey,sortDir]);

  function toggleSort(key:SortKey){
    if(sortKey===key)setSortDir(d=>d==="asc"?"desc":"asc");
    else{setSortKey(key);setSortDir(key==="shopped"?"desc":"asc");}
  }

  function openIntroduction(lead:SalesLead){
    setError("");
    setIntroLead(lead);
    setIntroPersonalNote("");
  }

  async function queueIntroduction(){
    if(!introLead)return;
    setBusyId(introLead.id);setError("");
    try{
      const response=await fetch("/api/sales/sales-introduction-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        opportunity_id:introLead.id,
        personal_message:introPersonalNote.trim()
      })});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload?.error||"Unable to send introduction email.");
      setQueuedIntroIds(current=>new Set(current).add(introLead.id));
      setIntroLead(null);
    }catch(e){setError(e instanceof Error?e.message:"Unable to send introduction email.");}
    finally{setBusyId(null);}
  }

  const [closeLead,setCloseLead]=useState<SalesLead|null>(null);
  async function confirmClose(reason:string,note:string){if(!closeLead)return;const lead=closeLead;setBusyId(lead.id);setError("");try{const response=await fetch("/api/sales/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"retire",opportunity_id:lead.id,reason,note_text:note||null})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Unable to close opportunity.");window.location.reload();}catch(e){setError(e instanceof Error?e.message:"Unable to close opportunity.");setBusyId(null);setCloseLead(null);}}
  const [lostLead,setLostLead]=useState<SalesLead|null>(null);
  async function confirmLost(category:string,reason:string,note:string){if(!lostLead)return;const lead=lostLead;setBusyId(lead.id);setError("");try{const response=await fetch("/api/sales/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"mark_lost",opportunity_id:lead.id,reason:`${category} | ${reason}`,note_text:note||null})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Could not mark lead lost.");window.location.reload();}catch(e){setError(e instanceof Error?e.message:"Unable to mark lost.");setBusyId(null);}}
  async function confirmRelease(reason:string,note:string){
    if(!releaseLead)return;
    const lead=releaseLead;
    setBusyId(lead.id);setError("");
    try{
      const response=await fetch("/api/sales/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"release_with_note",opportunity_id:lead.id,reason,note_text:note})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Unable to release claim.");
      setReleaseLead(null);
      window.location.reload();
    }catch(e){setError(e instanceof Error?e.message:"Unable to release claim.");}
    finally{setBusyId(null);}
  }
  async function action(lead:SalesLead, kind:"claim"|"retire"|"mark_lost"|"release_with_note"){
    if(kind==="release_with_note"){setReleaseLead(lead);setError("");return;}
    if(kind==="retire"){setCloseLead(lead);setError("");return;}
    if(kind==="mark_lost"){setLostLead(lead);return;}
    setBusyId(lead.id);setError("");
    try{
      const response=await fetch("/api/sales/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action:kind,
        opportunity_id:lead.id,
        
      })});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload?.error||"Unable to update sales opportunity.");
      window.location.reload();
    }catch(e){setError(e instanceof Error?e.message:"Unable to update sales opportunity.");setBusyId(null);}
  }

  return <>
    <div className={styles.toolbar}><div><strong>Sales Opportunities {filtered.length}</strong></div><input className={styles.search} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, phone, email, activity…"/></div>
    <div className={styles.ownerFilterRow}>
      <select className={styles.ownerSelect} value={owner} onChange={e=>setOwner(e.target.value)} aria-label="Filter sales opportunities by owner">
        <option value="All">All</option>
        <option value="Unclaimed">Unclaimed</option>
        <optgroup label="Claimed">
          {claimedOwners.map(name=><option key={name} value={name}>{name}</option>)}
        </optgroup>
      </select>
    </div>
    {error?<div className={styles.error}>{error}</div>:null}
    <div className={styles.tableCard}><table className={styles.table}><thead><tr>
      <th>Name</th>
      <th><button className={styles.sortButton} onClick={()=>toggleSort("visit")}>Visit Window {sortKey==="visit"?(sortDir==="asc"?"↑":"↓"):""}</button></th>
      <th><button className={styles.sortButton} onClick={()=>toggleSort("shopped")}>Shopped {sortKey==="shopped"?(sortDir==="asc"?"↑":"↓"):""}</button></th>
      <th>Interest</th><th>Owner</th><th>Drafts</th><th>Lead Value</th><th>Actions</th>
    </tr></thead><tbody>{filtered.map(l=>{const leadOwner=l.claimed_by_name||l.assigned_rep_name;const canIntroduce=Boolean(l.email&&leadOwner===profileName);return <tr key={l.id} className={repColor(leadOwner)?styles.claimedRow:undefined} style={repColor(leadOwner)?{backgroundColor:repColor(leadOwner)!.tint,borderLeft:`4px solid ${repColor(leadOwner)!.solid}`}:{}} onClick={()=>setSelected(l)}>
      <td><div className={styles.mainLine}>{l.customer_name||"Unnamed lead"}{l.is_past_guest?<span className={styles.vip}>Past Guest</span>:null}</div><div className={styles.subLine}>{l.phone_e164||l.email||"No contact info"}</div></td>
      <td><div className={styles.mainLine}>{dateWindow(l)}</div></td>
      <td><div className={styles.mainLine}>{fmtShopped(l.shopping_last_activity_at)}</div></td>
      <td><div className={styles.mainLine}>{l.interest_label||l.drafts?.[0]?.experience_name||"Not specified"}</div><div className={styles.subLine}>{l.party_needs||l.drafts?.[0]?.option_name||""}</div></td>
      <td>{leadOwner?<span className={styles.ownerBadge} style={{borderColor:repColor(leadOwner)?.solid,color:repColor(leadOwner)?.solid}}>{leadOwner}</span>:"Unclaimed"}</td><td>{l.draft_count||0}</td><td>{l.lead_value_cents!=null?money.format(l.lead_value_cents/100):"—"}</td>
      <td><div className={styles.rowActions} onClick={e=>e.stopPropagation()}>
        {!leadOwner?<button disabled={busyId===l.id} onClick={()=>void action(l,"claim")}>Claim</button>:null}
        {canIntroduce?<><button disabled={busyId===l.id} onClick={()=>setWorkLead(l)}>Work Lead</button><button disabled={busyId===l.id||queuedIntroIds.has(l.id)} onClick={()=>openIntroduction(l)}>{queuedIntroIds.has(l.id)?"Introduction Queued":"Email Introduction"}</button></>:null}
        {leadOwner===profileName?<button disabled={busyId===l.id} onClick={()=>void action(l,"release_with_note")}>Release Claim</button>:null}
        <button disabled={busyId===l.id} onClick={()=>void action(l,"retire")}>Close</button>
        <button className={styles.lostAction} disabled={busyId===l.id} onClick={()=>void action(l,"mark_lost")}>Lost</button>
      </div></td>
    </tr>})}</tbody></table></div>
    {introLead?<div style={{position:"fixed",inset:0,background:"rgba(16,24,40,.42)",zIndex:1000,display:"grid",placeItems:"center",padding:24,overflowY:"auto"}} onMouseDown={e=>{if(e.currentTarget===e.target)setIntroLead(null);}}>
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
    {workLead?<LeadWorkModal
      lead={workLead}
      profileName={profileName}
      onClose={()=>setWorkLead(null)}
      onOpenIntroduction={()=>{const lead=workLead;setWorkLead(null);if(lead)openIntroduction(lead);}}
      onOpenCustomer360={()=>{const lead=workLead;setWorkLead(null);if(lead)setSelected(lead);}}
      onLeadUpdated={()=>window.location.reload()}
    />:null}
    {releaseLead?<ReleaseClaimDialog customerName={releaseLead.customer_name||"Customer"} busy={busyId===releaseLead.id} error={error} onCancel={()=>{setReleaseLead(null);setError("");}} onConfirm={confirmRelease}/>:null}
    {closeLead?<CloseReasonDialog customerName={closeLead.customer_name||"Customer"} busy={busyId===closeLead.id} onCancel={()=>setCloseLead(null)} onConfirm={confirmClose}/>:null}
    {lostLead?<LostReasonDialog busy={busyId===lostLead.id} onCancel={()=>setLostLead(null)} onConfirm={confirmLost}/>:null}
    {selected?<Customer360Modal open={true} onClose={()=>setSelected(null)} opportunityId={selected.id} phone={selected.phone_e164} email={selected.email}/>:null}
  </>;
}
