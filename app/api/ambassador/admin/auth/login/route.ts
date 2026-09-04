import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, getAuthenticatedTeamProfile, signInWithPassword } from "@/lib/team-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() || "";
  const password = body?.password || "";
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

  try {
    const session = await signInWithPassword(email, password);
    const profile = await getAuthenticatedTeamProfile(session.access_token);
    if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
      return NextResponse.json({ error: "Ambassador administration requires an Epic admin or manager account." }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true, profile: { display_name: profile.display_name, role: profile.role } });
    response.cookies.set("epic_ambassador_admin_access_token", session.access_token, authCookieOptions(session.expires_in || 3600));
    if (session.refresh_token) response.cookies.set("epic_ambassador_admin_refresh_token", session.refresh_token, authCookieOptions(60 * 60 * 24 * 30));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sign in." }, { status: 401 });
  }
}
