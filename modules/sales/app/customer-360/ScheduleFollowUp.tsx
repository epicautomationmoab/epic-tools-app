"use client";
import {useEffect,useState} from "react";
type Member={id:string;display_name?:string;name?:string};
export default function ScheduleFollowUp({opportunityId,initialOpen=false,initialTitle=""}:{opportunityId:string;initialOpen?:boolean;initialTitle?:string}){
 const [open,setOpen]=useState(initialOpen),[people,setPeople]=useState<Member[]>([]),[assignee,setAssignee]=useState(""),[title,setTitle]=useState(initialTitle),[date,setDate]=useState(""),[note,setNote]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!open)return;fetch("/api/sales/followups?scope=members",{cache:"no-store"}).then(r=>r.json()).then(x=>{setPeople(x.members||[]);setAssignee(x.profile||"")}).catch(()=>{});},[open]);
 async function save(){setBusy(true);setMessage("");try{const r=await fetch("/api/sales/followups",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({opportunity_id:opportunityId,title,due_at:date?new Date(date).toISOString():null,assigned_to_profile_id:assignee,context_note:note,source:"c360"})});const p=await r.json();if(!r.ok)throw Error(p.error||"Could not schedule");setMessage("Follow-up scheduled in My Catch-Up.");setOpen(false);setTitle("");setDate("");setNote("");}catch(e){setMessage(e instanceof Error?e.message:"Unable to schedule")}finally{setBusy(false)}}
 return <section style={{border:"1px solid #dbe2ea",borderRadius:12,padding:12,marginTop:10,background:"#fff"}}>
 <button type="button" onClick={()=>setOpen(x=>!x)} style={{border:"1px solid #c9d4dd",padding:"9px 12px",borderRadius:8,background:"#f5f7fb",fontWeight:750,cursor:"pointer"}}>{open?"Close scheduler":"+ Schedule Follow-Up"}</button>
 {open?<div style={{display:"grid",gap:9,marginTop:12}}>
 <label style={{fontSize:12}}>What needs to happen?<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={240} placeholder="Call about rental quote" style={{width:"100%",padding:9,border:"1px solid #ccd4de",borderRadius:7}}/></label>
 <label style={{fontSize:12}}>Assigned to<select value={assignee} onChange={e=>setAssignee(e.target.value)} style={{display:"block",width:"100%",padding:9}}><option value="">Choose employee</option>{people.map(p=><option key={p.id} value={p.id}>{p.display_name||p.name}</option>)}</select></label>
 <label style={{fontSize:12}}>Due date & time<input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} style={{display:"block",padding:9}}/></label>
 <label style={{fontSize:12}}>Brief context (full history stays in C360)<textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} style={{width:"100%",padding:9,border:"1px solid #ccd4de",borderRadius:7}}/></label>
 <button type="button" disabled={busy||!assignee||!date||!title.trim()} onClick={()=>void save()} style={{border:0,borderRadius:8,background:"#831c29",color:"#fff",padding:10,cursor:"pointer"}}>{busy?"Saving…":"Schedule Follow-Up"}</button>
 </div>:null}
 {message?<p role="status" style={{fontSize:12}}>{message}</p>:null}
 </section>;
}
