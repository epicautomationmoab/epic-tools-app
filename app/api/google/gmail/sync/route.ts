import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { syncHelloInbox } from "@/lib/server/gmail-inbound";

async function authorized(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  return profile && profile.role !== "workstation" ? profile : null;
}

export async function POST(request: NextRequest) {
  const profile = await authorized(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  try {
    const result = await syncHelloInbox();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sync Hello Gmail." }, { status: 500 });
  }
}
