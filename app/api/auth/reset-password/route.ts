import { NextResponse } from "next/server";
import {
  getAuthUser,
  getTeamProfileByUserId,
  updatePasswordWithAccessToken,
} from "@/lib/team-auth";
import { setTeamProfilePin } from "@/lib/server/team-pin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  const confirmPin = typeof body?.confirm_pin === "string" ? body.confirm_pin.trim() : "";

  if (!accessToken || password.length < 8) {
    return NextResponse.json(
      { error: "A valid reset link and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return NextResponse.json(
      { error: "Employee PIN must be 4 to 6 digits." },
      { status: 400 },
    );
  }

  if (pin !== confirmPin) {
    return NextResponse.json({ error: "PINs do not match." }, { status: 400 });
  }

  try {
    const authUser = await getAuthUser(accessToken);
    if (!authUser?.id) throw new Error("This password reset session is no longer valid.");

    const profile = await getTeamProfileByUserId(authUser.id);
    if (!profile || !profile.active || profile.role === "workstation") {
      throw new Error("No active EpicTools employee profile is linked to this reset session.");
    }

    await setTeamProfilePin(profile.id, pin);
    await updatePasswordWithAccessToken(accessToken, password);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reset password and PIN." },
      { status: 400 },
    );
  }
}
