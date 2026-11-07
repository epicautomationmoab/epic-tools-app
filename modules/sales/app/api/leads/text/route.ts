import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../../lib/team-auth";

const EPIC_TOOLS_BASE_URL = (process.env.EPIC_TOOLS_BASE_URL || (process.env.EPIC_UNIFIED_INTERNAL_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""))).replace(/\/+$/, "");

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || !accessToken || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { opportunity_id?: string; message_text?: string } | null;
  const opportunityId = body?.opportunity_id?.trim();
  const messageText = body?.message_text?.trim() || "";
  if (!opportunityId) return NextResponse.json({ error: "Lead is required." }, { status: 400 });
  if (!messageText) return NextResponse.json({ error: "Message cannot be blank." }, { status: 400 });
  if (messageText.length > 1600) return NextResponse.json({ error: "Message is too long. Keep it under 1,600 characters." }, { status: 400 });

  try {
    const response = await fetch(`${EPIC_TOOLS_BASE_URL}/api/team/sales-text`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ opportunity_id: opportunityId, message_text: messageText }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: payload?.error || "Unable to send text." }, { status: response.status });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send text." }, { status: 500 });
  }
}
