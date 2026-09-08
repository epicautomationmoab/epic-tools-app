import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseRpc } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  if (!profile && !workstation) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const visitDate = String(body?.visit_date ?? "").trim();
    const experienceKey = String(body?.experience_key ?? "").trim();
    const visitStartTime = String(body?.visit_start_time ?? "").trim();
    const guideName = String(body?.guide_name ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || !experienceKey || !visitStartTime) {
      return NextResponse.json({ error: "Invalid manifest assignment." }, { status: 400 });
    }

    await supabaseRpc<void>("set_tour_manifest_guide", {
      p_visit_date: visitDate,
      p_experience_key: experienceKey,
      p_visit_start_time: visitStartTime,
      p_guide_name: guideName,
      p_updated_by_profile_id: profile?.id ?? null,
      p_updated_by_name: profile?.display_name ?? "Epic Workstation",
    });

    return NextResponse.json({ ok: true, guide_name: guideName });
  } catch (error) {
    console.error("Tour manifest guide save failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save guide assignment." },
      { status: 500 },
    );
  }
}
