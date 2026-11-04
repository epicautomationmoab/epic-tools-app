"use client";

import { useEffect, useState } from "react";

type Row={domain:string;created_at:string|null;created_by_name:string|null};

export default function BlockedDomainsClient(){
  const[rows,setRows]=useState<Row[]>([]);const[domain,setDomain]=useState("");const[busy,setBusy]=useState(false);const[error,setError]=useState("");
  async function load(){setError("");try{const r=await fetch("/api/sales/inbox/blocked-domains",{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error(p?.error||"Unable to load blocked domains.");setRows(p.domains||[]);}catch(e){setError(e instanceof Error?e.message:"Unable to load blocked domains.");}}
  useEffect(()=>{void load();},[]);
  async function add(){if(!domain.trim())return;setBusy(true);setError("");try{const r=await fetch("/api/sales/inbox/blocked-domains",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain:domain.trim()})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p?.error||"Unable to block domain.");setDomain("");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to block domain.");}finally{setBusy(false);}}
  async function remove(value:string){setBusy(true);setError("");try{const r=await fetch("/api/sales/inbox/blocked-domains",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain:value})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p?.error||"Unable to unblock domain.");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to unblock domain.");}finally{setBusy(false);}}
  return <div style={{maxWidth:900,margin:"0 auto",padding:"42px 32px"}}>
    <div style={{fontSize:12,fontWeight:900,letterSpacing:".12em",textTransform:"uppercase",color:"#ff5a1f"}}>Epic Communications</div>
    <h1 style={{fontSize:36,margin:"6px 0 8px"}}>Blocked Email Domains</h1>
    <p style={{color:"#667085",marginTop:0}}>Messages from these domains are still retained in Gmail ingestion, but they are excluded from the Epic Sales Inbox.</p>
    <div style={{display:"flex",gap:10,margin:"28px 0"}}><input value={domain} onChange={e=>setDomain(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void add();}} placeholder="example.com" style={{flex:1,padding:"12px 14px",border:"1px solid #d7dde5",borderRadius:10,fontSize:16}}/><button onClick={()=>void add()} disabled={busy||!domain.trim()} style={{padding:"12px 18px",border:0,borderRadius:10,background:"#ff5a1f",color:"white",fontWeight:800,cursor:"pointer"}}>Block Domain</button></div>
    {error?<div style={{padding:12,border:"1px solid #f1b5a0",background:"#fff5f1",borderRadius:10,color:"#a32b0b",marginBottom:16}}>{error}</div>:null}
    <div style={{display:"grid",gap:10}}>{rows.map(row=><div key={row.domain} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px",border:"1px solid #e2e7ec",borderRadius:12,background:"white"}}><div><strong style={{fontSize:17}}>{row.domain}</strong><div style={{fontSize:12,color:"#7b8794",marginTop:4}}>{row.created_by_name?`Added by ${row.created_by_name}`:"Blocked"}</div></div><button onClick={()=>void remove(row.domain)} disabled={busy} style={{padding:"9px 13px",border:"1px solid #d7dde5",borderRadius:8,background:"white",fontWeight:700,cursor:"pointer"}}>Remove</button></div>)}</div>
  </div>;
}
