import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

async function auth(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  return profile && accessToken && profile.role !== "workstation" ? { accessToken, profile } : null;
}

async function rpc(accessToken: string, fn: string, body: Record<string, unknown>) {
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

function emailDomain(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "";
}

function domainBlocked(domain: string, blocked: string[]) {
  return blocked.some((item) => domain === item || domain.endsWith(`.${item}`));
}

export async function GET(request: NextRequest) {
  const session = await auth(request);
  if (!session) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const includeClosed = request.nextUrl.searchParams.get("cleaned") === "1" || request.nextUrl.searchParams.get("closed") === "1";
  const threadKey = request.nextUrl.searchParams.get("thread_key");
  try {
    const lookup=request.nextUrl.searchParams.get("meta_lookup");
    if(lookup){const matches=await rpc(session.accessToken,"c360_meta_contact_lookup",{p_query:lookup});return NextResponse.json({ok:true,matches});}
    const socialDetail=request.nextUrl.searchParams.get("social_detail");
    if(socialDetail){
      const igMatch=socialDetail.match(/^meta:instagram:([0-9]+)$/);
      if(igMatch){const detail=await rpc(session.accessToken,"c360_instagram_thread_detail",{p_sender_id:igMatch[1]});return NextResponse.json({ok:true,detail});}
      const metaMatch=socialDetail.match(/^meta:facebook:([0-9]+)$/);
      if(metaMatch){const detail=await rpc(session.accessToken,"c360_meta_thread_detail",{p_sender_id:metaMatch[1]});return NextResponse.json({ok:true,detail});}
      const match=socialDetail.match(/^social:(instagram|facebook):(.+)$/);
      if(!match)return NextResponse.json({error:"Invalid social conversation."},{status:400});
      const detail=await rpc(session.accessToken,"c360_social_thread_detail",{p_platform:match[1],p_conversation_uid:match[2]});
      return NextResponse.json({ok:true,detail});
    }
    if (threadKey) {
      if(threadKey.startsWith("meta:facebook:")||threadKey.startsWith("meta:instagram:"))return NextResponse.json({ok:true,notes:[]});
      const social=threadKey.match(/^social:(instagram|facebook):(.+)$/);
      const notes=social
        ? await rpc(session.accessToken,"get_c360_social_notes",{p_platform:social[1],p_conversation_uid:social[2]})
        : threadKey.startsWith("podium:")
          ? await rpc(session.accessToken,"get_podium_inbox_notes",{p_conversation_uid:threadKey.slice(7)})
          : await rpc(session.accessToken,"get_epic_inbox_thread_notes",{p_thread_key:threadKey});
      return NextResponse.json({ ok: true, notes: notes || [] });
    }
    const [threads, blockedRows, phoneReport, collaborators, mentions] = await Promise.all([
      rpc(session.accessToken, "get_epic_routed_inbox_v2", { p_include_cleaned: includeClosed }),
      rpc(session.accessToken, "get_epic_sales_blocked_domains", {}),
      rpc(session.accessToken, "get_epic_phone_report", { p_local_date: null }),
      rpc(session.accessToken, "get_epic_inbox_collaborators", {}),
      rpc(session.accessToken, "get_epic_inbox_mentions", {}),
    ]);
    const podiumThreads = await rpc(session.accessToken, "get_c360_podium_inbox", {});
    const telnyxThreads = await rpc(session.accessToken, "get_c360_telnyx_inbox", {});
    const socialThreads = await rpc(session.accessToken, "get_c360_social_inbox", {}); // Keep received social messages visible while direct Meta delivery is incomplete.
    const metaThreads = await rpc(session.accessToken,"get_c360_meta_inbox",{});
    const instagramThreads = await rpc(session.accessToken,"get_c360_instagram_inbox",{});
    const blocked = (Array.isArray(blockedRows) ? blockedRows : []).map((row: { domain?: string }) => String(row.domain || "").toLowerCase()).filter(Boolean);
    const filteredThreads = [...(Array.isArray(threads) ? threads : []), ...(Array.isArray(podiumThreads) ? podiumThreads : []), ...(Array.isArray(telnyxThreads) ? telnyxThreads : []), ...(Array.isArray(socialThreads) ? socialThreads : []).filter((t:any)=>!((metaThreads||[]).some((m:any)=>m.platform===t.platform&&m.customer_name===t.customer_name&&m.preview===t.preview))), ...(Array.isArray(metaThreads) ? metaThreads : []), ...(Array.isArray(instagramThreads) ? instagramThreads : [])].filter((thread: { kind?: string; email?: string | null }) => {
      if (thread.kind !== "email") return true;
      const domain = emailDomain(thread.email);
      return !domain || !domainBlocked(domain, blocked);
    });

    const unresolved = filteredThreads.filter((thread: any) => thread.lane === "unmatched");
    const emailCandidates = [...new Set(unresolved.map((thread: any) => String(thread.email || "").trim().toLowerCase()).filter(Boolean))];
    const phoneCandidates = [...new Set(unresolved.map((thread: any) => String(thread.phone || "").replace(/\D/g, "")).filter(Boolean))];
    const knownByEmail = new Map<string, { id:string; display_name:string|null }>();
    const knownByPhone = new Map<string, { id:string; display_name:string|null }>();

    if (emailCandidates.length || phoneCandidates.length) {
      const matches = await rpc(session.accessToken, "get_epic_known_customer_matches", {
        p_emails: emailCandidates,
        p_phones: phoneCandidates,
      });
      for (const row of (Array.isArray(matches) ? matches : []) as Array<{ match_type:string; match_value:string; contact_id:string; display_name:string|null }>) {
        const customer = { id: row.contact_id, display_name: row.display_name };
        if (row.match_type === "email") knownByEmail.set(row.match_value, customer);
        if (row.match_type === "phone") knownByPhone.set(row.match_value, customer);
      }
    }

    const enrichedThreads = filteredThreads.map((thread: any) => {
      if (thread.lane !== "unmatched") return thread;
      const email = String(thread.email || "").trim().toLowerCase();
      const phone = String(thread.phone || "").replace(/\D/g, "");
      const contact = (email && knownByEmail.get(email)) || (phone && knownByPhone.get(phone)) || null;
      if (!contact) return thread;
      return {
        ...thread,
        contact_id: contact.id,
        known_customer: true,
        customer_name: contact.display_name || thread.customer_name,
      };
    });

    return NextResponse.json({
      ok: true,
      threads: enrichedThreads,
      phone_summary: phoneReport?.summary || {},
      team_members: Array.isArray(collaborators) ? collaborators : [],
      mentions: mentions || { unread_count: 0, thread_keys: [] },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load inbox." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth(request);
  if (!session) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; thread_key?: string; note_text?: string; destination?: string; entry_type?: string; expected_contact_id?: string | null; expected_phone?: string | null; expected_email?: string | null; expected_customer_name?: string | null } | null;
  if (!body?.thread_key) return NextResponse.json({ error: "Thread is required." }, { status: 400 });
  try {
    if(body.thread_key.startsWith("meta:facebook:")&&(body.action==="link"||body.action==="unlink")){
      const result=await rpc(session.accessToken,"c360_meta_link",{p_sender_id:body.thread_key.slice("meta:facebook:".length),p_contact_id:body.action==="link"?(body as typeof body & {contact_id?:string}).contact_id||null:null,p_unlink:body.action==="unlink"});
      return NextResponse.json(result);
    }
    if (body.thread_key.startsWith("social:")) {
      const match=body.thread_key.match(/^social:(instagram|facebook):(.+)$/);
      if(!match)return NextResponse.json({error:"Invalid social thread"},{status:400});
      if(!["close","clean","route","note","link","unlink"].includes(body.action||""))return NextResponse.json({error:"Unsupported social action"},{status:400});
      const result=await rpc(session.accessToken,"c360_social_action",{
        p_platform:match[1],p_conversation_uid:match[2],
        p_action:body.action==="clean"?"close":body.action,
        p_note_text:body.note_text||null,p_lane:body.destination||null,
        p_contact_id:(body as typeof body & {contact_id?:string}).contact_id||null
      });
      return NextResponse.json(result||{ok:true});
    }
    if (body.thread_key.startsWith("podium:") && (body.action === "close" || body.action === "clean")) { const ok = await rpc(session.accessToken, "close_c360_podium_inbox", { p_conversation_uid: body.thread_key.slice(7) }); return NextResponse.json({ok}); }
    if(body.thread_key.startsWith("telnyx:")&&["close","clean","route"].includes(body.action||"")){
      const result=await rpc(session.accessToken,"c360_telnyx_inbox_action",{
        p_phone:body.thread_key.slice("telnyx:".length),p_action:body.action==="route"?"route":"close",
        p_lane:body.action==="route"?body.destination:null
      });
      if(body.action==="route"&&body.note_text?.trim())await rpc(session.accessToken,"epic_sales_add_inbox_thread_note",{p_thread_key:body.thread_key,p_note_text:body.note_text.trim()});
      return NextResponse.json(result||{ok:true});
    }
    if (body.action === "close" || body.action === "clean") {
      const result = await rpc(session.accessToken, "epic_sales_clean_inbox_thread", { p_thread_key: body.thread_key });
      return NextResponse.json(result || { ok: true });
    }
    if (body.thread_key.startsWith("podium:") && (body.action==="note" || body.action==="route")) {
      const result=await rpc(session.accessToken,"podium_inbox_action",{
        p_conversation_uid:body.thread_key.slice(7),
        p_action:body.action,
        p_note_text:body.note_text||null,
        p_lane:body.action==="route"?body.destination:null
      });
      return NextResponse.json(result || {ok:true});
    }
    if (body.action === "c360_note") {
      const entryType=(body as typeof body & { entry_type?: string })?.entry_type;
      if(entryType!=="customer_note"&&entryType!=="reservation_note")return NextResponse.json({error:"Invalid note type."},{status:400});
      if(typeof body.thread_key!=="string"||!body.thread_key||typeof body.note_text!=="string"||!body.note_text.trim())return NextResponse.json({error:"A valid customer and note are required."},{status:400});
      if(body.thread_key.startsWith("opp:")){
        const valid=await rpc(session.accessToken,"epic_c360_verify_note_target",{p_thread_key:body.thread_key,p_contact_id:body.expected_contact_id||null,p_phone:body.expected_phone||null,p_email:body.expected_email||null,p_customer_name:body.expected_customer_name||null});
        if(valid!==true)return NextResponse.json({error:"Customer changed or note destination does not match. Reopen this customer and try again."},{status:409});
      }
      const result=await rpc(session.accessToken,"epic_sales_add_inbox_thread_note",{p_thread_key:body.thread_key,p_note_text:body.note_text||""});
      return NextResponse.json(result||{ok:true});
    }
    if (body.action === "note") {
      const result = await rpc(session.accessToken, "epic_sales_add_inbox_thread_note", { p_thread_key: body.thread_key, p_note_text: body.note_text || "" });
      return NextResponse.json(result || { ok: true });
    }
    if (body.action === "respond_mention") {
      const response = (body as typeof body & { response?: string })?.response;
      const result = await rpc(session.accessToken, "epic_respond_to_inbox_mention", { p_thread_key: body.thread_key, p_response: response || "" });
      return NextResponse.json(result || { ok: true });
    }
    if (body.action === "read_mentions") {
      const result = await rpc(session.accessToken, "epic_sales_mark_inbox_thread_mentions_read", { p_thread_key: body.thread_key });
      return NextResponse.json(result || { ok: true });
    }
    if (body.action === "route") {
      const destination = body.destination === "service" ? "service" : body.destination === "sales" ? "sales" : "";
      if (!destination) return NextResponse.json({ error: "Destination is required." }, { status: 400 });
      const result = await rpc(session.accessToken, "epic_route_inbox_thread", { p_thread_key: body.thread_key, p_destination: destination, p_note_text: body.note_text || null });
      return NextResponse.json(result || { ok: true });
    }
    return NextResponse.json({ error: "Invalid inbox action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update inbox thread." }, { status: 500 });
  }
}
