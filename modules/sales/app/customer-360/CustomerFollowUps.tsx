"use client";
import {useEffect,useState} from "react";
type Item={id:string;title:string;context_note:string;due_at:string;status:string;outcome:string|null;created_by_name:string;assigned_to_name:string};
type Event={type:string;actor:string;at:string;note:string|null};
export default function CustomerFollowUps({opportunityId}:{opportunityId:string}){
 const [items,setItems]=useState<Item[]>([]),[history,setHistory]=useState<Record<string,Event[]>>({}),[error,setError]=useState("");
 async function load(){try{const r=await fetch("/api/sales/followups?scope=customer&opportunity_id="+encodeURIComponent(opportunityId),{cache:"no-store"});const p=await r.json();if(!r.ok)throw Error(p.error||"Follow-ups unavailable");setItems(p.items||[])}catch(e){setError(e instanceof Error?e.message:"Follow-ups unavailable")}}
 useEffect(()=>{void load()},[opportunityId]);
 async function showHistory(id:string){if(history[id]){setHistory(s=>{const n={...s};delete n[id];return n});return}try{const r=await fetch("/api/sales/followups?scope=history&id="+encodeURIComponent(id));const p=await r.json();if(!r.ok)throw Error(p.error||"History unavailable");setHistory(s=>({...s,[id]:p.events||[]}))}catch(e){setError(e instanceof Error?e.message:"History unavailable")}}
 return <div style={{display:"grid",gap:8,marginTop:12}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><strong>Follow-Up Commitments</strong><button type="button" onClick={()=>void load()} style={{fontSize:11}}>Refresh</button></div>
 {error?<span role="alert" style={{fontSize:12,color:"#a63238"}}>{error}</span>:null}
 {!items.length?<span style={{fontSize:12,color:"#788493"}}>No follow-ups assigned to you or recorded by you for this opportunity.</span>:items.map(item=><div key={item.id} style={{background:"#f5f7fa",border:"1px solid #e0e5eb",padding:10,borderRadius:9,fontSize:12}}>
 <strong>{item.title}</strong> · {item.status==="completed"?"Completed":"Pending"}
 <div style={{marginTop:4}}>{item.created_by_name} scheduled · {item.assigned_to_name} assigned</div>
 <div>{new Date(item.due_at).toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Denver"})} Mountain</div>
 {item.context_note?<p style={{margin:"6px 0"}}>{item.context_note}</p>:null}
 <button type="button" onClick={()=>void showHistory(item.id)}> {history[item.id]?"Hide history":"Show history"}</button>
 {history[item.id]?<div style={{marginTop:7,borderTop:"1px solid #ddd",paddingTop:6}}>{history[item.id].map((e,i)=><p key={i} style={{margin:"5px 0"}}>{e.actor}: {e.type} · {new Date(e.at).toLocaleString()}{e.note?" — "+e.note:""}</p>)}</div>:null}
 </div>)}
 </div>;
}
