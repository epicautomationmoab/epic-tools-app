import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  const suppliedToken = request.cookies.get("epic_preview_access")?.value;

  if (previewToken && suppliedToken !== previewToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const hostname = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  if (hostname === "team.myepicreservation.com" && request.nextUrl.pathname === "/") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/team/readiness";
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/team/:path*",
    "/kiosk/:path*",
    "/visit/:path*",
  ],
};
