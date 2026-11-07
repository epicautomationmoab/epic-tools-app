"use client";
import {useEffect,useState} from "react";
import Customer360Modal from "../customer-360/Customer360Modal";
import ui from "./CatchUp.module.css";
type Item={id:string;opportunity_id:string;title:string;context_note:string;due_at:string;status:string;outcome?:string|null;assigned_to_profile_id:string;created_at:string;customer_name?:string;created_by_name?:string;assigned_to_name?:string};
type Event={type:string;note:string|null;actor:string;at:string;previous_due_at?:string|null;next_due_at?:string|null};
type Member={id:string;display_name:string};
const localDate=(d:string|Date)=>{const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Denver",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(d));const val=(x:string)=>parts.find(p=>p.type===x)?.value||"";return val("year")+"-"+val("month")+"-"+val("day")};
export default function ScheduledFollowUps(){
 const [dismissedIds,setDismissedIds]=useState<string[]>([]);
 const [items,setItems]=useState<Item[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true),[open,setOpen]=useState<string|null>(null),[action,setAction]=useState<string|null>(null),[note,setNote]=useState(""),[due,setDue]=useState(""),[outcome,setOutcome]=useState("contacted"),[assignee,setAssignee]=useState(""),[busy,setBusy]=useState(false),[manager,setManager]=useState(false),[teamView,setTeamView]=useState(false),[members,setMembers]=useState<Member[]>([]),[employee,setEmployee]=useState("all"),[history,setHistory]=useState<string|null>(null),[events,setEvents]=useState<Event[]>([]);
 async function load(team=teamView){try{const r=await fetch("/api/sales/followups"+(team?"?scope=team":""),{cache:"no-store"});const p=await r.json();if(!r.ok)throw Error(p.error||"Unable to load follow-ups");setItems(p.items||[]);if(!team)setDismissedIds(p.dismissedIds||[]);setManager(!!p.supervisor);setError("");}catch(e){setError(e instanceof Error?e.message:"Unable to load follow-ups")}finally{setLoading(false)}}
 useEffect(()=>{void load(false);fetch("/api/sales/followups?scope=members").then(r=>r.json()).then(p=>setMembers(p.members||[])).catch(()=>{});},[]);
 async function dismiss(id:string){setBusy(true);setError("");try{const r=await fetch("/api/sales/followups",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action:"dismiss"})});const p=await r.json();if(!r.ok)throw Error(p.error||"Unable to dismiss follow-up");setDismissedIds(old=>[...new Set([...old,id])]);}catch(e){setError(e instanceof Error?e.message:"Unable to dismiss")}finally{setBusy(false)}}
 async function changeView(team:boolean){setTeamView(team);setLoading(true);await load(team)}
 async function loadHistory(id:string){if(history===id){setHistory(null);return}setHistory(id);setEvents([]);try{const r=await fetch("/api/sales/followups?scope=history&id="+encodeURIComponent(id));const p=await r.json();if(!r.ok)throw Error(p.error||"History unavailable");setEvents(p.events||[])}catch(e){setError(e instanceof Error?e.message:"History unavailable")}}
 async function save(id:string,kind:string){setBusy(true);setError("");try{const body={id,action:kind,outcome:kind==="complete"?outcome:kind==="attempt"?outcome:null,note,due_at:kind==="reschedule"&&due?new Date(due).toISOString():null,assigned_to_profile_id:kind==="reassign"?assignee:null};const r=await fetch("/api/sales/followups",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const p=await r.json();if(!r.ok)throw Error(p.error||"Unable to update");setAction(null);setNote("");setDue("");setHistory(null);await load()}catch(e){setError(e instanceof Error?e.message:"Unable to update")}finally{setBusy(false)}}
 const today=localDate(new Date());
 const filtered=items.filter(x=>employee==="all"||x.assigned_to_profile_id===employee);
 const pending=filtered.filter(x=>x.status==="pending");
 const sections=[{name:"Overdue",rows:pending.filter(x=>localDate(x.due_at)<today)},{name:"Due Today",rows:pending.filter(x=>localDate(x.due_at)===today)},{name:"Upcoming",rows:pending.filter(x=>localDate(x.due_at)>today)},{name:"Recently Completed",rows:filtered.filter(x=>x.status==="completed"&&(teamView||!dismissedIds.includes(x.id))).slice(0,35)}];
 return <section className={ui.section} style={{marginTop:18}}>
 <h2 className={ui.sectionTitle}>Scheduled Follow-Ups</h2>
 <p className={ui.sectionDescription}>Your customer commitments, connected to their complete C360 conversations.</p>
 {manager?<div className={ui.segment}>
 <button type="button" className={ui.action} onClick={()=>void changeView(false)} aria-pressed={!teamView}>My Follow-Ups</button>
 <button type="button" className={ui.action} onClick={()=>void changeView(true)} aria-pressed={teamView}>Team Follow-Ups</button>
 {teamView?<select value={employee} onChange={e=>setEmployee(e.target.value)} aria-label="Filter by assigned employee"><option value="all">All employees</option>{members.map(m=><option key={m.id} value={m.id}>{m.display_name}</option>)}</select>:null}
 </div>:null}
 {loading?<p>Loading follow-ups…</p>:null}
 {error?<p role="alert" style={{color:"#ad2530"}}>{error}</p>:null}
 {!loading&&<div className={ui.gridFollow}>{sections.map(section=><div key={section.name} className={ui.followCard} data-status={section.name}>
 <h3>{section.name} ({section.rows.length})</h3>
 {!section.rows.length?<p>Nothing here right now</p>:section.rows.map(item=><div key={item.id} className={ui.row} style={{display:"grid",gap:8}}>
 <strong>{item.customer_name||"Customer"} {item.status==="completed"?"✓":""}</strong>
 <div style={{fontSize:14}}>{item.title}</div>
 {item.context_note?<div style={{fontSize:12,color:"#526073"}}>{item.context_note}</div>:null}
 <small>Scheduled by {item.created_by_name||"Employee"} · Assigned to {item.assigned_to_name||"Employee"} · {new Date(item.due_at).toLocaleString("en-US",{timeZone:"America/Denver",dateStyle:"medium",timeStyle:"short"})} Mountain</small>
 <div className={ui.actions}>
 <button type="button" className={ui.action} onClick={()=>setOpen(item.opportunity_id)}>Open C360</button>
 <button type="button" className={ui.action} onClick={()=>void loadHistory(item.id)}>{history===item.id?"Hide history":"View history"}</button>
 {item.status==="completed"&&!teamView?<button type="button" className={ui.action} disabled={busy} onClick={()=>void dismiss(item.id)}>Dismiss</button>:null}
 {item.status==="pending"?<>
 <button type="button" className={ui.action} onClick={()=>{setAction(item.id+":complete");setOutcome("contacted");setNote("")}}>Record outcome</button>
 <button type="button" className={ui.action} onClick={()=>{setAction(item.id+":attempt");setOutcome("no_answer");setNote("")}}>Record attempt</button>
 <button type="button" className={ui.action} onClick={()=>{setAction(item.id+":reschedule");setNote("")}}>Reschedule</button>
 <button type="button" className={ui.action} onClick={()=>{setAction(item.id+":reassign");setAssignee(item.assigned_to_profile_id);setNote("")}}>Reassign</button>
 </>:null}
 </div>
 {history===item.id?<div className={ui.details}>{events.length?events.map((e,i)=><div key={i} style={{padding:"5px 0"}}><strong>{e.actor} · {e.type}</strong> · {new Date(e.at).toLocaleString()}{e.note?" — "+e.note:""}</div>):"No events recorded yet."}</div>:null}
 {action?.startsWith(item.id+":")?<div style={{display:"grid",gap:8,maxWidth:480}}>
 {action.endsWith("reschedule")?<label>New date and time <input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label>:null}
 {action.endsWith("reassign")?<label>Assign to <select value={assignee} onChange={e=>setAssignee(e.target.value)}>{members.map(m=><option value={m.id} key={m.id}>{m.display_name}</option>)}</select></label>:null}
 {action.endsWith("complete")?<label>Result <select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="contacted">Spoke to customer</option><option value="booked">Booked</option><option value="no_longer_needed">No longer needed</option></select></label>:null}
 {action.endsWith("attempt")?<label>Attempt <select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="no_answer">No answer</option><option value="voicemail">Voicemail left</option></select></label>:null}
 <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Outcome or reason; full customer history stays in C360" rows={2}/>
 <div style={{display:"flex",gap:8}}><button className={ui.action+" "+ui.primary} disabled={busy||action.endsWith("complete")&&!note.trim()||action.endsWith("reschedule")&&!due||action.endsWith("reassign")&&!assignee} onClick={()=>void save(item.id,action.split(":")[1])}>{busy?"Saving…":"Save"}</button><button className={ui.action} onClick={()=>setAction(null)}>Cancel</button></div>
 </div>:null}
 </div>)}
 </div>)}</div>}
 {open?<Customer360Modal open={true} onClose={()=>setOpen(null)} opportunityId={open}/>:null}
 </section>
}
