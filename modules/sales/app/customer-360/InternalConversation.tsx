"use client";
import {useEffect,useMemo,useState} from "react";
import QuickFollowUp from "./QuickFollowUp";
import ScheduleFollowUp from "./ScheduleFollowUp";
type Note={id:string;entry_type?:"customer_note"|"reservation_note"|"team_message";note_text:string;author_name:string|null;created_at:string;mentions?:Array<{id:string;display_name:string;response_status?:string|null;responded_at?:string|null}>};
type Member={id:string;display_name?:string|null;name?:string|null;full_name?:string|null};
export default function InternalConversation({customerName,opportunityId,contactId,phone,email,reservationId,reservationConfirmations=[],reservationOptions=[]}:{customerName?:string;opportunityId?:string|null;contactId?:string|null;phone?:string|null;email?:string|null;reservationId?:string|null;reservationConfirmations?:string[];reservationOptions?:Array<{code:string;label:string}>}){
 // Use the existing inbox identity for unmatched callers; never manufacture a sales opportunity.
 const digits=String(phone||"").replace(/\D/g,"").slice(-10);
 const threadKey=opportunityId?"opp:"+opportunityId:digits.length===10?"phone:+1"+digits:contactId?"contact:"+contactId:email?.trim()?"email:"+email.trim().toLowerCase():reservationId?"reservation:"+reservationId:"";
 const [notes,setNotes]=useState<Note[]>([]);
 const [sharedNotes,setSharedNotes]=useState<Array<{note_id:string;confirmation_code:string;note_text:string;note_scope:string;source:string;visible_in_readiness:boolean;author_name:string|null;created_at:string}>>([]);
 const [reservationMode,setReservationMode]=useState(false);
 const [chosenConfirmation,setChosenConfirmation]=useState("");
 const [reservationQuery,setReservationQuery]=useState("");
 const [showInReadiness,setShowInReadiness]=useState(false);
 const confirmations=reservationConfirmations.filter(Boolean).join(",");
 async function refreshShared(){if(!confirmations)return;const response=await fetch("/api/sales/unified-notes?confirmations="+encodeURIComponent(confirmations),{cache:"no-store"});if(response.ok){const p=await response.json();setSharedNotes(p.notes||[]);}}
 useEffect(()=>{if(!confirmations)return;void refreshShared();const t=window.setInterval(()=>void refreshShared(),15000);return()=>window.clearInterval(t);},[confirmations]);
 const [members,setMembers]=useState<Member[]>([]);
 const [draft,setDraft]=useState("");
 const entryType="customer_note" as const;
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [status,setStatus]=useState("");
 const [scheduleCallback,setScheduleCallback]=useState(false);
 const [myProfileId,setMyProfileId]=useState("");
 useEffect(()=>{let live=true;async function load(){try{const r=await fetch("/api/sales/inbox?thread_key="+encodeURIComponent(threadKey),{cache:"no-store"});const p=await r.json();if(r.ok&&live)setNotes(p.notes||[]);}catch{}}void load();const timer=window.setInterval(load,15000);return()=>{live=false;window.clearInterval(timer)}},[threadKey]);
 useEffect(()=>{let live=true;fetch("/api/team/epic-ping",{cache:"no-store"}).then(r=>r.json()).then(p=>{if(live)setMyProfileId(p.profile?.id||"")}).catch(()=>{});return()=>{live=false}},[]);
 useEffect(()=>{let live=true;fetch("/api/sales/inbox",{cache:"no-store"}).then(r=>r.json()).then(p=>{if(live)setMembers(p.team_members||[])}).catch(()=>{});return()=>{live=false}},[]);
 const match=draft.match(/(?:^|\s)@([\w-]*)$/);
 const candidates=useMemo(()=>match?members.filter(m=>String(m.display_name||m.full_name||m.name||"").toLowerCase().split(/\s+/).some(p=>p.startsWith(match[1].toLowerCase()))).slice(0,8):[],[draft,members,match?.[1]]);
 function tag(member:Member){const name=member.display_name||member.full_name||member.name;if(!name)return;setDraft(v=>v.replace(/(^|\s)@[\w-]*$/,(_,space:string)=>space+"@"+name+" "));}
 async function respond(response:"acknowledged"|"dismissed"){setBusy(true);setError("");try{const r=await fetch("/api/sales/inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"respond_mention",thread_key:threadKey,response})});const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||"Unable to update mention");const n=await fetch("/api/sales/inbox?thread_key="+encodeURIComponent(threadKey),{cache:"no-store"});const result=await n.json();if(n.ok)setNotes(result.notes||[]);setStatus(response==="acknowledged"?"Mention acknowledged.":"Mention dismissed.");}catch(e){setError(e instanceof Error?e.message:"Unable to respond");}finally{setBusy(false);}}
 async function quickFollowUp(message:string){const r=await fetch("/api/sales/inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"note",thread_key:threadKey,note_text:message})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||"Unable to save follow-up.");const n=await fetch("/api/sales/inbox?thread_key="+encodeURIComponent(threadKey),{cache:"no-store"});const np=await n.json();if(n.ok)setNotes(np.notes||[]);}
 async function send(){if(!draft.trim())return; if(reservationMode){setBusy(true);setError("");try{const code=chosenConfirmation || (reservationConfirmations.length===1?reservationConfirmations[0]:"");if(!code)throw Error("Select a reservation before adding a reservation note.");const r=await fetch("/api/sales/unified-notes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmation_code:code,note_text:draft.trim(),visible_in_readiness:showInReadiness})});const p=await r.json();if(!r.ok)throw Error(p.error||"Unable to save reservation note");await refreshShared();setDraft("");setShowInReadiness(false);setStatus("Reservation note saved.");}catch(e){setError(e instanceof Error?e.message:"Unable to save note");}finally{setBusy(false)}return;}setBusy(true);setError("");setStatus("");try{const r=await fetch("/api/sales/inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"c360_note",entry_type:entryType,thread_key:threadKey,note_text:draft.trim(),expected_customer_name:customerName||null,expected_contact_id:contactId||null,expected_phone:phone||null,expected_email:email||null})});const p=await r.json().catch(()=>({}));if(!r.ok)throw Error(p.error||"Unable to post note");const n=await fetch("/api/sales/inbox?thread_key="+encodeURIComponent(threadKey),{cache:"no-store"});const np=await n.json();if(n.ok)setNotes(np.notes||[]);setDraft("");setStatus("Note saved.");}catch(e){setError(e instanceof Error?e.message:"Unable to post");}finally{setBusy(false);}}
 if(!threadKey)return null;
 return <section style={{border:"1px solid #dbe2ea",borderRadius:12,padding:13,background:"#fff",display:"grid",gap:10}}>
  <div><strong>Notes</strong><div style={{fontSize:11,color:"#627080"}}>Private to Epic employees · shared with Inbox</div></div>
  <QuickFollowUp onLog={quickFollowUp} onCallback={()=>{if(!opportunityId){setError("No linked sales opportunity. Open an active opportunity before scheduling a callback.");return;}setScheduleCallback(true);}}/>
  {scheduleCallback&&opportunityId?<div><ScheduleFollowUp opportunityId={opportunityId} initialOpen initialTitle="Call customer back — callback requested"/><button type="button" onClick={()=>setScheduleCallback(false)}>Dismiss callback scheduler</button></div>:null}
  {sharedNotes.length?<div style={{display:"grid",gap:7}}>{sharedNotes.map(n=><div key={n.note_id} style={{background:"#f5f7fa",borderRadius:9,padding:10,fontSize:12}}><strong>{n.source==="tripworks"?"TW Reservation Note":n.source==="readiness"?"Readiness Note":"Epic Reservation Note"}</strong><div style={{fontSize:11,color:"#607080"}}>{n.author_name||"Staff"} · {new Date(n.created_at).toLocaleString()} · {n.confirmation_code}</div><div style={{whiteSpace:"pre-wrap",marginTop:5}}>{n.note_text}</div><label style={{fontSize:11,display:"flex",gap:6,marginTop:7}}><input type="checkbox" checked={n.visible_in_readiness} disabled={n.source==="readiness"} title={n.source==="readiness"?"Notes written in Readiness always remain visible there":undefined} onChange={async e=>{const r=await fetch("/api/sales/unified-notes",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({note_id:n.note_id,visible_in_readiness:e.target.checked})});if(r.ok)await refreshShared();else setError("Unable to update Readiness visibility.")}}/>Show in Readiness</label></div>)}</div>:null}
  <div style={{display:"grid",gap:8,maxHeight:270,overflowY:"auto"}}>{notes.length?notes.map(n=><div key={n.id} style={{padding:"9px 10px",borderRadius:9,background:"#f5f7fa",fontSize:12}}>
   <div style={{fontSize:10,color:"#ad4223",fontWeight:800,marginBottom:5}}>{n.entry_type==="customer_note"?"INTERNAL NOTE":n.entry_type==="reservation_note"?"INTERNAL NOTE":"TEAM MESSAGE"}</div><div style={{display:"flex",justifyContent:"space-between",gap:7}}><strong>{n.author_name||"Epic teammate"}</strong><small>{new Date(n.created_at).toLocaleString()}</small></div>
   <div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",marginTop:5}}>{n.note_text}</div>{(n.mentions||[]).map(m=><div key={m.id} style={{fontSize:11,color:"#626f7d",marginTop:5}}>@{m.display_name}: {m.response_status==="acknowledged"?"Acknowledged":m.response_status==="dismissed"?"Dismissed":m.response_status==="legacy_read"?"Read":m.response_status?"Read":"Awaiting acknowledgment"}{m.responded_at?" · "+new Date(m.responded_at).toLocaleString():""}</div>)}{(n.mentions||[]).some(m=>m.id===myProfileId&&!m.response_status)?<div style={{display:"flex",gap:6,marginTop:7}}><button type="button" disabled={busy} onClick={()=>void respond("acknowledged")}>Acknowledge</button><button type="button" disabled={busy} onClick={()=>void respond("dismissed")}>Dismiss</button></div>:null}
  </div>):<span style={{fontSize:12,color:"#627080"}}>No internal messages yet.</span>}</div>

  <div style={{fontSize:11,color:"#647080"}}>{"Type @ to mention a teammate in your notes."}</div>
  {reservationConfirmations.length?<div style={{display:"flex",gap:12,fontSize:12}}><label><input type="radio" checked={!reservationMode} onChange={()=>setReservationMode(false)}/> Customer Note</label><label><input type="radio" checked={reservationMode} onChange={()=>setReservationMode(true)}/> Reservation Note</label></div>:null}
  {reservationMode&&reservationConfirmations.length>1?<div style={{display:"grid",gap:6,fontSize:12,maxWidth:420}}>
    <strong>Reservation</strong>
    {chosenConfirmation?<div style={{display:"flex",alignItems:"center",gap:8,padding:8,border:"1px solid #d8dee5",borderRadius:8}}>
      <span style={{flex:1}}>{reservationOptions.find(o=>o.code===chosenConfirmation)?.label||chosenConfirmation}</span>
      <button type="button" onClick={()=>{setChosenConfirmation("");setReservationQuery("")}} style={{border:0,background:"transparent",cursor:"pointer",textDecoration:"underline"}}>Change</button>
    </div>:<>
      <input type="search" value={reservationQuery} onChange={e=>setReservationQuery(e.target.value)} placeholder="Search date, activity, or confirmation" aria-label="Find reservation" style={{width:"100%",border:"1px solid #cbd5df",borderRadius:8,padding:"9px 10px",font:"inherit"}}/>
      <div style={{display:"grid",gap:3,maxHeight:220,overflowY:"auto",border:"1px solid #dbe2ea",borderRadius:8,padding:5}}>
       {(reservationOptions.length?reservationOptions:reservationConfirmations.map(code=>({code,label:code}))).filter(o=>(o.label+" "+o.code).toLowerCase().includes(reservationQuery.toLowerCase())).slice(0,6).map(o=><button key={o.code} type="button" onClick={()=>setChosenConfirmation(o.code)} style={{textAlign:"left",border:0,borderRadius:6,padding:"8px 10px",background:"#f5f7fa",cursor:"pointer",font:"inherit"}}>{o.label}</button>)}
       {!(reservationOptions.length?reservationOptions:reservationConfirmations.map(code=>({code,label:code}))).some(o=>(o.label+" "+o.code).toLowerCase().includes(reservationQuery.toLowerCase()))?<span style={{padding:8,color:"#647080"}}>No matching reservations</span>:null}
      </div>
      <span style={{color:"#647080",fontSize:11}}>Showing up to 6 matches. Type to narrow the list.</span>
    </>}
  </div>:null}
  {reservationMode?<label style={{fontSize:12}}><input type="checkbox" checked={showInReadiness} onChange={e=>setShowInReadiness(e.target.checked)}/> Show in Readiness</label>:null}
  <textarea aria-label="Internal team message" rows={3} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={"Add a note about the guest… Type @ to tag a teammate."} style={{width:"100%",boxSizing:"border-box",border:"1px solid #cbd5df",borderRadius:9,padding:10,font:"inherit",fontSize:13}}/>
  {candidates.length?<div role="listbox" style={{display:"grid",border:"1px solid #dbe2ea",borderRadius:9,padding:4}}>{candidates.map(m=><button type="button" key={m.id} onClick={()=>tag(m)} style={{border:0,background:"white",textAlign:"left",padding:7,cursor:"pointer"}}>@{m.display_name||m.full_name||m.name}</button>)}</div>:null}
  <button type="button" onClick={()=>void send()} disabled={busy||!draft.trim()} style={{background:"#171717",color:"white",border:0,borderRadius:9,padding:10,cursor:"pointer"}}>{busy?"Saving…":"Save Note"}</button>
  {error?<span role="alert" style={{fontSize:12,color:"#bb2525"}}>{error}</span>:null}{status?<span style={{fontSize:12,color:"#287450"}}>{status}</span>:null}
 </section>;
}
