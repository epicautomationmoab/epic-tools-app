"use client";
import {useEffect,useState} from "react";
type Ping={id:string;from_id:string;to_id:string;from_name:string;to_name:string;body:string;at:string;status:string|null;responded_at:string|null};
type Member={id:string;name:string};
export default function EpicPing(){
const [data,setData]=useState<{profile:{id:string;name:string};members:Member[];messages:Ping[]}|null>(null);
const [tab,setTab]=useState("all");const [recipient,setRecipient]=useState("");const [message,setMessage]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
async function load(){try{const r=await fetch("/api/team/epic-ping",{cache:"no-store"});const p=await r.json();if(!r.ok)throw Error(p.error||"Unable to load");setData(p);}catch(e){setError(e instanceof Error?e.message:"Unable to load");}}
useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==="visible")void load()},10000);return()=>clearInterval(timer)},[]);
async function act(payload:object){setBusy(true);setError("");try{const r=await fetch("/api/team/epic-ping",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||"Action failed");setMessage("");await load();}catch(e){setError(e instanceof Error?e.message:"Action failed")}finally{setBusy(false)}}
const unread=(data?.messages||[]).filter(p=>p.to_id===data?.profile.id&&!p.status).length;
const incoming=(data?.messages||[]).filter(p=>p.to_id===data?.profile.id);
const sent=(data?.messages||[]).filter(p=>p.from_id===data?.profile.id);
const view=tab;
const shown=view==="incoming"?incoming:view==="sent"?sent:(data?.messages||[]);
const btn={border:"1px solid #d9e1eb",borderRadius:9,padding:"9px 13px",fontSize:12,fontWeight:800,cursor:"pointer",background:"#fff",color:"#334155"} as const;
return <main style={{maxWidth:1060,margin:"0 auto",padding:"30px clamp(16px,3vw,44px)",display:"grid",gap:22,color:"#172033"}}>
 <header style={{padding:"24px 26px",background:"linear-gradient(115deg,#1b2638,#283e58)",color:"#fff",borderRadius:18,display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
  <div><div style={{fontSize:11,letterSpacing:2,fontWeight:900,color:"#fba07d"}}>EPIC TEAM COMMUNICATION</div><h1 style={{fontSize:29,margin:"7px 0 6px",letterSpacing:"-.04em"}}>Epic Ping</h1><p style={{fontSize:13,color:"#d8e1ed",margin:0}}>A quick message to a teammate, without involving a customer record.</p></div>
  <div style={{background:"rgba(255,255,255,.11)",border:"1px solid rgba(255,255,255,.2)",padding:"13px 18px",borderRadius:12,minWidth:120,textAlign:"center"}}><div style={{fontSize:27,fontWeight:900}}>{unread}</div><div style={{fontSize:11,color:"#d8e1ed"}}>Awaiting your response</div></div>
 </header>
 <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,340px),1fr))",gap:16,alignItems:"start"}}>
  <div style={{background:"#fff",border:"1px solid #e0e7ef",borderRadius:15,padding:22,display:"grid",gap:14,boxShadow:"0 4px 16px #0f172a08"}}>
   <div><h2 style={{fontSize:19,margin:"0 0 4px"}}>Send a Ping</h2><p style={{fontSize:12,color:"#64748b",margin:0}}>Choose a colleague and send a quick internal note.</p></div>
   <label style={{fontSize:12,fontWeight:800,display:"grid",gap:6}}>To <select aria-label="Choose colleague" value={recipient} onChange={e=>setRecipient(e.target.value)} style={{width:"100%",border:"1px solid #cbd5e1",borderRadius:9,padding:"11px 12px",background:"#fff",color:"#172033",fontSize:13}}><option value="">Choose colleague…</option>{(data?.members||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
   <label style={{fontSize:12,fontWeight:800,display:"grid",gap:6}}>Message <textarea rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder="What would you like to tell them?" style={{border:"1px solid #cbd5e1",borderRadius:9,padding:12,fontSize:13,font:"inherit",resize:"vertical",minHeight:100}}/></label>
   <button type="button" disabled={!recipient||!message.trim()||busy} onClick={()=>void act({action:"send",recipient,message})} style={{...btn,background:recipient&&message.trim()&&!busy?"#c44825":"#f1f5f9",borderColor:recipient&&message.trim()&&!busy?"#c44825":"#e2e8f0",color:recipient&&message.trim()&&!busy?"#fff":"#94a3b8",padding:"12px 18px"}}>{busy?"Working…":"Send Ping →"}</button>
  </div>
  <div style={{border:"1px solid #e0e7ef",borderRadius:15,padding:22,background:"#fff",display:"grid",gap:12}}>
   <h2 style={{fontSize:19,margin:0}}>Team Inbox</h2><p style={{fontSize:12,color:"#64748b",margin:0}}>Keep track of notes sent to you and those you've sent.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7}}>{[{label:"Waiting",value:unread,color:"#c44825"},{label:"Received",value:incoming.length,color:"#1d4ed8"},{label:"Sent",value:sent.length,color:"#15803d"}].map(item=><div key={item.label} style={{padding:12,borderRadius:10,background:"#f8fafc",border:"1px solid #edf1f5"}}><div style={{fontSize:21,fontWeight:900,color:item.color}}>{item.value}</div><div style={{fontSize:11,color:"#64748b"}}>{item.label}</div></div>)}</div>
   <p style={{fontSize:12,color:"#64748b",lineHeight:1.6,margin:"8px 0 0"}}>Pings are internal employee messages. Acknowledgement and dismissal controls appear on messages addressed to you.</p>
  </div>
 </section>
 <section style={{display:"grid",gap:12}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><h2 style={{fontSize:20,margin:0}}>Conversations</h2><div style={{display:"flex",gap:6}}>{[{id:"all",label:"All"},{id:"incoming",label:"Received"},{id:"sent",label:"Sent"}].map(t=><button key={t.id} type="button" onClick={()=>setTab(t.id)} style={{...btn,background:tab===t.id?"#26364c":"#fff",borderColor:tab===t.id?"#26364c":"#d9e1eb",color:tab===t.id?"#fff":"#334155"}}>{t.label}</button>)}</div></div>
  {shown.length===0?<div style={{border:"1px dashed #cbd5e1",background:"#fff",borderRadius:14,textAlign:"center",padding:"32px 18px",color:"#64748b"}}><strong style={{color:"#334155"}}>No {view==="incoming"?"received":view==="sent"?"sent":""} pings to show</strong><p style={{fontSize:12}}>Messages will appear here as your team uses Epic Ping.</p></div>:shown.map(p=><article key={p.id} style={{padding:"16px 18px",border:"1px solid "+(p.to_id===data?.profile.id&&!p.status?"#f8c4b2":"#dce5ee"),borderLeft:"4px solid "+(p.to_id===data?.profile.id&&!p.status?"#c44825":"#8ca1b8"),background:"#fff",borderRadius:12,display:"grid",gap:12}}>
   <div style={{display:"flex",alignItems:"start",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><strong style={{fontSize:14}}>{p.from_name} → {p.to_name}</strong><div style={{fontSize:11,color:"#64748b",marginTop:4}}>{new Date(p.at).toLocaleString()}</div></div><span style={{fontSize:11,fontWeight:750,borderRadius:20,padding:"5px 9px",background:p.status?"#f1f5f9":"#fff3e9",color:p.status?"#64748b":"#b45309"}}>{p.status||"Waiting for acknowledgement"}</span></div>
   <div style={{whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.6}}>{p.body}</div>
   {p.responded_at?<small style={{color:"#64748b"}}>Updated {new Date(p.responded_at).toLocaleString()}</small>:null}
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{p.to_id===data?.profile.id&&!p.status?<><button style={{...btn,background:"#dcfce7",color:"#166534",borderColor:"#bbf7d0"}} disabled={busy} onClick={()=>void act({action:"acknowledged",id:p.id})}>Acknowledge</button><button style={btn} disabled={busy} onClick={()=>void act({action:"dismissed",id:p.id})}>Dismiss</button></>:null}<button style={btn} type="button" onClick={()=>{setRecipient(p.from_id===data?.profile.id?p.to_id:p.from_id);setMessage("Re: "+p.body.slice(0,100)+"\n");window.scrollTo({top:0,behavior:"smooth"});}}>Reply</button><button type="button" title="Permanently delete Ping for both colleagues" aria-label="Delete Ping" disabled={busy} onClick={()=>{if(window.confirm("Permanently delete this Ping for both colleagues?"))void act({action:"delete",id:p.id});}} style={{...btn,marginLeft:"auto",color:"#b42318"}}>Delete</button></div>
  </article>)}
 </section>
 {error?<div role="alert" style={{color:"#b42318",border:"1px solid #fecaca",background:"#fef2f2",borderRadius:9,padding:12}}>{error}</div>:null}
 </main>;
}
