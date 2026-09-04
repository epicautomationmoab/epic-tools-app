import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}
async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}
async function requireManager(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  return profile && (profile.role === "admin" || profile.role === "manager") ? profile : null;
}

export async function GET(request: NextRequest) {
  if (!await requireManager(request)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  try {
    const rows = await rest<any[]>(`referral_redemptions?select=${encodeURIComponent("id,partner_id,amount_cents,method,method_details,status,requested_at,approved_at,sent_at,completed_at,rejected_at,cancelled_at,provider,provider_reference,internal_notes")}&order=requested_at.desc&limit=200`);
    const partnerIds = [...new Set(rows.map((r) => r.partner_id).filter(Boolean))];
    const partners = partnerIds.length ? await rest<any[]>(`referral_partners?id=in.(${partnerIds.join(",")})&select=id,name,slug`) : [];
    const partnerMap = new Map(partners.map((p) => [p.id, p]));
    return NextResponse.json({ ok: true, redemptions: rows.map((r) => ({ ...r, partner: partnerMap.get(r.partner_id) || null })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load redemption requests." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  if (!await requireManager(request)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";
  if (!id || !["approved","sent","completed","rejected","cancelled"].includes(status)) return NextResponse.json({ error: "Valid redemption and status are required." }, { status: 400 });
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now };
  if (status === "approved") patch.approved_at = now;
  if (status === "sent") patch.sent_at = now;
  if (status === "completed") patch.completed_at = now;
  if (status === "rejected") patch.rejected_at = now;
  if (status === "cancelled") patch.cancelled_at = now;
  if (typeof body?.provider === "string") patch.provider = body.provider.trim() || null;
  if (typeof body?.provider_reference === "string") patch.provider_reference = body.provider_reference.trim() || null;
  if (typeof body?.internal_notes === "string") patch.internal_notes = body.internal_notes.trim() || null;
  try {
    await rest<void>(`referral_redemptions?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update redemption request." }, { status: 500 }); }
}
