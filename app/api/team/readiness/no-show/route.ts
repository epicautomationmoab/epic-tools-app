import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.readiness_id === "string" ? body.readiness_id.trim() : "";
  const noShow = body?.is_no_show;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || typeof noShow !== "boolean")
    return NextResponse.json({ error: "Invalid no-show request." }, { status: 400 });
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const fn = noShow ? "set_readiness_no_show" : "clear_readiness_no_show";
  const payload = noShow ? { p_readiness_id: id, p_marked_by: profile.display_name } : { p_readiness_id: id };
  const result = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => null);
  if (!result) return NextResponse.json({ error: "No-show service unavailable." }, { status: 502 });
  if (!result.ok) return NextResponse.json({ error: "No-show update failed." }, { status: result.status >= 500 ? 502 : 400 });
  return NextResponse.json({ ok: true });
}
