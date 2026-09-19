"use client";
import { useEffect,useMemo,useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import CustomerJourneyModal from "../readiness/CustomerJourneyModal";
import styles from "./ServiceInbox.module.css";

type Thread={thread_key:string;kind:string;occurred_at:string;preview:string|null;subject:string|null;customer_name:string|null;email:string|null;phone:string|null;reservation_confirmation:string|null;reservation_id:string|null;queue:string;business_line:string|null;is_open:boolean};
type Note={id:string;note_text:string;author_name:string|null;created_at:string|null};
type Transfer={id:string;from_queue:string|null;to_queue:string;note_text:string|null;actor_name:string|null;created_at:string};
type EmailEvent={id:string;direction:"inbound"|"outbound";at:string;subject:string;body:string|null;sender_name?:string|null;sender?:string|null};
type Sms={message_id:string;direction:string;message_body:string|null;sent_at:string|null;first_received_at:string;agent_name:string|null};
type Call={id:string;at:string;direction:string;answered:boolean|null;voicemail:boolean|null;duration_seconds:number|null;recording_url:string|null;summary:string|null;transcription:string|null;lead_explanation:string|null};
type TimelineItem={id:string;at:string;type:"inbound"|"outbound"|"internal";label:string;body:string;subject:string;recording_url?:string|null;transcription?:string|null};

function time(v:string|null|undefined){if(!v)return"—";return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v));}
function kind(v:string){return v==="email"?"Email":v==="text"?"Text":v==="call"?"Call":v.replaceAll("_"," ");}
export default function ServiceInboxClient({queue,title}:{queue:"rental_service"|"tour_service";title:string}){
 const[threads,setThreads]=useState<Thread[]>([]),[selectedKey,setSelectedKey]=useState<string|null>(null),[query,setQuery]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const[notes,setNotes]=useState<Note[]>([]),[transfers,setTransfers]=useState<Transfer[]>([]),[emails,setEmails]=useState<EmailEvent[]>([]),[sms,setSms]=useState<Sms[]>([]),[calls,setCalls]=useState<Call[]>([]);
 const[readiness,setReadiness]=useState<ReadinessRow|null>(null),[c360Open,setC360Open]=useState(false);
 const[note,setNote]=useState(""),[reply,setReply]=useState(""),[channel,setChannel]=useState<"email"|"text">("email");
 async function load(){const r=await fetch(`/api/team/service-inbox?queue=${queue}`,{cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error(p.error||"Unable to load inbox.");setThreads(p.threads||[]);}
 async function loadDetail(t:Thread){
   const requests:[Promise<Response>,Promise<Response>,Promise<Response>?]=[
    fetch(`/api/team/service-inbox?thread_key=${encodeURIComponent(t.thread_key)}&confirmation=${encodeURIComponent(t.reservation_confirmation||"")}`,{cache:"no-store"}),
    fetch(`/api/team/readiness/email-history?confirmation=${encodeURIComponent(t.reservation_confirmation||"")}`,{cache:"no-store"})
   ];
   const call=t.reservation_confirmation?fetch(`/api/team/readiness/callrail?confirmation=${encodeURIComponent(t.reservation_confirmation)}`,{cache:"no-store"}):null;
   const [meta,emailRes,callRes]=await Promise.all([requests[0],requests[1],call||Promise.resolve(null)]);
   const m=await meta.json(); if(meta.ok){setNotes(m.notes||[]);setTransfers(m.transfers||[]);setReadiness(m.readiness||null);}
   const e=await emailRes.json(); setEmails(emailRes.ok?(e.emails||[]):[]);
   if(callRes){const c=await callRes.json();setSms(callRes.ok?(c.messages||[]):[]);setCalls(callRes.ok?(c.calls||[]):[]);}else{setSms([]);setCalls([]);}
 }
 useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"Unable to load inbox."));const id=window.setInterval(()=>{if(document.visibilityState==="visible")load().catch(()=>{});},5000);return()=>clearInterval(id);},[queue]);
 const visible=useMemo(()=>{const q=query.trim().toLowerCase();return threads.filter(t=>!q||[t.customer_name,t.email,t.phone,t.subject,t.preview,t.reservation_confirmation].filter(Boolean).some(x=>String(x).toLowerCase().includes(q)));},[threads,query]);
 const selected=threads.find(t=>t.thread_key===selectedKey)||null;
 useEffect(()=>{if(selected){loadDetail(selected).catch(e=>setError(e instanceof Error?e.message:"Unable to load conversation."));setReply("");setNote("");setC360Open(false);}else{setReadiness(null);setCalls([]);}},[selectedKey]);
 const timeline=useMemo(()=>{
   const items:TimelineItem[]=[
    ...emails.map(e=>({id:"e"+e.id,at:e.at,type:e.direction==="inbound"?"inbound":"outbound",label:e.direction==="inbound"?"Customer email":`Email from ${e.sender_name||"Epic"}`,body:e.body||"",subject:e.subject})),
    ...sms.map(s=>({id:"s"+s.message_id,at:s.sent_at||s.first_received_at,type:s.direction?.toLowerCase()==="inbound"?"inbound":"outbound",label:s.direction?.toLowerCase()==="inbound"?"Customer text":`Text from ${s.agent_name||"Epic"}`,body:s.message_body||"",subject:""})),
    ...calls.map(call=>({id:"c"+call.id,at:call.at,type:call.direction?.toLowerCase()==="outbound"?"outbound":"inbound",label:call.voicemail?"Voicemail":call.answered===false?"Missed call":call.direction?.toLowerCase()==="outbound"?"Outbound call":"Inbound call",body:call.summary||call.lead_explanation||"",subject:call.duration_seconds?`${Math.floor(call.duration_seconds/60)}m ${call.duration_seconds%60}s`:"",recording_url:call.recording_url,transcription:call.transcription})),
    ...notes.map(n=>({id:"n"+n.id,at:n.created_at||"",type:"internal",label:`Internal note · ${n.author_name||"Epic team"}`,body:n.note_text,subject:""})),
    ...transfers.filter(t=>!t.note_text).map(t=>({id:"t"+t.id,at:t.created_at,type:"internal",label:"Transfer",body:`${t.actor_name||"Epic team"} moved this conversation to ${t.to_queue.replaceAll("_"," ")}.`,subject:""}))
   ]; return items.sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime());
 },[emails,sms,calls,notes,transfers]);
 async function action(action:string,noteText?:string){if(!selected)return;setBusy(true);setError("");try{const r=await fetch("/api/team/service-inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,thread_key:selected.thread_key,note_text:noteText||""})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||"Unable to update conversation.");if(action==="sales"||action==="close"){setSelectedKey(null);await load();}else{setNote("");await loadDetail(selected);}}catch(e){setError(e instanceof Error?e.message:"Unable to update conversation.");}finally{setBusy(false);}}
 async function sendReply(){if(!selected?.reservation_confirmation||!reply.trim())return;setBusy(true);setError("");try{
   const endpoint=channel==="email"?"/api/team/readiness/gmail-send":"/api/team/readiness/callrail";
   const body=channel==="email"?{confirmation:selected.reservation_confirmation,subject:selected.subject?.startsWith("Re:")?selected.subject:`Re: ${selected.subject||"Your Epic 4X4 Adventure"}`,body:reply.trim()}:{confirmation:selected.reservation_confirmation,message_text:reply.trim()};
   const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||"Unable to send reply.");setReply("");await loadDetail(selected);
 }catch(e){setError(e instanceof Error?e.message:"Unable to send reply.");}finally{setBusy(false);}}
 return <div className={styles.shell}>
  <section className={styles.list}><div className={styles.searchWrap}><input className={styles.search} placeholder={`Search ${title.toLowerCase()}…`} value={query} onChange={e=>setQuery(e.target.value)}/></div>
   {visible.map(t=><button key={t.thread_key} className={`${styles.row} ${selectedKey===t.thread_key?styles.active:""}`} onClick={()=>setSelectedKey(t.thread_key)}><div className={styles.rowTop}><span className={styles.name}>{t.customer_name||t.email||t.phone||"Unknown guest"}</span><span className={styles.time}>{time(t.occurred_at)}</span></div><div className={styles.meta}><span className={styles.pill}>{queue==="rental_service"?"Rental":"Tour"}</span><span className={`${styles.pill} ${styles.kind}`}>{kind(t.kind)}</span></div><div className={styles.preview}>{t.subject?`${t.subject} — `:""}{t.preview||"No preview"}</div></button>)}
  </section>
  <section className={styles.detail}>{error?<div className={styles.error}>{error}</div>:null}{selected?<div className={styles.card}>
   <div className={styles.head}><div><div className={styles.eyebrow}>{title}</div><h2>{selected.customer_name||selected.email||selected.phone||"Unknown guest"}</h2><div className={styles.sub}>{[selected.email,selected.phone].filter(Boolean).join(" · ")}</div></div><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>{readiness?<button className={styles.secondary} onClick={()=>setC360Open(true)}>Open Customer 360</button>:null}<span className={styles.pill}>{selected.reservation_confirmation||"Service"}</span></div></div>
   <div className={styles.context}><div><span>Reservation</span><strong>{selected.reservation_confirmation||"—"}</strong></div><div><span>Latest inbound</span><strong>{kind(selected.kind)}</strong></div><div><span>Queue</span><strong>{queue==="rental_service"?"HQ Rentals":"Tour Service"}</strong></div></div>
   <div className={styles.timeline}>{timeline.map(x=><div key={x.id} className={`${styles.event} ${styles[x.type as "inbound"|"outbound"|"internal"]}`}><div className={styles.eventTop}><span>{x.label}</span><span>{time(x.at)}</span></div>{x.subject?<strong>{x.subject}</strong>:null}{x.body?<div className={styles.body}>{x.body}</div>:null>{x.recording_url?<div className={styles.actions}><a className={styles.secondary} href={x.recording_url} target="_blank" rel="noreferrer">Play Recording</a></div>:null}{x.transcription?<details style={{marginTop:8}}><summary style={{cursor:"pointer",fontWeight:800}}>View Transcript</summary><div className={styles.body} style={{marginTop:8}}>{x.transcription}</div></details>:null}</div>)}</div>
   <div className={styles.composer}><div style={{display:"grid",gridTemplateColumns:"150px 1fr",gap:8}}><select className={styles.select} value={channel} onChange={e=>setChannel(e.target.value as "email"|"text")}><option value="email">Email</option><option value="text">Text</option></select><textarea className={styles.textarea} rows={4} placeholder="Reply to guest…" value={reply} onChange={e=>setReply(e.target.value)}/></div><div className={styles.actions}><button className={styles.primary} disabled={busy||!reply.trim()} onClick={()=>void sendReply()}>{busy?"Working…":"Send Reply"}</button></div></div>
   <div className={styles.composer}><textarea className={styles.textarea} rows={2} placeholder="Internal note (optional)…" value={note} onChange={e=>setNote(e.target.value)}/><div className={styles.actions}><button className={styles.secondary} disabled={busy||!note.trim()} onClick={()=>void action("note",note)}>Add Internal Note</button><button className={styles.danger} disabled={busy} onClick={()=>void action("sales",note)}>Send to Sales{note.trim()?" + Note":""}</button><button className={styles.secondary} disabled={busy} onClick={()=>void action("close")}>Close Conversation</button></div></div>
  </div>:<div className={styles.empty}><div><strong>Select a conversation</strong><div style={{marginTop:8}}>Reply, add internal notes, or send it to Sales without leaving Epic Tools.</div></div></div>}</section>
 {readiness&&c360Open?<CustomerJourneyModal row={readiness} onClose={()=>setC360Open(false)}/>:null}
 </div>;
}
