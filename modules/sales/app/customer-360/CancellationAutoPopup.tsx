"use client";
import {useEffect,useRef,useState} from "react";
import CancellationAgreementPanel from "./CancellationAgreementPanel";
type Candidate={readiness_id:string;confirmation_code:string;customer_name:string;customer_phone:string|null;customer_email:string|null;product_display_name:string};
type Row=Candidate&{customer_name:string;customer_phone:string|null;customer_email:string|null;product_display_name:string};
export default function CancellationAutoPopup(){
 const started=useRef(new Date().toISOString());
 const seen=useRef(new Set<string>());
 const [active,setActive]=useState<Row|null>(null);
 useEffect(()=>{
  let dead=false,working=false;
  async function check(){
   if(dead||working||document.visibilityState!=="visible")return;
   working=true;
   try{
    const r=await fetch("/api/sales/cancellation-popup-candidates?since="+encodeURIComponent(started.current),{cache:"no-store"});
    if(!r.ok)return;
    const data=await r.json() as {candidates?:Candidate[]};
    for(const c of data.candidates||[]){
     if(seen.current.has(c.readiness_id))continue;
     const status=await fetch("/api/sales/cancellation-acknowledgement?readinessId="+encodeURIComponent(c.readiness_id),{cache:"no-store"});
     if(!status.ok)continue;
     seen.current.add(c.readiness_id);
     const st=await status.json();
     if(st.agreement&&["sent","opened","accepted"].includes(st.agreement.status))continue;
     if(!dead)setActive(current=>current||c);
    }
   }catch{}finally{working=false}
  }
  void check();const timer=window.setInterval(()=>void check(),3000);
  const rawUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let socket:WebSocket|null=null;
  if(rawUrl&&key){
   try{
    const url=new URL(rawUrl);
    url.protocol=url.protocol==="https:"?"wss:":"ws:";
    url.pathname="/realtime/v1/websocket";
    url.searchParams.set("apikey",key);
    url.searchParams.set("vsn","1.0.0");
    socket=new WebSocket(url);
    socket.addEventListener("open",()=>socket?.send(JSON.stringify({topic:"realtime:epic-readiness-signal",event:"phx_join",payload:{config:{broadcast:{ack:false,self:false},presence:{key:""},postgres_changes:[{event:"*",schema:"public",table:"readiness_realtime_signal"}]},access_token:key},ref:"1"})));
    socket.addEventListener("message",event=>{try{const message=JSON.parse(String(event.data));if(message.event==="postgres_changes"&&message.payload?.data?.table==="readiness_realtime_signal")void check()}catch{}});
   }catch{}
  }
  document.addEventListener("visibilitychange",check);
  return()=>{dead=true;socket?.close();window.clearInterval(timer);document.removeEventListener("visibilitychange",check)}
 },[]);
 return active?<CancellationAgreementPanel key={active.readiness_id} row={active} autoOpen showLauncher={false} dismissWhenHandledElsewhere onPopupClose={()=>setActive(null)}/>:null;
}
