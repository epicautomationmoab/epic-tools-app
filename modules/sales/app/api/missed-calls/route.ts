import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

async function rpc(accessToken: string, fn: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text || `Request failed (${response.status})`;
    try { const parsed = JSON.parse(text); message = parsed?.message || parsed?.error || message; } catch {}
    throw new Error(message);
  }
  return text ? JSON.parse(text) : null;
}

async function requireEmployee(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || !accessToken || profile.role === "workstation") return null;
  return { profile, accessToken };
}

export async function GET(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (!auth) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  try {
    const items = await rpc(auth.accessToken, "get_epic_sales_missed_calls", {});
    return NextResponse.json({ ok: true, items: Array.isArray(items) ? items : [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load missed calls." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireEmployee(request);
  if (!auth) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { work_item_id?: string; action?: string } | null;
  const id = body?.work_item_id?.trim();
  const action = body?.action?.trim();
  if (!id || !action) return NextResponse.json({ error: "Work item and action are required." }, { status: 400 });
  try {
    const result = await rpc(auth.accessToken, "epic_sales_missed_call_action", { p_work_item_id: id, p_action: action });
    return NextResponse.json(result || { ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update missed call." }, { status: 500 });
  }
}
