export type ReadinessRow = {
  visit_start_time: string;
  confirmation_code: string;
  customer_name: string;
  business_line: "tour" | "rental" | string;
  product_display_name: string;
  expected_guest_count: number | null;
  epic_document_count_label: string;
  epic_document_count_color: "green" | "yellow" | "red" | "gray" | string;
  mpwr_confirmation_number: string | null;
  amount_due_cents: number | null;
  is_paid: boolean | null;
  ohv_required: boolean | null;
  ohv_certificate_uploaded: boolean | null;
  attention_flags: string[] | null;
  tripworks_booking_url: string | null;
  mpwr_reservation_url: string | null;
  epic_document_signers: Array<{
    name: string;
    document_url?: string | null;
    is_minor_or_child?: boolean | null;
    is_waiver_adult?: boolean | null;
  }> | null;
};

export type ArrivalBoardRow = {
  visit_start_time: string;
  confirmation_code: string;
  customer_name: string;
  business_line: "tour" | "rental" | string;
  board_activity_label: string;
  board_action_label: "Proceed to Kiosk" | "See Agent" | string;
  board_action_type: "kiosk" | "agent" | string;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return { url: url.replace(/\/$/, ""), key };
}

async function fetchView<T>(viewName: string, searchParams: URLSearchParams): Promise<T[]> {
  const config = getSupabaseConfig();
  if (!config) return [];

  const endpoint = `${config.url}/rest/v1/${viewName}?${searchParams.toString()}`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`Supabase ${viewName} request failed: ${response.status}`);
  }

  return response.json() as Promise<T[]>;
}

export async function getReadinessRows() {
  const params = new URLSearchParams({
    select: "*",
    order: "visit_start_time.asc,customer_name.asc",
    limit: "500",
  });

  return fetchView<ReadinessRow>("guest_readiness_dashboard_scan_document_links_v3", params);
}

export async function getArrivalBoardRows() {
  const params = new URLSearchParams({
    select: "*",
    order: "visit_start_time.asc,business_line.asc,customer_name.asc",
    limit: "500",
  });

  return fetchView<ArrivalBoardRow>("guest_arrival_board_v", params);
}
