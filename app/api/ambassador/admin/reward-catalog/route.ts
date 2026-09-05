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

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sanitize(body: Record<string, unknown>, existing?: Record<string, any> | null) {
  const amountType = body.amount_type === "custom" ? "custom" : "fixed";
  const allowed = Array.isArray(body.allowed_amounts_cents)
    ? body.allowed_amounts_cents.map(Number).filter((v) => Number.isFinite(v) && v > 0).map(Math.round)
    : [];
  const displayName = String(body.display_name || "").trim();
  const imageUrl = String(body.image_url || "").trim();
  return {
    slug: existing?.slug || slugify(displayName),
    category: String(body.category || "").trim(),
    display_name: displayName,
    image_status: imageUrl ? "ready" : "placeholder",
    image_url: imageUrl || null,
    redemption_type: existing?.redemption_type || "gift_card",
    amount_type: amountType,
    allowed_amounts_cents: amountType === "fixed" ? allowed : [],
    min_amount_cents: Math.max(1, Math.round(Number(body.min_amount_cents) || 1000)),
    max_amount_cents: Number.isFinite(Number(body.max_amount_cents)) && Number(body.max_amount_cents) > 0 ? Math.round(Number(body.max_amount_cents)) : null,
    fee_cents: Math.max(0, Math.round(Number(body.fee_cents) || 0)),
    fee_note: String(body.fee_note || "").trim() || null,
    active: body.active !== false,
    sort_order: existing?.sort_order ?? 1000,
    updated_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: "Ambassador administrator access required." }, { status: 403 });
  try {
    const rows = await rest<any[]>(`referral_reward_catalog?select=*&order=category.asc,sort_order.asc,display_name.asc`);
    return NextResponse.json({ ok: true, rewards: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load reward catalog." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: "Ambassador administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Reward details are required." }, { status: 400 });
  const payload = sanitize(body);
  if (!payload.category || !payload.display_name) return NextResponse.json({ error: "Category and display name are required." }, { status: 400 });
  if (!payload.image_url) return NextResponse.json({ error: "Upload a reward image before saving." }, { status: 400 });
  if (payload.amount_type === "fixed" && payload.allowed_amounts_cents.length === 0) return NextResponse.json({ error: "Add at least one denomination for a fixed-value reward." }, { status: 400 });
  try {
    const sameSlug = await rest<any[]>(`referral_reward_catalog?slug=eq.${encodeURIComponent(payload.slug)}&select=id&limit=1`);
    if (sameSlug[0]) payload.slug = `${payload.slug}-${Date.now().toString().slice(-6)}`;
    const rows = await rest<any[]>("referral_reward_catalog", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
    return NextResponse.json({ ok: true, reward: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create reward." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: "Ambassador administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = String(body?.id || "");
  if (!id || !body) return NextResponse.json({ error: "Reward ID is required." }, { status: 400 });
  try {
    const existingRows = await rest<any[]>(`referral_reward_catalog?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    const existing = existingRows[0];
    if (!existing) return NextResponse.json({ error: "Reward not found." }, { status: 404 });
    const payload = sanitize(body, existing);
    if (!payload.category || !payload.display_name) return NextResponse.json({ error: "Category and display name are required." }, { status: 400 });
    if (!payload.image_url) return NextResponse.json({ error: "Upload a reward image before saving." }, { status: 400 });
    if (payload.amount_type === "fixed" && payload.allowed_amounts_cents.length === 0) return NextResponse.json({ error: "Add at least one denomination for a fixed-value reward." }, { status: 400 });
    const rows = await rest<any[]>(`referral_reward_catalog?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
    return NextResponse.json({ ok: true, reward: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update reward." }, { status: 500 });
  }
}
