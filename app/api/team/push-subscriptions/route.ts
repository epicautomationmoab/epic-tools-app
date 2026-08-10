import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";
import { webPushConfigured } from "@/lib/server/web-push";

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({
    configured: webPushConfigured(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null,
  });
}

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (profile.role === "workstation") {
    return NextResponse.json(
      { error: "Shared workstations do not subscribe to salesperson push notifications." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null) as { endpoint?: string; subscription?: unknown } | null;
  const endpoint = body?.endpoint?.trim();
  if (!endpoint || !body?.subscription) {
    return NextResponse.json({ error: "Push subscription is required." }, { status: 400 });
  }

  try {
    const { url } = getServerSupabaseConfig();
    const now = new Date().toISOString();
    const response = await fetch(
      `${url}/rest/v1/epic_push_subscriptions?on_conflict=endpoint`,
      {
        method: "POST",
        headers: serverSupabaseHeaders("resolution=merge-duplicates,return=minimal"),
        body: JSON.stringify({
          team_profile_id: profile.id,
          endpoint,
          subscription: body.subscription,
          active: true,
          last_error: null,
          updated_at: now,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: `Unable to save push subscription: ${detail || response.statusText}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save push subscription." },
      { status: 500 },
    );
  }
}
