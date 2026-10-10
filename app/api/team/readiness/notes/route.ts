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
  return profile && profile.role !== "workstation" ? profile : null;
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
async function saveLegacy(readinessId:string, noteText:string) {
  await rest("rpc/save_guest_readiness_note", { method:"POST", body:JSON.stringify({ p_readiness_id:readinessId, p_notes:noteText }) });
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

export async function POST(request: NextRequest) {
  const profile = await employee(request); if (!profile) return NextResponse.json({ error:"Employee login required." }, { status:401 });
  try {
    const body = await request.json(); const visit = await resolveVisit(request, body); const noteText = String(body?.note_text || "").trim();
    if (!visit || !noteText) return NextResponse.json({ error:"Reservation and note text are required." }, { status:400 });
    const rows = await rest<Array<Record<string,unknown>>>("epic_unified_notes", { method:"POST", headers:{ Prefer:"return=representation" }, body:JSON.stringify({ readiness_id:visit.readiness_id, note_text:noteText, note_scope:"reservation", source:"readiness", visible_in_readiness:true, confirmation_code:String(body?.confirmation || "").trim().toUpperCase() || null, author_name:profile.display_name }) });
    return NextResponse.json({ ok:true, note:rows[0] || null });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to save note." }, { status:500 }); }
}

export async function PATCH(request: NextRequest) {
  if (!await employee(request)) return NextResponse.json({ error:"Employee login required." }, { status:401 });
  try {
    const body = await request.json(); const noteId = String(body?.note_id || "").trim(); const noteText = String(body?.note_text || "").trim();
    if (!noteId || !noteText) return NextResponse.json({ error:"note_id and note_text are required." }, { status:400 });
    if (noteId === "legacy") { const visit = await resolveVisit(request, body); if (!visit) throw new Error("Reservation could not be identified."); await saveLegacy(visit.readiness_id, noteText); return NextResponse.json({ ok:true }); }
    const rows = await rest<Array<Record<string,unknown>>>(`epic_unified_notes?note_id=eq.${encodeURIComponent(noteId)}&source=neq.tripworks`, { method:"PATCH", headers:{ Prefer:"return=representation" }, body:JSON.stringify({ note_text:noteText, updated_at:new Date().toISOString() }) });
    return NextResponse.json({ ok:true, note:rows[0] || null });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to update note." }, { status:500 }); }
}

export async function DELETE(request: NextRequest) {
  if (!await employee(request)) return NextResponse.json({ error:"Employee login required." }, { status:401 });
  try {
    const body = await request.json(); const noteId = String(body?.note_id || "").trim(); if (!noteId) return NextResponse.json({ error:"note_id is required." }, { status:400 });
    if (noteId === "legacy") { const visit = await resolveVisit(request, body); if (!visit) throw new Error("Reservation could not be identified."); await saveLegacy(visit.readiness_id, ""); return NextResponse.json({ ok:true }); }
    await rest<void>(`epic_unified_notes?note_id=eq.${encodeURIComponent(noteId)}&source=neq.tripworks`, { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:JSON.stringify({ archived_at:new Date().toISOString(), updated_at:new Date().toISOString() }) });
    return NextResponse.json({ ok:true });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to remove note." }, { status:500 }); }
}
