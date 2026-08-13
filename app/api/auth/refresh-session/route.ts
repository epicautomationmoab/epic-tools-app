import { NextRequest, NextResponse } from "next/server";
import {
  authCookieOptions,
  getAuthenticatedTeamProfile,
  refreshSessionWithRefreshToken,
} from "@/lib/team-auth";

const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("epic_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ refreshed: false }, { status: 401 });
  }

  try {
    const session = await refreshSessionWithRefreshToken(refreshToken);
    const profile = await getAuthenticatedTeamProfile(session.access_token);

    if (!profile) {
      return NextResponse.json({ refreshed: false }, { status: 401 });
    }

    const response = NextResponse.json({ refreshed: true });
    response.cookies.set(
      "epic_access_token",
      session.access_token,
      authCookieOptions(session.expires_in ?? 60 * 60),
    );
    response.cookies.set(
      "epic_refresh_token",
      session.refresh_token,
      authCookieOptions(REFRESH_COOKIE_MAX_AGE),
    );
    return response;
  } catch {
    return NextResponse.json({ refreshed: false }, { status: 401 });
  }
}
