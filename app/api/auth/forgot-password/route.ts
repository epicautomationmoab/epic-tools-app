import { NextResponse } from "next/server";
import { sendTeamPasswordReset } from "@/lib/team-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const redirectTo = `${new URL(request.url).origin}/auth/reset-password`;
    await sendTeamPasswordReset(email, redirectTo);
  } catch {
    // Do not reveal whether an address exists or is activated.
  }

  return NextResponse.json({
    success: true,
    message: "If that email belongs to an active EpicTools employee account, a password reset link has been sent.",
  });
}
