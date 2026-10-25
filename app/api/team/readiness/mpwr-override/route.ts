import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.readiness_id === "string" ? body.readiness_id.trim() : "";
  const confirmation = typeof body?.confirmation_number === "string" ? body.confirmation_number.trim() : "";
  const waiverUrl = typeof body?.waiver_url === "string" ? body.waiver_url.trim() : "";
  let parsed: URL;
  try { parsed = new URL(waiverUrl); } catch { return NextResponse.json({ error: "Invalid waiver URL." }, { status: 400 }); }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
      !confirmation || confirmation.length > 120 || waiverUrl.length > 2000 ||
      parsed.protocol !== "https:" || parsed.username || parsed.password)
    return NextResponse.json({ error: "Invalid MPWR override." }, { status: 400 });
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) return NextResponse.json({ error: "Service configuration missing." }, { status: 503 });
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const res = await fetch(`${url}/rest/v1/rpc/manual_override_mpwr_information`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_readiness_id: id, p_mpwr_confirmation_number: confirmation, p_mpwr_waiver_url: waiverUrl }),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "MPWR service unavailable." }, { status: 502 });
  if (!res.ok) return NextResponse.json({ error: "Unable to save MPWR override." }, { status: res.status >= 500 ? 502 : 400 });
  return NextResponse.json({ ok: true });
}
