import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { identifyTeamProfileByPin } from "@/lib/server/team-pin";

async function canUseActionPin(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  return Boolean(profile && profile.role !== "workstation");
}

export async function POST(request: NextRequest) {
  if (!await canUseActionPin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { pin?: string } | null;
  const pin = body?.pin?.trim() || "";

  if (!pin) {
    return NextResponse.json({ error: "PIN is required." }, { status: 400 });
  }

  try {
    const verified = await identifyTeamProfileByPin(pin);
    if (!verified) return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });

    return NextResponse.json({
      ok: true,
      profile: {
        id: verified.id,
        display_name: verified.display_name,
        role: verified.role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to verify PIN." },
      { status: 500 },
    );
  }
}
