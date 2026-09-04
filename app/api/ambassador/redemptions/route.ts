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

async function getWallet(partnerId: string) {
  const [rewards, redemptions] = await Promise.all([
    rest<Array<{ partner_reward_cents: number; reward_status: string }>>(
      `referral_bookings?partner_id=eq.${encodeURIComponent(partnerId)}&reward_status=in.(earned,sent,redeemed)&select=partner_reward_cents,reward_status`,
    ),
    rest<Array<Record<string, unknown>>>(
      `referral_redemptions?partner_id=eq.${encodeURIComponent(partnerId)}&select=id,amount_cents,method,method_details,status,requested_at,approved_at,sent_at,completed_at,rejected_at,cancelled_at,provider,provider_reference&order=requested_at.desc`,
    ),
  ]);

  const earned = rewards.reduce((sum, row) => sum + Math.max(0, Number(row.partner_reward_cents) || 0), 0);
  const committed = redemptions
    .filter((row) => !["rejected", "cancelled"].includes(String(row.status)))
    .reduce((sum, row) => sum + Math.max(0, Number(row.amount_cents) || 0), 0);
  return { earned_cents: earned, committed_cents: committed, available_cents: Math.max(0, earned - committed), redemptions };
}

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedAmbassadorProfile(request.cookies.get("epic_ambassador_access_token")?.value);
  if (!profile) return NextResponse.json({ error: "Ambassador login required." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await getWallet(profile.partner_id)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load redemption wallet." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedAmbassadorProfile(request.cookies.get("epic_ambassador_access_token")?.value);
  if (!profile) return NextResponse.json({ error: "Ambassador login required." }, { status: 401 });
  if (profile.role === "viewer") return NextResponse.json({ error: "Viewer access cannot request a redemption." }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const amountCents = Math.round(Number(body?.amount_cents));
  const method = typeof body?.method === "string" ? body.method : "";
  const allowedMethods = new Set(["gift_card", "venmo", "paypal", "check"]);
  if (!Number.isFinite(amountCents) || amountCents <= 0) return NextResponse.json({ error: "Enter a valid redemption amount." }, { status: 400 });
  if (!allowedMethods.has(method)) return NextResponse.json({ error: "Choose a valid redemption method." }, { status: 400 });

  const details = (body?.method_details && typeof body.method_details === "object" && !Array.isArray(body.method_details)) ? body.method_details as Record<string, unknown> : {};
  if (method === "gift_card" && !String(details.brand || "").trim()) return NextResponse.json({ error: "Choose a gift card." }, { status: 400 });
  if (method === "venmo" && !String(details.handle || "").trim()) return NextResponse.json({ error: "Enter the Venmo username or phone/email." }, { status: 400 });
  if (method === "paypal" && !String(details.email || "").includes("@")) return NextResponse.json({ error: "Enter the PayPal email address." }, { status: 400 });
  if (method === "check" && (!String(details.payee || "").trim() || !String(details.address || "").trim())) return NextResponse.json({ error: "Enter the check payee and mailing address." }, { status: 400 });

  try {
    const wallet = await getWallet(profile.partner_id);
    if (amountCents > wallet.available_cents) {
      return NextResponse.json({ error: `Redemption cannot exceed the available earned reward balance of $${(wallet.available_cents / 100).toFixed(2)}.` }, { status: 409 });
    }

    const rows = await rest<Array<Record<string, unknown>>>("referral_redemptions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        partner_id: profile.partner_id,
        requested_by_profile_id: profile.id,
        amount_cents: amountCents,
        method,
        method_details: details,
        status: "requested",
      }),
    });
    const after = await getWallet(profile.partner_id);
    return NextResponse.json({ ok: true, redemption: rows[0], available_cents: after.available_cents });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to request redemption." }, { status: 500 });
  }
}
