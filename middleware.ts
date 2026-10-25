import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Preview deployments share some database settings with production. Until
  // isolated staging credentials are verified, disallow all API mutations.
  if (process.env.VERCEL_ENV === "preview" &&
      request.nextUrl.pathname.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    return NextResponse.json({ error: "Preview API writes are disabled until staging is isolated." }, { status: 403 });
  }

  const hasEmployeeSession = Boolean(request.cookies.get("epic_access_token")?.value);
  const pathname = request.nextUrl.pathname;

  // Arrival Board is a guest-facing lobby display, not an employee work area.
  const guestArrivalBoard = pathname === "/team/arrival-board" || pathname.startsWith("/team/arrival-board/");
  if (pathname.startsWith("/team") && !guestArrivalBoard && !hasEmployeeSession) {
    const loginUrl = new URL("/employee-login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Kiosk and guest visit pages are guest-facing production surfaces and do not
  // depend on the temporary EpicTools preview password.
  if (pathname.startsWith("/kiosk") || pathname.startsWith("/visit")) {
    return NextResponse.next();
  }

  const hostname = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  if (hostname === "team.myepicreservation.com" && pathname === "/") {
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
    "/api/:path*",
  ],
};
