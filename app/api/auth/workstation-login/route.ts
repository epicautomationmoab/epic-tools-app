import { NextResponse } from "next/server";
import { WORKSTATION_COOKIE, verifyWorkstationPassword, workstationCookieValue } from "@/lib/server/workstation-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!verifyWorkstationPassword(password)) {
    return NextResponse.json({ error: "Incorrect workstation password." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(WORKSTATION_COOKIE, workstationCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return response;
}
