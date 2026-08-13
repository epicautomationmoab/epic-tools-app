import { NextResponse } from "next/server";
import {
  authCookieOptions,
  getTeamProfileByEmail,
  getTeamProfileByUserId,
  linkTeamProfileUser,
  updatePasswordWithAccessToken,
} from "@/lib/team-auth";
import { setTeamProfilePin } from "@/lib/server/team-pin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  const confirmPin = typeof body?.confirm_pin === "string" ? body.confirm_pin.trim() : "";

  if (!accessToken || !refreshToken || password.length < 8) {
    return NextResponse.json(
      { error: "A valid invitation and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 4 to 6 digits." }, { status: 400 });
  }
  if (pin !== confirmPin) {
    return NextResponse.json({ error: "PINs do not match." }, { status: 400 });
  }

  try {
    const user = await updatePasswordWithAccessToken(accessToken, password);
    const email = user.email?.trim();
    if (!email) throw new Error("Supabase did not return an email for this account.");

    let profile = await getTeamProfileByUserId(user.id);
    if (!profile) {
      profile = await getTeamProfileByEmail(email);
      if (!profile || !profile.active) throw new Error("This email is not an active EpicTools employee account.");
      if (profile.user_id && profile.user_id !== user.id) {
        throw new Error("This EpicTools profile is already linked to a different Auth account.");
      }
      if (!profile.user_id) {
        await linkTeamProfileUser(profile.id, user.id);
        profile = { ...profile, user_id: user.id };
      }
    }

    if (!profile.active) throw new Error("This EpicTools employee account is inactive.");
    if (profile.role === "workstation") throw new Error("Shared workstation profiles are not invited as employees.");

    await setTeamProfilePin(profile.id, pin);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email },
      profile: { display_name: profile.display_name, role: profile.role },
    });
    response.cookies.set("epic_access_token", accessToken, authCookieOptions(60 * 60));
    response.cookies.set("epic_refresh_token", refreshToken, authCookieOptions(60 * 60 * 24 * 30));
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to activate EpicTools account." },
      { status: 400 },
    );
  }
}
