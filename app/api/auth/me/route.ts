import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);

  if (!profile) {
    return NextResponse.json({ authenticated: false, profile: null });
  }

  return NextResponse.json({
    authenticated: true,
    profile: {
      id: profile.id,
      user_id: profile.user_id,
      display_name: profile.display_name,
      email: profile.email,
      role: profile.role,
      tripworks_user_id: profile.tripworks_user_id,
    },
  });
}
