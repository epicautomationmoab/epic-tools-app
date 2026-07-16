import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const expectedPassword = process.env.EPIC_PREVIEW_PASSWORD;
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;

  if (!expectedPassword || !previewToken) {
    return NextResponse.json(
      { error: "Preview access is not configured." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (password !== expectedPassword) {
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set("epic_preview_access", previewToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
