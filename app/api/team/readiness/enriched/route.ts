import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getReadinessRows } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(
    request.cookies.get("epic_access_token")?.value,
  );

  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }

  try {
    const rows = await getReadinessRows({ fast: true });
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Readiness enrichment.",
      },
      { status: 500 },
    );
  }
}
