import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function requireManager(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) return null;
  return profile;
}

export async function GET(request: NextRequest) {
  const profile = await requireManager(request);
  if (!profile) return NextResponse.json({ error: "Manager access required." }, { status: 403 });

  try {
    const partners = await rest<Array<Record<string, unknown>>>(
      `referral_partners?select=${encodeURIComponent("id,name,slug,contact_name,contact_email,status,reward_mode,reward_basis,partner_reward_cents,partner_reward_percent,guest_discount_cents,guest_discount_percent,promo_code,attribution_window_days,show_promo_popup,popup_heading,popup_body,created_at,updated_at")}&order=name.asc`,
    );
    return NextResponse.json({ ok: true, partners });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load referral partners." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await requireManager(request);
  if (!profile) return NextResponse.json({ error: "Manager access required." }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") : "";
  if (!name || !slug) return NextResponse.json({ error: "Partner name and referral code are required." }, { status: 400 });

  const rewardBasis = body?.reward_basis === "percent" ? "percent" : "flat";
  const payload = {
    name,
    slug,
    contact_name: typeof body?.contact_name === "string" ? body.contact_name.trim() || null : null,
    contact_email: typeof body?.contact_email === "string" ? body.contact_email.trim() || null : null,
    reward_mode: typeof body?.reward_mode === "string" ? body.reward_mode : "partner_reward",
    reward_basis: rewardBasis,
    partner_reward_cents: rewardBasis === "flat" && Number.isFinite(Number(body?.partner_reward_cents)) ? Math.max(0, Math.round(Number(body?.partner_reward_cents))) : 0,
    partner_reward_percent: rewardBasis === "percent" && Number.isFinite(Number(body?.partner_reward_percent)) ? Math.min(100, Math.max(0, Number(body?.partner_reward_percent))) : 0,
    guest_discount_cents: rewardBasis === "flat" && Number.isFinite(Number(body?.guest_discount_cents)) ? Math.max(0, Math.round(Number(body?.guest_discount_cents))) : 0,
    guest_discount_percent: rewardBasis === "percent" && Number.isFinite(Number(body?.guest_discount_percent)) ? Math.min(100, Math.max(0, Number(body?.guest_discount_percent))) : 0,
    promo_code: typeof body?.promo_code === "string" ? body.promo_code.trim() || null : null,
    attribution_window_days: Number.isFinite(Number(body?.attribution_window_days)) ? Math.min(365, Math.max(1, Math.round(Number(body?.attribution_window_days)))) : 30,
    show_promo_popup: Boolean(body?.show_promo_popup),
    popup_heading: typeof body?.popup_heading === "string" ? body.popup_heading.trim() || null : null,
    popup_body: typeof body?.popup_body === "string" ? body.popup_body.trim() || null : null,
  };

  try {
    const rows = await rest<Array<Record<string, unknown>>>("referral_partners", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ ok: true, partner: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create referral partner." }, { status: 500 });
  }
}
