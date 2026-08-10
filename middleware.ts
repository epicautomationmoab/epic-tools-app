import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  const suppliedPreviewToken = request.cookies.get("epic_preview_access")?.value;
  const hasPreviewAccess = Boolean(previewToken && suppliedPreviewToken === previewToken);
  const hasEmployeeSession = Boolean(request.cookies.get("epic_access_token")?.value);
  const pathname = request.nextUrl.pathname;

  // During the preview rollout, keep the legacy preview gate available while also
  // allowing an individual EpicTools session to reach the team dashboard.
  if (pathname.startsWith("/team") && !hasPreviewAccess && !hasEmployeeSession) {
    const loginUrl = new URL("/employee-login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!pathname.startsWith("/team") && previewToken && !hasPreviewAccess) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
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
  ],
};
