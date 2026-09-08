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
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey:key, Authorization:`Bearer ${key}`, "Content-Type":"application/json", ...(init?.headers || {}) }, cache:"no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}
async function resolveVisit(request: NextRequest, body?: any) {
  const readinessId = String(body?.readiness_id || request.nextUrl.searchParams.get("readiness_id") || "").trim();
  const confirmation = String(body?.confirmation || request.nextUrl.searchParams.get("confirmation") || "").trim().toUpperCase();
  if (readinessId) {
    const rows = await rest<Array<{ readiness_id:string; notes:string|null }>>(`guest_readiness_with_handoff_v?readiness_id=eq.${encodeURIComponent(readinessId)}&select=readiness_id,notes&limit=1`);
    return rows[0] || { readiness_id: readinessId, notes: null };
  }
  if (!confirmation) return null;
  const rows = await rest<Array<{ readiness_id:string; notes:string|null }>>(`guest_readiness_with_handoff_v?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=readiness_id,notes&limit=1`);
  return rows[0] || null;
}
async function saveLegacy(readinessId:string, noteText:string) {
  await rest("rpc/save_guest_readiness_note", { method:"POST", body:JSON.stringify({ p_readiness_id:readinessId, p_notes:noteText }) });
}

export async function GET(request: NextRequest) {
  if (!await employee(request)) return NextResponse.json({ error:"Employee login required." }, { status:401 });
  try {
    const visit = await resolveVisit(request);
    if (!visit) return NextResponse.json({ error:"Reservation could not be identified." }, { status:404 });
    const notes = await rest<Array<Record<string,unknown>>>(`guest_readiness_staff_notes?readiness_id=eq.${encodeURIComponent(visit.readiness_id)}&archived_at=is.null&select=${encodeURIComponent("note_id,readiness_id,note_text,note_category,created_by,created_at,updated_at")}&order=created_at.desc`);
    return NextResponse.json({ ok:true, readiness_id:visit.readiness_id, legacy_note:visit.notes || null, notes });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to load notes." }, { status:500 }); }
}

export async function POST(request: NextRequest) {
  const profile = await employee(request); if (!profile) return NextResponse.json({ error:"Employee login required." }, { status:401 });
  try {
    const body = await request.json(); const visit = await resolveVisit(request, body); const noteText = String(body?.note_text || "").trim();
    if (!visit || !noteText) return NextResponse.json({ error:"Reservation and note text are required." }, { status:400 });
    const rows = await rest<Array<Record<string,unknown>>>("guest_readiness_staff_notes", { method:"POST", headers:{ Prefer:"return=representation" }, body:JSON.stringify({ readiness_id:visit.readiness_id, note_text:noteText, note_category:"operations", created_by:profile.display_name }) });
    return NextResponse.json({ ok:true, note:rows[0] || null });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to save note." }, { status:500 }); }
}

export async function PATCH(request: NextRequest) {
  if (!await employee(request)) return NextResponse.json({ error:"Employee login required." }, { status:401 });
  try {
    const body = await request.json(); const noteId = String(body?.note_id || "").trim(); const noteText = String(body?.note_text || "").trim();
    if (!noteId || !noteText) return NextResponse.json({ error:"note_id and note_text are required." }, { status:400 });
    if (noteId === "legacy") { const visit = await resolveVisit(request, body); if (!visit) throw new Error("Reservation could not be identified."); await saveLegacy(visit.readiness_id, noteText); return NextResponse.json({ ok:true }); }
    const rows = await rest<Array<Record<string,unknown>>>(`guest_readiness_staff_notes?note_id=eq.${encodeURIComponent(noteId)}`, { method:"PATCH", headers:{ Prefer:"return=representation" }, body:JSON.stringify({ note_text:noteText, updated_at:new Date().toISOString() }) });
    return NextResponse.json({ ok:true, note:rows[0] || null });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to update note." }, { status:500 }); }
}

export async function DELETE(request: NextRequest) {
  if (!await employee(request)) return NextResponse.json({ error:"Employee login required." }, { status:401 });
  try {
    const body = await request.json(); const noteId = String(body?.note_id || "").trim(); if (!noteId) return NextResponse.json({ error:"note_id is required." }, { status:400 });
    if (noteId === "legacy") { const visit = await resolveVisit(request, body); if (!visit) throw new Error("Reservation could not be identified."); await saveLegacy(visit.readiness_id, ""); return NextResponse.json({ ok:true }); }
    await rest<void>(`guest_readiness_staff_notes?note_id=eq.${encodeURIComponent(noteId)}`, { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:JSON.stringify({ archived_at:new Date().toISOString(), updated_at:new Date().toISOString() }) });
    return NextResponse.json({ ok:true });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to remove note." }, { status:500 }); }
}
