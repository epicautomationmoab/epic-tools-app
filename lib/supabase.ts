export type ReadinessRow = {
  readiness_id?: string;
  visit_start_time: string;
  confirmation_code: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_phone_last_four?: string | null;
  business_line: "tour" | "rental" | string;
  product_display_name: string;
  expected_guest_count: number | null;
  total_vehicle_count?: number | null;
  epic_document_count_label: string;
  epic_document_count_color: "green" | "yellow" | "red" | "gray" | string;
  epic_document_received_count?: number | null;
  epic_document_expected_count?: number | null;
  mpwr_document_received_count?: number | null;
  mpwr_document_expected_count?: number | null;
  mpwr_confirmation_number: string | null;
  amount_due_cents: number | null;
  is_paid: boolean | null;
  requires_mpwr?: boolean | null;
  premier_adventure_assure?: boolean | null;
  adventure_assure_level?: string | null;
  ohv_required: boolean | null;
  ohv_certificate_uploaded: boolean | null;
  attention_flags: string[] | null;
  tripworks_booking_url: string | null;
  mpwr_reservation_url: string | null;
  notes?: string | null;
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
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!rawUrl || !key) {
    throw new Error("Supabase environment variables are missing in Vercel.");
  }

  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const url = normalizedUrl.replace(/\/+$/, "");

  return { url, key };
}

async function fetchView<T>(viewName: string, searchParams: URLSearchParams): Promise<T[]> {
  const config = getSupabaseConfig();
  const endpoint = `${config.url}/rest/v1/${viewName}?${searchParams.toString()}`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      cache: "no-store",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Supabase network request failed for ${config.url}: ${detail}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase ${viewName} request failed (${response.status}) at ${config.url}: ${body.slice(0, 300)}`,
    );
  }

  return response.json() as Promise<T[]>;
}

export async function getReadinessRows() {
  const params = new URLSearchParams({
    select: "*",
    limit: "500",
  });

  const rows = await fetchView<ReadinessRow>(
    "guest_readiness_app_v",
    params,
  );

  return rows.sort((a, b) => {
    const timeCompare = a.visit_start_time.localeCompare(b.visit_start_time);
    if (timeCompare !== 0) return timeCompare;
    return a.customer_name.localeCompare(b.customer_name);
  });
}

export async function getArrivalBoardRows() {
  const params = new URLSearchParams({
    select: "*",
    limit: "500",
  });

  const rows = await fetchView<ArrivalBoardRow>("guest_arrival_board_v", params);

  return rows.sort((a, b) => {
    const timeCompare = a.visit_start_time.localeCompare(b.visit_start_time);
    if (timeCompare !== 0) return timeCompare;

    const lineCompare = a.business_line.localeCompare(b.business_line);
    if (lineCompare !== 0) return lineCompare;

    return a.customer_name.localeCompare(b.customer_name);
  });
}
