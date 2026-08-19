import { NextRequest, NextResponse } from "next/server";
import { createTeamProfile, getAuthenticatedTeamProfile } from "@/lib/team-auth";

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

async function isAuthorizedManager(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (profile?.role === "admin" || profile?.role === "manager") return true;
  return hasPreviewAccess(request);
}

export async function POST(request: NextRequest) {
  if (!await isAuthorizedManager(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  try {
    const profile = await createTeamProfile({
      display_name: typeof body?.display_name === "string" ? body.display_name : "",
      email: typeof body?.email === "string" ? body.email : "",
      role: body?.role,
      tripworks_user_id: body?.tripworks_user_id,
      tripworks_full_name: typeof body?.tripworks_full_name === "string" ? body.tripworks_full_name : "",
    });
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add employee." },
      { status: 400 },
    );
  }
}
