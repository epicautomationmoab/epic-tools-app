export type VehicleBreakdownItem = {
  model: string;
  quantity: number;
};

export type ReadinessRow = {
  readiness_id?: string;
  visit_start_time: string;
  confirmation_code: string;
  guest_portal_token?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_phone_last_four?: string | null;
  business_line: "tour" | "rental" | string;
  product_display_name: string;
  rental_duration?: string | null;
  expected_guest_count: number | null;
  total_vehicle_count?: number | null;
  vehicle_breakdown?: VehicleBreakdownItem[] | null;
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
  handoff_status?: "checked_in" | "tour_returned" | "rental_out" | "rental_returned" | null;
  courtesy_call_completed?: boolean;
  courtesy_call_completed_by?: string | null;
  courtesy_call_outcome?: string | null;
  courtesy_call_completed_at?: string | null;
  notes?: string | null;
  epic_document_signers: Array<{
    name: string;
    document_url?: string | null;
    source?: "tripworks" | "epic" | string | null;
    waiver_id?: string | null;
    is_minor_or_child?: boolean | null;
    is_waiver_adult?: boolean | null;
  }> | null;
  mpwr_waivers: Array<{
    name: string;
    email?: string | null;
    document_url?: string | null;
    is_minor?: boolean | null;
    is_passenger?: boolean | null;
  }> | null;
};

export type ArrivalBoardRow = {
  visit_start_time: string;
  confirmation_code: string;
  customer_name: string;
  customer_phone_last_four?: string | null;
  business_line: "tour" | "rental" | string;
  board_activity_label: string;
  product_display_name?: string | null;
  rental_duration?: string | null;
  total_vehicle_count?: number | null;
  board_action_label: "Proceed to Kiosk" | "See Agent" | string;
  board_action_type: "kiosk" | "agent" | string;
  handoff_status?: "checked_in" | "tour_returned" | "rental_out" | "rental_returned" | null;
};

function getSupabaseConfig(useSecretKey = false) {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = useSecretKey
    ? process.env.SUPABASE_SECRET_KEY?.trim()
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!rawUrl || !key) {
    throw new Error(
      useSecretKey
        ? "Supabase secret environment variables are missing."
        : "Supabase environment variables are missing in Vercel.",
    );
  }

  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const url = normalizedUrl.replace(/\/+$/, "");
  return { url, key };
}

async function fetchSupabase<T>(
  path: string,
  params: URLSearchParams,
  useSecretKey = false,
): Promise<T[]> {
  const { url, key } = getSupabaseConfig(useSecretKey);
  const response = await fetch(`${url}/rest/v1/${path}?${params.toString()}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${path} failed (${response.status}): ${body.slice(0, 300)}`);
  }

  return (await response.json()) as T[];
}

export async function getReadinessRows(): Promise<ReadinessRow[]> {
  return fetchSupabase<ReadinessRow>(
    "guest_readiness_with_handoff_v",
    new URLSearchParams({
      select: "*",
      order: "visit_start_time.asc",
    }),
    true,
  );
}

export async function getArrivalBoardRows(): Promise<ArrivalBoardRow[]> {
  return fetchSupabase<ArrivalBoardRow>(
    "arrival_board_v",
    new URLSearchParams({
      select: "*",
      order: "visit_start_time.asc",
    }),
    true,
  );
}
