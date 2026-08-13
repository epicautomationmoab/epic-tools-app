import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { identifyTeamProfileByPin } from "@/lib/server/team-pin";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

async function canUseActionPin(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  return Boolean(profile || workstation || hasPreviewAccess(request));
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
