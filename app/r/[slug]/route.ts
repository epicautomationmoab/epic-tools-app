import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await context.params;
  const slug = rawSlug.trim().toLowerCase();
  const fallback = "https://www.epic4x4adventures.com/";

  try {
    const partners = await rest<Array<{ id: string; slug: string; attribution_window_days: number }>>(
      `referral_partners?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=id,slug,attribution_window_days&limit=1`,
    );
    const partner = partners[0];
    if (!partner) return NextResponse.redirect(fallback);

    const visitorId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + partner.attribution_window_days * 24 * 60 * 60 * 1000).toISOString();
    const landingUrl = request.nextUrl.searchParams.get("to") || fallback;
    const safeLanding = landingUrl.startsWith("https://www.epic4x4adventures.com") || landingUrl.startsWith("https://epic4x4adventures.com") ? landingUrl : fallback;

    const rows = await rest<Array<{ id: string }>>("referral_visits", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        partner_id: partner.id,
        visitor_id: visitorId,
        landing_url: safeLanding,
        referrer_url: request.headers.get("referer"),
        utm_source: request.nextUrl.searchParams.get("utm_source"),
        utm_medium: request.nextUrl.searchParams.get("utm_medium"),
        utm_campaign: request.nextUrl.searchParams.get("utm_campaign"),
        utm_term: request.nextUrl.searchParams.get("utm_term"),
        utm_content: request.nextUrl.searchParams.get("utm_content"),
        user_agent: request.headers.get("user-agent"),
        expires_at: expiresAt,
        metadata: { ambassador_host: request.headers.get("host"), source: "ambassador_redirect" },
      }),
    });

    const destination = new URL(safeLanding);
    destination.searchParams.set("ref", partner.slug);
    destination.searchParams.set("rid", rows[0].id);
    return NextResponse.redirect(destination);
  } catch {
    return NextResponse.redirect(fallback);
  }
}
