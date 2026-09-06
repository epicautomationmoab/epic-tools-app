import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function requireEmployee(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return null;
  return profile;
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

export async function GET(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const readinessId = request.nextUrl.searchParams.get("readiness_id")?.trim();
  if (!readinessId) return NextResponse.json({ error: "readiness_id is required." }, { status: 400 });

  try {
    const notes = await rest<Array<{
      note_id: string;
      readiness_id: string;
      note_text: string;
      note_category: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    }>>(`guest_readiness_staff_notes?readiness_id=eq.${encodeURIComponent(readinessId)}&archived_at=is.null&select=${encodeURIComponent("note_id,readiness_id,note_text,note_category,created_by,created_at,updated_at")}&order=created_at.desc`);

    return NextResponse.json({ ok: true, notes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load notes." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  try {
    const body = await request.json();
    const readinessId = String(body?.readiness_id || "").trim();
    const noteText = String(body?.note_text || "").trim();
    if (!readinessId || !noteText) return NextResponse.json({ error: "readiness_id and note_text are required." }, { status: 400 });

    const rows = await rest<Array<Record<string, unknown>>>("guest_readiness_staff_notes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        readiness_id: readinessId,
        note_text: noteText,
        note_category: "operations",
        created_by: profile.display_name,
      }),
    });

    return NextResponse.json({ ok: true, note: rows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save note." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  try {
    const body = await request.json();
    const noteId = String(body?.note_id || "").trim();
    const noteText = String(body?.note_text || "").trim();
    if (!noteId || !noteText) return NextResponse.json({ error: "note_id and note_text are required." }, { status: 400 });

    const rows = await rest<Array<Record<string, unknown>>>(`guest_readiness_staff_notes?note_id=eq.${encodeURIComponent(noteId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ note_text: noteText, updated_at: new Date().toISOString() }),
    });

    return NextResponse.json({ ok: true, note: rows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update note." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  try {
    const body = await request.json();
    const noteId = String(body?.note_id || "").trim();
    if (!noteId) return NextResponse.json({ error: "note_id is required." }, { status: 400 });

    await rest<void>(`guest_readiness_staff_notes?note_id=eq.${encodeURIComponent(noteId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove note." }, { status: 500 });
  }
}
