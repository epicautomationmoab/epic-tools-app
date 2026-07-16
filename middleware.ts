import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;

  if (!previewToken) {
    return NextResponse.next();
  }

  const suppliedToken = request.cookies.get("epic_preview_access")?.value;

  if (suppliedToken === previewToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/",
    "/team/:path*",
    "/kiosk/:path*",
    "/visit/:path*",
  ],
};
