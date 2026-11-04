"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
const reasons=[
 ["general_question","General question / information only"],
 ["reservation_service","Existing reservation / customer service"],
 ["vendor","Vendor / unrelated business"],
 ["wrong_number","Wrong number / spam"],
 ["other","Other"],
];
export default function PhoneLeadCorrection({session,extension,eventTime,override,eligible}:{session:string;extension:string;eventTime:string;override?:{reason:string;changed_by_name:string;changed_at:string}|null;eligible:boolean}){
 const router=useRouter();
 const [editing,setEditing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function save(reason:string,restore=false){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/sales/phone-report/lead-override",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session,extension,event_time:eventTime,reason,restore})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Unable to save");
   setEditing(false);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to save");}finally{setBusy(false);}
 }
 if(!eligible&&!override)return null;
 return <div style={{marginTop:7,fontWeight:500}}>
  {override?<><div style={{fontSize:11,color:"#6b7280"}}>Not a Sales Lead · {reasons.find(r=>r[0]===override.reason)?.[1]||override.reason}</div><div style={{fontSize:10,color:"#87919b"}}>Corrected by {override.changed_by_name}</div><button disabled={busy} onClick={()=>save("restored",true)} style={{marginTop:4,fontSize:11,color:"#bb3d18",background:"none",border:0,textDecoration:"underline",cursor:"pointer"}}>Restore Sales Lead</button></>:
  editing?<div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}><select aria-label="Why is this not a sales lead?" defaultValue="" id={"reason-"+session+"-"+extension} style={{fontSize:11,padding:5}} onChange={e=>{if(e.target.value)void save(e.target.value);}} disabled={busy}><option value="">Choose reason…</option>{reasons.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button disabled={busy} onClick={()=>setEditing(false)} style={{fontSize:11}}>Cancel</button></div>:
  <button disabled={busy} onClick={()=>setEditing(true)} style={{background:"#fff",border:"1px solid #d7dce2",borderRadius:6,padding:"5px 8px",fontSize:11,fontWeight:800,color:"#58616c",cursor:"pointer"}}>Not a Sales Lead</button>}
  {error?<div role="alert" style={{color:"#b42318",fontSize:11}}>{error}</div>:null}
 </div>;
}
