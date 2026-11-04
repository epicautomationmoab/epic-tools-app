"use client";

import { useEffect, useState, useRef } from "react";
import GuidedLeadSheet from "@/modules/sales/app/GuidedLeadSheet";

type Call = { id:string; caller_phone:string|null; caller_name:string|null; route_label:string|null; route_kind:string|null; confirmation_code:string|null; received_at?:string|null };


export default function SharedIncomingCall({employeeId}:{employeeId:string}) {
  const STORAGE="epictools-pending-call:"+employeeId;
  const [clearing,setClearing]=useState(false);
  const generation=useRef(0);
  const [call,setCall]=useState<Call|null>(null);
  const [error,setError]=useState(false);
  const [sheet,setSheet]=useState<Call|null>(null);
  const [manual,setManual]=useState(false);
  const [manualId,setManualId]=useState("manual");
  useEffect(()=>{const open=()=>{setManualId("manual-"+Date.now());setManual(true);};window.addEventListener("epicc360:new-lead-sheet",open);return()=>window.removeEventListener("epicc360:new-lead-sheet",open);},[]);
  useEffect(()=>{
    const url=new URL(window.location.href);
    if(!url.searchParams.has("lead_phone")&&!url.searchParams.has("lead_name"))return;
    const phone=url.searchParams.get("lead_phone")||"";
    const name=url.searchParams.get("lead_name")||"";
    setSheet({id:"external-"+Date.now(),caller_phone:phone,caller_name:name,route_label:null,route_kind:"new_lead",confirmation_code:null});
    url.searchParams.delete("lead_phone");
    url.searchParams.delete("lead_name");
    window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
  },[]);
  useEffect(()=>{
    try { const saved=sessionStorage.getItem(STORAGE); if(saved)setCall(JSON.parse(saved)); } catch {}
    let active=true,busy=false;
    async function check(){
      if(!active||busy||document.visibilityState!=="visible")return;
      busy=true;
      const started=generation.current;
      try {
        const response=await fetch("/api/team/live-calls",{cache:"no-store"});
        if(!response.ok)throw Error();
        const payload=await response.json();
        if(active&&started===generation.current){setError(false);setCall(payload.call??null);}
      } catch {if(active)setError(true);}
      finally {busy=false;}
    }
    void check();
    const timer=setInterval(()=>void check(),4000);
    const visible=()=>void check();
    document.addEventListener("visibilitychange",visible);
    window.addEventListener("focus",visible);
    return()=>{active=false;clearInterval(timer);document.removeEventListener("visibilitychange",visible);window.removeEventListener("focus",visible);};
  },[]);
  useEffect(()=>{try{if(call)sessionStorage.setItem(STORAGE,JSON.stringify(call));else sessionStorage.removeItem(STORAGE);}catch{}},[call]);
  async function dismiss(){
    if(!call)return;
    generation.current++;
    try {
      const response=await fetch("/api/team/live-calls",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({live_call_id:call.id})});
      if(!response.ok)throw Error("Unable to dismiss call");
      generation.current++;setCall(null);sessionStorage.removeItem(STORAGE);setError(false);
    }catch{setError(true);}
  }
  async function dismissAll(){
    if(clearing)return;
    generation.current++;setClearing(true);
    try {
      const response=await fetch("/api/team/live-calls",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"dismiss_all"})});
      if(!response.ok)throw Error("Unable to dismiss past calls");
      generation.current++;setCall(null);sessionStorage.removeItem(STORAGE);setError(false);
    }catch{setError(true);}finally{setClearing(false);}
  }
  const manualPanel=manual?<GuidedLeadSheet phone="" name="" draftId={manualId} onClose={()=>setManual(false)}/>:null;
  if(!call)return <>{manualPanel}{sheet?<GuidedLeadSheet phone={sheet.caller_phone||""} name={sheet.caller_name||""} onClose={()=>setSheet(null)}/>:null}</>;
  const known=Boolean(call.route_kind&&call.route_kind!=="new_lead");
  const phone=call.caller_phone||"Unknown number";
  const label=known?(call.route_label||call.caller_name||"Known customer"):(call.caller_name||"Unknown caller");
  const callTime=call.received_at&&Number.isFinite(new Date(call.received_at).getTime())?new Date(call.received_at):null;
  const moabDate=(date:Date)=>new Intl.DateTimeFormat("en-US",{timeZone:"America/Denver",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  const callTimeLabel=callTime?`${moabDate(callTime)===moabDate(new Date())?"Today":new Intl.DateTimeFormat("en-US",{timeZone:"America/Denver",month:"short",day:"numeric"}).format(callTime)} at ${new Intl.DateTimeFormat("en-US",{timeZone:"America/Denver",hour:"numeric",minute:"2-digit",hour12:true}).format(callTime)}`:null;
  const url=known?("/sales/customers?q="+encodeURIComponent(call.caller_phone||call.confirmation_code||"")+"&open=1"):("/sales/customers?q="+encodeURIComponent(call.caller_phone||""));
  return <>{manualPanel}<aside aria-label="Incoming Call" role="status" style={{position:"fixed",bottom:20,right:20,zIndex:9000,width:"min(335px,calc(100vw - 30px))",boxSizing:"border-box",padding:16,borderRadius:12,border:"1px solid #d7d9dc",borderLeft:"4px solid #c92320",background:"#fff",color:"#171717",boxShadow:"0 8px 26px #0002"}}>
    <div style={{fontWeight:900,fontSize:11,letterSpacing:1,color:"#b52b25"}}>INCOMING CALL · {known?"RECOGNIZED":"UNKNOWN"}</div>
    <div style={{fontSize:17,fontWeight:800,marginTop:7}}>{label}</div>
    <div style={{fontSize:13,marginTop:3}}>{phone}</div>
    {callTimeLabel&&<div style={{fontSize:11,marginTop:5,color:"#6b7280"}}>{callTimeLabel}</div>}
    <div style={{display:"flex",gap:8,marginTop:13}}>
      <a href={url} onClick={async e=>{e.preventDefault();if(!known)setSheet(call);await dismiss();if(known)window.location.assign(url);}} style={{flex:1,padding:"9px 10px",borderRadius:7,background:"#c92320",color:"#fff",textAlign:"center",textDecoration:"none",fontSize:12,fontWeight:800}}>{known?"Open C360":"Open Lead Sheet"}</a>
      <button type="button" onClick={()=>void dismiss()} style={{borderRadius:7,border:"1px solid #d6d6d6",background:"#fff",padding:"9px 10px",fontSize:12,cursor:"pointer"}}>Dismiss</button>
    </div>
    <button type="button" disabled={clearing} onClick={()=>void dismissAll()} style={{width:"100%",marginTop:10,padding:"8px",border:"1px solid #d6d6d6",borderRadius:7,background:"#fff",cursor:"pointer"}}>{clearing?"Dismissing…":"Dismiss All Past Calls"}</button>
    {error&&<div style={{fontSize:11,color:"#a33",marginTop:8}}>Call feed temporarily unavailable</div>}
  </aside>{sheet?<GuidedLeadSheet phone={sheet.caller_phone||""} name={sheet.caller_name||""} onClose={()=>setSheet(null)}/>:null}</>;
}
