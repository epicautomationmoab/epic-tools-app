import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

const allowed = new Set(["checked_in", "rental_out", "rental_returned", "clear"]);

// Staff-only proxy for the privileged handoff RPC. Never accept actor attribution
// from the caller; derive it from a verified employee session.
export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const readinessId = typeof body?.readiness_id === "string" ? body.readiness_id.trim() : "";
  const status = typeof body?.handoff_status === "string" ? body.handoff_status : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(readinessId) || !allowed.has(status)) {
    return NextResponse.json({ error: "Invalid readiness ID or handoff status." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return NextResponse.json({ error: "Server configuration missing." }, { status: 503 });

  const clearing = status === "clear";
  const result = await fetch(`${url}/rest/v1/rpc/${clearing ? "clear_epic_operational_handoff" : "set_epic_operational_handoff"}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(clearing ? {
      p_readiness_id: readinessId,
      p_recorded_by: profile.display_name,
    } : {
      p_readiness_id: readinessId,
      p_handoff_status: status,
      p_recorded_by: profile.display_name,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!result) return NextResponse.json({ error: "Handoff service unavailable." }, { status: 502 });
  if (!result.ok) return NextResponse.json({ error: "Unable to update reservation handoff." }, { status: result.status >= 500 ? 502 : 400 });
  return NextResponse.json({ ok: true, handoff_status: clearing ? null : status });
}
