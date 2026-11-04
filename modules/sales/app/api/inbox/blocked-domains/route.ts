import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../../lib/team-auth";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

async function auth(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  return profile && accessToken && profile.role !== "workstation" ? { accessToken, profile } : null;
}

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

export async function GET(request: NextRequest) {
  const session = await auth(request);
  if (!session) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  try {
    const domains = await rpc(session.accessToken, "get_epic_sales_blocked_domains", {});
    return NextResponse.json({ ok: true, domains: domains || [], can_manage: session.profile.role === "admin" || session.profile.role === "manager" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load blocked domains." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth(request);
  if (!session) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  if (session.profile.role !== "admin" && session.profile.role !== "manager") return NextResponse.json({ error: "Manager or admin access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { domain?: string } | null;
  if (!body?.domain) return NextResponse.json({ error: "Domain is required." }, { status: 400 });
  try {
    const result = await rpc(session.accessToken, "epic_sales_add_blocked_domain", { p_domain: body.domain });
    return NextResponse.json(result || { ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to block domain." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth(request);
  if (!session) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  if (session.profile.role !== "admin" && session.profile.role !== "manager") return NextResponse.json({ error: "Manager or admin access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { domain?: string } | null;
  if (!body?.domain) return NextResponse.json({ error: "Domain is required." }, { status: 400 });
  try {
    const result = await rpc(session.accessToken, "epic_sales_remove_blocked_domain", { p_domain: body.domain });
    return NextResponse.json(result || { ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to unblock domain." }, { status: 500 });
  }
}
