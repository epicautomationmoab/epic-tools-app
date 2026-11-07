import { NextResponse } from "next/server";
import { authCookieOptions, getAuthenticatedTeamProfile, signInWithPassword } from "../../../../lib/team-auth";

function secondsToMidnight() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const n = (type: string) => Number(parts.find(p => p.type === type)?.value || 0);
  return Math.max(1, 86400 - n("hour") * 3600 - n("minute") * 60 - n("second"));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

  try {
    const session = await signInWithPassword(email, password);
    const profile = await getAuthenticatedTeamProfile(session.access_token);
    if (!profile || !profile.active) throw new Error("This account is not authorized for Epic Sales.");

    const response = NextResponse.json({ success: true, profile: { display_name: profile.display_name, email: profile.email, role: profile.role } });
    const midnight = secondsToMidnight();
    response.cookies.set("epic_access_token", session.access_token, authCookieOptions(Math.min(midnight, session.expires_in ?? 60 * 60)));
    response.cookies.set("epic_refresh_token", session.refresh_token, authCookieOptions(midnight));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sign in." }, { status: 401 });
  }
}
