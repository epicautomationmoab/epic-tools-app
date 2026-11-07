import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function config() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}
async function employee(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  return profile?.active && profile.role !== "workstation" ? profile : null;
}
async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = path.startsWith("epic_unified_notes") && process.env.EPIC_NOTES_PREVIEW_URL && process.env.EPIC_NOTES_PREVIEW_KEY ? {url:process.env.EPIC_NOTES_PREVIEW_URL,key:process.env.EPIC_NOTES_PREVIEW_KEY} : config();
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey:key, Authorization:`Bearer ${key}`, "Content-Type":"application/json", ...(init?.headers || {}) }, cache:"no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

type VisitIdentity = { readiness_id:string; notes:string|null };

async function lookupVisit(view:string, field:"readiness_id"|"confirmation_code", value:string) {
  const rows = await rest<VisitIdentity[]>(`${view}?${field}=eq.${encodeURIComponent(value)}&select=readiness_id,notes&limit=1`);
  return rows[0] || null;
}

async function resolveVisit(request: NextRequest, body?: any) {
  const readinessId = String(body?.readiness_id || request.nextUrl.searchParams.get("readiness_id") || "").trim();
  const confirmation = String(body?.confirmation || request.nextUrl.searchParams.get("confirmation") || "").trim().toUpperCase();

  if (readinessId) {
    return (
      await lookupVisit("guest_readiness_with_handoff_v", "readiness_id", readinessId)
    ) || (
      await lookupVisit("guest_readiness_history_search_v", "readiness_id", readinessId)
    ) || { readiness_id: readinessId, notes: null };
  }

  if (!confirmation) return null;

  return (
    await lookupVisit("guest_readiness_with_handoff_v", "confirmation_code", confirmation)
  ) || (
    await lookupVisit("guest_readiness_history_search_v", "confirmation_code", confirmation)
  );
}
export async function GET(request: NextRequest) {
  if (!await employee(request)) return NextResponse.json({ error:"Employee login required." }, { status:401 });
  try {
    const confirmation=String(request.nextUrl.searchParams.get("confirmation")||"").trim().toUpperCase();
    const requestedReadinessId=String(request.nextUrl.searchParams.get("readiness_id")||"").trim();
    if (!confirmation && !requestedReadinessId) return NextResponse.json({error:"Reservation required."},{status:400});
    // Query by confirmation directly: C360-origin notes may not have a readiness_id.
    // Don't fail the whole drawer because a historic Readiness view cannot resolve a visit.
    const filter=confirmation
      ? `confirmation_code=eq.${encodeURIComponent(confirmation)}`
      : `readiness_id=eq.${encodeURIComponent(requestedReadinessId)}`;
    const rows=await rest<Array<Record<string,unknown>>>(`epic_unified_notes?${filter}&archived_at=is.null&visible_in_readiness=eq.true&select=*&order=created_at.desc`);
    const notes=rows.map(n=>({...n,note_category:n.note_scope,created_by:n.author_name}));
    let visit:VisitIdentity|null=null;
    try { visit=await resolveVisit(request); }
    catch(error){ console.warn("[readiness-notes] legacy visit lookup unavailable",error instanceof Error?error.message:String(error)); }
    const readinessId=visit?.readiness_id||requestedReadinessId||null;
    const legacyExists=readinessId ? rows.some(n=>n.source_note_id===`legacy:${readinessId}`) : false;
    return NextResponse.json({ok:true,readiness_id:readinessId,legacy_note:legacyExists?null:(visit?.notes||null),notes});
  }catch(error){
    const message=error instanceof Error?error.message:"Unable to load notes.";
    console.error("[readiness-notes] GET failed",message);
    return NextResponse.json({error:message},{status:500});
  }
}

async function mutate(request: NextRequest, action: "add"|"edit"|"archive") {
  if (!await employee(request)) return NextResponse.json({error:"Employee login required."},{status:401});
  const body=await request.json().catch(()=>null);
  if(!body) return NextResponse.json({error:"Valid note request required."},{status:400});
  const text=String(body.note_text||"").trim();
  if(action!=="archive" && (!text || text.length>4000)) return NextResponse.json({error:"Note must contain 1 to 4000 characters."},{status:400});
  const confirmation=String(body.confirmation||"").trim().toUpperCase();
  const id=String(body.note_id||"");
  if(action==="add" ? !/^[A-Z0-9-]{3,25}$/.test(confirmation) : !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({error:"Valid reservation or note required. Legacy notes are read-only."},{status:400});
  const expected=body.expected_updated_at;
  if(action!=="add" && (typeof expected!=="string" || !Number.isFinite(Date.parse(expected)))) return NextResponse.json({error:"Reload this reservation before editing the note."},{status:409});
  const origin=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/,"");
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!origin || !key) return NextResponse.json({error:"Note storage unavailable."},{status:503});
  try {
    const response=await fetch(`${origin}/rest/v1/rpc/${action==="add"?"epic_readiness_note_add":"epic_readiness_note_change"}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${request.cookies.get("epic_access_token")?.value}`,"Content-Type":"application/json"},body:JSON.stringify(action==="add"?{p_confirmation:confirmation,p_note_text:text}:{p_note_id:id,p_expected_updated_at:expected,p_note_text:text,p_archive:action==="archive"}),cache:"no-store"});
    const data=await response.json();
    if(!response.ok){
      const status=data.code==="40001"?409:data.code==="P0002"?404:data.code==="42501"?403:data.code==="22023"?400:502;
      const error=status===409?"This note changed since you opened it. Close and reopen the reservation before saving again.":status===404?"Note or reservation unavailable, archived, or read-only.":"Unable to save this note.";
      return NextResponse.json({error},{status});
    }
    const note=data[0];
    return NextResponse.json({ok:true,note:note?{...note,created_by:note.author_name,note_category:note.note_scope}:null},{headers:{"Cache-Control":"no-store"}});
  } catch {return NextResponse.json({error:"Note storage is temporarily unavailable."},{status:502});}
}
export async function POST(request: NextRequest){return mutate(request,"add");}
export async function PATCH(request: NextRequest){return mutate(request,"edit");}
export async function DELETE(request: NextRequest){return mutate(request,"archive");}
