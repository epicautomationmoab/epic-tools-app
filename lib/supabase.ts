import { loadRentalV2Readiness } from "@/lib/server/rental-v2-readiness";
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
  rental_v2_agreements_received?: number | null;
  rental_v2_agreements_expected?: number | null;
  rental_v2_drivers_received?: number | null;
  rental_v2_drivers_expected?: number | null;
  rental_v2_ready?: boolean | null;
  rental_v2_signers?: Array<{
    name: string;
    role: "driver" | "passenger" | "minor";
    signatureId: string;
    signedAt: string | null;
  }> | null;
  rental_v2_exceptions?: string[] | null;
  mpwr_document_received_count?: number | null;
  mpwr_document_expected_count?: number | null;
  mpwr_confirmation_number: string | null;
  amount_due_cents: number | null;
  is_paid: boolean | null;
  requires_mpwr?: boolean | null;
  premier_adventure_assure?: boolean | null;
  adventure_assure_level?: string | null;
  belt_tire_protection?: boolean | null;
  overnight_addon?: boolean | null;
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
  epic_document_delivery_failures?: Array<{
    name: string;
    email?: string | null;
    error?: string | null;
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

type OperationalReservationAccountingRow = {
  confirmation_code: string;
  tripworks_trip_id: string;
  latest_payload: unknown;
  trip_payload: unknown;
};

type OperationalTripOrderAccountingRow = {
  tripworks_trip_id: string;
  experience_name: string | null;
  start_time: string | null;
  total_sales_cents: number | null;
  experience_total_cents: number | null;
  is_cancelled: boolean | null;
  trip_order_status_slug: string | null;
};

const SAN_JUAN_COUNTY_SALES_TAX_RATE = 0.0635;
const UTAH_RENTAL_VEHICLE_TAX_RATE = 0.025;

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function successfulGuestPaymentsCents(payload: unknown) {
  const record = asRecord(payload);
  const payments = Array.isArray(record?.payments) ? record.payments : [];

  return payments.reduce((sum, payment) => {
    const row = asRecord(payment);
    if (!row) return sum;
    const status = asRecord(row.status)?.name;
    const direction = asRecord(row.direction)?.name;
    const amount = asNumber(row.amount);
    if (status !== "Successful" || direction !== "Payment" || amount === null) return sum;
    return sum + Math.round(amount);
  }, 0);
}

function wallTimestampKey(value: string | null | undefined) {
  return value?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)?.slice(1).join(" ") ?? "";
}

function activityKey(confirmationCode: string, startTime: string | null | undefined, experienceName: string | null | undefined) {
  return `${confirmationCode}|${wallTimestampKey(startTime)}|${experienceName?.trim().toLowerCase() ?? ""}`;
}

function rentalActivityCustomerTotalCents(order: OperationalTripOrderAccountingRow) {
  const totalSales = Math.max(order.total_sales_cents ?? 0, 0);
  const rentalExperience = Math.max(order.experience_total_cents ?? 0, 0);
  const countySalesTax = Math.round(totalSales * SAN_JUAN_COUNTY_SALES_TAX_RATE);
  const rentalVehicleTax = Math.round(rentalExperience * UTAH_RENTAL_VEHICLE_TAX_RATE);
  return totalSales + countySalesTax + rentalVehicleTax;
}

export async function getReadinessRows() {
  const params = new URLSearchParams({ select: "*", limit: "500" });
  const rows = await fetchView<ReadinessRow>("guest_readiness_with_handoff_v", params);
  const confirmationCodes = [...new Set(rows.map((row) => row.confirmation_code).filter((code): code is string => Boolean(code)))];
  const readinessIds = [...new Set(rows.map((row) => row.readiness_id).filter((id): id is string => Boolean(id)))];
  const portalTokenByConfirmationCode = new Map<string, string>();
  const overnightByReadinessId = new Map<string, boolean | null>();
  const fullyCoveredRentalActivities = new Set<string>();
  const epicDocumentDeliveryFailuresByConfirmationCode = new Map<
    string,
    Array<{ name: string; email?: string | null; error?: string | null }>
  >();

  for (let index = 0; index < readinessIds.length; index += 100) {
    const batch = readinessIds.slice(index, index + 100);
    const quotedIds = batch.map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
    const overnightParams = new URLSearchParams({
      select: "readiness_id,overnight_addon",
      readiness_id: `in.(${quotedIds})`,
      limit: "1000",
    });
    const overnightRows = await fetchView<{ readiness_id: string; overnight_addon: boolean | null }>(
      "guest_readiness_operational",
      overnightParams,
      true,
    );
    for (const overnightRow of overnightRows) {
      overnightByReadinessId.set(overnightRow.readiness_id, overnightRow.overnight_addon);
    }
  }

  for (let index = 0; index < confirmationCodes.length; index += 100) {
    const batch = confirmationCodes.slice(index, index + 100);
    const quotedCodes = batch.map((code) => `"${code.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
    const portalParams = new URLSearchParams({
      select: "confirmation_code,guest_portal_token",
      confirmation_code: `in.(${quotedCodes})`,
      limit: "1000",
    });
    const failedEpicDocParams = new URLSearchParams({
      select: "confirmation_code,signer_full_name,signer_email,copy_email_error",
      confirmation_code: `in.(${quotedCodes})`,
      copy_email_status: "eq.failed",
      limit: "1000",
    });
    const accountingReservationParams = new URLSearchParams({
      select: "confirmation_code,tripworks_trip_id,latest_payload,trip_payload",
      confirmation_code: `in.(${quotedCodes})`,
      limit: "1000",
    });
    const [portalRows, failedEpicDocs, accountingReservations] = await Promise.all([
      fetchView<{ confirmation_code: string; guest_portal_token: string | null }>(
        "guest_portal_v",
        portalParams,
        true,
      ),
      fetchView<{
        confirmation_code: string;
        signer_full_name: string;
        signer_email: string | null;
        copy_email_error: string | null;
      }>("epic_waiver_signatures", failedEpicDocParams, true),
      fetchView<OperationalReservationAccountingRow>(
        "operational_reservations",
        accountingReservationParams,
        true,
      ),
    ]);

    const tripIds = [...new Set(accountingReservations.map((row) => row.tripworks_trip_id).filter(Boolean))];
    if (tripIds.length > 0) {
      const quotedTripIds = tripIds.map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
      const tripOrderParams = new URLSearchParams({
        select: "tripworks_trip_id,experience_name,start_time,total_sales_cents,experience_total_cents,is_cancelled,trip_order_status_slug",
        tripworks_trip_id: `in.(${quotedTripIds})`,
        limit: "2000",
      });
      const tripOrders = await fetchView<OperationalTripOrderAccountingRow>(
        "operational_trip_orders",
        tripOrderParams,
        true,
      );
      const tripOrdersByTrip = new Map<string, OperationalTripOrderAccountingRow[]>();
      for (const order of tripOrders) {
        const list = tripOrdersByTrip.get(order.tripworks_trip_id) ?? [];
        list.push(order);
        tripOrdersByTrip.set(order.tripworks_trip_id, list);
      }

      for (const reservation of accountingReservations) {
        const activeOrders = (tripOrdersByTrip.get(reservation.tripworks_trip_id) ?? [])
          .filter((order) => order.is_cancelled !== true && order.trip_order_status_slug !== "cancelled")
          .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

        // Only override the umbrella balance when multiple active rental activities share
        // one TripWorks confirmation. Successful payments are applied chronologically to
        // prove that an earlier activity is fully covered. Any activity we cannot prove is
        // fully covered keeps the original umbrella balance and remains blocked.
        if (activeOrders.length < 2) continue;

        let availablePayments = Math.max(
          successfulGuestPaymentsCents(reservation.latest_payload),
          successfulGuestPaymentsCents(reservation.trip_payload),
        );

        for (const order of activeOrders) {
          const activityTotal = rentalActivityCustomerTotalCents(order);
          if (activityTotal <= 0) continue;
          if (availablePayments + 1 < activityTotal) break;

          availablePayments -= activityTotal;
          fullyCoveredRentalActivities.add(
            activityKey(reservation.confirmation_code, order.start_time, order.experience_name),
          );
        }
      }
    }

    for (const portalRow of portalRows) {
      if (portalRow.confirmation_code && portalRow.guest_portal_token && !portalTokenByConfirmationCode.has(portalRow.confirmation_code)) {
        portalTokenByConfirmationCode.set(portalRow.confirmation_code, portalRow.guest_portal_token);
      }
    }

    for (const failedEpicDoc of failedEpicDocs) {
      if (!failedEpicDoc.confirmation_code || !failedEpicDoc.signer_full_name) continue;
      const failures = epicDocumentDeliveryFailuresByConfirmationCode.get(failedEpicDoc.confirmation_code) ?? [];
      failures.push({
        name: failedEpicDoc.signer_full_name,
        email: failedEpicDoc.signer_email,
        error: failedEpicDoc.copy_email_error,
      });
      epicDocumentDeliveryFailuresByConfirmationCode.set(failedEpicDoc.confirmation_code, failures);
    }
  }

  const rentalV2Readiness = await loadRentalV2Readiness(
    rows
      .filter((row) => row.business_line === "rental" && row.readiness_id)
      .map((row) => ({
        readinessId: row.readiness_id!,
        confirmationCode: row.confirmation_code,
        expectedGuestCount: row.expected_guest_count,
        vehicleCount: row.total_vehicle_count,
      })),
  );

  return rows
    .map((row) => {
      const activityIsCovered =
        row.business_line === "rental" &&
        fullyCoveredRentalActivities.has(
          activityKey(row.confirmation_code, row.visit_start_time, row.product_display_name),
        );

      const rentalV2 = row.readiness_id
        ? rentalV2Readiness.get(row.readiness_id)
        : undefined;

      return {
        ...row,
        rental_v2_agreements_received: rentalV2?.agreementsReceived ?? null,
        rental_v2_agreements_expected: rentalV2?.agreementsExpected ?? null,
        rental_v2_drivers_received: rentalV2?.driversReceived ?? null,
        rental_v2_drivers_expected: rentalV2?.driversExpected ?? null,
        rental_v2_ready: rentalV2?.ready ?? null,
        rental_v2_signers: rentalV2?.signers ?? null,
        rental_v2_exceptions: rentalV2?.exceptions ?? null,
        amount_due_cents: activityIsCovered ? 0 : row.amount_due_cents,
        is_paid: activityIsCovered ? true : row.is_paid,
        attention_flags: activityIsCovered
          ? (row.attention_flags ?? []).filter((flag) => flag !== "payment")
          : row.attention_flags,
        handoff_status: row.handoff_status === "tour_returned" ? "checked_in" : row.handoff_status,
        guest_portal_token: portalTokenByConfirmationCode.get(row.confirmation_code) ?? null,
        overnight_addon: row.readiness_id ? (overnightByReadinessId.get(row.readiness_id) ?? null) : null,
        epic_document_delivery_failures:
          epicDocumentDeliveryFailuresByConfirmationCode.get(row.confirmation_code) ?? [],
      };
    })
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
    select: "readiness_id,confirmation_code,visit_start_time,business_line,customer_phone_last_four,handoff_status,product_display_name,rental_duration,total_vehicle_count,expected_guest_count,amount_due_cents,mpwr_document_received_count,mpwr_document_expected_count,ohv_required,ohv_certificate_uploaded",
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
      "total_vehicle_count" |
      "expected_guest_count" |
      "amount_due_cents" |
      "mpwr_document_received_count" |
      "mpwr_document_expected_count" |
      "ohv_required" |
      "ohv_certificate_uploaded"
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
  const rentalV2Readiness = await loadRentalV2Readiness(
    readinessRows
      .filter((row) => row.business_line === "rental" && row.readiness_id)
      .map((row) => ({
        readinessId: row.readiness_id!,
        confirmationCode: row.confirmation_code,
        expectedGuestCount: row.expected_guest_count,
        vehicleCount: row.total_vehicle_count,
      })),
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

      const rentalV2 = readiness?.readiness_id
        ? rentalV2Readiness.get(readiness.readiness_id)
        : undefined;
      const rentalOtherRequirementsComplete =
        row.business_line !== "rental" ||
        (
          (readiness?.amount_due_cents ?? 0) <= 0 &&
          (readiness?.mpwr_document_received_count ?? 0) >=
            (readiness?.mpwr_document_expected_count ?? 0) &&
          (
            readiness?.ohv_required === false ||
            (
              readiness?.ohv_certificate_uploaded === true &&
              hasRequiredOhvCertificates
            )
          )
        );
      const rentalReady =
        row.business_line !== "rental" ||
        (rentalV2?.ready === true && rentalOtherRequirementsComplete);

      return {
        ...row,
        customer_phone_last_four: readiness?.customer_phone_last_four ?? row.customer_phone_last_four ?? null,
        handoff_status: readiness?.handoff_status ?? row.handoff_status ?? null,
        product_display_name: readiness?.product_display_name ?? row.product_display_name ?? row.board_activity_label,
        rental_duration: readiness?.rental_duration ?? row.rental_duration ?? null,
        total_vehicle_count: totalVehicleCount,
        board_action_label:
          row.business_line === "rental"
            ? rentalReady
              ? "See Agent"
              : "Proceed to Kiosk"
            : hasRequiredOhvCertificates
              ? row.board_action_label
              : "Proceed to Kiosk",
        board_action_type:
          row.business_line === "rental"
            ? rentalReady
              ? "agent"
              : "kiosk"
            : hasRequiredOhvCertificates
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