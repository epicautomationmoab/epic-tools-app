export type SalesRateRow = {
  experience_id: string;
  experience_name: string | null;
  business_line: "tour" | "rental" | string;
  ticket_type_id: string;
  ticket_type_name: string;
  unit_price_cents: number;
  quantity_label: string | null;
  sales_help_text: string | null;
  effective_start: string | null;
  effective_end: string | null;
  source: string | null;
};

export type SalesBookingLink = { experience_id: string; booking_url: string; };

export type SalesExperienceFee = {
  experience_id: string;
  experience_name: string;
  fee_label: string;
  fee_cents: number;
};

export type SaveQuoteActivity = {
  experienceId: string;
  tripSafe: boolean;
  premier: boolean;
  priorEveningPickup: boolean;
  nextMorningDropoff: boolean;
  tickets: Array<{ ticketTypeId: string; quantity: number }>;
};

export type SaveQuoteResult = {
  quote_id: string;
  opportunity_id: string | null;
  total_cents: number;
  lead_created_or_attached: boolean;
  visit_start_date?: string | null;
  visit_end_date?: string | null;
};

export type RecentSalesQuote = {
  quote_id: string;
  opportunity_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_e164: string | null;
  visit_start_date: string | null;
  visit_end_date: string | null;
  status: string;
  total_cents: number;
  created_at: string;
};

export type SalesQuoteDetail = {
  quote: RecentSalesQuote & Record<string, unknown>;
  activities: Array<{
    id: string;
    experience_id: string;
    experience_name: string;
    business_line: string;
    activity_order: number;
    tripsafe_selected: boolean;
    premier_selected: boolean;
    prior_evening_pickup?: boolean;
    next_morning_dropoff?: boolean;
    private_fee_cents?: number;
    rental_period_days?: number;
    items: Array<{
      ticket_type_id: string;
      ticket_type_name: string;
      quantity: number;
      unit_price_cents: number;
      line_total_cents: number;
    }>;
  }>;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

const apiHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  "Content-Type": "application/json",
};

export async function getSalesRates(year: 2026 | 2027 = 2026): Promise<SalesRateRow[]> {
  const params = new URLSearchParams({
    select: "experience_id,experience_name,business_line,ticket_type_id,ticket_type_name,unit_price_cents,quantity_label,sales_help_text,effective_start,effective_end,source",
    is_active: "eq.true",
    experience_id: "neq.17328",
    ticket_type_name: "not.in.(Guest,Adult Rider,Terms and Conditions)",
    order: "business_line.asc,experience_name.asc,ticket_type_name.asc",
  });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/sales_quote_rates?${params.toString()}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Unable to load sales rates (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const rows = await response.json() as SalesRateRow[];
  // Un-dated legacy rate-sheet entries are the existing 2026 schedule only.
  // Never fall back to them when a future season is selected.
  const day = `${year}-07-01`;
  return rows.filter(row => year === 2026
    ? (!row.effective_start && !row.effective_end) || (!!row.effective_start && row.effective_start <= day && (!row.effective_end || row.effective_end >= day))
    : !!row.effective_start && row.effective_start <= day && (!row.effective_end || row.effective_end >= day));
}

export async function getSalesBookingLinks(): Promise<SalesBookingLink[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/sales_booking_links?select=experience_id,booking_url&is_active=eq.true`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY }, cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load booking links.");
  return response.json() as Promise<SalesBookingLink[]>;
}

export async function getSalesExperienceFees(): Promise<SalesExperienceFee[]> {
  const params = new URLSearchParams({
    select: "experience_id,experience_name,fee_label,fee_cents",
    is_active: "eq.true",
    order: "experience_name.asc",
  });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/sales_quote_experience_fees?${params.toString()}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Unable to load private tour fees (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  return response.json() as Promise<SalesExperienceFee[]>;
}

export async function saveSalesQuote(input: {
  quoteId?: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  visitStart?: string;
  visitEnd?: string;
  activities: SaveQuoteActivity[];
}): Promise<SaveQuoteResult> {
  const response = await fetch("/api/sales/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Unable to save estimate (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  return response.json() as Promise<SaveQuoteResult>;
}

export async function getRecentSalesQuotes(limit = 25): Promise<RecentSalesQuote[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_recent_epic_sales_quotes`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ p_limit: limit }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Unable to load saved quotes (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  return response.json() as Promise<RecentSalesQuote[]>;
}

export async function getSalesQuoteDetail(quoteId: string): Promise<SalesQuoteDetail> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_epic_sales_quote_detail`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ p_quote_id: quoteId }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Unable to open quote (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const result = await response.json();
  if (!result) throw new Error("Quote not found.");
  return result as SalesQuoteDetail;
}
