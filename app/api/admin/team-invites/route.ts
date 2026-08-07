import { NextRequest, NextResponse } from "next/server";
import { inviteTeamProfile, listTeamProfiles } from "@/lib/team-auth";

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

export async function GET(request: NextRequest) {
  if (!hasPreviewAccess(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const profiles = await listTeamProfiles();
    return NextResponse.json({ profiles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load team profiles." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasPreviewAccess(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const redirectTo = `${request.nextUrl.origin}/auth/accept-invite`;
    const result = await inviteTeamProfile(email, redirectTo);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to invite employee." },
      { status: 500 },
    );
  }
}
