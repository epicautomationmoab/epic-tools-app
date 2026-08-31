"use client";

import { useEffect, useMemo, useState } from "react";

type WorkItem = {
  id: string;
  source: string;
  source_record_id: string | null;
  work_type: string;
  status: string;
  subject: string | null;
  summary: string | null;
  assigned_profile_id: string | null;
  assigned_name: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

const CLASSIFICATIONS = [
  ["unclassified", "Needs Review"],
  ["sales_lead", "Sales Lead"],
  ["customer_service", "Customer Service"],
  ["existing_guest", "Existing Guest"],
  ["other", "Other / Internal"],
  ["junk", "Junk"],
] as const;

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function durationLabel(value: unknown) {
  const seconds = Number(value || 0);
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}
function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }

export default function InboxTable({ initialItems }: { initialItems: WorkItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const response = await fetch("/api/team/leads/inbox", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) setItems(payload.items || []);
    } catch {}
  }

  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function action(item: WorkItem, actionName: "claim" | "release" | "classify", workType?: string) {
    setBusyId(item.id); setError("");
    try {
      const response = await fetch("/api/team/leads/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, work_item_id: item.id, work_type: workType }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update item.");
      if (payload.status === "closed") setItems((current) => current.filter((row) => row.id !== item.id));
      else await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update item."); }
    finally { setBusyId(null); }
  }

  const countUnclaimed = useMemo(() => items.filter((item) => !item.assigned_name).length, [items]);

  return <>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:12}}>
      <div style={{color:"#6e7986",fontWeight:750}}>{items.length} open work item{items.length===1?"":"s"} · {countUnclaimed} unclaimed</div>
      <button type="button" onClick={()=>void refresh()} style={{border:"1px solid #d6dde5",background:"white",borderRadius:9,padding:"9px 13px",fontWeight:850,cursor:"pointer"}}>Refresh</button>
    </div>
    {error ? <div style={{marginBottom:12,padding:12,borderRadius:10,background:"#fff1ef",border:"1px solid #efb9b2",color:"#97372f",fontWeight:800}}>{error}</div> : null}
    <div style={{display:"grid",gap:12}}>
      {items.map((item) => {
        const m = item.metadata || {};
        const channel = text(m.channel) || (item.source.includes("sms") ? "sms" : "call");
        const caller = text(m.caller_name) || text(m.phone) || "Unknown contact";
        const duration = durationLabel(m.duration_seconds);
        const recording = text(m.recording_url);
        return <article key={item.id} style={{border:"1px solid #dbe2e8",borderRadius:14,background:"white",padding:16,display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:14,alignItems:"start"}}>
          <div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
              <strong style={{fontSize:18}}>{caller}</strong>
              <span style={{fontSize:11,fontWeight:900,textTransform:"uppercase",letterSpacing:".08em",padding:"4px 7px",borderRadius:999,background:"#edf3f8",color:"#4e6072"}}>{channel}</span>
              {duration ? <span style={{color:"#6f7c89",fontWeight:750}}>{duration}</span> : null}
            </div>
            <div style={{fontWeight:850,marginBottom:5}}>{item.subject || "New customer contact"}</div>
            <div style={{color:"#687585",lineHeight:1.45}}>{item.summary || "No summary available yet."}</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:9,fontSize:13,color:"#6f7c89",fontWeight:750}}>
              <span>{timeLabel(item.created_at)}</span>
              {text(m.source_name) ? <span>{text(m.source_name)}</span> : null}
              {text(m.campaign) ? <span>{text(m.campaign)}</span> : null}
              {recording ? <a href={recording} target="_blank" rel="noreferrer" style={{fontWeight:850}}>Listen to recording ↗</a> : null}
            </div>
          </div>
          <div style={{display:"grid",gap:8,minWidth:190}}>
            <div style={{fontSize:12,fontWeight:800,color:"#7b8793"}}>OWNER</div>
            <strong>{item.assigned_name || "Unclaimed"}</strong>
            {!item.assigned_name ? <button type="button" disabled={busyId===item.id} onClick={()=>void action(item,"claim")} style={{border:0,borderRadius:9,padding:"9px 12px",background:"#202936",color:"white",fontWeight:900,cursor:"pointer"}}>{busyId===item.id?"Working…":"Claim"}</button> : <button type="button" disabled={busyId===item.id} onClick={()=>void action(item,"release")} style={{border:"1px solid #d4dce3",borderRadius:9,padding:"9px 12px",background:"white",fontWeight:850,cursor:"pointer"}}>Release</button>}
            <select value={item.work_type} disabled={busyId===item.id} onChange={(event)=>void action(item,"classify",event.target.value)} style={{padding:"9px 10px",border:"1px solid #d4dce3",borderRadius:9,background:"white",font:"inherit",fontWeight:800}}>
              {CLASSIFICATIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </article>;
      })}
      {!items.length ? <div style={{padding:24,textAlign:"center",color:"#778391",border:"1px dashed #cfd7df",borderRadius:14}}>No unclassified CallRail work waiting right now.</div> : null}
    </div>
  </>;
}
