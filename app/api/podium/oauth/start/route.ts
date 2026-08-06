import { NextRequest, NextResponse } from "next/server";
import { createPodiumAuthorizationUrl, podiumEnvironmentConfigured } from "@/lib/server/podium";

function isAuthorized(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  return Boolean(previewToken && request.cookies.get("epic_preview_access")?.value === previewToken);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.redirect(new URL("/login", request.url));
  if (!podiumEnvironmentConfigured()) {
    return NextResponse.json({ error: "Podium environment variables are incomplete." }, { status: 500 });
  }
  return NextResponse.redirect(createPodiumAuthorizationUrl());
}
