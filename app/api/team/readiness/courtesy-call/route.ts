import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const id = typeof input?.readiness_id === "string" ? input.readiness_id.trim() : "";
  const outcome = typeof input?.call_outcome === "string" ? input.call_outcome.trim() : "";
  const notes = typeof input?.notes === "string" ? input.notes.trim() : "";
  if (!uuid.test(id) || typeof input?.arrival_confirmed !== "boolean" || typeof input?.location_discussed !== "boolean" ||
      outcome.length > 120 || notes.length > 5000) {
    return NextResponse.json({ error: "Invalid courtesy-call details." }, { status: 400 });
  }
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) return NextResponse.json({ error: "Service configuration missing." }, { status: 503 });
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const response = await fetch(`${url}/rest/v1/rpc/complete_courtesy_call`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_readiness_id: id, p_completed_by: profile.display_name,
      p_notes: notes, p_arrival_confirmed: input.arrival_confirmed,
      p_location_discussed: input.location_discussed, p_call_outcome: outcome,
    }), cache: "no-store",
  }).catch(() => null);
  if (!response) return NextResponse.json({ error: "Courtesy-call service unavailable." }, { status: 502 });
  if (!response.ok) return NextResponse.json({ error: "Unable to complete courtesy call." }, { status: response.status >= 500 ? 502 : 400 });
  return NextResponse.json({ ok: true });
}
