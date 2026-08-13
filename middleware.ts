import { NextRequest, NextResponse } from "next/server";

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function middleware(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  const suppliedPreviewToken = request.cookies.get("epic_preview_access")?.value;
  const hasPreviewAccess = Boolean(previewToken && suppliedPreviewToken === previewToken);
  const hasEmployeeSession = Boolean(request.cookies.get("epic_access_token")?.value);
  const workstationPassword = process.env.EPIC_HQ_RECEPTION_PASSWORD?.trim();
  const workstationCookie = request.cookies.get("epic_workstation_access")?.value;
  const hasWorkstationAccess = Boolean(
    workstationPassword && workstationCookie && workstationCookie === await sha256Hex(workstationPassword),
  );
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/team") && !hasPreviewAccess && !hasEmployeeSession && !hasWorkstationAccess) {
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
  ],
};
