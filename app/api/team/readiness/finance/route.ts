import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

// Readiness finance UI's three allowed operations. All inputs are checked on
// the server; actor attribution is taken from an authenticated employee session.
const allowed = new Set([
  "ensure_rental_damage_deposit",
  "get_rental_damage_deposit",
  "set_rental_damage_deposit_basis",
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bases = new Set(["standard", "premier_international", "none"]);

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }
  const input = await request.json().catch(() => null);
  const operation = typeof input?.operation === "string" ? input.operation : "";
  const readinessId = typeof input?.readiness_id === "string" ? input.readiness_id.trim() : "";
  if (!allowed.has(operation) || !uuidPattern.test(readinessId)) {
    return NextResponse.json({ error: "Invalid finance request." }, { status: 400 });
  }
  const payload: Record<string, string> = { p_readiness_id: readinessId };
  if (operation === "set_rental_damage_deposit_basis") {
    if (!bases.has(input?.basis)) return NextResponse.json({ error: "Invalid deposit basis." }, { status: 400 });
    payload.p_basis = input.basis;
  }
  if (operation !== "get_rental_damage_deposit") payload.p_updated_by = profile.display_name;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return NextResponse.json({ error: "Finance service not configured." }, { status: 503 });
  const response = await fetch(`${url}/rest/v1/rpc/${operation}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).catch(() => null);
  if (!response) return NextResponse.json({ error: "Finance service unavailable." }, { status: 502 });
  if (!response.ok) return NextResponse.json({ error: "Finance operation unsuccessful." }, { status: response.status >= 500 ? 502 : 400 });
  return NextResponse.json(await response.json().catch(() => null));
}
