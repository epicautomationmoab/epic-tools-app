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

async function fetchView<T>(viewName: string, searchParams: URLSearchParams, useSecretKey = false): Promise<T[]> {
  const config = getSupabaseConfig(useSecretKey);
  const endpoint = `${config.url}/rest/v1/${viewName}?${searchParams.toString()}`;
  let response: Response;

  try {
    response = await fetch(endpoint, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
      cache: "no-store",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Supabase network request failed for ${config.url}: ${detail}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${viewName} request failed (${response.status}) at ${config.url}: ${body.slice(0, 300)}`);
  }

  return response.json() as Promise<T[]>;
}

export async function getReadinessRows() {
  const params = new URLSearchParams({ select: "*", limit: "500" });
  const rows = await fetchView<ReadinessRow>("guest_readiness_with_handoff_v", params);
  const confirmationCodes = [...new Set(rows.map((row) => row.confirmation_code).filter((code): code is string => Boolean(code)))];
  const portalTokenByConfirmationCode = new Map<string, string>();

  for (let index = 0; index < confirmationCodes.length; index += 100) {
    const batch = confirmationCodes.slice(index, index + 100);
    const quotedCodes = batch.map((code) => `"${code.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
    const portalParams = new URLSearchParams({
      select: "confirmation_code,guest_portal_token",
      confirmation_code: `in.(${quotedCodes})`,
      limit: "1000",
    });
    const portalRows = await fetchView<{ confirmation_code: string; guest_portal_token: string | null }>(
      "guest_portal_v",
      portalParams,
      true,
    );

    for (const portalRow of portalRows) {
      if (portalRow.confirmation_code && portalRow.guest_portal_token && !portalTokenByConfirmationCode.has(portalRow.confirmation_code)) {
        portalTokenByConfirmationCode.set(portalRow.confirmation_code, portalRow.guest_portal_token);
      }
    }
  }

  return rows
    .map((row) => ({ ...row, guest_portal_token: portalTokenByConfirmationCode.get(row.confirmation_code) ?? null }))
    .sort((a, b) => a.visit_start_time.localeCompare(b.visit_start_time) || a.customer_name.localeCompare(b.customer_name));
}

function getMountainDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function getMountainOffsetMs(date: Date) {
  const zoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    timeZoneName: "longOffset",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  const match = zoneName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error("Unable to determine America/Denver UTC offset.");
  const direction = match[1] === "+" ? 1 : -1;
  return direction * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

function mountainMidnightUtc(year: number, month: number, day: number) {
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let instant = localMidnightAsUtc;
  for (let index = 0; index < 3; index += 1) instant = localMidnightAsUtc - getMountainOffsetMs(new Date(instant));
  return new Date(instant);
}

function normalizeTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export async function getArrivalBoardRows() {
  const today = getMountainDateParts(new Date());
  const start = mountainMidnightUtc(today.year, today.month, today.day);
  const end = mountainMidnightUtc(today.year, today.month, today.day + 1);
  const dateFilters = [
    ["visit_start_time", `gte.${start.toISOString()}`],
    ["visit_start_time", `lt.${end.toISOString()}`],
  ] as const;

  const arrivalParams = new URLSearchParams({ select: "*", limit: "100" });
  const readinessParams = new URLSearchParams({
    select: "readiness_id,confirmation_code,visit_start_time,business_line,customer_phone_last_four,handoff_status,product_display_name,rental_duration,total_vehicle_count",
    limit: "100",
  });
  for (const [key, value] of dateFilters) {
    arrivalParams.append(key, value);
    readinessParams.append(key, value);
  }

  const [rows, readinessRows] = await Promise.all([
    fetchView<ArrivalBoardRow>("guest_arrival_board_with_handoff_v", arrivalParams),
    fetchView<Pick<ReadinessRow,
      "readiness_id" |
      "confirmation_code" |
      "visit_start_time" |
      "business_line" |
      "customer_phone_last_four" |
      "handoff_status" |
      "product_display_name" |
      "rental_duration" |
      "total_vehicle_count"
    >>("guest_readiness_with_handoff_v", readinessParams),
  ]);

  const readinessIds = readinessRows
    .map((row) => row.readiness_id)
    .filter((id): id is string => Boolean(id));
  const ohvUploadCountByReadinessId = new Map<string, number>();

  for (let index = 0; index < readinessIds.length; index += 100) {
    const batch = readinessIds.slice(index, index + 100);
    const quotedIds = batch.map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
    const ohvParams = new URLSearchParams({
      select: "readiness_id",
      readiness_id: `in.(${quotedIds})`,
      limit: "1000",
    });
    const uploads = await fetchView<{ readiness_id: string }>(
      "ohv_certificate_uploads",
      ohvParams,
      true,
    );

    for (const upload of uploads) {
      ohvUploadCountByReadinessId.set(
        upload.readiness_id,
        (ohvUploadCountByReadinessId.get(upload.readiness_id) ?? 0) + 1,
      );
    }
  }

  const readinessByKey = new Map(
    readinessRows.map((row) => [
      `${row.confirmation_code}|${normalizeTimestamp(row.visit_start_time)}|${row.business_line}`,
      row,
    ]),
  );
  const terminalStatuses = new Set(["checked_in", "tour_returned", "rental_out", "rental_returned"]);

  return rows
    .map((row) => {
      const readiness = readinessByKey.get(
        `${row.confirmation_code}|${normalizeTimestamp(row.visit_start_time)}|${row.business_line}`,
      );
      const totalVehicleCount = readiness?.total_vehicle_count ?? row.total_vehicle_count ?? null;
      const uploadedOhvCount = readiness?.readiness_id
        ? (ohvUploadCountByReadinessId.get(readiness.readiness_id) ?? 0)
        : 0;
      const hasRequiredOhvCertificates =
        row.business_line !== "rental" ||
        (typeof totalVehicleCount === "number" &&
          totalVehicleCount > 0 &&
          uploadedOhvCount >= totalVehicleCount);

      return {
        ...row,
        customer_phone_last_four: readiness?.customer_phone_last_four ?? row.customer_phone_last_four ?? null,
        handoff_status: readiness?.handoff_status ?? row.handoff_status ?? null,
        product_display_name: readiness?.product_display_name ?? row.product_display_name ?? row.board_activity_label,
        rental_duration: readiness?.rental_duration ?? row.rental_duration ?? null,
        total_vehicle_count: totalVehicleCount,
        board_action_label: hasRequiredOhvCertificates
          ? row.board_action_label
          : "Proceed to Kiosk",
        board_action_type: hasRequiredOhvCertificates
          ? row.board_action_type
          : "kiosk",
      };
    })
    .filter((row) => !row.handoff_status || !terminalStatuses.has(row.handoff_status))
    .sort((a, b) =>
      a.visit_start_time.localeCompare(b.visit_start_time) ||
      a.business_line.localeCompare(b.business_line) ||
      a.customer_name.localeCompare(b.customer_name),
    );
}
