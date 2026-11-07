import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
const EPIC_TIME_ZONE = "America/Denver";
const TOOLS_BASE = (process.env.EPIC_UNIFIED_INTERNAL_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")).replace(/\/+$/, "");

async function auth(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  return profile && accessToken && profile.role !== "workstation" ? { accessToken, profile } : null;
}

async function rpcNamed(accessToken: string, fn:string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Request failed (${response.status})`);
  return text ? JSON.parse(text) : null;
}

async function reservationIdForConfirmation(accessToken:string, confirmation:string) {
  const response=await fetch(`${SUPABASE_URL}/rest/v1/operational_reservations?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=id&order=updated_at.desc&limit=1`,{
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${accessToken}`},cache:"no-store"
  });
  if(!response.ok)return null;
  const rows=await response.json().catch(()=>[]) as Array<{id:string}>;
  return rows[0]?.id||null;
}

function zonedParts(date:Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EPIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read=(type:string)=>Number(parts.find(part=>part.type===type)?.value||0);
  return { year:read("year"),month:read("month"),day:read("day"),hour:read("hour"),minute:read("minute"),second:read("second") };
}

// TripWorks reservation start/end values arrive as Moab wall-clock times but are stored with +00.
// Reinterpret those clock fields in America/Denver so the UI does not subtract 6/7 hours.
function normalizeTripWorksWallTime(value:unknown) {
  if(typeof value!=="string"||!value)return value;
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if(!match)return value;
  const target={year:Number(match[1]),month:Number(match[2]),day:Number(match[3]),hour:Number(match[4]),minute:Number(match[5]),second:Number(match[6])};
  const targetAsUtc=Date.UTC(target.year,target.month-1,target.day,target.hour,target.minute,target.second);
  let guess=new Date(targetAsUtc);
  for(let i=0;i<3;i+=1){
    const current=zonedParts(guess);
    const currentAsUtc=Date.UTC(current.year,current.month-1,current.day,current.hour,current.minute,current.second);
    const delta=targetAsUtc-currentAsUtc;
    if(delta===0)break;
    guess=new Date(guess.getTime()+delta);
  }
  return guess.toISOString();
}

function normalizeCustomerReservationTimes(customer:any) {
  if(!customer||!Array.isArray(customer.reservations))return customer;
  return {
    ...customer,
    reservations: customer.reservations.map((reservation:any)=>({
      ...reservation,
      start_time: normalizeTripWorksWallTime(reservation.start_time),
      end_time: normalizeTripWorksWallTime(reservation.end_time),
    })),
  };
}

function mergeCallRailWithPbxInbound(callrailCalls:any[],pbxInboundCalls:any[]) {
  const inboundIndexes=callrailCalls.map((call:any,index:number)=>({call,index})).filter(x=>x.call?.direction==="inbound");
  const used=new Set<number>();
  const merged=pbxInboundCalls.map((pbx:any)=>{
    const pbxAt=new Date(pbx.at||0).getTime();
    let best:{call:any;index:number;delta:number}|null=null;
    for(const candidate of inboundIndexes){
      if(used.has(candidate.index))continue;
      const callAt=new Date(candidate.call.at||0).getTime();
      if(!pbxAt||!callAt)continue;
      const delta=Math.abs(pbxAt-callAt);
      if(delta<=180000&&(!best||delta<best.delta))best={call:candidate.call,index:candidate.index,delta};
    }
    if(best)used.add(best.index);
    const call=best?.call||{};
    return {
      ...call,
      ...pbx,
      id:pbx.id||`pbx-in-${pbx.session}`,
      direction:"inbound",
      answered:Boolean(pbx.answered),
      voicemail:Boolean(pbx.voicemail),
      recording_url:call.recording_url||null,
      summary:call.summary||call.lead_explanation||null,
      transcription:call.transcription||null,
      lead_score:call.lead_score??null,
      lead_explanation:call.lead_explanation||null,
      source_name:call.source_name||"Grandstream PBX",
      customer_phone_number:call.customer_phone_number||null,
      campaign:call.campaign||null,
      matched_reservation_id:call.matched_reservation_id||null,
      matched_opportunity_id:call.matched_opportunity_id||null,
    };
  });
  const remaining=callrailCalls.filter((call:any,index:number)=>call?.direction!=="inbound"||!used.has(index));
  return [...merged,...remaining].sort((a:any,b:any)=>new Date(b.at||0).getTime()-new Date(a.at||0).getTime());
}

export async function GET(request: NextRequest) {
  const session = await auth(request);
  if (!session) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const params = request.nextUrl.searchParams;
  let reservationId=params.get("reservation")||null;
  const confirmation=params.get("confirmation")||null;
  if(!reservationId&&confirmation) reservationId=await reservationIdForConfirmation(session.accessToken,confirmation);

  const body = {
    p_contact_id: params.get("contact") || null,
    p_opportunity_id: params.get("opportunity") || null,
    p_reservation_id: reservationId,
    p_phone: params.get("phone") || null,
    p_email: params.get("email") || null,
  };

  if (!Object.values(body).some(Boolean)) return NextResponse.json({ error: "Customer identity is required." }, { status: 400 });

  try {
    let customer = normalizeCustomerReservationTimes(await rpcNamed(session.accessToken, "get_epic_customer_360", body));
    // Add source histories only after an employee has explicitly confirmed the phone relationship.
    const currentPhone=String(customer?.identity?.phone||body.p_phone||"").replace(/[^0-9]/g,"").slice(-10);
    if(currentPhone.length===10){
      const linkedPhones=await rpcNamed(session.accessToken,"c360_linked_phones",{p_phone:currentPhone}).catch(()=>[]);
      for(const linkedPhone of Array.isArray(linkedPhones)?linkedPhones.slice(0,8):[]){
        if(String(linkedPhone)===currentPhone)continue;
        const other=normalizeCustomerReservationTimes(await rpcNamed(session.accessToken,"get_epic_customer_360",{
          p_contact_id:null,p_opportunity_id:null,p_reservation_id:null,p_phone:linkedPhone,p_email:null
        }));
        if(!other)continue;
        for(const key of ["calls","texts","emails","reservations","opportunities","drafts","quotes","notes"]){
          const left=Array.isArray(customer?.[key])?customer[key]:[];
          const right=Array.isArray(other?.[key])?other[key]:[];
          const dedup=new Map<string,any>();
          for(const item of [...left,...right]){
            const id=String(item?.id||item?.confirmation_code||JSON.stringify(item));
            if(!dedup.has(id))dedup.set(id,item);
          }
          customer[key]=[...dedup.values()];
        }
        if(!customer?.identity?.email && other?.identity?.email)customer.identity.email=other.identity.email;
        if(!customer?.identity?.name && other?.identity?.name)customer.identity.name=other.identity.name;
        customer.identity.linked_phones=[...new Set([...(customer.identity.linked_phones||[]),linkedPhone])];
      }
    }
    // Show the caller's number, not the Epic tracking line, on CallRail timeline entries.
    if(Array.isArray(customer?.calls)){
      const callIds=customer.calls.map((c:any)=>String(c.id||"")).filter((id:string)=>id.startsWith("CAL"));
      if(callIds.length){
        const origins=await rpcNamed(session.accessToken,"c360_employee_call_origins",{p_call_ids:callIds}).catch(()=>({}));
        for(const call of customer.calls){
          if(origins?.[call.id])call.customer_phone_number=origins[call.id];
        }
      }
    }
    // Primary choices are explicit; opening the secondary number cannot promote it.
    if(currentPhone.length===10 && customer?.identity){
      const primary=await rpcNamed(session.accessToken,"c360_linked_primary_contact",{p_phone:currentPhone}).catch(()=>null);
      if(primary?.phone)customer.identity.phone="+1"+primary.phone;
      if(primary?.email)customer.identity.email=primary.email;
      if(!primary?.phone){
        const regular=await rpcNamed(session.accessToken,"c360_employee_regular_contact",{p_phone:currentPhone,p_email:customer.identity.email||null}).catch(()=>null);
        if(regular?.primary_phone)customer.identity.phone="+1"+regular.primary_phone;
        if(regular?.primary_email)customer.identity.email=regular.primary_email;
      }
    }
    // A caller with no reservation/lead still deserves a named, discoverable C360.
    // Only fall back to CallRail when the canonical customer identity has no name.
    if (customer?.identity && !customer.identity.name && body.p_phone) {
      const callerName = await rpcNamed(session.accessToken, "c360_inbound_caller_name", {p_phone:body.p_phone}).catch(()=>null);
      if (typeof callerName==="string" && callerName.trim()) {
        customer.identity.name = callerName.trim();
      }
    }

    let pbxCalls:any[] = [];
    let pbxInboundCalls:any[] = [];
    const identityPhone=String(customer?.identity?.phone||params.get("phone")||"").replace(/\D/g,"").slice(-10);
    if(identityPhone.length===10){
      const outboundRows=await rpcNamed(session.accessToken,"get_epic_outbound_calls_for_phone",{p_phone:identityPhone}).catch(()=>[]);
      const inboundRows=await rpcNamed(session.accessToken,"get_epic_inbound_call_sessions_for_phone",{p_phone:identityPhone}).catch(()=>[]);
      pbxCalls=Array.isArray(outboundRows)?outboundRows:[];
      pbxInboundCalls=Array.isArray(inboundRows)?inboundRows:[];
    }

    const confirmations = [...new Set((customer?.reservations || []).map((r:any)=>String(r.confirmation_code||"").trim()).filter(Boolean))] as string[];

    let readinessByConfirmation = new Map<string, any>();
    let cancellationEvents:any[] = [];
    if (confirmations.length) {
      const headers={apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.accessToken}`};
      const readinessParams=new URLSearchParams({
        confirmation_code:`in.(${confirmations.join(",")})`,
        select:"confirmation_code,tripworks_booking_url,mpwr_confirmation_number,mpwr_reservation_url"
      });
      const [readinessResponse,cancellationRows]=await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/guest_readiness_operational?${readinessParams.toString()}`,{headers,cache:"no-store"}),
        rpcNamed(session.accessToken,"get_epic_cancellation_timeline",{p_confirmations:confirmations}).catch(()=>[])
      ]);
      if(readinessResponse.ok){
        const readinessRows=await readinessResponse.json().catch(()=>[]) as any[];
        readinessByConfirmation=new Map(readinessRows.map((row:any)=>[String(row.confirmation_code||"").toUpperCase(),row]));
      }
      cancellationEvents=Array.isArray(cancellationRows)?cancellationRows:[];
    }

    const opportunityIds = (customer?.opportunities || []).map((o:any)=>String(o.id||"").trim()).filter(Boolean);
    let salesCallWorkflows:any[] = [];
    if (opportunityIds.length) {
      const headers={apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.accessToken}`};
      const workflowParams=new URLSearchParams({
        opportunity_id:`in.(${opportunityIds.join(",")})`,
        select:"id,opportunity_id,rep_name,objection_code,objection_detail,resolution_note,outcome_code,next_action,follow_up_at,created_at,updated_at",
        order:"created_at.desc",
        limit:"25",
      });
      const workflowResponse=await fetch(`${SUPABASE_URL}/rest/v1/sales_lead_call_workflows?${workflowParams.toString()}`,{headers,cache:"no-store"});
      if(workflowResponse.ok){
        salesCallWorkflows=await workflowResponse.json().catch(()=>[]);
      }
    }

    // Inbox team-thread notes belong to the customer lifecycle, even after a sale closes the Inbox thread.
    let teamThreadNotes:any[]=[];
    // Include notes filed under the actual inbound phone thread, even when no opportunity exists.
    const noteThreadKeys=[...new Set([
      ...opportunityIds.map((id:string)=>`opp:${id}`),
      ...[identityPhone,...(Array.isArray(customer?.identity?.linked_phones)?customer.identity.linked_phones:[])].filter((phone:any)=>String(phone).length===10).map((phone:any)=>`phone:+1${phone}`),
      ...(customer?.identity?.contact_id?[ `contact:${customer.identity.contact_id}` ]:[]),
      ...(!identityPhone.length&&customer?.identity?.email?[ `email:${String(customer.identity.email).trim().toLowerCase()}` ]:[]),
      ...(!identityPhone.length&&!customer?.identity?.contact_id&&!customer?.identity?.email&&customer?.reservations?.[0]?.id?[ `reservation:${customer.reservations[0].id}` ]:[]),
    ])];
    if(noteThreadKeys.length){
      const results=await Promise.all(noteThreadKeys.map(key=>rpcNamed(session.accessToken,"get_epic_inbox_thread_notes",{p_thread_key:key}).catch(()=>[])));
      const unique=new Map<string,any>();
      for(const row of results.flatMap((rows:any)=>Array.isArray(rows)?rows:[]))if(row?.id)unique.set(String(row.id),row);
      teamThreadNotes=[...unique.values()].sort((a,b)=>new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime());
    }

    // Enrich existing authorized customer texts with the actual CallRail line used.
    // Never infer a business SMS number from the customer's phone or from another conversation.
    let smsNumberById=new Map<string,{epic_number:string|null;customer_number:string|null}>();
    if(identityPhone.length===10 && Array.isArray(customer?.texts) && customer.texts.length){
      const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/c360_callrail_sms_numbers`,{
        method:"POST",
        headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.accessToken}`,"Content-Type":"application/json"},
        body:JSON.stringify({p_phone:"+1"+identityPhone}),cache:"no-store"
      });
      if(response.ok){
        const rows=await response.json().catch(()=>[]) as Array<{message_id:string;direction:string;source_number:string|null;destination_number:string|null}>;
        smsNumberById=new Map(rows.map(row=>[row.message_id,{
          epic_number:row.direction==="inbound"?row.destination_number:row.source_number,
          customer_number:row.direction==="inbound"?row.source_number:row.destination_number,
        }]));
      }
    }

    // Podium SMS is fetched through the authenticated server route, not through public Supabase RLS.
    // This is read-only enrichment: historical SMS must not create or reopen inbox tasks.
    let podiumTexts:any[] = [];
    if (identityPhone.length === 10) {
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/c360_podium_sms`, {
          method: "POST",
          headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_phone: "+1" + identityPhone }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Podium SMS lookup failed: ${response.status}`);
        const messages = await response.json();
        podiumTexts = (Array.isArray(messages) ? messages : []).map((message:any) => ({
          id: `podium:${message.event_key}`,
          message_uid: message.message_uid,
          at: message.message_at || message.received_at,
          direction: message.direction,
          body: message.body,
          agent_name: null,
          status: message.event_type === "message.failed" ? "failed" : "sent",
          epic_number: "2700",
          customer_number: "+1" + identityPhone,
          provider: "podium",
          conversation_uid: message.conversation_uid,
        }));
      } catch (error) {
        console.warn("Podium C360 enrichment unavailable", error);
      }
    }

    // Telnyx inbound SMS/MMS history stays in C360, separate from inbox tasks.
    let telnyxTexts:any[]=[];
    if(identityPhone.length===10){
      try{
        const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/c360_telnyx_sms`,{
          method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.accessToken}`,"Content-Type":"application/json"},
          body:JSON.stringify({p_phone:"+1"+identityPhone}),cache:"no-store"
        });
        if(response.ok){
          const rows=await response.json();
          telnyxTexts=(Array.isArray(rows)?rows:[]).map((m:any)=>({
            id:"telnyx:"+m.message_id,at:m.at,direction:m.direction,body:m.body,agent_name:null,
            status:m.direction==="inbound"?"received":"sent",provider:"telnyx",
            epic_number:m.epic_number,customer_number:m.customer_phone
          }));
        }
      }catch(error){console.warn("Telnyx C360 enrichment unavailable",error);}
    }

    let linkedSocial:any[]=[];
    const verifiedContactId=customer?.identity?.contact_id;
    if(verifiedContactId && /^[0-9a-f-]{36}$/i.test(String(verifiedContactId))){
      try{
        const res=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_c360_linked_social_messages`,{
          method:"POST",
          headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.accessToken}`,"Content-Type":"application/json"},
          body:JSON.stringify({p_contact_id:verifiedContactId}),cache:"no-store"
        });
        if(res.ok)linkedSocial=await res.json();
      }catch(error){console.warn("Linked social history unavailable",error);}
    }
    const enriched = customer ? {
      ...customer,
      reservations:(customer.reservations||[]).map((reservation:any)=>{
        const readiness=readinessByConfirmation.get(String(reservation.confirmation_code||"").toUpperCase());
        return {
          ...reservation,
          tripworks_booking_url:readiness?.tripworks_booking_url||null,
          mpwr_confirmation_number:readiness?.mpwr_confirmation_number||null,
          mpwr_reservation_url:readiness?.mpwr_reservation_url||null,
        };
      }),
      calls:[...mergeCallRailWithPbxInbound(customer.calls||[],pbxInboundCalls),...pbxCalls].sort((a:any,b:any)=>new Date(b.at||0).getTime()-new Date(a.at||0).getTime()),
      texts:[...(customer.texts||[]).map((t:any)=>({...t,provider:"callrail",...(smsNumberById.get(String(t.message_id||t.id).replace(/^callrail:/,""))||{epic_number:null,customer_number:null})})),...podiumTexts,...telnyxTexts].sort((a:any,b:any)=>new Date(a.at||0).getTime()-new Date(b.at||0).getTime()),
      cancellation_agreements:cancellationEvents,
      sales_call_workflows:salesCallWorkflows,
      team_thread_notes:teamThreadNotes,
      social_messages:linkedSocial,
    } : customer;

    return NextResponse.json({ ok: true, customer: enriched });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Customer 360." }, { status: 500 });
  }
}
