import type { ReadinessRow } from "@/lib/supabase";

function mountainDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

type ReadinessSourceRow = Pick<
  ReadinessRow,
  | "readiness_id"
  | "visit_start_time"
  | "confirmation_code"
  | "customer_name"
  | "business_line"
  | "product_display_name"
  | "rental_duration"
  | "total_vehicle_count"
  | "vehicle_breakdown"
>;

type HandoffRow = {
  readiness_id: string;
  handoff_status: string;
  updated_at: string;
};

function supabaseServerConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server configuration is missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function fetchJson<T>(path: string, params: URLSearchParams): Promise<T[]> {
  const { url, key } = supabaseServerConfig();
  const response = await fetch(`${url}/rest/v1/${path}?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Unable to load ${path}.`);
  }
  return response.json() as Promise<T[]>;
}

export async function getHeldOverRentals(): Promise<ReadinessRow[]> {
  const today = mountainDateKey();
  const readinessParams = new URLSearchParams({
    select: "readiness_id,visit_start_time,confirmation_code,customer_name,business_line,product_display_name,rental_duration,total_vehicle_count,vehicle_breakdown",
    business_line: "eq.rental",
    archived_at: "is.null",
    visit_start_time: `lt.${today}T00:00:00`,
    order: "visit_start_time.asc",
    limit: "500",
  });

  const readinessRows = await fetchJson<ReadinessSourceRow>("guest_readiness_operational", readinessParams);
  if (readinessRows.length === 0) return [];

  const readinessIds = readinessRows
    .map((row) => row.readiness_id)
    .filter((id): id is string => Boolean(id));
  const quotedIds = readinessIds.map((id) => `"${id}"`).join(",");
  const handoffParams = new URLSearchParams({
    select: "readiness_id,handoff_status,updated_at",
    readiness_id: `in.(${quotedIds})`,
    order: "updated_at.desc",
    limit: "1000",
  });
  const handoffs = await fetchJson<HandoffRow>("epic_operational_handoffs", handoffParams);

  const latestHandoffByReadinessId = new Map<string, HandoffRow>();
  for (const handoff of handoffs) {
    if (!latestHandoffByReadinessId.has(handoff.readiness_id)) {
      latestHandoffByReadinessId.set(handoff.readiness_id, handoff);
    }
  }

  return readinessRows
    .filter((row) => {
      if (!row.readiness_id) return true;
      return latestHandoffByReadinessId.get(row.readiness_id)?.handoff_status !== "rental_returned";
    })
    .map((row) => ({
      ...row,
      handoff_status: row.readiness_id
        ? (latestHandoffByReadinessId.get(row.readiness_id)?.handoff_status as ReadinessRow["handoff_status"] | undefined) ?? null
        : null,
      expected_guest_count: null,
      epic_document_count_label: "",
      epic_document_count_color: "gray",
      mpwr_confirmation_number: null,
      amount_due_cents: null,
      is_paid: null,
      ohv_required: null,
      ohv_certificate_uploaded: null,
      attention_flags: null,
      tripworks_booking_url: null,
      mpwr_reservation_url: null,
      epic_document_signers: null,
      mpwr_waivers: null,
    }));
}

export async function getCarryoverRentalCount() {
  try {
    return (await getHeldOverRentals()).length;
  } catch {
    return 0;
  }
}
