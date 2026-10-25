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

type NoShowRow = {
  readiness_id: string;
};

type PortalRow = {
  confirmation_code: string;
  guest_portal_token: string | null;
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

function quoteList(values: string[]) {
  return values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
}

export async function getHeldOverRentals(): Promise<ReadinessRow[]> {
  const today = mountainDateKey();

  // IMPORTANT: held-over detection must read the operational table directly.
  // The app-facing readiness view is intentionally optimized for live/current readiness
  // and can exclude prior-day rows that still need a Rental Returned handoff.
  const readinessParams = new URLSearchParams({
    select: "readiness_id,visit_start_time,confirmation_code,customer_name,business_line,product_display_name,rental_duration,total_vehicle_count,vehicle_breakdown",
    business_line: "eq.rental",
    archived_at: "is.null",
    live_dashboard_visible: "eq.true",
    order: "visit_start_time.asc",
    limit: "500",
  });
  readinessParams.append("visit_start_time", `lt.${today}T00:00:00`);

  const readinessRows: ReadinessSourceRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const params = new URLSearchParams(readinessParams);
    params.set("offset", String(offset));
    const page = await fetchJson<ReadinessSourceRow>("guest_readiness_operational", params);
    readinessRows.push(...page);
    if (page.length < 500) break;
  }
  if (readinessRows.length === 0) return [];

  const readinessIds = readinessRows.map((row) => row.readiness_id).filter((id): id is string => Boolean(id));
  const confirmationCodes = [...new Set(readinessRows.map((row) => row.confirmation_code).filter(Boolean))];
  const handoffs: HandoffRow[] = [];
  const noShows: NoShowRow[] = [];
  const portalRows: PortalRow[] = [];
  // Batch the joins so multi-month rentals do not exceed URL or API row limits.
  for (let i = 0; i < readinessIds.length; i += 100) {
    const ids = readinessIds.slice(i, i + 100);
    const quotedIds = ids.map((id) => '"' + id + '"').join(",");
    const [hs, ns] = await Promise.all([
      fetchJson<HandoffRow>("epic_operational_handoffs", new URLSearchParams({
        select: "readiness_id,handoff_status,updated_at",
        readiness_id: "in.(" + quotedIds + ")",
        order: "updated_at.desc",
        limit: "1000",
      })),
      fetchJson<NoShowRow>("epic_no_show_status", new URLSearchParams({
        select: "readiness_id",
        readiness_id: "in.(" + quotedIds + ")",
        limit: "1000",
      })),
    ]);
    handoffs.push(...hs);
    noShows.push(...ns);
  }
  for (let i = 0; i < confirmationCodes.length; i += 100) {
    const ps = await fetchJson<PortalRow>("guest_portal_v", new URLSearchParams({
      select: "confirmation_code,guest_portal_token",
      confirmation_code: "in.(" + quoteList(confirmationCodes.slice(i, i + 100)) + ")",
      limit: "1000",
    }));
    portalRows.push(...ps);
  }

  const reconciledReadinessIds = new Set<string>();
  for (let i = 0; i < readinessIds.length; i += 100) {
    const ids = readinessIds.slice(i, i + 100);
    const reconciled = await fetchJson<{ readiness_id: string }>(
      "held_over_queue_reconciliations",
      new URLSearchParams({
        select: "readiness_id",
        readiness_id: "in.(" + ids.map((id) => '"' + id + '"').join(",") + ")",
        limit: "1000",
      }),
    );
    for (const row of reconciled) reconciledReadinessIds.add(row.readiness_id);
  }

  const noShowReadinessIds = new Set(noShows.map((row) => row.readiness_id));
  const latestHandoffByReadinessId = new Map<string, HandoffRow>();
  for (const handoff of handoffs) {
    if (!latestHandoffByReadinessId.has(handoff.readiness_id)) {
      latestHandoffByReadinessId.set(handoff.readiness_id, handoff);
    }
  }

  const portalTokenByConfirmation = new Map<string, string>();
  for (const portalRow of portalRows) {
    if (portalRow.guest_portal_token) portalTokenByConfirmation.set(portalRow.confirmation_code, portalRow.guest_portal_token);
  }

  return readinessRows
    .filter((row) => {
      if (!row.readiness_id) return true;
      if (noShowReadinessIds.has(row.readiness_id) || reconciledReadinessIds.has(row.readiness_id)) return false;
      return latestHandoffByReadinessId.get(row.readiness_id)?.handoff_status !== "rental_returned";
    })
    .map((row) => ({
      ...row,
      handoff_status: row.readiness_id
        ? (latestHandoffByReadinessId.get(row.readiness_id)?.handoff_status as ReadinessRow["handoff_status"] | undefined) ?? null
        : null,
      guest_portal_token: portalTokenByConfirmation.get(row.confirmation_code) ?? null,
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
