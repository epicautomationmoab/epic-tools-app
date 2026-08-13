import { NextRequest, NextResponse } from "next/server";
import { exchangePodiumAuthorizationCode, validatePodiumOAuthState } from "@/lib/server/podium";

export async function GET(request: NextRequest) {
  const dashboard = new URL("/team/readiness", request.nextUrl.origin);
  try {
    const error = request.nextUrl.searchParams.get("error");
    if (error) throw new Error(request.nextUrl.searchParams.get("error_description") || error);
    const code = request.nextUrl.searchParams.get("code")?.trim();
    const state = request.nextUrl.searchParams.get("state")?.trim();
    if (!code || !state) throw new Error("Podium did not return a complete authorization response.");
    validatePodiumOAuthState(state);
    await exchangePodiumAuthorizationCode(code);
    dashboard.searchParams.set("podium", "connected");
  } catch (error) {
    dashboard.searchParams.set("podium", "error");
    dashboard.searchParams.set("message", error instanceof Error ? error.message : "Podium connection failed.");
  }
  return NextResponse.redirect(dashboard);
}
