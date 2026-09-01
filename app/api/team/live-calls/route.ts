import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

async function requireEmployee(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return null;
  return profile;
}

export async function GET(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  try {
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const calls = await rest<Array<Record<string, unknown>>>(
      `live_calls?received_at=gte.${encodeURIComponent(since)}&select=${encodeURIComponent("id,callrail_call_id,caller_phone,caller_name,tracking_phone,source_name,campaign,received_at,route_kind,opportunity_id,reservation_id,contact_id,confirmation_code,route_label")}&order=received_at.desc&limit=20`,
    );
    if (!calls.length) return NextResponse.json({ ok: true, call: null });

    const ids = calls.map((call) => `"${String(call.id)}"`).join(",");
    const seen = await rest<Array<{ live_call_id: string }>>(
      `live_call_seen?profile_id=eq.${encodeURIComponent(profile.id)}&live_call_id=in.(${ids})&select=live_call_id`,
    );
    const seenIds = new Set(seen.map((row) => row.live_call_id));
    const call = calls.find((row) => !seenIds.has(String(row.id))) || null;
    return NextResponse.json({ ok: true, call });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load live calls." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { live_call_id?: string } | null;
  const liveCallId = body?.live_call_id?.trim();
  if (!liveCallId) return NextResponse.json({ error: "Live call is required." }, { status: 400 });

  try {
    await rest<void>("live_call_seen?on_conflict=live_call_id,profile_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ live_call_id: liveCallId, profile_id: profile.id, seen_at: new Date().toISOString() }),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to mark live call seen." }, { status: 500 });
  }
}
