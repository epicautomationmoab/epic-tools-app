import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { setTeamProfilePin, teamProfileHasPin } from "@/lib/server/team-pin";

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (profile.role === "workstation") {
    return NextResponse.json({ error: "Shared workstation profiles do not use employee PINs." }, { status: 409 });
  }

  return NextResponse.json({
    hasPin: await teamProfileHasPin(profile.id),
    profile: {
      id: profile.id,
      display_name: profile.display_name,
      email: profile.email,
      role: profile.role,
    },
  });
}

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (profile.role === "workstation") {
    return NextResponse.json({ error: "Shared workstation profiles cannot set employee PINs." }, { status: 409 });
  }

  const body = await request.json().catch(() => null) as { pin?: string; confirmPin?: string } | null;
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  const confirmPin = typeof body?.confirmPin === "string" ? body.confirmPin.trim() : "";

  if (!pin || !confirmPin) {
    return NextResponse.json({ error: "PIN and confirmation are required." }, { status: 400 });
  }
  if (pin !== confirmPin) {
    return NextResponse.json({ error: "PINs do not match." }, { status: 400 });
  }

  try {
    const result = await setTeamProfilePin(profile.id, pin);
    return NextResponse.json({ ok: true, pinSetAt: result.pinSetAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save PIN." },
      { status: 400 },
    );
  }
}
