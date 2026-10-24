import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.readiness_id === "string" ? body.readiness_id.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || notes.length > 10000)
    return NextResponse.json({ error: "Invalid note request." }, { status: 400 });
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) return NextResponse.json({ error: "Service configuration missing." }, { status: 503 });
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const response = await fetch(`${url}/rest/v1/rpc/save_guest_readiness_note`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_readiness_id: id, p_notes: notes }), cache: "no-store",
  }).catch(() => null);
  if (!response) return NextResponse.json({ error: "Note service unavailable." }, { status: 502 });
  if (!response.ok) return NextResponse.json({ error: "Could not save Readiness note." }, { status: response.status >= 500 ? 502 : 400 });
  return NextResponse.json({ ok: true });
}
