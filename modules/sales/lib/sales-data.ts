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

export async function getSalesRates(year: 2026 | 2027 = 2026): Promise<SalesRateRow[]> {
  const response = await fetch("/api/sales/quote-catalog?kind=rates", {
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
  const response = await fetch("/api/sales/quote-catalog?kind=links", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load booking links.");
  return response.json() as Promise<SalesBookingLink[]>;
}

export async function getSalesExperienceFees(): Promise<SalesExperienceFee[]> {
  const response = await fetch("/api/sales/quote-catalog?kind=fees", {
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
  const response = await fetch(`/api/sales/quotes?limit=${encodeURIComponent(limit)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Unable to load saved quotes (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  return response.json() as Promise<RecentSalesQuote[]>;
}

export async function getSalesQuoteDetail(quoteId: string): Promise<SalesQuoteDetail> {
  const response = await fetch(`/api/sales/quotes?quote=${encodeURIComponent(quoteId)}`, {
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
