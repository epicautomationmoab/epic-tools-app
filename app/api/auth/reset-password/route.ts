import { NextResponse } from "next/server";
import { updatePasswordWithAccessToken } from "@/lib/team-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!accessToken || password.length < 8) {
    return NextResponse.json(
      { error: "A valid reset link and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }

  try {
    await updatePasswordWithAccessToken(accessToken, password);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reset password." },
      { status: 400 },
    );
  }
}
