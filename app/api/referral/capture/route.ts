import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://epic4x4adventures.com",
  "https://www.epic4x4adventures.com",
]);

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
  return text ? JSON.parse(text) as T : undefined as T;
}

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.epic4x4adventures.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403, headers: cors(origin) });
  }

  const body = await request.json().catch(() => null);
  const slug = typeof body?.ref === "string" ? body.ref.trim().toLowerCase() : "";
  const landingUrl = typeof body?.landing_url === "string" ? body.landing_url : origin;
  const visitorId = typeof body?.visitor_id === "string" && body.visitor_id.length <= 100
    ? body.visitor_id
    : crypto.randomUUID();

  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
    return NextResponse.json({ error: "Invalid referral code." }, { status: 400, headers: cors(origin) });
  }

  try {
    const partners = await rest<Array<{
      id: string;
      slug: string;
      name: string;
      attribution_window_days: number;
      promo_code: string | null;
      guest_discount_cents: number;
      show_promo_popup: boolean;
      popup_heading: string | null;
      popup_body: string | null;
    }>>(
      `referral_partners?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=id,slug,name,attribution_window_days,promo_code,guest_discount_cents,show_promo_popup,popup_heading,popup_body&limit=1`,
    );
    const partner = partners[0];
    if (!partner) {
      return NextResponse.json({ error: "Referral partner not found." }, { status: 404, headers: cors(origin) });
    }

    const expiresAt = new Date(Date.now() + partner.attribution_window_days * 86400000).toISOString();
    const rows = await rest<Array<{ id: string }>>("referral_visits", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        partner_id: partner.id,
        visitor_id: visitorId,
        landing_url: landingUrl,
        referrer_url: typeof body?.referrer_url === "string" ? body.referrer_url : null,
        utm_source: typeof body?.utm_source === "string" ? body.utm_source : null,
        utm_medium: typeof body?.utm_medium === "string" ? body.utm_medium : null,
        utm_campaign: typeof body?.utm_campaign === "string" ? body.utm_campaign : null,
        utm_term: typeof body?.utm_term === "string" ? body.utm_term : null,
        utm_content: typeof body?.utm_content === "string" ? body.utm_content : null,
        user_agent: request.headers.get("user-agent"),
        expires_at: expiresAt,
        metadata: { source: "epic4x4adventures_webflow" },
      }),
    });

    return NextResponse.json({
      success: true,
      referral_visit_id: rows[0]?.id,
      visitor_id: visitorId,
      expires_at: expiresAt,
      partner: {
        name: partner.name,
        slug: partner.slug,
        promo_code: partner.promo_code,
        guest_discount_cents: partner.guest_discount_cents,
        show_promo_popup: partner.show_promo_popup,
        popup_heading: partner.popup_heading,
        popup_body: partner.popup_body,
      },
    }, { headers: cors(origin) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record referral." }, { status: 500, headers: cors(origin) });
  }
}
