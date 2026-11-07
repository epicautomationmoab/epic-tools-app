import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseRpc } from "@/lib/server/supabase-rest";

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile?.active || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("readiness_id") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Valid reservation ID required." }, { status: 400 });
  }
  try {
    // Preserve the existing drawer's initialization outside isolated Preview.
    // Preview reads only the prepared synthetic records.
    if (process.env.EPIC_STAGING_NO_OUTBOUND !== "true") {
      await supabaseRpc("ensure_rental_damage_deposit", { p_readiness_id: id, p_updated_by: profile.display_name });
    }
    const deposit = await supabaseRpc("get_rental_damage_deposit", { p_readiness_id: id });
    return NextResponse.json(deposit, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load deposit status. Please retry." }, { status: 502 });
  }
}
