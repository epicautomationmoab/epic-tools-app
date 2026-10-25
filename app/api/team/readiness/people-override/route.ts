import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

const operations = new Set(["get_readiness_people_override", "set_readiness_people_override", "clear_readiness_people_override"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const operation = typeof input?.operation === "string" ? input.operation : "";
  const id = typeof input?.readiness_id === "string" ? input.readiness_id.trim() : "";
  if (!operations.has(operation) || !uuid.test(id)) return NextResponse.json({ error: "Invalid override request." }, { status: 400 });
  const body: Record<string, string | number> = { p_readiness_id: id };
  if (operation === "set_readiness_people_override") {
    const count = input?.people_count;
    const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
    if (!Number.isInteger(count) || count < 1 || count > 100 || !reason || reason.length > 2000) {
      return NextResponse.json({ error: "Invalid people override values." }, { status: 400 });
    }
    body.p_people_count = count;
    body.p_reason = reason;
    body.p_updated_by = profile.display_name;
  }
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) return NextResponse.json({ error: "Service configuration missing." }, { status: 503 });
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const response = await fetch(`${url}/rest/v1/rpc/${operation}`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store",
  }).catch(() => null);
  if (!response) return NextResponse.json({ error: "Override service unavailable." }, { status: 502 });
  if (!response.ok) return NextResponse.json({ error: "Unable to update people override." }, { status: response.status >= 500 ? 502 : 400 });
  return NextResponse.json(await response.json().catch(() => null));
}
