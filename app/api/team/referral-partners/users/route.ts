import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}
async function requireManager(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) return null;
  return profile;
}
async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

export async function GET(request: NextRequest) {
  const manager = await requireManager(request);
  if (!manager) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  const partnerId = request.nextUrl.searchParams.get("partner_id")?.trim() || "";
  try {
    const path = partnerId ? `referral_partner_profiles?partner_id=eq.${encodeURIComponent(partnerId)}&select=id,partner_id,user_id,display_name,email,role,active,invited_at,last_login_at,updated_at&order=display_name.asc` : `referral_partner_profiles?select=id,partner_id,user_id,display_name,email,role,active,invited_at,last_login_at,updated_at&order=display_name.asc`;
    const users = await rest<Array<Record<string, unknown>>>(path);
    return NextResponse.json({ ok: true, users });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Ambassador users." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const manager = await requireManager(request);
  if (!manager) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const partnerId = typeof body?.partner_id === "string" ? body.partner_id.trim() : "";
  const displayName = typeof body?.display_name === "string" ? body.display_name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role === "owner" || body?.role === "viewer" ? body.role : "manager";
  if (!partnerId || !displayName || !email.includes("@")) return NextResponse.json({ error: "Partner, name, and a valid email are required." }, { status: 400 });
  try {
    const partner = await rest<Array<{ id: string; name: string }>>(`referral_partners?id=eq.${encodeURIComponent(partnerId)}&select=id,name&limit=1`);
    if (!partner[0]) return NextResponse.json({ error: "Referral partner not found." }, { status: 404 });
    const existing = await rest<Array<{ id: string; active: boolean }>>(`referral_partner_profiles?partner_id=eq.${encodeURIComponent(partnerId)}&email=ilike.${encodeURIComponent(email)}&select=id,active&limit=1`);
    if (existing[0]) return NextResponse.json({ error: existing[0].active ? "That email already has access to this partner." : "That email already exists for this partner but is revoked. Reactivate it instead of sending a new invite." }, { status: 409 });
    const profileRows = await rest<Array<{ id: string }>>("referral_partner_profiles", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ partner_id: partnerId, display_name: displayName, email, role, active: true, invited_at: new Date().toISOString() }) });
    const { url, key } = getSupabaseConfig();
    const redirectTo = "https://www.epic4x4ambassador.com/ambassador/setup";
    const inviteResponse = await fetch(`${url}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, data: { account_type: "ambassador", display_name: displayName, ambassador_profile_id: profileRows[0].id, partner_id: partnerId, partner_name: partner[0].name, role } }), cache: "no-store" });
    const invitePayload = await inviteResponse.json().catch(() => ({}));
    if (!inviteResponse.ok) { await rest<void>(`referral_partner_profiles?id=eq.${encodeURIComponent(profileRows[0].id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); throw new Error(invitePayload?.msg || invitePayload?.message || invitePayload?.error_description || "Unable to send Ambassador invitation."); }
    return NextResponse.json({ ok: true, invited: { display_name: displayName, email, role, partner_name: partner[0].name } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to invite Ambassador user." }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  const manager = await requireManager(request);
  if (!manager) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const profileId = typeof body?.profile_id === "string" ? body.profile_id.trim() : "";
  const active = typeof body?.active === "boolean" ? body.active : null;
  if (!profileId || active === null) return NextResponse.json({ error: "Profile and access status are required." }, { status: 400 });
  try {
    const rows = await rest<Array<Record<string, unknown>>>(`referral_partner_profiles?id=eq.${encodeURIComponent(profileId)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ active, updated_at: new Date().toISOString() }) });
    if (!rows[0]) return NextResponse.json({ error: "Ambassador portal user not found." }, { status: 404 });
    return NextResponse.json({ ok: true, user: rows[0] });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update Ambassador access." }, { status: 500 }); }
}
