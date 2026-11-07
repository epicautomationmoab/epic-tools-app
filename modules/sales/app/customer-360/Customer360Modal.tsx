"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Customer360.module.css";
import CallTranscript from "./CallTranscript";
import GuidedLeadSheet from "../GuidedLeadSheet";
import InternalConversation from "./InternalConversation";
import LeadWorkspaceAccess from "./LeadWorkspaceAccess";
import ReservationReadiness from "./ReservationReadiness";
import ScheduleFollowUp from "./ScheduleFollowUp";
import CustomerFollowUps from "./CustomerFollowUps";
import PossibleCustomerMatches from "./PossibleCustomerMatches";
import SocialIdentityLink from "./SocialIdentityLink";
import ContactIdentityEditor from "./ContactIdentityEditor";

type Identity={contact_id:string|null;name:string|null;phone:string|null;email:string|null;tripworks_customer_id:number|null;tripworks_customer_code:string|null};
type Reservation={id:string;confirmation_code:string|null;customer_name:string|null;customer_email:string|null;customer_phone:string|null;tripworks_customer_id:number|null;business_line:string|null;experience_name:string|null;start_time:string|null;end_time:string|null;trip_status:string|null;booking_status:string|null;is_cancelled:boolean|null;total_amount_cents:number|null;amount_due_cents:number|null;people_count:number|null;trip_method_name:string|null;customer_portal_url:string|null;created_at:string|null;updated_at:string|null;tripworks_booking_url?:string|null;mpwr_confirmation_number?:string|null;mpwr_reservation_url?:string|null};
type Opportunity={id:string;status:string|null;customer_name:string|null;email:string|null;phone:string|null;lead_value_cents:number|null;interest_label:string|null;activity_window_start:string|null;activity_window_end:string|null;assigned_rep_name:string|null;claimed_by_name:string|null;source_method:string|null;shopping_last_activity_at:string|null;updated_at:string|null};
type Draft={id:string;confirmation_code:string|null;experience_name:string|null;option_name:string|null;activity_date:string|null;value_cents:number|null;is_current_draft:boolean|null;converted_at:string|null;last_seen_at:string|null};
type Quote={id:string;opportunity_id:string|null;status:string|null;experience_name:string|null;total_cents:number|null;created_by_name:string|null;emailed_at:string|null;created_at:string|null;visit_start_date:string|null;visit_end_date:string|null};
type Call={customer_phone_number?:string|null;id:string;at:string|null;direction:string|null;answered:boolean|null;voicemail:boolean|null;duration_seconds:number|null;recording_url:string|null;summary:string|null;transcription:string|null;lead_score:number|null;lead_explanation:string|null;source_name:string|null;campaign:string|null;matched_reservation_id:string|null;matched_opportunity_id:string|null;pbx_outcome?:string|null;pbx_answered_extension?:string|null;pbx_answered_agent?:string|null;pbx_queue_wait_seconds?:number|null;pbx_ring_attempts?:number|null;pbx_extensions_rung?:string[]|null;pbx_touched_voicemail?:boolean|null;pbx_voicemail_deposited?:boolean|null;pbx_talk_seconds?:number|null};
type Text={message_uid?:string|null;id:string;at:string|null;direction:string|null;body:string|null;agent_name:string|null;status:string|null;epic_number?:string|null;customer_number?:string|null;provider?:"podium"|"callrail"|"telnyx";conversation_uid?:string|null};
type Email={id:string;at:string|null;direction:string|null;subject:string|null;body:string|null;from_email:string|null;to_emails:string[]|null};
type Note={id:string;opportunity_id:string|null;author_name:string|null;note_text:string|null;created_at:string|null};
type CancellationAgreement={id:string;confirmation_code:string|null;status:string|null;sent_at:string|null;opened_at:string|null;accepted_at:string|null;created_at:string|null;policy_title:string|null;customer_name:string|null;signer_name:string|null};
type SalesCallWorkflow={id:string;opportunity_id:string;rep_name:string;objection_code:string|null;objection_detail:string|null;resolution_note:string|null;outcome_code:string|null;next_action:string|null;follow_up_at:string|null;created_at:string|null;updated_at:string|null};
type Customer360={social_messages?:Array<{event_key:string;platform:"instagram"|"facebook";direction:string;body:string|null;message_at:string|null}>;team_thread_notes?:Array<{id:string;author_name:string|null;note_text:string;created_at:string|null}>;identity:Identity;reservations:Reservation[];opportunities:Opportunity[];drafts:Draft[];quotes:Quote[];calls:Call[];texts:Text[];emails:Email[];notes:Note[];cancellation_agreements?:CancellationAgreement[];sales_call_workflows?:SalesCallWorkflow[]};

type Props={open:boolean;onClose:()=>void;contactId?:string|null;opportunityId?:string|null;reservationId?:string|null;reservationConfirmation?:string|null;phone?:string|null;email?:string|null};
type EventItem={id:string;kind:"social"|"call"|"sales_call"|"text"|"email"|"reservation"|"lead"|"draft"|"quote"|"note"|"agreement";at:string|null;title:string;meta?:string|null;body?:string|null;href?:string|null;hrefLabel?:string|null;secondaryHref?:string|null;secondaryHrefLabel?:string|null;transcript?:string|null;attachments?:Array<{id:string;content_type:string}>};
type LifecycleFilter="all"|"call"|"text"|"email"|"social"|"reservation";

const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
function fmtDateTime(v:string|null){if(!v)return"Unknown time";const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}
function fmtDate(v:string|null){if(!v)return"—";const d=new Date(v.length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function durationLabel(s:number|null){if(s==null)return"";const m=Math.floor(s/60),r=s%60;return m?`${m}m ${r}s`:`${r}s`;}
function twCustomerUrl(code:string|null){return code?`https://epic4x4.tripworks.com/customer/${encodeURIComponent(code)}/trips`:null;}
function twReservationUrl(code:string|null){return code?`https://epic4x4.tripworks.com/trip/${encodeURIComponent(code)}/bookings`:null;}
const objectionLabels:Record<string,string>={price_value:"Price / Value",activity_choice:"Which Activity?",vehicle_choice:"Which Vehicle?",difficulty_safety:"Difficulty / Safety",dates_timing:"Dates / Timing",group_deciding:"Group Still Deciding",competitor:"Comparing Companies",trip_not_final:"Trip Not Finalized",itinerary_help:"Needs Itinerary Help",researching:"Just Researching",other:"Something Else"};
const outcomeLabels:Record<string,string>={booked:"Booked on the call",quote:"Sending quote",activity_info:"Sending activity information",group_discussion:"Customer will discuss with group",follow_up:"Follow up on a specific date",researching:"Not ready / researching",lost:"Lost",do_not_contact:"Do not contact"};

export default function Customer360Modal(props:Props){
  const{open,onClose,contactId,opportunityId,reservationId,reservationConfirmation,phone,email}=props;
  const[data,setData]=useState<Customer360|null>(null);const[openedPhoto,setOpenedPhoto]=useState<string|null>(null);const[leadSheets,setLeadSheets]=useState<Array<{id:string;fields:Record<string,any>;updated_at:string}>>([]);const[editSheet,setEditSheet]=useState<string|null>(null);const[loading,setLoading]=useState(false);const[error,setError]=useState("");const[filter,setFilter]=useState<LifecycleFilter>("all");const[composeChannel,setComposeChannel]=useState<"email"|"text"|null>(null);const[composeSubject,setComposeSubject]=useState("Your Epic 4X4 Adventure");const[composeBody,setComposeBody]=useState("");const[sending,setSending]=useState(false);const[sendStatus,setSendStatus]=useState("");const[textTransport,setTextTransport]=useState<string>("callrail");
  const[replyRouteOverride,setReplyRouteOverride]=useState<string|null>(null);
  const[showReplyChoices,setShowReplyChoices]=useState(false);
  const lastInboundRoute=useMemo(()=>{
    const latest=[...(data?.texts||[])].filter(t=>t.direction==="inbound").sort((a,b)=>new Date(b.at||0).getTime()-new Date(a.at||0).getTime());
    for(const t of latest){
      if(t.provider==="telnyx"&&t.epic_number)return "telnyx";
      if(t.provider==="podium"&&t.conversation_uid)return "podium:"+t.conversation_uid;
      if(t.provider==="callrail"&&t.epic_number)return "callrail:"+t.epic_number;
    }
    return null;
  },[data?.texts]);
  useEffect(()=>{
    setTextTransport(replyRouteOverride||lastInboundRoute||"callrail");
  },[replyRouteOverride,lastInboundRoute]);
  useEffect(()=>{if(!open){setReplyRouteOverride(null);setShowReplyChoices(false);}},[open]);

  useEffect(()=>{if(!open)return;let active=true;const id=setInterval(()=>{if(document.visibilityState==="visible"&&!sending&&!loading){const q=new URLSearchParams();if(contactId)q.set("contact",contactId);if(opportunityId)q.set("opportunity",opportunityId);if(reservationId)q.set("reservation",reservationId);if(reservationConfirmation)q.set("confirmation",reservationConfirmation);if(phone)q.set("phone",phone);if(email)q.set("email",email);fetch("/api/sales/customer-360?"+q,{cache:"no-store"}).then(r=>r.ok?r.json():null).then(p=>{if(active&&p?.customer)setData(p.customer);}).catch(()=>{});}},12000);return()=>{active=false;clearInterval(id)};},[open,sending,loading,contactId,opportunityId,reservationId,reservationConfirmation,phone,email]);
  useEffect(()=>{if(!open||(!data?.identity?.contact_id&&!data?.identity?.phone))return;let active=true;fetch("/api/sales/lead-sheets?"+(data.identity?.contact_id?"contact="+encodeURIComponent(data.identity?.contact_id):"phone="+encodeURIComponent(data.identity?.phone||"")),{cache:"no-store"}).then(r=>r.json()).then(p=>{if(active)setLeadSheets(p.rows||[])}).catch(()=>{});return()=>{active=false}},[open,data?.identity?.contact_id,data?.identity?.phone,editSheet]);

  useEffect(()=>{if(!open)return;const controller=new AbortController();setData(null);setFilter("all");(async()=>{setLoading(true);setError("");try{const q=new URLSearchParams();if(contactId)q.set("contact",contactId);if(opportunityId)q.set("opportunity",opportunityId);if(reservationId)q.set("reservation",reservationId);if(reservationConfirmation)q.set("confirmation",reservationConfirmation);if(phone)q.set("phone",phone);if(email)q.set("email",email);const r=await fetch(`/api/sales/customer-360?${q.toString()}`,{cache:"no-store",signal:controller.signal});const p=await r.json();if(!r.ok)throw new Error(p?.error||"Unable to load Customer 360.");if(!controller.signal.aborted)setData(p.customer||null);}catch(e){if((e as Error).name!=="AbortError")setError(e instanceof Error?e.message:"Unable to load Customer 360.");}finally{setLoading(false);}})();return()=>controller.abort();},[open,contactId,opportunityId,reservationId,reservationConfirmation,phone,email]);

  useEffect(()=>{if(!open)return;const handler=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",handler);const previousOverflow=document.body.style.overflow;const previousOverscroll=document.body.style.overscrollBehavior;document.body.style.overflow="hidden";document.body.style.overscrollBehavior="none";return()=>{window.removeEventListener("keydown",handler);document.body.style.overflow=previousOverflow;document.body.style.overscrollBehavior=previousOverscroll;};},[open,onClose]);

  const [mediaByEvent,setMediaByEvent]=useState<Record<string,Array<{id:string;content_type:string}>>>({});
  const [pendingPodium,setPendingPodium]=useState<Text[]>([]);
  const shownTexts=useMemo(()=>{
    const remote=data?.texts||[];
    const pending=pendingPodium.filter(local=>!remote.some(t=>(local.message_uid&&t.message_uid===local.message_uid)||(t.provider==="podium"&&t.direction==="outbound"&&t.body===local.body&&t.conversation_uid===local.conversation_uid&&Math.abs(new Date(t.at||0).getTime()-new Date(local.at||0).getTime())<120000)));
    return [...remote,...pending];
  },[data?.texts,pendingPodium]);
  useEffect(()=>{const ids=[...new Set((data?.texts||[]).map(t=>t.id.startsWith("podium:")?t.id.slice(7):t.id.startsWith("telnyx:")?t.id.slice(7):t.id))];if(!ids.length){setMediaByEvent({});return;}let active=true;fetch("/api/sales/message-media?events="+encodeURIComponent(ids.join(",")),{cache:"no-store"}).then(r=>r.ok?r.json():null).then(p=>{if(!active)return;const grouped:Record<string,Array<{id:string;content_type:string}>>={};for(const m of p?.attachments||[]){(grouped[m.provider_event_id]??=[]).push(m);}setMediaByEvent(grouped);}).catch(()=>{});return()=>{active=false};},[data?.texts]);
  const timeline=useMemo<EventItem[]>(()=>{if(!data)return[];const items:EventItem[]=[];
    for(const c of data.calls||[]){const isPbxInbound=c.direction==="inbound"&&Boolean(c.pbx_outcome);const title=c.direction==="outbound"?"Outbound call":c.answered===false?(c.voicemail&&c.pbx_voicemail_deposited===true?"Missed call — Voicemail":"Missed call"):"Inbound call — Answered";const answerLabel=c.pbx_answered_agent||c.pbx_answered_extension;const pbxMeta=isPbxInbound?[c.answered?(answerLabel?"Answered by "+answerLabel:"Answered"):"No human answer",c.pbx_ring_attempts!=null?c.pbx_ring_attempts+" ring attempt"+(c.pbx_ring_attempts===1?"":"s"):null,c.pbx_queue_wait_seconds!=null?c.pbx_queue_wait_seconds+"s queue wait":null]:[];items.push({id:`c-${c.id}`,kind:"call",at:c.at,title,meta:[...pbxMeta,c.lead_score!=null?`CallRail score ${c.lead_score}`:null,durationLabel(c.duration_seconds),c.customer_phone_number?"From "+c.customer_phone_number:null,c.source_name&&/\d/.test(c.source_name)?"Epic line "+c.source_name:c.source_name,c.campaign].filter(Boolean).join(" · "),body:c.summary||c.lead_explanation||null,href:c.recording_url||undefined,hrefLabel:"Listen to call",transcript:c.transcription});}
    for(const w of data.sales_call_workflows||[]){
      const details=[
        w.objection_code?`Objection: ${objectionLabels[w.objection_code]||w.objection_code}`:null,
        w.objection_detail?`Guest said: ${w.objection_detail}`:null,
        w.resolution_note?`How we addressed it: ${w.resolution_note}`:null,
        w.next_action?`Next step: ${w.next_action}`:null,
        w.follow_up_at?`Follow-up: ${fmtDateTime(w.follow_up_at)}`:null,
      ].filter(Boolean).join("\n");
      items.push({
        id:`sc-${w.id}`,
        kind:"sales_call",
        at:w.created_at||w.updated_at,
        title:`Sales call notes — ${w.rep_name}`,
        meta:w.outcome_code?(outcomeLabels[w.outcome_code]||w.outcome_code):null,
        body:details||null,
      });
    }
    for(const m of data.social_messages||[])items.push({id:"sm-"+m.event_key,kind:"social",at:m.message_at,title:(m.platform==="instagram"?"Instagram":"Facebook Messenger")+(m.direction==="outbound"?" · Sent":" · Received"),meta:m.platform==="instagram"?"Instagram DM":"Facebook Messenger",body:m.body});
    for(const t of shownTexts)items.push({id:`t-${t.id}`,kind:"text",at:t.at,title:t.direction==="outbound"?"Text sent":"Text received",meta:[t.agent_name,t.status].filter(Boolean).join(" · "),body:t.body,attachments:mediaByEvent[t.id.startsWith("podium:")?t.id.slice(7):t.id.startsWith("telnyx:")?t.id.slice(7):t.id]||[]});
    for(const e of data.emails||[])items.push({id:`e-${e.id}`,kind:"email",at:e.at,title:e.direction==="outbound"?`Email sent${e.subject?`: ${e.subject}`:""}`:`Email received${e.subject?`: ${e.subject}`:""}`,meta:e.direction==="inbound"?(e.from_email?`From ${e.from_email}`:null):(e.to_emails?.length?`To ${e.to_emails.join(", ")}`:null),body:e.body});
    for(const r of data.reservations||[])items.push({id:`r-${r.id}`,kind:"reservation",at:r.created_at||r.updated_at||r.start_time,title:`${r.is_cancelled?"Cancelled reservation":"Reservation"}: ${r.experience_name||r.confirmation_code||"TripWorks booking"}`,meta:[r.business_line,r.trip_status,r.total_amount_cents!=null?money.format(r.total_amount_cents/100):null].filter(Boolean).join(" · "),body:r.start_time?`${fmtDateTime(r.start_time)}${r.people_count?` · ${r.people_count} guests`:""}`:null,href:r.tripworks_booking_url||twReservationUrl(r.confirmation_code)||undefined,hrefLabel:r.confirmation_code?`TripWorks ${r.confirmation_code}`:"Open reservation in TripWorks",secondaryHref:r.mpwr_reservation_url||undefined,secondaryHrefLabel:r.mpwr_confirmation_number?`MPWR ${r.mpwr_confirmation_number}`:"Open MPWR"});
    for(const o of data.opportunities||[])items.push({id:`o-${o.id}`,kind:"lead",at:o.shopping_last_activity_at||o.updated_at,title:o.status==="booked"?"Lead booked":o.status==="open"?"Active lead":`Lead ${o.status||""}`.trim(),meta:[o.interest_label,o.lead_value_cents!=null?money.format(o.lead_value_cents/100):null,o.claimed_by_name||o.assigned_rep_name].filter(Boolean).join(" · "),body:o.activity_window_start?`Visit window ${fmtDate(o.activity_window_start)}${o.activity_window_end&&o.activity_window_end!==o.activity_window_start?` – ${fmtDate(o.activity_window_end)}`:""}`:null});
    for(const d of data.drafts||[]){
      const state=d.converted_at?"Converted to booking":d.is_current_draft===false?"Closed":"Open draft";
      items.push({id:`d-${d.id}`,kind:"draft",at:d.converted_at||d.last_seen_at,title:`${d.converted_at?"TripWorks draft converted":"TripWorks draft"}: ${d.experience_name||"Draft Reservation"}`,meta:[d.option_name,d.value_cents!=null?money.format(d.value_cents/100):null,d.confirmation_code,state].filter(Boolean).join(" · "),body:d.activity_date?`For ${fmtDate(d.activity_date)}`:null,href:twReservationUrl(d.confirmation_code)||undefined,hrefLabel:"Open in TripWorks"});
    }
    for(const q of data.quotes||[])items.push({id:`q-${q.id}`,kind:"quote",at:q.created_at,title:`Epic quote ${q.status||"saved"}`,meta:[q.experience_name,q.total_cents!=null?money.format(q.total_cents/100):null,q.created_by_name,q.emailed_at?"Emailed":null].filter(Boolean).join(" · "),body:q.visit_start_date?`Visit ${fmtDate(q.visit_start_date)}${q.visit_end_date&&q.visit_end_date!==q.visit_start_date?` – ${fmtDate(q.visit_end_date)}`:""}`:null,href:`/sales/quote?quote=${encodeURIComponent(q.id)}`,hrefLabel:"Open Quote"});
    for(const n of data.team_thread_notes||[])items.push({id:`tn-${n.id}`,kind:"note",at:n.created_at,title:"Internal team message",meta:n.author_name,body:n.note_text});
    for(const n of data.notes||[])items.push({id:`n-${n.id}`,kind:"note",at:n.created_at,title:"Sales note",meta:n.author_name,body:n.note_text});
    for(const a of data.cancellation_agreements||[]){const status=(a.status||"created").toLowerCase();const at=a.accepted_at||a.opened_at||a.sent_at||a.created_at;items.push({id:`a-${a.id}`,kind:"agreement",at,title:`Cancellation Policy Acknowledgement — ${status.charAt(0).toUpperCase()+status.slice(1)}`,meta:[a.confirmation_code,a.signer_name?`Signed by ${a.signer_name}`:null].filter(Boolean).join(" · "),body:a.policy_title||null,href:twReservationUrl(a.confirmation_code)||undefined,hrefLabel:a.confirmation_code?`TripWorks ${a.confirmation_code}`:"Open reservation"});}
    for(const s of leadSheets){items.push({id:"ls-"+s.id,kind:"note",at:s.updated_at,title:"Guided Lead Sheet",meta:String(s.fields?.disposition||"Saved discovery"),body:[s.fields?.activity,s.fields?.notes,s.fields?.next].filter(Boolean).join(" · ")});}
    return items.sort((a,b)=>(b.at?new Date(b.at).getTime():0)-(a.at?new Date(a.at).getTime():0));
  },[data,leadSheets,shownTexts,mediaByEvent]);

  const visibleTimeline=useMemo(()=>timeline.filter(item=>filter==="all"?true:filter==="reservation"?(item.kind==="reservation"||item.kind==="agreement"):filter==="call"?(item.kind==="call"||item.kind==="sales_call"):item.kind===filter),[timeline,filter]);

  const replyRoutes=useMemo(()=>{
    const routes:Array<{value:string;label:string}>=[];
    for(const t of [...(data?.texts||[])].sort((a,b)=>new Date(b.at||0).getTime()-new Date(a.at||0).getTime())){
      if(t.provider==="telnyx"&&t.direction==="inbound"){
        if(!routes.some(r=>r.value==="telnyx"))routes.push({value:"telnyx",label:"Telnyx — 7775"});
      }else if(t.provider==="podium"&&t.conversation_uid){
        const value="podium:"+t.conversation_uid;
        if(!routes.some(r=>r.value===value))routes.push({value,label:"Podium — 2700"});
      }else if(t.provider==="callrail"&&t.epic_number){
        const value="callrail:"+t.epic_number;
        if(!routes.some(r=>r.value===value))routes.push({value,label:"CallRail — "+t.epic_number});
      }
    }
    if(!routes.length)routes.push({value:"callrail",label:"CallRail (existing texting)"});
    if(lastInboundRoute&&!routes.some(r=>r.value===lastInboundRoute))routes.unshift({value:lastInboundRoute,label:lastInboundRoute==="telnyx"?"Telnyx — 7775":lastInboundRoute.startsWith("podium:")?"Podium — 2700":"CallRail — "+lastInboundRoute.slice(9)});
    return routes;
  },[data?.texts,lastInboundRoute]);
  async function sendTextInline(){await sendCommunication("text");}

  async function sendCommunication(channelOverride?:"text"|"email"){
    const channel=channelOverride||composeChannel;if(!data||!channel||!composeBody.trim())return;
    setSending(true);setError("");setSendStatus("");
    try{
      const reservation=(data.reservations||[]).find(r=>!r.is_cancelled)||(data.reservations||[])[0]||null;
      const opportunity=(data.opportunities||[]).find(o=>o.status==="open")||(data.opportunities||[])[0]||null;
      const viaPodium=channel==="text"&&textTransport.startsWith("podium:");
      const viaTelnyx=channel==="text"&&textTransport==="telnyx";
      const podiumConversation=viaPodium?textTransport.slice("podium:".length):null;
      if(viaPodium&&!podiumConversation)throw new Error("No verified Podium conversation to reply to.");
      const target=viaPodium?"/api/sales/podium-text":viaTelnyx?"/api/sales/telnyx-text":"/api/sales/customer-communications";
      const r=await fetch(target,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        ...(viaPodium?{conversation_uid:podiumConversation}:{}),
        ...(channel==="text"&&textTransport.startsWith("callrail:")?{tracking_number:textTransport.slice("callrail:".length)}:{}),
        channel,
        confirmation:reservation?.confirmation_code||reservationConfirmation||null,
        opportunity_id:opportunity?.id||opportunityId||null,
        contact_id:data.identity?.contact_id||contactId||null,
        email:data.identity?.email||email||null,
        phone:data.identity?.phone||phone||null,
        customer_name:data.identity?.name||null,
        subject:channel==="email"?composeSubject:null,
        message_text:composeBody.trim()
      })});
      const p=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(typeof p?.error === "string" ? p.error : "Unable to send message. No confirmation was received.");
      if(viaPodium){
        const outgoing=composeBody.trim();
        setPendingPodium(current=>[...current,{
          id:"podium-local:"+String(p.message_uid||Date.now()),
          message_uid:typeof p.message_uid==="string"?p.message_uid:null,
          at:new Date().toISOString(),direction:"outbound",body:outgoing,
          agent_name:"Epic team",status:"accepted",epic_number:"2700",
          customer_number:data.identity?.phone,provider:"podium",conversation_uid:podiumConversation
        }]);
      }
      const wasText=channel==="text";setComposeBody("");setSendStatus(wasText?(viaPodium?"Text sent via Podium 2700.":viaTelnyx?"Text sent via Telnyx 7775.":"Text sent via CallRail."):"Email sent.");setComposeChannel(null);
      if(wasText){const q=new URLSearchParams();if(contactId)q.set("contact",contactId);if(opportunityId)q.set("opportunity",opportunityId);if(reservationId)q.set("reservation",reservationId);if(reservationConfirmation)q.set("confirmation",reservationConfirmation);if(phone)q.set("phone",phone);if(email)q.set("email",email);const refreshed=await fetch(`/api/sales/customer-360?${q}`,{cache:"no-store"});if(refreshed.ok){const body=await refreshed.json();if(body.customer)setData(body.customer);}}
    }catch(e){setError(e instanceof Error?e.message:"Unable to send message.");}
    finally{setSending(false);}
  }

  useEffect(()=>{if(!openedPhoto)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpenedPhoto(null);};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[openedPhoto]);
  if(!open)return null;
  const identity=data?.identity;
  const activeReservations=(data?.reservations||[]).filter(r=>!r.is_cancelled&&(!r.end_time||new Date(r.end_time).getTime()>=Date.now()-24*60*60*1000));
  const pastReservations=(data?.reservations||[]).filter(r=>!activeReservations.some(a=>a.id===r.id));
  const openLeads=(data?.opportunities||[]).filter(o=>o.status==="open");
  const futureDrafts=(data?.drafts||[]).filter(d=>d.is_current_draft!==false&&!d.converted_at);
  const shoppingDrafts=[...(data?.drafts||[])].sort((a,b)=>new Date(b.last_seen_at||0).getTime()-new Date(a.last_seen_at||0).getTime());
  const quoteParams=new URLSearchParams();
  if(identity?.contact_id)quoteParams.set("contact",identity?.contact_id);
  if(openLeads[0]?.id)quoteParams.set("opportunity",openLeads[0].id);
  if(activeReservations[0]?.id)quoteParams.set("reservation",activeReservations[0].id);
  const quoteHref=quoteParams.size?`/sales/quote?${quoteParams.toString()}`:"/sales/quote";

  async function openStaffBookingCard(){
    const draft=futureDrafts[0];
    if(!draft)return;
    const url=`/sales/staff-booking?draft=${encodeURIComponent(draft.id)}`;
    const pictureInPicture=(window as any).documentPictureInPicture;
    if(pictureInPicture?.requestWindow){
      try{
        const pipWindow=await pictureInPicture.requestWindow({width:430,height:720});
        pipWindow.document.title="Epic Staff Booking";
        pipWindow.document.body.style.margin="0";
        pipWindow.document.body.style.overflow="hidden";
        const frame=pipWindow.document.createElement("iframe");
        frame.src=url;
        frame.title="Epic Staff Booking";
        frame.style.width="100%";
        frame.style.height="100vh";
        frame.style.border="0";
        frame.style.display="block";
        pipWindow.document.body.appendChild(frame);
        return;
      }catch{
        // Fall through to a normal helper window if Picture-in-Picture is unavailable or blocked.
      }
    }
    window.open(url,"epic-staff-booking","popup=yes,width=680,height=820,resizable=yes,scrollbars=yes");
  }
  const lifetimeSpend=(data?.reservations||[]).reduce((sum,r)=>sum+(r.total_amount_cents||0),0);
  const communications=(data?.calls?.length||0)+(data?.texts?.length||0)+(data?.emails?.length||0);
  const hasCalls=((data?.calls?.length||0)+(data?.sales_call_workflows?.length||0))>0;
  const hasTexts=(data?.texts?.length||0)>0;
  const hasEmails=(data?.emails?.length||0)>0;
  const hasSocial=(data?.social_messages?.length||0)>0;
  const badges:string[]=[];
  if(activeReservations.length)badges.push(`${activeReservations.length} Active Reservation${activeReservations.length===1?"":"s"}`);
  if(openLeads.length)badges.push(`${openLeads.length} Active Lead${openLeads.length===1?"":"s"}`);
  if(pastReservations.length)badges.push(`${pastReservations.length} Prior Visit${pastReservations.length===1?"":"s"}`);
  if(identity?.tripworks_customer_id)badges.push("TripWorks Customer");
  if(!badges.length)badges.push("New Customer");

  return <div className={styles.backdrop} onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="EpicC360">
    <header className={styles.header}><div className={styles.headerIdentity}><div className={styles.eyebrow}>EpicC360</div><h2>{identity?.name||"New / Unknown Customer"}</h2><div className={styles.sub}>{[identity?.email,identity?.phone].filter(Boolean).join(" · ")||(identity?.contact_id?"Social identity on file":"No customer identity captured yet")}</div>{data?<div className={styles.badges}>{badges.map(b=><span key={b}>{b}</span>)}</div>:null}</div><div className={styles.headerActions} style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}>
<div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",padding:4,border:"1px solid #e3e8ee",background:"#f8fafc",borderRadius:12}}>
<ContactIdentityEditor name={identity?.name} phone={identity?.phone} email={identity?.email} contactId={identity?.contact_id}/>
{identity?.contact_id && !identity?.email && !identity?.phone && (data?.social_messages?.length||0)>0?<SocialIdentityLink contactId={identity?.contact_id} onLinked={()=>onClose()}/>:null}
<PossibleCustomerMatches name={identity?.name} phone={identity?.phone} email={identity?.email} sourceType={data?.opportunities?.[0]?.id?"sales_opportunity":data?.calls?.find((c:any)=>String(c.id||"").startsWith("CAL"))?.id?"call":null} sourceKey={data?.opportunities?.[0]?.id||data?.calls?.find((c:any)=>String(c.id||"").startsWith("CAL"))?.id||null}/>
</div>
{identity?.email?<button className={styles.button} type="button" onClick={()=>{setComposeChannel("email");setSendStatus("");}}>Email</button>:null}
{identity?.phone?<button className={styles.button} type="button" onClick={()=>{setFilter("text");setComposeChannel(null);setSendStatus("");}}>Text</button>:null}
<a className={styles.buttonPrimary} href={quoteHref}>Build Quote</a>
{futureDrafts.length?<button className={styles.button} type="button" onClick={openStaffBookingCard}>Book It</button>:null}
<button className={styles.close} aria-label="Close EpicC360" onClick={onClose}>×</button></div></header>
    {composeChannel&&data?<div style={{background:"#fff",borderBottom:"1px solid #e2e7ec",padding:"16px 26px",display:"grid",gap:10}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><strong>{composeChannel==="email"?"Email":"Text"} {data.identity?.name||"customer"}</strong><button className={styles.close} type="button" onClick={()=>setComposeChannel(null)}>×</button></div>{composeChannel==="email"?<input style={{width:"100%",boxSizing:"border-box",border:"1px solid #d9e0e6",borderRadius:9,padding:"10px 12px"}} value={composeSubject} onChange={e=>setComposeSubject(e.target.value)} placeholder="Subject"/>:null}<textarea style={{width:"100%",boxSizing:"border-box",border:"1px solid #d9e0e6",borderRadius:9,padding:"10px 12px",resize:"vertical"}} rows={5} value={composeBody} onChange={e=>setComposeBody(e.target.value)} placeholder={composeChannel==="email"?"Write email…":"Write text…"} maxLength={composeChannel==="text"?1600:20000}/><div style={{display:"flex",justifyContent:"flex-end",gap:9}}><button className={styles.button} type="button" onClick={()=>setComposeChannel(null)}>Cancel</button><button className={styles.buttonPrimary} type="button" disabled={sending||!composeBody.trim()} onClick={()=>void sendCommunication()}>{sending?"Sending…":composeChannel==="email"?"Send Email":"Send Text"}</button></div></div>:null}
    {sendStatus?<div style={{background:"#edf8f1",padding:"9px 26px",fontSize:12,fontWeight:800}}>{sendStatus}</div>:null}
    {loading?<div className={styles.loading}>Loading EpicC360…</div>:error?<div className={styles.error}>{error}</div>:!data?<div className={styles.empty}>No customer record found.</div>:<div className={styles.body}>
      <main className={styles.journey}><div className={styles.lifecycleHeader}><div><div className={styles.eyebrow}>Customer Lifecycle</div><h3>Customer Lifecycle</h3></div><span>{timeline.length} events</span></div><div className={styles.filters}>{([['all','All'],['call','Calls'],['text','Texts'],['email','Emails'],['social','Social Media'],['reservation','Reservations']] as Array<[LifecycleFilter,string]>).map(([value,label])=>{const hasActivity=value==="call"?hasCalls:value==="text"?hasTexts:value==="email"?hasEmails:value==="social"?hasSocial:false;const presenceClass=value==="call"&&hasActivity?styles.filterHasCalls:value==="text"&&hasActivity?styles.filterHasTexts:value==="email"&&hasActivity?styles.filterHasEmails:value==="social"&&hasActivity?styles.filterHasSocial:"";return <button key={value} className={`${styles.filter} ${presenceClass} ${filter===value?styles.filterActive:""}`} onClick={()=>setFilter(value)}>{label}</button>;})}</div>{filter==="text"&&data?<section style={{display:"grid",gap:12,padding:"12px 4px"}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,alignItems:"center"}}>
          <strong>Text conversation</strong><span style={{fontSize:12,color:"#5d6776"}}>Customer: {identity?.phone||"Unknown"}</span>
        </div>
        <div style={{display:"grid",gap:10,maxHeight:460,overflowY:"auto",padding:"12px",background:"#f7f8fa",borderRadius:12}}>
          {[...shownTexts].sort((a,b)=>new Date(a.at||0).getTime()-new Date(b.at||0).getTime()).map(t=>{
            const outbound=t.direction==="outbound";
            return <div key={t.id} style={{display:"flex",justifyContent:outbound?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"83%",padding:"11px 13px",borderRadius:12,background:outbound?"#dbecff":"#fff",border:"1px solid #dfe5eb",overflowWrap:"anywhere"}}>
                {t.body?<div style={{whiteSpace:"pre-wrap",fontSize:14}}>{t.body}</div>:null}
                {(mediaByEvent[t.id.startsWith("podium:")?t.id.slice(7):t.id.startsWith("telnyx:")?t.id.slice(7):t.id]||[]).map(media=><a key={media.id} href={"/api/sales/message-media?id="+encodeURIComponent(media.id)} target="_blank" rel="noreferrer" onClick={e=>{if(["image/jpeg","image/png","image/webp","image/gif","image/avif","image/bmp"].includes(media.content_type)){e.preventDefault();setOpenedPhoto(media.id);}}} style={{display:"inline-block",margin:"7px 7px 0 0"}}>{["image/jpeg","image/png","image/webp","image/gif","image/avif","image/bmp"].includes(media.content_type)?<img src={"/api/sales/message-media?id="+encodeURIComponent(media.id)} alt="Guest photo" loading="lazy" style={{width:170,height:128,objectFit:"cover",borderRadius:8,border:"1px solid #ddd"}}/>:<span style={{display:"inline-block",padding:12,border:"1px solid #ddd",borderRadius:8}}>📎 {media.content_type==="application/pdf"?"Open PDF":"Open attachment"}</span>}</a>)}
                <div style={{fontSize:11,color:"#677486",marginTop:7}}>{outbound?(t.agent_name||"Epic team"):(identity?.name||"Customer")} · {fmtDateTime(t.at)}{t.provider==="podium"?(outbound?" · sent":" · received"):(t.status?" · "+t.status:"")}</div>
                <div style={{fontSize:11,color:"#677486",marginTop:3}}>Epic SMS: {t.epic_number||"Number unavailable"}{t.provider==="podium"?" · Podium":""}</div>
              </div>
            </div>;
          })}
        </div>
        <div style={{display:"grid",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",fontSize:13}}>
            <strong>Replying from: {replyRoutes.find(r=>r.value===textTransport)?.label||"CallRail (existing texting)"}</strong>
            <button type="button" onClick={()=>setShowReplyChoices(v=>!v)} style={{border:0,background:"transparent",color:"#145db0",cursor:"pointer",fontWeight:700}}>Change</button>
            {!replyRouteOverride&&lastInboundRoute?<span style={{fontSize:11,color:"#65758a"}}>Automatically selected from latest incoming text</span>:null}
          </div>
          {showReplyChoices?<label style={{fontSize:12}}>Send from <select aria-label="Text reply provider" value={textTransport} onChange={e=>{setReplyRouteOverride(e.target.value);setTextTransport(e.target.value);setShowReplyChoices(false);}} style={{marginLeft:8,padding:7,borderRadius:7}}>{replyRoutes.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select><button type="button" onClick={()=>{setReplyRouteOverride(null);setTextTransport(lastInboundRoute||"callrail");setShowReplyChoices(false);}} style={{marginLeft:10}}>Use automatic</button></label>:null}
          <div style={{fontSize:12,color:"#5d6776"}}>Reply to {identity?.phone||"customer"} using {textTransport==="telnyx"?"Telnyx 7775":textTransport.startsWith("podium:")?"Podium 2700":textTransport.startsWith("callrail:")?"CallRail "+textTransport.slice("callrail:".length):"CallRail existing texting"}. Messages stay in one customer timeline.</div>
          <textarea aria-label="Reply to customer by text" rows={3} maxLength={1600} value={composeBody} onChange={e=>setComposeBody(e.target.value)} placeholder="Reply in this conversation…" style={{width:"100%",boxSizing:"border-box",padding:12,borderRadius:10,border:"1px solid #cbd5df",resize:"vertical"}}/>
          <div style={{display:"flex",justifyContent:"flex-end"}}><button type="button" className={styles.buttonPrimary} disabled={sending||!composeBody.trim()||!identity?.phone} onClick={()=>void sendTextInline()}>{sending?"Sending…":"Send Text"}</button></div>
        </div>
      </section>:<div className={styles.timeline}>{visibleTimeline.length?visibleTimeline.map(item=><article key={item.id} className={`${styles.event} ${styles[item.kind]}`}><div className={styles.eventTop}><strong>{item.kind==="social"?item.meta==="Instagram DM"?<span title="Instagram" aria-label="Instagram" style={{display:"inline-flex",verticalAlign:"middle",marginRight:7,padding:3,borderRadius:6,color:"#fff",background:"linear-gradient(135deg,#8134af,#dd2a7b,#f58529)"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg></span>:<span title="Facebook Messenger" aria-label="Facebook Messenger" style={{display:"inline-flex",justifyContent:"center",alignItems:"center",verticalAlign:"middle",marginRight:7,width:21,height:21,borderRadius:6,background:"#1877f2",color:"#fff",fontWeight:900}}>f</span>:null}{item.title}</strong><span>{fmtDateTime(item.at)}</span></div>{item.meta?<div className={styles.eventMeta}>{item.meta}</div>:null}{item.body?<div className={styles.eventBody}>{item.body}</div>:null}{item.attachments?.length?<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>{item.attachments.map(media=><a key={media.id} href={"/api/sales/message-media?id="+encodeURIComponent(media.id)} target="_blank" rel="noreferrer" onClick={e=>{if(["image/jpeg","image/png","image/webp","image/gif","image/avif","image/bmp"].includes(media.content_type)){e.preventDefault();setOpenedPhoto(media.id);}}} title="Open guest image">{["image/jpeg","image/png","image/webp","image/gif","image/avif","image/bmp"].includes(media.content_type)?<img src={"/api/sales/message-media?id="+encodeURIComponent(media.id)} alt="Guest attachment" loading="lazy" style={{width:140,height:110,objectFit:"cover",borderRadius:8,border:"1px solid #ddd"}}/>:<span style={{display:"inline-block",padding:14,border:"1px solid #ddd",borderRadius:8}}>📎 {media.content_type==="application/pdf"?"Open PDF":"Open attachment"}</span>}</a>)}</div>:null}{item.href?<a href={item.href} target={item.href.startsWith("http")?"_blank":undefined} rel={item.href.startsWith("http")?"noreferrer":undefined}>{item.hrefLabel||"Open"}</a>:null}{item.secondaryHref?<><span> · </span><a href={item.secondaryHref} target="_blank" rel="noreferrer">{item.secondaryHrefLabel||"Open"}</a></>:null}{item.id.startsWith("ls-")?<button type="button" onClick={()=>setEditSheet(item.id.slice(3))}>Open Lead Sheet</button>:null}{item.kind==="call"&&item.transcript?<CallTranscript transcript={item.transcript}/>:null}</article>):<div className={styles.emptyTimeline}>No activity in this view yet.</div>}</div>}</main>
      <aside className={styles.sidebar}><div className={styles.commandTitle}><h3>Command Center</h3></div>
        <InternalConversation key={[identity?.contact_id||"",identity?.phone||"",identity?.email||"",data.opportunities?.[0]?.id||"",data.reservations?.[0]?.id||""].join("|")} opportunityId={data.opportunities?.[0]?.id} contactId={identity?.contact_id} phone={identity?.phone||phone} email={identity?.email||email} reservationId={data.reservations?.[0]?.id||reservationId} reservationConfirmations={[...new Set([...(data.reservations||[]).map(r=>r.confirmation_code).filter((x):x is string=>Boolean(x)),...(reservationConfirmation?[reservationConfirmation]:[])])]} reservationOptions={(data.reservations||[]).filter(r=>r.confirmation_code).map(r=>({code:r.confirmation_code!,label:[r.confirmation_code, r.experience_name, r.start_time?fmtDate(r.start_time):null].filter(Boolean).join(" · ")}))}/>
        {activeReservations.length?<div className={styles.sideSection}><h3>Current / Upcoming Reservation</h3>{activeReservations.map(r=><div key={r.id} className={styles.record}><div style={{background:"linear-gradient(115deg,#fff1e8,#fff8f4)",border:"1px solid #f8d9ca",borderRadius:11,padding:"12px 13px",marginBottom:12}}><div className={styles.recordTitle}>{r.experience_name||r.confirmation_code}</div><div className={styles.recordMeta}>{[r.start_time?fmtDateTime(r.start_time):null,r.trip_status,r.amount_due_cents!=null?`${money.format(r.amount_due_cents/100)} due`:null].filter(Boolean).join(" · ")}</div><div className={styles.recordActions}>{r.confirmation_code?<a className={styles.button} style={{background:"#fff",color:"#c2410c",border:"1px solid #f4b89d",fontWeight:800}} href={r.tripworks_booking_url||twReservationUrl(r.confirmation_code)!} target="_blank" rel="noreferrer">TripWorks {r.confirmation_code}</a>:null}{r.mpwr_confirmation_number&&r.mpwr_reservation_url?<a className={styles.button} href={r.mpwr_reservation_url} target="_blank" rel="noreferrer">MPWR {r.mpwr_confirmation_number}</a>:null}</div></div>{r.confirmation_code?<ReservationReadiness confirmation={r.confirmation_code} customerName={r.customer_name} customerPhone={r.customer_phone} customerEmail={r.customer_email} productName={r.experience_name}/>:null}</div>)}</div>:null}
        {openLeads.length?<div className={styles.sideSection}><h3>Active Lead</h3>{openLeads.map(o=><div key={o.id} className={styles.record}><div className={styles.recordTitle}>{o.interest_label||"Active sales opportunity"}</div><div className={styles.recordMeta}>{[o.lead_value_cents!=null?money.format(o.lead_value_cents/100):null,o.activity_window_start?fmtDate(o.activity_window_start):null,o.claimed_by_name||o.assigned_rep_name||"Unclaimed"].filter(Boolean).join(" · ")}</div><LeadWorkspaceAccess opportunityId={o.id}/><ScheduleFollowUp opportunityId={o.id}/><CustomerFollowUps opportunityId={o.id}/></div>)}</div>:null}
        {!openLeads.length&&data.opportunities?.[0]?.id?<div className={styles.sideSection}><h3>Customer Follow-Ups</h3><ScheduleFollowUp opportunityId={data.opportunities[0].id}/><CustomerFollowUps opportunityId={data.opportunities[0].id}/></div>:null}
        <div className={styles.summaryGrid}><div><span>Known Visits</span><strong>{data.reservations.length}</strong></div><div><span>Known Spend</span><strong>{money.format(lifetimeSpend/100)}</strong></div><div><span>Communications</span><strong>{communications}</strong></div><div><span>Open Sales Activity</span><strong>{openLeads.length}</strong></div></div>
        {shoppingDrafts.length?<div className={styles.sideSection}><h3>TripWorks Shopping History ({shoppingDrafts.length})</h3><div style={{fontSize:12,color:"#64748b",marginBottom:11}}>Most recently shopped first · individual draft details</div>{shoppingDrafts.map(d=><div key={d.id} className={styles.compactRecord} style={{display:"grid",gap:7,marginBottom:10,padding:"12px 13px",border:"1px solid #e2e8f0",borderRadius:11,background:"#fff"}}>
 <strong style={{fontSize:14,color:"#17212e"}}>{d.experience_name||"Draft Reservation"}</strong>
 {d.option_name?<span style={{fontSize:12,fontWeight:700,color:"#475569"}}>{d.option_name}</span>:null}
 <span style={{fontSize:12,color:"#64748b"}}>Shopped {fmtDateTime(d.last_seen_at)}{d.activity_date?" · Visit "+fmtDate(d.activity_date):""}</span>
 <span style={{fontSize:13,fontWeight:800,color:"#17212e"}}>{d.value_cents!=null?money.format(d.value_cents/100):"Total unavailable"} <span style={{fontSize:11,fontWeight:600,color:"#64748b"}}>· {d.converted_at?"Converted to booking":d.is_current_draft===false?"Closed draft":"Open draft"}</span></span>
 {d.confirmation_code?<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontSize:11,color:"#64748b"}}>{d.confirmation_code}</span><a href={twReservationUrl(d.confirmation_code)||"#"} target="_blank" rel="noreferrer" style={{fontSize:12,fontWeight:750,color:"#c2410c"}}>Open in TripWorks ↗</a></div>:null}
 </div>)}</div>:null}
        <div className={styles.sideSection}><h3>Customer Identity</h3><div className={styles.identityList}><div><span>Name</span><strong>{identity?.name||"—"}</strong></div><div><span>Phone</span><strong>{identity?.phone||"—"}</strong></div><div><span>Email</span><strong>{identity?.email||"—"}</strong></div><div><span>TripWorks Customer</span><strong>{identity?.tripworks_customer_code&&twCustomerUrl(identity?.tripworks_customer_code)?<a href={twCustomerUrl(identity?.tripworks_customer_code)!} target="_blank" rel="noreferrer">{identity?.tripworks_customer_code}</a>:identity?.tripworks_customer_id??"—"}</strong></div></div></div>
      </aside>
    </div>}
  </section>{openedPhoto?<div role="presentation" onClick={()=>setOpenedPhoto(null)} style={{position:"fixed",inset:0,zIndex:20000,background:"rgba(12,19,30,.9)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><div role="dialog" aria-modal="true" aria-label="Full-size customer photo" onClick={e=>e.stopPropagation()} style={{position:"relative",maxWidth:"95vw",maxHeight:"95vh"}}><button type="button" aria-label="Close photo" onClick={()=>setOpenedPhoto(null)} style={{position:"absolute",top:-17,right:-17,zIndex:1,border:0,borderRadius:22,background:"#fff",color:"#17212e",width:36,height:36,fontSize:22,cursor:"pointer"}}>×</button><img src={"/api/sales/message-media?id="+encodeURIComponent(openedPhoto)} alt="Customer photo enlarged" style={{display:"block",maxWidth:"90vw",maxHeight:"88vh",width:"auto",height:"auto",objectFit:"contain",borderRadius:8}}/></div></div>:null}{editSheet?<GuidedLeadSheet phone={identity?.phone||""} name={identity?.name||""} draftId={editSheet} onClose={()=>setEditSheet(null)}/>:null}</div>;
}
