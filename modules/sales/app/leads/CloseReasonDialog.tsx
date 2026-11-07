"use client";
import {useState} from "react";

export const closeReasons=[
  "Already booked / converted",
  "Duplicate opportunity",
  "Existing customer / reservation inquiry",
  "Test or internal record",
  "Invalid contact / spam",
  "Not a sales opportunity",
  "Other — explanation required",
] as const;

export default function CloseReasonDialog({customerName,busy,onCancel,onConfirm}:{customerName:string;busy:boolean;onCancel:()=>void;onConfirm:(reason:string,note:string)=>void|Promise<void>}){
  const [reason,setReason]=useState("");
  const [note,setNote]=useState("");
  const requiresNote=reason==="Other — explanation required";
  return <div role="presentation" style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(15,23,42,.58)",display:"grid",placeItems:"center",padding:16}}>
    <section role="dialog" aria-modal="true" aria-label="Close sales opportunity" style={{width:"min(520px,100%)",maxHeight:"90vh",overflowY:"auto",background:"#fff",color:"#17212e",borderRadius:16,padding:24,boxShadow:"0 20px 65px #0003"}}>
      <h2 style={{margin:"0 0 6px",fontSize:23}}>Close sales opportunity</h2>
      <div style={{fontWeight:700}}>{customerName}</div>
      <p style={{fontSize:13,color:"#64748b",lineHeight:1.5}}>Choose why this record should leave the active sales queue. For a genuine sale that did not convert, use <strong>Lost</strong> instead.</p>
      <fieldset style={{padding:0,margin:0,border:0,display:"grid",gap:7}}>
        <legend style={{fontWeight:750,fontSize:13,marginBottom:9}}>Close reason *</legend>
        {closeReasons.map(r=><label key={r} style={{display:"flex",gap:10,alignItems:"center",border:"1px solid "+(reason===r?"#ef6a30":"#d9e2eb"),borderRadius:9,padding:"11px 12px",cursor:"pointer",background:reason===r?"#fff5ef":"#fff",fontSize:13}}><input type="radio" name="close-reason" disabled={busy} checked={reason===r} onChange={()=>setReason(r)}/>{r}</label>)}
      </fieldset>
      <label style={{display:"grid",gap:7,fontSize:13,fontWeight:750,marginTop:15}}>Additional details {requiresNote?"(required)":"(optional)"}
        <textarea rows={3} value={note} disabled={busy} onChange={e=>setNote(e.target.value)} maxLength={2000} placeholder="Add any context that should remain in C360…" style={{border:"1px solid #cbd5e1",borderRadius:9,padding:11,font:"inherit",resize:"vertical"}}/>
      </label>
      <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginTop:19}}>
        <button type="button" className="epic-btn" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className="epic-btn epic-btn--primary" disabled={busy||!reason||(requiresNote&&!note.trim())} onClick={()=>void onConfirm(reason,note.trim())}>{busy?"Closing…":"Confirm Close"}</button>
      </div>
    </section>
  </div>;
}
