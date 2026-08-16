import { NextResponse } from "next/server";

function config() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

async function getJson(url: string, key: string) {
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

export async function GET(_request: Request, context: { params: Promise<{ confirmation: string; token: string }> }) {
  try {
    const { confirmation, token } = await context.params;
    const c = config();
    const response = await fetch(`${c.url}/rest/v1/rpc/resolve_epic_waiver_session_v2`, {
      method: "POST",
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_confirmation_code: confirmation, p_public_token: token }),
      cache: "no-store",
    });
    const body = await response.text();
    if (!response.ok) return NextResponse.json({ error: "Unable to load waiver.", detail: body.slice(0, 300) }, { status: response.status });
    const rows = JSON.parse(body);
    if (!rows?.length) return NextResponse.json({ error: "This waiver link is invalid, inactive, or expired." }, { status: 404 });

    const session = rows[0];
    let customerPhone: string | null = null;
    let businessLine: string | null = null;
    let rentalTermsHtml: string | null = null;
    let totalVehicleCount = 1;

    const reservationParams = new URLSearchParams({
      select: "customer_phone",
      confirmation_code: `eq.${confirmation}`,
      limit: "1",
    });
    const reservations = await getJson(`${c.url}/rest/v1/operational_reservations?${reservationParams.toString()}`, c.key);
    customerPhone = reservations?.[0]?.customer_phone ?? null;

    if (session.waiver_template_id) {
      const templateParams = new URLSearchParams({
        select: "business_line,document_type,html_body",
        id: `eq.${session.waiver_template_id}`,
        limit: "1",
      });
      const templates = await getJson(`${c.url}/rest/v1/epic_waiver_templates?${templateParams.toString()}`, c.key);
      businessLine = templates?.[0]?.business_line ?? null;
      rentalTermsHtml = businessLine === "rental" ? templates?.[0]?.html_body ?? null : null;
    }

    if (businessLine === "rental") {
      const readinessParams = new URLSearchParams({
        select: "total_vehicle_count",
        confirmation_code: `eq.${confirmation}`,
        business_line: "eq.rental",
      });
      const readinessRows = await getJson(`${c.url}/rest/v1/guest_readiness_operational?${readinessParams.toString()}`, c.key);
      const counts = Array.isArray(readinessRows)
        ? readinessRows.map((row) => Number(row.total_vehicle_count) || 0)
        : [];
      totalVehicleCount = Math.max(1, ...counts);
    }

    return NextResponse.json({
      session: {
        ...session,
        customer_phone: customerPhone,
        business_line: businessLine || "tour",
        rental_terms_html: rentalTermsHtml,
        total_vehicle_count: totalVehicleCount,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load waiver." }, { status: 500 });
  }
}
