"use client";

import {useState} from "react";

const reasons=[
  "Unable to follow up",
  "Better handled by another representative",
  "Customer requested another representative",
  "Other"
];

export default function ReleaseClaimDialog({customerName,busy,error,onCancel,onConfirm}:{customerName:string;busy:boolean;error:string;onCancel:()=>void;onConfirm:(reason:string,note:string)=>Promise<void>}){
 const [reason,setReason]=useState("");
 const [note,setNote]=useState("");
 const valid=reason.length>0&&note.trim().length>=10;
 return <div role="presentation" style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(15,23,42,.58)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
  <section role="dialog" aria-modal="true" aria-labelledby="release-claim-title" style={{background:"#fff",color:"#17212e",borderRadius:16,padding:"clamp(16px,4vw,26px)",width:"min(510px,100%)",maxHeight:"calc(100dvh - 32px)",overflowY:"auto",boxSizing:"border-box",boxShadow:"0 24px 55px rgba(0,0,0,.22)",display:"grid",gap:14}}>
   <header><h2 id="release-claim-title" style={{margin:"0 0 8px",fontSize:22}}>Release Claim</h2><div style={{fontWeight:700}}>{customerName}</div><p style={{color:"#64748b",fontSize:13,margin:"8px 0 0",lineHeight:1.5}}>This opportunity will return to Unclaimed. Previous communication, notes, and employee assignment history will remain in C360.</p></header>
   <fieldset style={{border:0,padding:0,margin:0,display:"grid",gap:8}}><legend style={{fontWeight:750,fontSize:13,marginBottom:8}}>Reason for release <span style={{color:"#b42318"}}>*</span></legend>{reasons.map(value=><label key={value} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px",border:"1px solid "+(reason===value?"#ef6a30":"#d9e2eb"),background:reason===value?"#fff5ef":"#fff",borderRadius:9,cursor:"pointer",fontSize:13}}><input type="radio" name="release-reason" value={value} checked={reason===value} onChange={()=>setReason(value)}/>{value}</label>)}</fieldset>
   <label style={{display:"grid",gap:7,fontWeight:750,fontSize:13}}>Explanation for the next representative <span style={{color:"#b42318"}}>*</span><textarea rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain why you are releasing this lead and anything the next representative should know." maxLength={2000} style={{boxSizing:"border-box",width:"100%",padding:12,font:"inherit",fontWeight:400,lineHeight:1.5,resize:"vertical",border:"1px solid #cbd5e1",borderRadius:9}}/><span style={{fontSize:11,fontWeight:400,color:"#64748b"}}>Required: at least 10 characters.</span></label>
   {error?<p role="alert" style={{color:"#b42318",fontSize:13,margin:0}}>{error}</p>:null}
   <div style={{display:"flex",flexWrap:"wrap",justifyContent:"flex-end",gap:9}}><button type="button" disabled={busy} onClick={onCancel} style={{border:"1px solid #ccd5df",padding:"11px 16px",borderRadius:9,background:"#fff",fontWeight:750}}>Cancel</button><button type="button" disabled={!valid||busy} onClick={()=>void onConfirm(reason,note.trim())} style={{border:0,padding:"11px 16px",borderRadius:9,background:valid&&!busy?"#f06429":"#d4d7dc",color:valid&&!busy?"#fff":"#475569",fontWeight:800,cursor:valid&&!busy?"pointer":"not-allowed"}}>{busy?"Releasing…":"Release Claim"}</button></div>
  </section>
 </div>;
}
