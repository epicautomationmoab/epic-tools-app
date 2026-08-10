import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";
import { webPushConfigured } from "@/lib/server/web-push";

type StoredSubscription = { id: string; endpoint: string };

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
  if (profile.role === "workstation") return NextResponse.json({ error: "Shared workstations do not subscribe to salesperson push notifications." }, { status: 409 });

  const body = await request.json().catch(() => null) as { endpoint?: string; subscription?: unknown } | null;
  const endpoint = body?.endpoint?.trim();
  if (!endpoint || !body?.subscription) return NextResponse.json({ error: "Push subscription is required." }, { status: 400 });

  const existing = await supabaseSelect<StoredSubscription>(
    "epic_push_subscriptions",
    new URLSearchParams({ select: "id,endpoint", endpoint: `eq.${endpoint}`, limit: "1" }),
  );

  const now = new Date().toISOString();
  if (existing[0]) {
    await supabasePatch(
      "epic_push_subscriptions",
      new URLSearchParams({ id: `eq.${existing[0].id}` }),
      { team_profile_id: profile.id, subscription: body.subscription, active: true, last_error: null, updated_at: now },
    );
  } else {
    const { getServerSupabaseConfig, serverSupabaseHeaders } = await import("@/lib/server/supabase-rest");
    const { url } = getServerSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/epic_push_subscriptions`, {
      method: "POST",
      headers: serverSupabaseHeaders(),
      body: JSON.stringify({ team_profile_id: profile.id, endpoint, subscription: body.subscription, active: true, created_at: now, updated_at: now }),
    });
    if (!response.ok) return NextResponse.json({ error: `Unable to save push subscription: ${await response.text()}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
