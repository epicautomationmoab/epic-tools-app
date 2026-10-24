import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const readinessId = typeof body?.readiness_id === "string" ? body.readiness_id.trim() : "";
  const level = body?.level;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(readinessId) || !["Standard", "Premier"].includes(level)) {
    return NextResponse.json({ error: "Invalid coverage update." }, { status: 400 });
  }
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) return NextResponse.json({ error: "Service configuration missing." }, { status: 503 });
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const response = await fetch(`${url}/rest/v1/rpc/set_readiness_adventure_assure_override`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_readiness_id: readinessId,
      p_level: level,
      p_reason: "Updated from Guest Readiness dashboard",
      p_updated_by: profile.display_name,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!response) return NextResponse.json({ error: "Coverage service unavailable." }, { status: 502 });
  if (!response.ok) return NextResponse.json({ error: "Unable to update coverage." }, { status: response.status >= 500 ? 502 : 400 });
  return NextResponse.json({ ok: true });
}
