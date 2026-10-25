import { NextRequest, NextResponse } from "next/server";
import { createPodiumAuthorizationUrl, podiumEnvironmentConfigured } from "@/lib/server/podium";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

async function isAuthorized(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  return profile?.role === "admin" || profile?.role === "manager";
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) return NextResponse.redirect(new URL("/login", request.url));
  if (!podiumEnvironmentConfigured()) {
    return NextResponse.json({ error: "Podium environment variables are incomplete." }, { status: 500 });
  }
  return NextResponse.redirect(createPodiumAuthorizationUrl());
}
