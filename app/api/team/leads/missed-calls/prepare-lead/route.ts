import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey:key, Authorization:`Bearer ${key}`, "Content-Type":"application/json", ...(init?.headers||{}) },
    cache:"no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return NextResponse.json({error:"Employee login required."},{status:401});
  const body = await request.json().catch(()=>null) as {work_item_id?:string}|null;
  const id = body?.work_item_id?.trim();
  if (!id) return NextResponse.json({error:"Work item is required."},{status:400});

  try {
    const rows = await rest<Array<{id:string;source_record_id:string|null;source:string;status:string;metadata:Record<string,unknown>}>>(`customer_work_items?id=eq.${encodeURIComponent(id)}&select=id,source_record_id,source,status,metadata&limit=1`);
    const item = rows[0];
    if (!item || item.status !== "open") return NextResponse.json({error:"Open missed-call item not found."},{status:404});
    const m = item.metadata || {};
    const phone = typeof m.phone === "string" ? m.phone : "";
    if (!phone) return NextResponse.json({error:"Caller phone is missing."},{status:400});
    const callId = item.source_record_id || `work_${item.id}`;
    const now = new Date().toISOString();

    const existing = await rest<Array<{id:string}>>(`live_calls?callrail_call_id=eq.${encodeURIComponent(callId)}&select=id&limit=1`);
    if (existing[0]?.id) return NextResponse.json({ok:true,live_call_id:existing[0].id});

    const payload = {
      callrail_call_id: callId,
      caller_phone: phone,
      caller_name: typeof m.caller_name === "string" ? m.caller_name : null,
      tracking_phone: typeof m.tracking_phone_number === "string" ? m.tracking_phone_number : null,
      source_name: typeof m.source_name === "string" ? m.source_name : null,
      campaign: typeof m.campaign === "string" ? m.campaign : null,
      received_at: typeof m.event_received_at === "string" ? m.event_received_at : now,
      route_kind: "new_lead",
      route_label: typeof m.caller_name === "string" && m.caller_name ? m.caller_name : "Missed caller",
      raw_payload: { customer_work_item_id:item.id, ...m },
      updated_at: now,
    };
    const saved = await rest<Array<{id:string}>>("live_calls",{
      method:"POST",
      headers:{Prefer:"return=representation"},
      body:JSON.stringify(payload),
    });
    const liveCallId = saved[0]?.id;
    if (!liveCallId) throw new Error("Live call record was not prepared.");
    return NextResponse.json({ok:true,live_call_id:liveCallId});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to prepare lead capture."},{status:500});
  }
}
