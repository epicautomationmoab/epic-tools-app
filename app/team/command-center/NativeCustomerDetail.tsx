"use client";

import { useState } from "react";
import { displayCustomerDate } from "@/lib/command-center/customer-display";

type RecordRow = Record<string, unknown>;
const arrays = ["reservations", "opportunities", "drafts", "quotes", "calls", "texts", "emails", "notes"] as const;
function records(value: unknown): RecordRow[] { return Array.isArray(value) ? value.filter((v):v is RecordRow => Boolean(v) && typeof v === "object") : []; }
function field(row: RecordRow, name: string): string { const value = row[name]; return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function eventTitle(kind: string, row: RecordRow): string {
  return ["experience_name", "subject", "customer_name", "confirmation_code", "direction", "author_name"].map(key => field(row,key)).find(Boolean) || kind;
}
function countDuplicates(rows: RecordRow[]): string[] {
  const counts = new Map<string,number>();
  for(const row of rows){const confirmation=field(row,"confirmation_code").trim(); if(confirmation)counts.set(confirmation,(counts.get(confirmation)||0)+1);}
  return [...counts].filter(([,count])=>count>1).map(([code])=>code);
}
/** Intentionally read-only: does not render unverified guest portal URLs or provider send actions. */
export default function NativeCustomerDetail({ value }:{ value: Record<string,unknown> }) {
  const identity = value.identity && typeof value.identity === "object" ? value.identity as RecordRow : {};
  const reservations = records(value.reservations);
  const repeatedConfirmations = countDuplicates(reservations);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const selectedReservation = reservations.find(row => field(row, "id") === selectedReservationId) || null;
  return <div>
    <header style={{ border:"1px solid #d9e2ec",borderRadius:12,padding:16,background:"#f8fafc" }}>
      <div style={{ fontSize:11,letterSpacing:1.5,color:"#64748b" }}>CONFIRMED CUSTOMER RECORD</div>
      <h3 style={{ margin:"7px 0" }}>{field(identity,"name") || "Customer"}</h3>
      <div style={{ fontSize:13,color:"#475569" }}>{[field(identity,"phone"),field(identity,"email")].filter(Boolean).join(" | ")}</div>
    </header>
    {repeatedConfirmations.length>0 && <p role="status" style={{ color:"#92400e",padding:12,border:"1px solid #facc15",borderRadius:8 }}>
      More than one reservation record shares confirmation {repeatedConfirmations.join(", ")}. Choose the exact reservation before performing any visit-specific action.
    </p>}
    <section aria-label="Exact reservation context" style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}>
      <strong>Reservation context</strong>
      <p style={{ fontSize: 13, color: "#52647b" }}>Select a specific reservation by its unique ID before any future reservation-specific action. Selection is read-only.</p>
      <select aria-label="Select exact reservation" value={selectedReservationId || ""} onChange={event => setSelectedReservationId(event.target.value || null)}
        style={{ maxWidth: "100%", padding: 9, border: "1px solid #94a3b8", borderRadius: 7 }}>
        <option value="">No reservation selected</option>
        {reservations.filter(row => field(row,"id")).map(row =>
          <option key={field(row,"id")} value={field(row,"id")}>{[field(row,"confirmation_code"), field(row,"experience_name"), displayCustomerDate(row.start_time,"reservation"), field(row,"id")].filter(Boolean).join(" · ")}</option>
        )}
      </select>
      {selectedReservation && <p role="status" style={{ fontSize: 13 }}>Selected reservation ID: <strong>{field(selectedReservation,"id")}</strong> — {field(selectedReservation,"experience_name") || "Visit"}. No changes have been made.</p>}
    </section>
    <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,margin:"15px 0" }}>
      {arrays.map(kind=><div key={kind} style={{ border:"1px solid #e2e8f0",borderRadius:9,padding:11 }}>
        <div style={{ fontSize:21,fontWeight:800 }}>{records(value[kind]).length}</div>
        <div style={{ fontSize:12,textTransform:"capitalize",color:"#52647b" }}>{kind}</div>
      </div>)}
    </div>
    {arrays.map(kind=>{
      const items=records(value[kind]);
      return <details key={kind} style={{ margin:"9px 0",border:"1px solid #e2e8f0",borderRadius:10,padding:12 }}>
        <summary style={{ cursor:"pointer",fontWeight:700,textTransform:"capitalize" }}>{kind} ({items.length})</summary>
        {items.length===0?<p style={{ color:"#64748b",fontSize:13 }}>No records in the current native data response.</p>:
        <div style={{ marginTop:10 }}>{items.slice(0,100).map((item,index)=>{
          const at=item.at || item.start_time || item.created_at || item.updated_at;
          return <article key={field(item,"id") || `${kind}-${index}`} style={{ borderTop:"1px solid #edf2f7",padding:"12px 0",fontSize:13 }}>
            <strong>{eventTitle(kind,item)}</strong>
            <div style={{ color:"#64748b",margin:"4px 0" }}>{displayCustomerDate(at,kind==="reservations"?"reservation":"event")}</div>
            {kind==="reservations" && <div style={{ color:"#475569" }}>
              Confirmation: {field(item,"confirmation_code")||"—"} · Reservation ID: {field(item,"id")||"Unavailable"} · Status: {field(item,"trip_status")||"Unknown"}
            </div>}
            <div style={{ whiteSpace:"pre-wrap",overflowWrap:"anywhere",marginTop:5 }}>{["summary","note_text","body","text"].map(key=>field(item,key)).find(Boolean) || ""}</div>
          </article>;
        })}</div>}
      </details>;
    })}
    <p style={{ color:"#9a3412",fontSize:12 }}>Read-only migration preview. Original C360 includes additional linked identities, enriched phone history, readiness and communication actions not yet migrated.</p>
  </div>;
}
