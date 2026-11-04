"use client";
import {useState} from "react";

const outcomes=[
  {id:"no_answer",title:"No Answer",icon:"☎",description:"Called guest — No Answer"},
  {id:"voicemail",title:"Left Message",icon:"▣",description:"Called guest — Left Message"},
  {id:"spoke",title:"Spoke to Guest",icon:"☎",description:"Called guest — Spoke to Guest"},
  {id:"callback",title:"Callback Requested",icon:"◷",description:"Called guest — Callback Requested"}
] as const;

export default function QuickFollowUp({onLog,onCallback,disabled=false}:{onLog:(message:string)=>Promise<void>;onCallback?:()=>void;disabled?:boolean}){
 const [saving,setSaving]=useState<string|null>(null);
 const [feedback,setFeedback]=useState("");
 async function log(id:string,description:string){
  if(disabled||saving)return;
  if(id==="callback"&&onCallback){onCallback();return;}
  setSaving(id);setFeedback("");
  try{await onLog(description);setFeedback(description+" — saved.");}
  catch(e){setFeedback(e instanceof Error?e.message:"Could not save follow-up.");}
  finally{setSaving(null);}
 }
 return <div style={{display:"grid",gap:9,margin:"12px 0 16px"}}>
  <div style={{fontSize:11,fontWeight:900,color:"#657285",letterSpacing:".1em"}}>QUICK FOLLOW-UP</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
   {outcomes.map(o=><button key={o.id} type="button" disabled={disabled||!!saving} onClick={()=>void log(o.id,o.description)} style={{display:"flex",alignItems:"center",gap:9,textAlign:"left",padding:"12px 10px",minHeight:48,border:"1px solid #d9e1e9",borderRadius:10,background:"#fff",color:"#17212e",fontWeight:750,fontSize:13,cursor:disabled||saving?"wait":"pointer"}}>
    <span aria-hidden="true" style={{fontSize:18}}>{o.icon}</span><span>{saving===o.id?"Saving…":o.title}</span>
   </button>)}
  </div>
  {feedback?<div role="status" style={{fontSize:12,color:feedback.includes("saved.")?"#287450":"#bb2525"}}>{feedback}</div>:null}
 </div>;
}
