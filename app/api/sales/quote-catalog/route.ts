import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

const catalogs = {
  rates: {
    table: "sales_quote_rates",
    params: {
      select: "experience_id,experience_name,business_line,ticket_type_id,ticket_type_name,unit_price_cents,quantity_label,sales_help_text,effective_start,effective_end,source",
      is_active: "eq.true", experience_id: "neq.17328",
      ticket_type_name: "not.in.(Guest,Adult Rider,Terms and Conditions)",
      order: "business_line.asc,experience_name.asc,ticket_type_name.asc",
    },
  },
  links: { table: "sales_booking_links", params: { select: "experience_id,booking_url", is_active: "eq.true" } },
  fees: { table: "sales_quote_experience_fees", params: { select: "experience_id,experience_name,fee_label,fee_cents", is_active: "eq.true", order: "experience_name.asc" } },
} as const;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile?.active || profile.role === "workstation") return reply({ error: "Signed-in employee required." }, 401);
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "rates" && kind !== "links" && kind !== "fees") return reply({ error: "Invalid catalog." }, 400);
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!origin || !secret) return reply({ error: "Quote catalog configuration unavailable." }, 503);
  const catalog = catalogs[kind];
  try {
    const response = await fetch(`${origin}/rest/v1/${catalog.table}?${new URLSearchParams(catalog.params)}`, {
      headers: { apikey: secret, Authorization: `Bearer ${secret}` }, cache: "no-store",
    });
    if (!response.ok) return reply({ error: "Unable to load quote catalog." }, 502);
    const rows = await response.json();
    return Array.isArray(rows) ? reply(rows) : reply({ error: "Invalid quote catalog response." }, 502);
  } catch {
    return reply({ error: "Quote catalog is temporarily unavailable." }, 502);
  }
}
