import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAmbassadorProfile } from "@/lib/ambassador-auth";

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

type CatalogItem = {
  id: string; slug: string; category: string; display_name: string; image_status: string; image_url: string | null;
  redemption_type: string; amount_type: string; allowed_amounts_cents: number[]; min_amount_cents: number; max_amount_cents: number | null;
  fee_cents: number; fee_note: string | null; sort_order: number;
};

async function getWallet(partnerId: string) {
  const [rewards, adjustments, redemptions] = await Promise.all([
    rest<Array<{ partner_reward_cents: number; reward_status: string }>>(
      `referral_bookings?partner_id=eq.${encodeURIComponent(partnerId)}&reward_status=in.(earned,sent,redeemed)&select=partner_reward_cents,reward_status`,
    ),
    rest<Array<{ amount_cents: number }>>(
      `referral_reward_adjustments?partner_id=eq.${encodeURIComponent(partnerId)}&select=amount_cents`,
    ),
    rest<Array<Record<string, unknown>>>(
      `referral_redemptions?partner_id=eq.${encodeURIComponent(partnerId)}&select=id,amount_cents,method,method_details,status,requested_at,approved_at,sent_at,completed_at,rejected_at,cancelled_at,provider,provider_reference&order=requested_at.desc`,
    ),
  ]);
  const bookingEarned = rewards.reduce((sum, row) => sum + Math.max(0, Number(row.partner_reward_cents) || 0), 0);
  const adjustmentTotal = adjustments.reduce((sum, row) => sum + (Number(row.amount_cents) || 0), 0);
  const earned = bookingEarned + adjustmentTotal;
  const committed = redemptions.filter((row) => !["rejected", "cancelled"].includes(String(row.status))).reduce((sum, row) => sum + Math.max(0, Number(row.amount_cents) || 0), 0);
  return { earned_cents: earned, booking_earned_cents: bookingEarned, adjustment_cents: adjustmentTotal, committed_cents: committed, available_cents: Math.max(0, earned - committed), redemptions };
}

async function getCatalog() {
  return rest<CatalogItem[]>(`referral_reward_catalog?active=eq.true&select=${encodeURIComponent("id,slug,category,display_name,image_status,image_url,redemption_type,amount_type,allowed_amounts_cents,min_amount_cents,max_amount_cents,fee_cents,fee_note,sort_order")}&order=sort_order.asc,display_name.asc`);
}

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedAmbassadorProfile(request.cookies.get("epic_ambassador_access_token")?.value);
  if (!profile) return NextResponse.json({ error: "Ambassador login required." }, { status: 401 });
  try {
    const [wallet, catalog] = await Promise.all([getWallet(profile.partner_id), getCatalog()]);
    return NextResponse.json({ ok: true, ...wallet, catalog });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load redemption wallet." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedAmbassadorProfile(request.cookies.get("epic_ambassador_access_token")?.value);
  if (!profile) return NextResponse.json({ error: "Ambassador login required." }, { status: 401 });
  if (profile.role === "viewer") return NextResponse.json({ error: "Viewer access cannot request a redemption." }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const catalogId = typeof body?.catalog_id === "string" ? body.catalog_id : "";
  const requestedValue = Math.round(Number(body?.reward_value_cents));
  const details = (body?.method_details && typeof body.method_details === "object" && !Array.isArray(body.method_details)) ? body.method_details as Record<string, unknown> : {};
  if (!catalogId) return NextResponse.json({ error: "Choose a reward." }, { status: 400 });

  try {
    const rows = await rest<CatalogItem[]>(`referral_reward_catalog?id=eq.${encodeURIComponent(catalogId)}&active=eq.true&select=${encodeURIComponent("id,slug,category,display_name,image_status,image_url,redemption_type,amount_type,allowed_amounts_cents,min_amount_cents,max_amount_cents,fee_cents,fee_note,sort_order")}&limit=1`);
    const item = rows[0];
    if (!item) return NextResponse.json({ error: "That reward is no longer available." }, { status: 404 });

    let rewardValue = requestedValue;
    if (item.amount_type === "fixed") {
      if (!item.allowed_amounts_cents.includes(rewardValue)) return NextResponse.json({ error: "Choose one of the available reward amounts." }, { status: 400 });
    } else {
      if (!Number.isFinite(rewardValue) || rewardValue < item.min_amount_cents) return NextResponse.json({ error: `Minimum redemption is $${(item.min_amount_cents / 100).toFixed(2)}.` }, { status: 400 });
      if (item.max_amount_cents && rewardValue > item.max_amount_cents) return NextResponse.json({ error: `Maximum redemption is $${(item.max_amount_cents / 100).toFixed(2)}.` }, { status: 400 });
    }

    if (item.redemption_type === "venmo" && !String(details.handle || "").trim()) return NextResponse.json({ error: "Enter the Venmo username, phone, or email." }, { status: 400 });
    if (item.redemption_type === "paypal" && !String(details.email || "").includes("@")) return NextResponse.json({ error: "Enter the PayPal email address." }, { status: 400 });
    if (item.redemption_type === "check" && (!String(details.payee || "").trim() || !String(details.address || "").trim())) return NextResponse.json({ error: "Enter the check payee and mailing address." }, { status: 400 });

    const feeCents = Math.max(0, Number(item.fee_cents) || 0);
    const totalDeduction = rewardValue + feeCents;
    const wallet = await getWallet(profile.partner_id);
    if (totalDeduction > wallet.available_cents) {
      return NextResponse.json({ error: `This reward requires $${(totalDeduction / 100).toFixed(2)} from your available balance including fees. You currently have $${(wallet.available_cents / 100).toFixed(2)} available.` }, { status: 409 });
    }

    const method = item.redemption_type === "prepaid_card" ? "gift_card" : item.redemption_type;
    const methodDetails = {
      ...details,
      catalog_id: item.id,
      catalog_slug: item.slug,
      brand: item.display_name,
      category: item.category,
      reward_value_cents: rewardValue,
      fee_cents: feeCents,
      fee_note: item.fee_note,
      total_deduction_cents: totalDeduction,
    };

    const created = await rest<Array<Record<string, unknown>>>("referral_redemptions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ partner_id: profile.partner_id, requested_by_profile_id: profile.id, amount_cents: totalDeduction, method, method_details: methodDetails, status: "requested" }),
    });
    const after = await getWallet(profile.partner_id);
    return NextResponse.json({ ok: true, redemption: created[0], available_cents: after.available_cents });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to request redemption." }, { status: 500 });
  }
}
