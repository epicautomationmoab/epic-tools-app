import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAmbassadorAdmin } from "@/lib/ambassador-admin-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
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

async function requireAdmin(request: NextRequest) {
  return getAuthenticatedAmbassadorAdmin(request.cookies.get("epic_ambassador_admin_access_token")?.value);
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Ambassador admin login required." }, { status: 401 });

  try {
    const [partners, bookings, adjustments, redemptions] = await Promise.all([
      rest<any[]>(`referral_partners?select=id,name,slug,status,reward_mode,reward_basis,partner_reward_cents,partner_reward_percent,guest_discount_cents,guest_discount_percent&order=name.asc`),
      rest<any[]>(`referral_bookings?select=id,partner_id,partner_reward_cents,reward_status,confirmation_code,customer_name,experience_name,activity_start_at,booking_status&order=activity_start_at.desc.nullslast&limit=5000`),
      rest<any[]>(`referral_reward_adjustments?select=id,partner_id,amount_cents,adjustment_type,reason,reference,created_by_name,created_by_email,created_at&order=created_at.desc&limit=5000`),
      rest<any[]>(`referral_redemptions?select=id,partner_id,amount_cents,status&limit=5000`),
    ]);

    const payload = partners.map((partner) => {
      const pb = bookings.filter((row) => row.partner_id === partner.id);
      const pa = adjustments.filter((row) => row.partner_id === partner.id);
      const pr = redemptions.filter((row) => row.partner_id === partner.id);
      const bookingEarned = pb.filter((row) => ["earned","sent","redeemed"].includes(String(row.reward_status))).reduce((sum, row) => sum + Math.max(0, Number(row.partner_reward_cents) || 0), 0);
      const adjustmentTotal = pa.reduce((sum, row) => sum + (Number(row.amount_cents) || 0), 0);
      const committed = pr.filter((row) => !["rejected","cancelled"].includes(String(row.status))).reduce((sum, row) => sum + Math.max(0, Number(row.amount_cents) || 0), 0);
      return {
        ...partner,
        earned_cents: bookingEarned + adjustmentTotal,
        adjustment_total_cents: adjustmentTotal,
        committed_cents: committed,
        available_cents: Math.max(0, bookingEarned + adjustmentTotal - committed),
        adjustments: pa.slice(0, 20),
        recent_bookings: pb.slice(0, 20),
      };
    });

    return NextResponse.json({ ok: true, admin: { display_name: admin.display_name, role: admin.role }, partners: payload });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Ambassador administration." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Ambassador admin login required." }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const partnerId = typeof body?.partner_id === "string" ? body.partner_id : "";
  const amountCents = Math.round(Number(body?.amount_cents));
  const adjustmentType = ["manual","legacy_getambassador","correction"].includes(String(body?.adjustment_type)) ? String(body?.adjustment_type) : "manual";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  if (!partnerId || !Number.isFinite(amountCents) || amountCents === 0 || !reason) {
    return NextResponse.json({ error: "Partner, non-zero amount, and reason are required." }, { status: 400 });
  }

  try {
    const partner = await rest<any[]>(`referral_partners?id=eq.${encodeURIComponent(partnerId)}&select=id,name&limit=1`);
    if (!partner[0]) return NextResponse.json({ error: "Ambassador not found." }, { status: 404 });
    const rows = await rest<any[]>("referral_reward_adjustments", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        partner_id: partnerId,
        amount_cents: amountCents,
        adjustment_type: adjustmentType,
        reason,
        reference: reference || null,
        created_by_team_profile_id: admin.id,
        created_by_name: admin.display_name,
        created_by_email: admin.email,
        metadata: { source: "ambassador_admin" },
      }),
    });
    return NextResponse.json({ ok: true, adjustment: rows[0], partner: { id: partner[0].id, name: partner[0].name } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save reward adjustment." }, { status: 500 });
  }
}
