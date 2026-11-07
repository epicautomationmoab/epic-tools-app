"use client";
import { useState } from "react";

export const lostReasonGroups = [
  { category:"Price & Value", reasons:["Price too high","Additional fees / insurance","Competitor offered better value","Payment / deposit requirements"] },
  { category:"Availability & Scheduling", reasons:["Requested date unavailable","Vehicle / tour unavailable","Schedule or duration didn't work","Last-minute booking unavailable"] },
  { category:"Policies & Restrictions", reasons:["Guest wants to trailer rental","Children too young / small","Driver age restriction","Trail / terrain restrictions","Cancellation policy","Pet restrictions"] },
  { category:"Product & Experience", reasons:["Different vehicle or seating","Different trail / experience","Wanted guided instead of rental","Wanted rental instead of guided","Too difficult / intimidating","Not adventurous enough"] },
  { category:"Guest Circumstances", reasons:["Travel plans changed","Weather concerns","Group couldn't agree","Booked with competitor","Chose another activity","Not ready to book"] },
  { category:"Unable to Determine / Other", reasons:["No response after follow-up","Reason unknown","Other — explanation required"] },
] as const;

export default function LostReasonDialog({onCancel,onConfirm,busy=false}:{onCancel:()=>void;onConfirm:(category:string,reason:string,note:string)=>void|Promise<void>;busy?:boolean}) {
  const [expanded,setExpanded]=useState<string|null>(null);
  const [reason,setReason]=useState("");
  const [note,setNote]=useState("");
  const selectedCategory=lostReasonGroups.find(g=>g.reasons.some(r=>r===reason))?.category||"";
  const requireNote=reason==="Other — explanation required";
  return <div role="presentation" style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(15,23,42,.58)",display:"grid",placeItems:"center",padding:16}}>
    <section role="dialog" aria-modal="true" aria-label="Why was this opportunity lost?" style={{width:"min(560px,100%)",maxHeight:"90vh",overflowY:"auto",background:"#fff",borderRadius:16,padding:22,boxShadow:"0 20px 65px #0003"}}>
      <h2 style={{margin:"0 0 4px",fontSize:23}}>Why was this opportunity lost?</h2>
      <p style={{margin:"0 0 17px",color:"#667085",fontSize:13}}>Choose a category, then the specific reason.</p>
      <div style={{display:"grid",gap:7}}>
        {lostReasonGroups.map(group=><div key={group.category} style={{border:"1px solid #d8dee7",borderRadius:11,overflow:"hidden"}}>
          <button type="button" aria-expanded={expanded===group.category} disabled={busy} onClick={()=>setExpanded(expanded===group.category?null:group.category)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"#fff",border:0,textAlign:"left",cursor:"pointer",fontWeight:750,color:"#252b34"}}>
            <span>{group.category}{selectedCategory===group.category?" ✓":""}</span><span aria-hidden>{expanded===group.category?"▴":"▾"}</span>
          </button>
          {expanded===group.category?<div style={{borderTop:"1px solid #e6eaf0",padding:8,display:"grid",gap:2}}>{group.reasons.map(r=><label key={r} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,background:reason===r?"#f2f4f7":"#fff",cursor:"pointer",fontSize:13}}><input type="radio" name="lost-reason" checked={reason===r} onChange={()=>setReason(r)}/>{r}</label>)}</div>:null}
        </div>)}
      </div>
      {requireNote?<label style={{display:"grid",gap:6,marginTop:13,fontWeight:700,fontSize:13}}>Explanation required<textarea autoFocus value={note} onChange={e=>setNote(e.target.value)} rows={3} style={{padding:10,border:"1px solid #cbd5e1",borderRadius:8,font:"inherit"}}/></label>:null}
      <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginTop:18}}>
        <button type="button" disabled={busy} onClick={onCancel} style={{padding:"10px 17px",border:"1px solid #cbd5e1",borderRadius:8,background:"#fff",cursor:"pointer"}}>Cancel</button>
        <button type="button" disabled={busy||!reason||(requireNote&&!note.trim())} onClick={()=>void onConfirm(selectedCategory,reason,note.trim())} style={{padding:"10px 17px",border:0,borderRadius:8,background:"#c92320",color:"#fff",fontWeight:800,cursor:"pointer",opacity:busy||!reason||(requireNote&&!note.trim())?.5:1}}>{busy?"Saving…":"Confirm Lost"}</button>
      </div>
    </section>
  </div>;
}
