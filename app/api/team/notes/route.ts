import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

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
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function access(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (profile && profile.role !== "workstation") return { kind: "employee" as const, profile };
  if (verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value)) return { kind: "workstation" as const, profile: null };
  return null;
}

export async function PATCH(request: NextRequest) {
  const actor = await access(request);
  if (!actor) return NextResponse.json({ error: "Team login required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    scope?: "lead" | "readiness";
    note_id?: string;
    note_text?: string;
  } | null;

  const scope = body?.scope;
  const noteId = body?.note_id?.trim();
  const noteText = body?.note_text?.trim() || "";

  if (!scope || !noteId) return NextResponse.json({ error: "Note scope and note ID are required." }, { status: 400 });
  if (!noteText) return NextResponse.json({ error: "Note cannot be blank." }, { status: 400 });
  if (noteText.length > 4000) return NextResponse.json({ error: "Note is too long." }, { status: 400 });
  if (scope === "lead" && actor.kind !== "employee") return NextResponse.json({ error: "Employee login required for sales notes." }, { status: 403 });

  const now = new Date().toISOString();

  try {
    if (scope === "lead") {
      const rows = await rest<Array<{ id: string; opportunity_id: string; author_name: string; note_text: string; created_at: string; updated_at: string }>>(
        `sales_opportunity_notes?id=eq.${encodeURIComponent(noteId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ note_text: noteText, updated_at: now }),
        },
      );
      if (!rows.length) return NextResponse.json({ error: "Sales note not found." }, { status: 404 });
      return NextResponse.json({ ok: true, note: rows[0] });
    }

    const rows = await rest<Array<{ note_id: string; readiness_id: string; note_text: string; note_category: string | null; created_by: string | null; created_at: string; updated_at: string }>>(
      `guest_readiness_staff_notes?note_id=eq.${encodeURIComponent(noteId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ note_text: noteText, updated_at: now }),
      },
    );
    if (!rows.length) return NextResponse.json({ error: "Readiness note not found." }, { status: 404 });
    return NextResponse.json({ ok: true, note: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update note." }, { status: 500 });
  }
}
