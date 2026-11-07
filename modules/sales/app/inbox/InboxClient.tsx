"use client";

import { useEffect, useMemo, useState } from "react";
import Customer360Modal from "../customer-360/Customer360Modal";
import QuickFollowUp from "../customer-360/QuickFollowUp";
import LostReasonDialog from "../LostReasonDialog";
import styles from "./Inbox.module.css";

type InboxThread = {
  platform?: "instagram"|"facebook"|null;
  thread_key:string; kind:string; source_id:string; occurred_at:string; preview:string|null; subject:string|null;
  customer_name:string|null; email:string|null; phone:string|null; opportunity_id:string|null; opportunity_status:string|null;
  lead_value_cents:number|null; interest_label:string|null; activity_window_start:string|null; activity_window_end:string|null;
  assigned_rep_name:string|null; claimed_by_name:string|null; reservation_id:string|null; reservation_confirmation:string|null;
  lane:"sales"|"service"|"unmatched"; is_open:boolean; handled_at:string|null; handled_by_name:string|null;
  known_customer?:boolean; contact_id?:string|null; queue?:string|null; business_line?:string|null; routing_reason?:string|null; identity_status?:string|null;
};
type TeamMember={id:string;display_name?:string|null;name?:string|null;full_name?:string|null};
type InboxNote={id:string;thread_key:string;note_text:string;author_name:string|null;created_at:string|null;mentions?:Array<{id:string;display_name:string}>};
type Filter="open"|"sales"|"service";
type PhoneSummary={inbound_queue_calls?:number;answered_live?:number;missed?:number;live_answer_rate_pct?:number;avg_answer_wait_seconds?:number;median_answer_wait_seconds?:number;longest_answer_wait_seconds?:number;longest_missed_wait_seconds?:number};
const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});

function fmtTime(v:string|null){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}
function fmtDate(v:string|null){if(!v)return"—";const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString(undefined,{month:"short",day:"numeric"});}
function SocialPlatformIcon({platform}:{platform?:"instagram"|"facebook"|null}){if(!platform)return null;return platform==="facebook"?<span title="Facebook Messenger" aria-label="Facebook Messenger" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",height:21,width:21,borderRadius:6,background:"#1877f2",color:"#fff",fontWeight:900,fontSize:18,marginRight:7,verticalAlign:"middle"}}>f</span>:<span title="Instagram" aria-label="Instagram" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",height:21,width:21,borderRadius:6,background:"linear-gradient(135deg,#8134af,#dd2a7b,#f58529)",color:"#fff",marginRight:7,verticalAlign:"middle"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg></span>;}
function kindLabel(kind:string){if(kind==="social")return "Social DM";if(kind==="email")return"Email";if(kind==="text")return"Text";if(kind==="abandoned_call")return"Abandoned call";if(kind==="missed_call")return"Missed call";if(kind==="voicemail")return"Voicemail";if(kind==="shopping")return"TripWorks Draft";return"Call";}
function currentStateLabel(t:InboxThread){if(t.lane==="service"&&t.business_line==="rental")return"RENTAL SERVICE";if(t.lane==="service"&&t.business_line==="tour")return"TOUR SERVICE";if(t.lane==="service")return"SERVICE";if(t.opportunity_status==="lost")return"LOST LEAD";if(t.opportunity_status==="retired")return"CLOSED LEAD";if(t.opportunity_status==="booked")return"BOOKED";if(t.opportunity_status==="open")return"ACTIVE LEAD";if(t.lane==="sales"&&t.routing_reason==="active_sales")return"ACTIVE LEAD";return"SALES";}
function currentStateClass(t:InboxThread){if(t.lane==="sales")return styles.sales;if(t.lane==="service")return styles.service;return styles.sales;}
function twReservationUrl(code:string|null){return code?`https://epic4x4.tripworks.com/trip/${encodeURIComponent(code)}/bookings`:null;}
function renderMentions(note:InboxNote){
  const names=(note.mentions||[]).map(m=>m.display_name).filter(Boolean);
  if(!names.length)return note.note_text;
  let parts:[string,boolean][]=[[note.note_text,false]];
  for(const full of names){
    const first=full.split(" ")[0];
    const tokens=[`@${full}`,`@${first}`].sort((a,b)=>b.length-a.length);
    for(const token of tokens){
      const next:[string,boolean][]=[];
      for(const [text,tagged] of parts){
        if(tagged){next.push([text,true]);continue;}
        const lower=text.toLowerCase(),needle=token.toLowerCase();
        let start=0,index=lower.indexOf(needle,start);
        if(index<0){next.push([text,false]);continue;}
        while(index>=0){
          if(index>start)next.push([text.slice(start,index),false]);
          next.push([text.slice(index,index+token.length),true]);
          start=index+token.length;
          index=lower.indexOf(needle,start);
        }
        if(start<text.length)next.push([text.slice(start),false]);
      }
      parts=next;
    }
  }
  return <>
{parts.map(([text,tagged],i)=>tagged?<span key={i} style={{display:"inline-block",padding:"1px 5px",borderRadius:6,background:"#eaf2ff",color:"#1b5fbf",fontWeight:800}}>{text}</span>:<span key={i}>{text}</span>)}</>;
}

function renderDraftMentions(text:string,names:string[]){
  const tokens=names.map(name=>"@"+name).filter(token=>text.toLowerCase().includes(token.toLowerCase())).sort((a,b)=>b.length-a.length);
  const pieces:Array<{value:string;tag:boolean}>=[];
  let i=0;
  while(i<text.length){
    const token=tokens.find(t=>text.slice(i,i+t.length).toLowerCase()===t.toLowerCase());
    if(token){pieces.push({value:text.slice(i,i+token.length),tag:true});i+=token.length;continue;}
    const last=pieces[pieces.length-1];
    if(last&&!last.tag)last.value+=text[i];else pieces.push({value:text[i],tag:false});
    i++;
  }
  return pieces.map((piece,index)=>piece.tag?<span key={index} style={{background:"#eaf2ff",color:"#1b5fbf",borderRadius:5,fontWeight:800}}>{piece.value}</span>:<span key={index}>{piece.value}</span>);
}

const socialActionStyle={border:"1px solid #d9e2eb",borderRadius:9,padding:"9px 14px",background:"#fff",color:"#243449",fontSize:13,fontWeight:800,cursor:"pointer"} as const;
const socialPrimaryStyle={...socialActionStyle,background:"#ff6526",borderColor:"#ff6526",color:"#fff"} as const;
export default function InboxClient(){
  const[socialDetail,setSocialDetail]=useState<{messages:Array<{id:string;at:string;body:string;direction:string}>;link:{contact_id:string;display_name?:string}|null}|null>(null);
  const[linkedC360Open,setLinkedC360Open]=useState(false);
  const[closeChoice,setCloseChoice]=useState(false);
  const[claimFollowUp,setClaimFollowUp]=useState(false);
  const[followDue,setFollowDue]=useState("");
  const[followTitle,setFollowTitle]=useState("Call customer about their plans");
  const[followNote,setFollowNote]=useState("");
  const[showLostReasons,setShowLostReasons]=useState(false);
  const[linkContactId,setLinkContactId]=useState("");
  const[linkMatches,setLinkMatches]=useState<Array<{contact_id:string;display_name:string|null;canonical_phone:string|null;canonical_email:string|null}>>([]);
  const[linkSearched,setLinkSearched]=useState(false);
  const[threads,setThreads]=useState<InboxThread[]>([]);const[inboxMedia,setInboxMedia]=useState<Record<string,Array<{id:string;content_type:string}>>>({});const[openedMedia,setOpenedMedia]=useState<string|null>(null);const[phoneSummary,setPhoneSummary]=useState<PhoneSummary>({});const[selectedKey,setSelectedKey]=useState<string|null>(null);const[filter,setFilter]=useState<Filter>("open");const[query,setQuery]=useState("");const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[customer360Open,setCustomer360Open]=useState(false);const[mentionTarget,setMentionTarget]=useState<string|null>(null);const[notes,setNotes]=useState<InboxNote[]>([]);const[noteText,setNoteText]=useState("");const[reply,setReply]=useState("");const[channel,setChannel]=useState<"email"|"text">("email");const[subject,setSubject]=useState("Your Epic 4X4 Adventure");const[teamMembers,setTeamMembers]=useState<TeamMember[]>([]);const[selectedMentionNames,setSelectedMentionNames]=useState<string[]>([]);const[mentionThreads,setMentionThreads]=useState<string[]>([]);const[mentionCount,setMentionCount]=useState(0);const[mentionAuthors,setMentionAuthors]=useState<Record<string,string>>({});const[mentionAlerts,setMentionAlerts]=useState<Array<{thread_key:string;mentioned_by_name:string;created_at:string}>>([]);const[showMentionAlerts,setShowMentionAlerts]=useState(true);
  async function load(){try{const r=await fetch("/api/sales/inbox",{cache:"no-store"});const p=await r.json();if(r.status===401){window.location.replace("/uui-login?expired=1");return;}if(!r.ok)throw new Error(p?.error||"Unable to load inbox.");setError("");setThreads(p.threads||[]);setPhoneSummary(p.phone_summary||{});setTeamMembers(Array.isArray(p.team_members)?p.team_members:[]);setMentionThreads(p.mentions?.thread_keys||[]);setMentionAlerts(Array.isArray(p.mentions?.threads)?p.mentions.threads:[]);setMentionCount(Number(p.mentions?.unread_count||0));setMentionAuthors(Object.fromEntries((p.mentions?.threads||[]).map((m:{thread_key:string;mentioned_by_name:string})=>[m.thread_key,m.mentioned_by_name])));}catch(e){setError(e instanceof Error?e.message:"Unable to load inbox.");}}
  async function loadSocialDetail(key:string){try{const r=await fetch("/api/sales/inbox?social_detail="+encodeURIComponent(key),{cache:"no-store"});const p=await r.json();if(r.ok)setSocialDetail(p.detail||null);}catch{setSocialDetail(null);}}
  async function findCustomer(){setBusy(true);setError("");try{const res=await fetch("/api/sales/inbox?meta_lookup="+encodeURIComponent(linkContactId.trim()),{cache:"no-store"});const data=await res.json();if(!res.ok)throw new Error(data.error||"Lookup failed");setLinkMatches(data.matches||[]);setLinkSearched(true);}catch(err){setError(err instanceof Error?err.message:"Lookup failed");}finally{setBusy(false);}}
  async function changeSocialLink(action:"link"|"unlink",id?:string){if(!selected?.thread_key.startsWith("meta:facebook:"))return;setBusy(true);setError("");try{const res=await fetch("/api/sales/inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,thread_key:selected.thread_key,contact_id:id})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Link failed");await loadSocialDetail(selected.thread_key);setLinkMatches([]);setLinkSearched(false);}catch(err){setError(err instanceof Error?err.message:"Link failed");}finally{setBusy(false);}}

  async function loadNotes(threadKey:string){try{const r=await fetch(`/api/sales/inbox?thread_key=${encodeURIComponent(threadKey)}`,{cache:"no-store"});const p=await r.json();if(r.ok)setNotes(p.notes||[]);}catch{}}
  useEffect(()=>{void load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},5000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{if(selectedKey){setError("");void loadNotes(selectedKey);if(selectedKey.startsWith("social:")||selectedKey.startsWith("meta:"))void loadSocialDetail(selectedKey);else setSocialDetail(null);setNoteText("");setSelectedMentionNames([]);setReply("");setLinkMatches([]);setLinkSearched(false);const thread=threads.find(t=>t.thread_key===selectedKey);setChannel(thread?.kind==="text"?"text":"email");}else setNotes([]);},[selectedKey]);
  const visible=useMemo(()=>{const q=query.trim().toLowerCase();return threads.filter(t=>{if(!t.is_open)return false;if(filter!=="open"&&t.lane!==filter)return false;if(!q)return true;return[t.customer_name,t.email,t.phone,t.subject,t.preview,t.reservation_confirmation,t.interest_label].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));});},[threads,filter,query,mentionThreads]);
  const selected=useMemo(()=>visible.find(t=>t.thread_key===selectedKey)||threads.find(t=>t.thread_key===selectedKey)||null,[visible,threads,selectedKey]);
  useEffect(()=>{
    const ids=[...new Set(visible.filter(t=>t.kind==="text"&&t.source_id).map(t=>t.source_id))].slice(0,80);
    if(!ids.length){setInboxMedia({});return;}
    let live=true;
    fetch("/api/sales/message-media?events="+encodeURIComponent(ids.join(",")),{cache:"no-store"})
      .then(r=>r.ok?r.json():null).then(p=>{
        if(!live)return;
        const media:Record<string,Array<{id:string;content_type:string}>>={};
        for(const a of p?.attachments||[])if(a.provider_event_id)(media[a.provider_event_id]??=[]).push(a);
        setInboxMedia(media);
      }).catch(()=>{});
    return ()=>{live=false};
  },[visible.map(t=>t.source_id).join("|")]);
  const mediaPreview=(sourceId:string,large=false)=>(inboxMedia[sourceId]||[]).map(a=>
    ["image/jpeg","image/png","image/gif","image/webp","image/avif","image/bmp"].includes(a.content_type)
      ?<img key={a.id} src={"/api/sales/message-media?id="+encodeURIComponent(a.id)} alt="Open customer photo larger" title="Click to enlarge" tabIndex={0} role="button" onClick={event=>{event.stopPropagation();setOpenedMedia(a.id);}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();event.stopPropagation();setOpenedMedia(a.id);}}} loading="lazy" style={{display:"inline-block",width:large?180:54,height:large?130:46,objectFit:"cover",borderRadius:7,marginTop:6,marginRight:7,border:"1px solid #d9e1e9",cursor:"zoom-in"}}/>
      :<span key={a.id} style={{display:"inline-block",fontSize:12,marginTop:5}}>📎 Attachment</span>
  );

  async function respondMention(threadKey:string,response:"acknowledged"|"dismissed"){setBusy(true);setError("");try{const r=await fetch("/api/sales/inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"respond_mention",thread_key:threadKey,response})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||"Unable to update mention");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to update mention");}finally{setBusy(false);}}
  async function closeThread(){if(!selected)return;setBusy(true);setError("");try{const r=await fetch("/api/sales/inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"close",thread_key:selected.thread_key})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p?.error||"Unable to close conversation.");setNoteText("");setSelectedKey(null);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to close conversation.");}finally{setBusy(false);}}
  const mentionMatch=noteText.match(/(?:^|\s)@([\w-]*)$/);
  const mentionOptions=mentionMatch?teamMembers.filter(member=>{const name=String(member.display_name||member.full_name||member.name||"");return name.toLowerCase().split(/\s+/).some(part=>part.startsWith(mentionMatch[1].toLowerCase()));}): [];
  function selectMention(member:TeamMember){const name=String(member.display_name||member.full_name||member.name||"").trim();if(!name)return;setSelectedMentionNames(current=>[...new Set([...current,name])]);setNoteText(current=>current.replace(/(^|\s)@[\w-]*$/,(_,space:string)=>`${space}@${name} `));}
  async function addNote(){if(!selected||!noteText.trim())return;setBusy(true);setError("");try{const r=await fetch("/api/sales/inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"note",thread_key:selected.thread_key,note_text:noteText.trim()})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p?.error||"Unable to add note.");setNoteText("");setSelectedMentionNames([]);await Promise.all([loadNotes(selected.thread_key),load()]);}catch(e){setError(e instanceof Error?e.message:"Unable to add note.");}finally{setBusy(false);}}
  async function markLostFromInbox(category:string,reason:string,note:string){
    if(!selected?.opportunity_id)return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/sales/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"mark_lost",opportunity_id:selected.opportunity_id,reason:category+" | "+reason,note_text:note||null})});
      const result=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(result.error||"Unable to mark opportunity lost.");
      setShowLostReasons(false);setCloseChoice(false);
      await closeThread();
    }catch(e){setError(e instanceof Error?e.message:"Unable to mark opportunity lost.");}finally{setBusy(false);}
  }
  async function quickFollowUp(message:string){if(!selected)throw new Error("Select a customer first.");const r=await fetch("/api/sales/inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"note",thread_key:selected.thread_key,note_text:message})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||"Unable to save follow-up.");await Promise.all([loadNotes(selected.thread_key),load()]);}
  async function routeThread(destination:"sales"|"service"){if(!selected)return;setBusy(true);setError("");try{const r=await fetch("/api/sales/inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"route",thread_key:selected.thread_key,destination,note_text:noteText.trim()||null})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p?.error||"Unable to move conversation.");setNoteText("");setSelectedKey(null);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to move conversation.");}finally{setBusy(false);}}
  async function sendReply(){if(!selected||!reply.trim())return;setBusy(true);setError("");try{const isMeta=selected.thread_key.startsWith("meta:facebook:");const isInstagramMeta=selected.thread_key.startsWith("meta:instagram:");const isSocial=selected.thread_key.startsWith("social:");const isPodium=selected.thread_key.startsWith("podium:");const isTelnyx=selected.thread_key.startsWith("telnyx:");if((isPodium||isTelnyx)&&channel!=="text")throw new Error("These conversations use SMS replies.");const r=await fetch(isMeta?"/api/sales/meta-messenger":isInstagramMeta?"/api/sales/meta-instagram":isSocial&&selected.platform==="instagram"?"/api/sales/meta-instagram":isSocial&&selected.platform==="facebook"?"/api/sales/meta-facebook-social":isSocial?"/api/sales/podium-social":isPodium?"/api/sales/podium-text":isTelnyx?"/api/sales/telnyx-text":"/api/sales/customer-communications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...(isMeta?{recipient_id:selected.thread_key.slice("meta:facebook:".length)}:isInstagramMeta?{recipient_id:selected.thread_key.slice("meta:instagram:".length)}:isSocial?{platform:selected.platform,conversation_uid:selected.thread_key.split(":").slice(2).join(":")}:isPodium?{conversation_uid:selected.thread_key.slice(7)}:{}),channel,confirmation:selected.reservation_confirmation,opportunity_id:selected.opportunity_id,contact_id:selected.contact_id,email:selected.email,phone:isTelnyx?selected.thread_key.slice("telnyx:".length):selected.phone,customer_name:selected.customer_name,subject:channel==="email"?subject:null,message_text:reply.trim()})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(typeof p?.error==="string"?p.error:"Unable to send message.");setReply("");if(isMeta||isInstagramMeta||isSocial)await loadSocialDetail(selected.thread_key);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to send message.");}finally{setBusy(false);}}
  async function claimAndSchedule(){
    if(!selected||!followDue||!followTitle.trim())return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/sales/inbox/claim-follow-up",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        thread_key:selected.thread_key,opportunity_id:selected.opportunity_id,contact_id:selected.contact_id,
        title:followTitle.trim(),context_note:followNote.trim(),due_at:new Date(followDue).toISOString()
      })});
      const p=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(p.error||"Unable to schedule follow-up");
      setClaimFollowUp(false);setSelectedKey(null);await load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to claim follow-up")}
    finally{setBusy(false)}
  }
  async function claimLead(){if(!selected?.opportunity_id)return;setBusy(true);setError("");try{const r=await fetch("/api/sales/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"claim",opportunity_id:selected.opportunity_id})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p?.error||"Unable to claim lead.");
    // Claiming an Inbox sales notification hands the opportunity to Sales; it does not retire the lead.
    // Close only this Inbox thread, preserving C360 history and allowing fresh inbound activity to re-open it.
    if(selected.lane==="sales"&&selected.kind==="shopping"){
      const closed=await fetch("/api/sales/inbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"close",thread_key:selected.thread_key})});
      const result=await closed.json().catch(()=>({}));
      if(!closed.ok)throw new Error("Lead claimed, but the Inbox notification could not be cleared: "+(result.error||"Try closing the conversation."));
      setSelectedKey(null);
    }
    await load();}catch(e){setError(e instanceof Error?e.message:"Unable to claim lead.");}finally{setBusy(false);}}
  const counts=useMemo(()=>({open:threads.filter(t=>t.is_open).length,sales:threads.filter(t=>t.is_open&&t.lane==="sales").length,service:threads.filter(t=>t.is_open&&t.lane==="service").length}),[threads]);
  return <>
    {openedMedia?<div role="presentation" onClick={()=>setOpenedMedia(null)} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(12,19,30,.9)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div role="dialog" aria-modal="true" aria-label="Full-size customer photo" onClick={e=>e.stopPropagation()} style={{position:"relative",maxWidth:"95vw",maxHeight:"95vh"}}>
        <button type="button" aria-label="Close photo" onClick={()=>setOpenedMedia(null)} style={{position:"absolute",top:-17,right:-17,zIndex:1,border:0,borderRadius:22,background:"#fff",color:"#17212e",width:36,height:36,fontSize:22,cursor:"pointer"}}>×</button>
        <img src={"/api/sales/message-media?id="+encodeURIComponent(openedMedia)} alt="Customer photo enlarged" style={{display:"block",maxWidth:"90vw",maxHeight:"88vh",width:"auto",height:"auto",objectFit:"contain",borderRadius:8}}/>
      </div>
    </div>:null}
    <section className={styles.phoneKpis}>
      <div><span>Total Calls</span><strong>{phoneSummary.inbound_queue_calls??0}</strong></div>
      <div><span>Median Answer</span><strong>{phoneSummary.median_answer_wait_seconds==null?"—":`${Math.round(phoneSummary.median_answer_wait_seconds)}s`}</strong></div>
      <div><span>Average Answer</span><strong>{phoneSummary.avg_answer_wait_seconds==null?"—":`${Math.round(phoneSummary.avg_answer_wait_seconds)}s`}</strong></div>
      <div><span>Longest Wait</span><strong>{phoneSummary.longest_answer_wait_seconds==null?"—":`${Math.round(phoneSummary.longest_answer_wait_seconds)}s`}</strong></div>
    </section>
    <header className={styles.header}><div><div className={styles.eyebrow}>EpicC360</div><h1>Inbox <span className={styles.count}>{counts.open}</span></h1><p>Every open customer conversation, in one place. Closed conversations remain in EpicC360 and can be found under Customers.</p></div><div className={styles.filters}><button className={`${styles.filter} ${filter==="open"?styles.filterActive:""}`} onClick={()=>setFilter("open")}>Open {counts.open}</button><button className={`${styles.filter} ${filter==="sales"?styles.filterActive:""}`} onClick={()=>setFilter("sales")}>Sales {counts.sales}</button><button className={`${styles.filter} ${filter==="service"?styles.filterActive:""}`} onClick={()=>setFilter("service")}>Service {counts.service}</button></div></header>
    <div className={styles.workspace}>
      <section className={styles.listPane}><div className={styles.listHeader}><input className={styles.search} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search open conversations…"/></div>{error?<div className={styles.error}>{error}</div>:null}{visible.map(t=><button key={t.thread_key} className={`${styles.thread} ${selectedKey===t.thread_key?styles.selected:""}`} onClick={()=>{setError("");setSelectedKey(t.thread_key);}}><div className={styles.threadTop}><div className={styles.name}><SocialPlatformIcon platform={t.platform}/>{t.customer_name||t.email||t.phone||"Unknown customer"}{mentionThreads.includes(t.thread_key)?<span style={{display:"inline-flex",marginLeft:7,padding:"3px 7px",borderRadius:999,background:"#fff0e8",color:"#c84817",fontSize:10,fontWeight:900,verticalAlign:2}}>{mentionAuthors[t.thread_key]||"Someone"} mentioned you</span>:null}</div><div className={styles.time}>{fmtTime(t.occurred_at)}</div></div><div className={styles.threadMeta}><span className={`${styles.pill} ${currentStateClass(t)}`}>{currentStateLabel(t)}</span>{t.identity_status==="unidentified"?<span className={`${styles.pill} ${styles.unmatched}`}>Unidentified</span>:null}<span className={`${styles.pill} ${t.kind==="shopping"?styles.tripworksDraft:""}`}>{kindLabel(t.kind)}</span></div><div className={styles.preview}>{t.subject?`${t.subject} — `:""}{t.preview||(inboxMedia[t.source_id]?.length?"📷 Photo received":"No preview")}</div>{mediaPreview(t.source_id)}</button>)}</section>
      <section className={styles.detailPane}>{selected?<div className={styles.card}><div className={styles.detailTop}><div><div className={styles.eyebrow}>{selected.lane==="service"?"Service":"Sales"}</div><h2><SocialPlatformIcon platform={selected.platform}/>{selected.customer_name||selected.email||selected.phone||"Unknown customer"}{selected.platform?` · ${selected.platform==="instagram"?"Instagram":"Facebook Messenger"}`:""}</h2><div className={styles.sub}>{[selected.email,selected.phone].filter(Boolean).join(" · ")||"No known contact record yet"}</div></div><span className={`${styles.pill} ${currentStateClass(selected)}`}>{currentStateLabel(selected)}</span></div>
        <div className={styles.contextGrid}><div className={styles.context}><span>Latest inbound</span><strong>{kindLabel(selected.kind)}</strong></div><div className={styles.context}><span>Lead value</span><strong>{selected.lead_value_cents!=null?money.format(selected.lead_value_cents/100):"—"}</strong></div><div className={styles.context}><span>Owner</span><strong>{selected.claimed_by_name||selected.assigned_rep_name||"Unassigned"}</strong></div><div className={styles.context}><span>Interest</span><strong>{selected.interest_label||"—"}</strong></div><div className={styles.context}><span>Visit window</span><strong>{selected.activity_window_start?`${fmtDate(selected.activity_window_start)}${selected.activity_window_end&&selected.activity_window_end!==selected.activity_window_start?` – ${fmtDate(selected.activity_window_end)}`:""}`:"—"}</strong></div><div className={styles.context}><span>Reservation</span><strong>{selected.reservation_confirmation&&twReservationUrl(selected.reservation_confirmation)?<a href={twReservationUrl(selected.reservation_confirmation)!} target="_blank" rel="noreferrer">{selected.reservation_confirmation}</a>:"—"}</strong></div></div>
        <div className={styles.message}><div className={styles.messageLabel}>Latest customer activity · {fmtTime(selected.occurred_at)}</div>{selected.subject?<div className={styles.subject}>{selected.subject}</div>:null}<div className={styles.body}>{selected.preview||(inboxMedia[selected.source_id]?.length?"📷 Photo received":"No message preview available.")}</div>{mediaPreview(selected.source_id,true)}</div>
        {(selected.kind==="social"||selected.thread_key.startsWith("meta:"))?<div className={styles.message}><div className={styles.messageLabel}><SocialPlatformIcon platform={selected.platform}/>Social conversation · {selected.platform==="instagram"?"Instagram":"Facebook Messenger"}</div><div style={{display:"grid",gap:8,marginTop:10}}>{(socialDetail?.messages||[]).map(m=><div key={m.id} style={{padding:10,background:m.direction==="outbound"?"#e3f1ff":"#f3f4f6",borderRadius:9}}><strong>{m.direction==="outbound"?"Epic team":"Social contact"}</strong><div>{m.body}</div><small>{fmtTime(m.at)}</small></div>)}</div><div style={{marginTop:12,fontWeight:700}}>Customer identity</div>{socialDetail?.link?<div>Linked to {socialDetail.link.display_name||socialDetail.link.contact_id} <button type="button" style={socialPrimaryStyle} onClick={()=>setLinkedC360Open(true)}>Open Customer C360</button> <button type="button" style={socialActionStyle} disabled={busy} onClick={()=>void changeSocialLink("unlink")}>Unlink</button></div>:<div style={{marginTop:6}}><div style={{display:"flex",gap:8}}><input aria-label="Find customer by phone email or ID" placeholder="Search phone, email, or customer ID" value={linkContactId} onChange={e=>{setLinkContactId(e.target.value);setLinkSearched(false);setLinkMatches([]);}}/><button type="button" disabled={busy||!linkContactId.trim()} onClick={()=>void findCustomer()}>Find Customer</button></div>{linkSearched&&linkMatches.length===0?<div>No matching customer found. Social profile remains independent.</div>:null}{linkMatches.map(m=><div key={m.contact_id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 4px"}}><span>{m.display_name||"Customer"} · {m.canonical_phone||m.canonical_email||m.contact_id}</span><button type="button" disabled={busy} onClick={()=>void changeSocialLink("link",m.contact_id)}>Confirm Link</button></div>)}</div>}</div>:null}
        <div className={styles.message}><div className={styles.messageLabel}>Reply to Customer</div><div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:8,marginTop:10}}>{(selected.kind==="social"||selected.thread_key.startsWith("meta:"))?<div style={{fontWeight:800}}>{selected.thread_key.startsWith("meta:instagram:")?"Reply directly via Meta Instagram":selected.thread_key.startsWith("meta:")?"Reply directly via Meta Messenger": selected.platform==="instagram"?"Reply directly via Meta Instagram":"Reply directly via Meta Facebook"}</div>:<select className={styles.search} value={channel} onChange={e=>setChannel(e.target.value as "email"|"text")}><option value="email" disabled={selected.thread_key.startsWith("podium:")}>Email</option><option value="text">Text</option></select>}{selected.kind!=="social"&&channel==="email"?<input className={styles.search} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject"/>:<div/>}</div><textarea className={styles.search} style={{minHeight:100,resize:"vertical",marginTop:8}} value={reply} onChange={e=>setReply(e.target.value)} placeholder={selected.kind==="social"?"Write social reply…":channel==="email"?"Write email…":"Write text…"} maxLength={selected.kind==="social"||channel==="text"?1600:20000}/><div className={styles.actions} style={{marginTop:10}}><button className={styles.primary} disabled={busy||(selected.kind==="social"&&!selected.thread_key.startsWith("meta:")&&selected.platform!=="instagram"&&selected.platform!=="facebook")||!reply.trim()||(selected.kind!=="social"&&!selected.thread_key.startsWith("meta:")&&((channel==="email"&&!selected.email)||(channel==="text"&&!selected.phone)))} onClick={()=>void sendReply()}>{busy?"Sending…":selected.thread_key.startsWith("meta:instagram:")?"Send via Instagram":selected.thread_key.startsWith("meta:")?"Send via Messenger":selected.kind==="social"?`Send via ${selected.platform==="instagram"?"Instagram":"Facebook"}`:channel==="email"?"Send Email":"Send Text"}</button></div></div>

        <div className={styles.message}><div className={styles.messageLabel}>Notes</div><QuickFollowUp onLog={quickFollowUp} onCallback={()=>{setFollowTitle("Call customer back");setFollowDue("");setFollowNote("Callback requested by customer");setClaimFollowUp(true)}} />{notes.length?<div style={{display:"grid",gap:9,marginTop:10}}>{notes.map(n=><div key={n.id} style={{border:"1px solid #e6eaee",borderRadius:10,padding:"10px 12px",background:"#fafbfc"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",fontSize:12}}><strong>{n.author_name||"Epic team"}</strong><span style={{color:"#8b95a1",fontSize:11}}>{fmtTime(n.created_at)}</span></div><div style={{marginTop:5,whiteSpace:"pre-wrap",fontSize:13,lineHeight:1.45}}>{renderMentions(n)}</div></div>)}</div>:null}<div style={{position:"relative",marginTop:8}}>
          {noteText?<div aria-hidden="true" style={{position:"absolute",inset:0,padding:"12px 13px",fontFamily:"monospace",fontSize:13,lineHeight:"20px",whiteSpace:"pre-wrap",overflowWrap:"anywhere",pointerEvents:"none",color:"#17212e",zIndex:1}}>{renderDraftMentions(noteText,selectedMentionNames)}</div>:null}
          <textarea className={styles.search} style={{minHeight:80,resize:"vertical",marginTop:0,position:"relative",zIndex:2,background:"transparent",color:noteText?"transparent":undefined,caretColor:"#17212e",fontFamily:"monospace",fontSize:13,lineHeight:"20px"}} value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Add a guest note… Type @ to mention a teammate." aria-label="Guest notes" />
        </div>{mentionOptions.length>0?<div role="listbox" aria-label="Mention a teammate" style={{border:"1px solid #d9e1ea",borderRadius:10,marginTop:5,padding:4,background:"#fff",boxShadow:"0 5px 18px rgba(0,0,0,.08)",maxHeight:260,overflowY:"auto"}}>{mentionOptions.map(member=><button key={member.id} type="button" role="option" aria-selected={false} onClick={()=>selectMention(member)} style={{display:"block",width:"100%",padding:"8px 10px",background:"transparent",border:0,textAlign:"left",cursor:"pointer",fontSize:13}}>@{member.display_name||member.full_name||member.name}</button>)}</div>:null}<div className={styles.actions} style={{marginTop:10}}><button className={styles.secondary} disabled={busy||!noteText.trim()} onClick={()=>void addNote()}>{busy?"Posting…":"Post Note"}</button></div></div>        <div className={styles.actions}>{selected.lane==="sales"&&selected.opportunity_id&&selected.opportunity_status==="open"&&!selected.claimed_by_name?<button className={styles.secondary} disabled={busy} onClick={()=>{setFollowTitle("Call customer about their plans");setFollowDue("");setFollowNote("");setClaimFollowUp(true)}}>Claim</button>:null}<button className={styles.secondary} onClick={()=>{if(selected.thread_key.startsWith("social:")){if(socialDetail?.link?.contact_id)setLinkedC360Open(true);else setError("Social contact is not linked yet. Reload this conversation and try again.");}else setCustomer360Open(true);}}>{selected.thread_key.startsWith("meta:")?"Open Social C360":"Open EpicC360"}</button>{selected.lane!=="service"?<button className={styles.secondary} disabled={busy} onClick={()=>void routeThread("service")}>{noteText.trim()?"Send to Service + Note":"Send to Service"}</button>:<button className={styles.secondary} disabled={busy} onClick={()=>void routeThread("sales")}>{noteText.trim()?"Send to Sales + Note":"Send to Sales"}</button>}{selected.opportunity_id&&selected.opportunity_status==="open"&&selected.claimed_by_name?<span className={styles.pill}>Claimed · {selected.claimed_by_name}</span>:null}<button className={styles.primary} disabled={busy||!selected.is_open} onClick={()=>selected.lane==="sales"&&(selected.opportunity_id||selected.contact_id)?setCloseChoice(true):void closeThread()}>{busy?"Closing…":"Close"}</button></div><div className={styles.cleanNote}>Close removes this conversation from the Inbox. The customer and full history remain searchable in Customers / EpicC360. New inbound activity brings the conversation back.</div>
      </div>:<div className={styles.empty}><div><strong>Select a conversation</strong><div style={{marginTop:8}}>Customer context and the latest inbound activity will appear here.</div></div></div>}</section>
    </div>
    {claimFollowUp?<div role="presentation" style={{position:"fixed",inset:0,zIndex:2901,background:"rgba(15,23,42,.58)",display:"grid",placeItems:"center",padding:16}}>
      <section role="dialog" aria-modal="true" aria-label="Claim and schedule follow-up" style={{width:"min(480px,100%)",background:"#fff",borderRadius:14,padding:24,display:"grid",gap:12}}>
        <h2 style={{margin:0}}>Claim Opportunity</h2>
        <strong>{selected?.customer_name||"Customer"}</strong>
        <p style={{fontSize:13,margin:0}}>Claim this opportunity and optionally schedule a follow-up. Full notes stay in C360.</p>
        <label>Follow-up action<input style={{display:"block",width:"100%",padding:10,marginTop:5}} value={followTitle} onChange={e=>setFollowTitle(e.target.value)}/></label>
        <label>Due date & time<input type="datetime-local" style={{display:"block",padding:10,marginTop:5}} value={followDue} onChange={e=>setFollowDue(e.target.value)}/></label>
        <label>Context for C360<textarea rows={3} style={{display:"block",width:"100%",padding:10,marginTop:5}} value={followNote} onChange={e=>setFollowNote(e.target.value)} placeholder="What are we following up on?"/></label>
        <div style={{display:"flex",gap:10}}>
          <button type="button" disabled={busy||!followDue||!followTitle.trim()} onClick={()=>void claimAndSchedule()}>{busy?"Saving…":"Claim & Schedule Follow-Up"}</button>{selected?.opportunity_id?<button type="button" disabled={busy} onClick={()=>{setClaimFollowUp(false);void claimLead();}}>Claim Without Follow-Up</button>:null}
          <button type="button" disabled={busy} onClick={()=>setClaimFollowUp(false)}>Cancel</button>
        </div>
      </section></div>:null}
    {closeChoice?<div role="presentation" style={{position:"fixed",inset:0,zIndex:2900,background:"rgba(15,23,42,.58)",display:"grid",placeItems:"center",padding:16}}><section role="dialog" aria-modal="true" aria-label="Close conversation or opportunity" style={{width:"min(440px,100%)",background:"#fff",borderRadius:15,padding:23,display:"grid",gap:12}}><h2 style={{margin:0}}>What are you closing?</h2><button type="button" disabled={busy} onClick={()=>{setCloseChoice(false);void closeThread();}} style={{padding:15,border:"1px solid #d4dce6",borderRadius:10,background:"#fff",textAlign:"left",cursor:"pointer"}}><strong>Conversation Complete</strong><div style={{fontSize:12,color:"#667085",marginTop:4}}>Remove from Inbox. The sales opportunity remains active.</div></button>{selected?.opportunity_id?<button type="button" disabled={busy} onClick={()=>{setCloseChoice(false);setShowLostReasons(true);}} style={{padding:15,border:"1px solid #d4dce6",borderRadius:10,background:"#fff",textAlign:"left",cursor:"pointer"}}><strong>Sales Opportunity Lost</strong><div style={{fontSize:12,color:"#667085",marginTop:4}}>Record why the guest didn't book and close the conversation.</div></button>:null}<button type="button" disabled={busy} onClick={()=>setCloseChoice(false)} style={{padding:9,background:"#fff",border:0,cursor:"pointer"}}>Cancel</button></section></div>:null}
    {showLostReasons?<LostReasonDialog busy={busy} onCancel={()=>setShowLostReasons(false)} onConfirm={markLostFromInbox}/>:null}
    {customer360Open&&selected?.thread_key.startsWith("meta:")?<div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,.5)",padding:28,overflow:"auto"}}><section style={{background:"#fff",borderRadius:16,padding:28,minHeight:"85vh",maxWidth:1100,margin:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2><SocialPlatformIcon platform="facebook"/>{selected.customer_name||"Facebook Contact"} · Social C360</h2><div>{socialDetail?.link?<button type="button" style={socialPrimaryStyle} onClick={()=>setLinkedC360Open(true)}>Open {socialDetail.link.display_name||"Customer"} C360</button>:null}<button style={socialActionStyle} onClick={()=>setCustomer360Open(false)}>Close</button></div></div><p>Independent Facebook Messenger identity. No TripWorks customer link is required.</p><h3>Messenger history</h3><div style={{display:"grid",gap:12}}>{(socialDetail?.messages||[]).map(m=><div key={m.id} style={{background:m.direction==="outbound"?"#eaf3ff":"#f3f4f6",padding:14,borderRadius:10}}><strong>{m.direction==="outbound"?"Epic 4X4 Adventures":"Facebook contact"}</strong><p>{m.body}</p><small>{fmtTime(m.at)}</small></div>)}</div></section></div>:null}
    {linkedC360Open&&socialDetail?.link?<Customer360Modal open={linkedC360Open} onClose={()=>setLinkedC360Open(false)} contactId={socialDetail.link.contact_id}/>:null}
    {customer360Open&&((selected&&!selected.thread_key.startsWith("meta:")&&!selected.thread_key.startsWith("social:"))||mentionTarget)?<Customer360Modal key={mentionTarget||selected?.thread_key||"unknown"} open={true} onClose={()=>{setCustomer360Open(false);setMentionTarget(null);}} contactId={mentionTarget?null:selected?.contact_id} opportunityId={mentionTarget||selected?.opportunity_id} reservationId={mentionTarget?null:selected?.reservation_id} reservationConfirmation={mentionTarget?null:selected?.reservation_confirmation} phone={mentionTarget?null:selected?.phone} email={mentionTarget?null:selected?.email}/>:null}
  </>;
}
