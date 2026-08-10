import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile, inviteTeamProfile, listTeamProfiles, sendTeamPasswordReset } from "@/lib/team-auth";

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

async function isAuthorizedAdmin(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (profile?.role === "admin") return true;
  return hasPreviewAccess(request);
}

export async function GET(request: NextRequest) {
  if (!await isAuthorizedAdmin(request)) {
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
  if (!await isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const action = body?.action === "reset_password" ? "reset_password" : "invite";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    if (action === "reset_password") {
      const redirectTo = `${request.nextUrl.origin}/auth/reset-password`;
      const result = await sendTeamPasswordReset(email, redirectTo);
      return NextResponse.json({ success: true, resetSent: true, profile: result.profile });
    }

    const redirectTo = `${request.nextUrl.origin}/auth/accept-invite`;
    const result = await inviteTeamProfile(email, redirectTo);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to manage employee authentication." },
      { status: 500 },
    );
  }
}
