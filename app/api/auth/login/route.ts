import { NextResponse } from "next/server";
import {
  authCookieOptions,
  getTeamProfileByEmail,
  getTeamProfileByUserId,
  linkTeamProfileUser,
  signInWithPassword,
} from "@/lib/team-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const session = await signInWithPassword(email, password);
    let profile = await getTeamProfileByUserId(session.user.id);

    if (!profile) {
      profile = await getTeamProfileByEmail(email);
      if (!profile || !profile.active) throw new Error("This account is not authorized for EpicTools.");
      if (profile.user_id && profile.user_id !== session.user.id) {
        throw new Error("This EpicTools profile is linked to a different Auth account.");
      }
      if (!profile.user_id) {
        await linkTeamProfileUser(profile.id, session.user.id);
        profile = { ...profile, user_id: session.user.id };
      }
    }

    if (!profile.active) throw new Error("This EpicTools employee account is inactive.");

    const response = NextResponse.json({
      success: true,
      profile: {
        display_name: profile.display_name,
        email: profile.email,
        role: profile.role,
        tripworks_user_id: profile.tripworks_user_id,
      },
    });
    response.cookies.set("epic_access_token", session.access_token, authCookieOptions(session.expires_in ?? 60 * 60));
    response.cookies.set("epic_refresh_token", session.refresh_token, authCookieOptions(60 * 60 * 24 * 30));
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sign in." },
      { status: 401 },
    );
  }
}
