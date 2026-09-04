import { NextResponse } from "next/server";
import {
  ambassadorCookieOptions,
  getAmbassadorProfileByEmail,
  getAmbassadorProfileByUserId,
  linkAmbassadorProfileUser,
  signInAmbassador,
} from "@/lib/ambassador-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

  try {
    const session = await signInAmbassador(email, password);
    let profile = await getAmbassadorProfileByUserId(session.user.id);

    if (!profile) {
      profile = await getAmbassadorProfileByEmail(email);
      if (!profile || !profile.active) throw new Error("This account is not authorized for Epic 4X4 Ambassador.");
      if (profile.user_id && profile.user_id !== session.user.id) throw new Error("This Ambassador profile is linked to a different account.");
      if (!profile.user_id) {
        await linkAmbassadorProfileUser(profile.id, session.user.id);
        profile = { ...profile, user_id: session.user.id };
      }
    }

    if (!profile.active) throw new Error("This Ambassador account is inactive.");

    const response = NextResponse.json({ success: true, profile: { display_name: profile.display_name, email: profile.email, role: profile.role } });
    response.cookies.set("epic_ambassador_access_token", session.access_token, ambassadorCookieOptions(session.expires_in ?? 3600));
    response.cookies.set("epic_ambassador_refresh_token", session.refresh_token, ambassadorCookieOptions(60 * 60 * 24 * 30));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sign in." }, { status: 401 });
  }
}
