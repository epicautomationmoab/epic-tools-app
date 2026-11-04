import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../../lib/team-auth";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

async function rpc(accessToken: string, fn: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Request failed (${response.status})`);
  return text ? JSON.parse(text) : null;
}

async function auth(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  return profile && accessToken && profile.role !== "workstation" ? accessToken : null;
}

export async function GET(request: NextRequest) {
  const accessToken = await auth(request);
  if (!accessToken) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  try {
    const activity = await rpc(accessToken, "get_epic_sales_activity", {});
    return NextResponse.json({ ok: true, activity: activity || {} });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load activity." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const accessToken = await auth(request);
  if (!accessToken) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { opportunity_id?: string } | null;
  if (!body?.opportunity_id) return NextResponse.json({ error: "Lead is required." }, { status: 400 });
  try {
    const result = await rpc(accessToken, "epic_sales_mark_activity_seen", { p_opportunity_id: body.opportunity_id });
    return NextResponse.json(result || { ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to mark activity seen." }, { status: 500 });
  }
}
