import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const expired = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  response.cookies.set("epic_access_token", "", expired);
  response.cookies.set("epic_refresh_token", "", expired);
  response.cookies.set("epic_preview_access", "", expired);

  return response;
}
