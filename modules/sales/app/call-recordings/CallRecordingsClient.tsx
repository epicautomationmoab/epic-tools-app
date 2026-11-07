"use client";

import { useMemo, useState } from "react";
import CallTranscript from "../customer-360/CallTranscript";
import styles from "./CallRecordings.module.css";

export type Recording = {
  callrail_call_id: string;
  customer_name: string | null;
  customer_phone_number: string | null;
  tracking_phone_number: string | null;
  direction: string | null;
  call_type: string | null;
  answered: boolean | null;
  voicemail: boolean | null;
  start_time: string | null;
  duration_seconds: number | null;
  source_name: string | null;
  campaign: string | null;
  recording_url: string | null;
  recording_player_url: string | null;
  call_summary: string | null;
  transcription_text: string | null;
  matched_opportunity_id: string | null;
  matched_lead_name: string | null;
  matched_lead_status: string | null;
  matched_booking_confirmation_code: string | null;
  matched_reservation_id?: string | null;
  reservation_confirmation?: string | null;
  reservation_business_line?: string | null;
};

type ViewMode = "working" | "history" | "all";

function fmtTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function fmtDuration(seconds: number | null) { if (!seconds) return "—"; const mins=Math.floor(seconds/60); const rem=seconds%60; return `${mins}:${String(rem).padStart(2,"0")}`; }
function relationship(recording: Recording) {
  const status=(recording.matched_lead_status||"").toLowerCase();
  if(recording.matched_reservation_id){
    const line=(recording.reservation_business_line||"").toLowerCase();
    const label=line==="tour"?"Existing Tour Reservation":line==="rental"?"Existing Rental Reservation":"Existing Reservation";
    return <span className={styles.booked}>{label}{recording.reservation_confirmation?<small>{recording.reservation_confirmation}</small>:null}</span>;
  }
  if(!recording.matched_opportunity_id)return <span className={styles.unmatched}>Unmatched</span>;
  if(status==="open")return <a href={`/sales/leads?open=${encodeURIComponent(recording.matched_opportunity_id)}`}>{recording.matched_lead_name||"Open lead"}</a>;
  if(status==="booked")return <span className={styles.booked}>{recording.matched_lead_name||"Booked"}{recording.matched_booking_confirmation_code?<small>{recording.matched_booking_confirmation_code}</small>:null}</span>;
  if(status==="lost"||status==="retired")return <span className={styles.closed}>{recording.matched_lead_name||"Closed"}<small>{status==="lost"?"Lost":"Retired"}</small></span>;
  return <span>{recording.matched_lead_name||"Matched"}</span>;
}
function isHistory(r: Recording){const s=(r.matched_lead_status||"").toLowerCase();return s==="booked"||s==="lost"||s==="retired";}

export default function CallRecordingsClient({ recordings }: { recordings: Recording[] }) {
  const [query,setQuery]=useState(""); const[selected,setSelected]=useState<Recording|null>(null); const[view,setView]=useState<ViewMode>("working");
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return recordings.filter(r=>{
    if(view==="working"&&isHistory(r))return false;
    if(view==="history"&&!isHistory(r))return false;
    if(!q)return true;
    return [r.customer_name,r.customer_phone_number,r.source_name,r.campaign,r.matched_lead_name,r.matched_booking_confirmation_code,r.call_summary].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
  });},[recordings,query,view]);

  return <>
    <div className={styles.toolbar}>
      <div><strong>{filtered.length} recording{filtered.length===1?"":"s"}</strong><span> · newest first</span></div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={()=>setView("working")} style={{fontWeight:view==="working"?900:700}}>Active / Unmatched</button>
        <button onClick={()=>setView("history")} style={{fontWeight:view==="history"?900:700}}>History</button>
        <button onClick={()=>setView("all")} style={{fontWeight:view==="all"?900:700}}>All</button>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search caller, phone, source, campaign, customer…"/>
      </div>
    </div>
    <div className={styles.tableCard}><table><thead><tr><th>Caller</th><th>Time</th><th>Duration</th><th>Source</th><th>Relationship</th><th></th></tr></thead><tbody>
      {filtered.map(r=><tr key={r.callrail_call_id}><td><strong>{r.customer_name||"Unknown caller"}</strong><div>{r.customer_phone_number||"No phone"}</div></td><td>{fmtTime(r.start_time)}</td><td>{fmtDuration(r.duration_seconds)}</td><td><strong>{r.source_name||"—"}</strong><div>{r.campaign||""}</div></td><td>{relationship(r)}</td><td><button onClick={()=>setSelected(r)}>Open</button></td></tr>)}
    </tbody></table>{!filtered.length?<div className={styles.empty}>No recordings match this view.</div>:null}</div>
    {selected?<div className={styles.backdrop} onMouseDown={()=>setSelected(null)}><aside className={styles.drawer} onMouseDown={e=>e.stopPropagation()}>
      <div className={styles.drawerHeader}><div><div className={styles.eyebrow}>Call Recording</div><h2>{selected.customer_name||"Unknown caller"}</h2><p>{selected.customer_phone_number||"No phone"} · {fmtTime(selected.start_time)}</p></div><button className={styles.close} onClick={()=>setSelected(null)}>×</button></div>
      <div className={styles.factGrid}><div><span>Duration</span><strong>{fmtDuration(selected.duration_seconds)}</strong></div><div><span>Call Type</span><strong>{selected.voicemail?"Voicemail":selected.call_type||(selected.answered?"Answered":"Missed")}</strong></div><div><span>Tracking Number</span><strong>{selected.tracking_phone_number||"—"}</strong></div><div><span>Source</span><strong>{selected.source_name||"—"}</strong></div></div>
      <div className={styles.actions}><a className={styles.primary} href={selected.recording_player_url||selected.recording_url||"#"} target="_blank" rel="noreferrer">Play Recording ↗</a>{selected.matched_opportunity_id&&selected.matched_lead_status==="open"?<a href={`/sales/leads?open=${encodeURIComponent(selected.matched_opportunity_id)}`}>Open Lead</a>:null}</div>
      {selected.matched_lead_status==="booked"?<section><h3>Booked Customer</h3><p>{selected.matched_lead_name}{selected.matched_booking_confirmation_code?` · ${selected.matched_booking_confirmation_code}`:""}. This call remains in history and the booking timeline, but is no longer an open Sales lead.</p></section>:null}
      {selected.matched_lead_status==="lost"||selected.matched_lead_status==="retired"?<section><h3>Closed Sales Opportunity</h3><p>{selected.matched_lead_name} · {selected.matched_lead_status}.</p></section>:null}
      {selected.campaign?<section><h3>Campaign</h3><p>{selected.campaign}</p></section>:null}{selected.call_summary?<section><h3>Call Summary</h3><p>{selected.call_summary}</p></section>:null}{selected.transcription_text?<section><h3>Transcription</h3><CallTranscript transcript={selected.transcription_text}/></section>:null}
    </aside></div>:null}
  </>;
}
