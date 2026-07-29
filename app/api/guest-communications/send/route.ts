import { NextResponse } from "next/server";
import { Resend } from "resend";

type CommunicationRow = {
  id: string;
  confirmation_code: string;
  communication_type: string;
  guest_portal_token: string;
  customer_name: string;
  customer_email: string | null;
  status: string;
  attempt_count: number | null;
  scheduled_for: string | null;
  visit_date: string | null;
  test_mode: boolean | null;
  test_recipient_email: string | null;
};

type GuestPortalRow = {
  product_display_name: string;
  visit_start_time: string;
  business_line: string | null;
  total_vehicle_count: number | null;
  epic_document_received_count: number | null;
  epic_document_expected_count: number | null;
  mpwr_document_received_count: number | null;
  mpwr_document_expected_count: number | null;
  ohv_certificate_uploaded: boolean | null;
};

const TOUR_ADDRESS = "1041 S. Main Street, Moab, UT 84532";
const RENTAL_ADDRESS = "11860 S. Highway 191, Moab, UT 84532";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSupabaseConfig() {
  const rawUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SECRET_KEY");
  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: normalizedUrl.replace(/\/+$/, ""), key };
}

function supabaseHeaders(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "Guest";
}

function formatVisitTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function mountainDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function buildReservationSummary(rows: GuestPortalRow[]) {
  return rows.map((row) => {
    const vehicleText = row.total_vehicle_count && row.total_vehicle_count > 0
      ? ` · ${row.total_vehicle_count} vehicle${row.total_vehicle_count === 1 ? "" : "s"}`
      : "";
    return `${row.product_display_name} · ${formatVisitTime(row.visit_start_time)}${vehicleText}`;
  }).join("\n");
}

function buildReadinessMessage(rows: GuestPortalRow[]) {
  const epicExpected = rows.reduce((sum, row) => sum + (row.epic_document_expected_count ?? 0), 0);
  const epicReceived = rows.reduce((sum, row) => sum + (row.epic_document_received_count ?? 0), 0);
  const mpwrExpected = rows.reduce((sum, row) => sum + (row.mpwr_document_expected_count ?? 0), 0);
  const mpwrReceived = rows.reduce((sum, row) => sum + (row.mpwr_document_received_count ?? 0), 0);
  const ohvComplete = rows.every(
    (row) => row.business_line?.trim().toLowerCase() !== "rental" || row.ohv_certificate_uploaded === true,
  );

  if (epicReceived >= epicExpected && mpwrReceived >= mpwrExpected && ohvComplete) {
    return {
      headline: "You’re Ready!",
      message: "Nicely done—your required items are complete. Review your reservation and arrival details before your adventure.",
    };
  }
  return {
    headline: "A Few Items Still Need Attention",
    message: "Please open your guest portal to review and complete any remaining documents before arriving for your adventure.",
  };
}

function getLocation(rows: GuestPortalRow[]) {
  const businessLines = new Set(rows.map((row) => row.business_line?.trim().toLowerCase()).filter(Boolean));
  if (businessLines.size !== 1) throw new Error("The reservation needs manual business-line location review.");
  const address = businessLines.has("rental") ? RENTAL_ADDRESS : TOUR_ADDRESS;
  return {
    address,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
  };
}

async function fetchOneCommunication(params: URLSearchParams) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/guest_communications?${params}`, {
    headers: supabaseHeaders(config.key), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load communication queue: ${await response.text()}`);
  const rows = (await response.json()) as CommunicationRow[];
  return rows[0] ?? null;
}

async function loadNextCommunication() {
  const dueReminder = await fetchOneCommunication(new URLSearchParams({
    select: "*",
    communication_type: "eq.arrival_reminder_day_before",
    status: "eq.scheduled",
    scheduled_for: `lte.${new Date().toISOString()}`,
    customer_email: "not.is.null",
    order: "scheduled_for.asc",
    limit: "1",
  }));

  if (dueReminder) return dueReminder;

  return fetchOneCommunication(new URLSearchParams({
    select: "*",
    communication_type: "eq.initial_guest_portal",
    status: "eq.ready",
    customer_email: "not.is.null",
    order: "ready_at.asc,queued_at.asc",
    limit: "1",
  }));
}

async function loadGuestPortalRows(token: string) {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({ select: "*", guest_portal_token: `eq.${token}`, order: "visit_start_time.asc" });
  const response = await fetch(`${config.url}/rest/v1/guest_portal_v?${params}`, {
    headers: supabaseHeaders(config.key), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load portal data: ${await response.text()}`);
  return (await response.json()) as GuestPortalRow[];
}

async function updateCommunication(id: string, values: Record<string, unknown>) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/guest_communications?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...supabaseHeaders(config.key), Prefer: "return=representation" },
    body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Unable to update communication: ${text}`);
  const rows = text ? (JSON.parse(text) as Record<string, unknown>[]) : [];
  if (rows.length !== 1) throw new Error(`Communication update matched ${rows.length} rows for id ${id}.`);
}

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${requiredEnv("GUEST_EMAIL_SENDER_SECRET")}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const communication = await loadNextCommunication();
  if (!communication) {
    return NextResponse.json({ ok: true, sent: false, message: "No communications are ready." });
  }

  if (
    communication.communication_type === "arrival_reminder_day_before" &&
    communication.visit_date &&
    communication.visit_date <= mountainDate()
  ) {
    await updateCommunication(communication.id, {
      status: "cancelled",
      last_error: "Reminder became stale before sending.",
    });
    return NextResponse.json({ ok: true, sent: false, skippedStale: communication.id });
  }

  const attemptTime = new Date().toISOString();
  await updateCommunication(communication.id, {
    status: "sending",
    attempt_count: (communication.attempt_count ?? 0) + 1,
    last_attempt_at: attemptTime,
    last_error: null,
  });

  try {
    const portalRows = await loadGuestPortalRows(communication.guest_portal_token);
    if (!portalRows.length) throw new Error("No guest portal rows were found.");

    const configuredMode = process.env.GUEST_EMAIL_MODE?.trim().toLowerCase() ?? "test";
    const mustUseTestRecipient = configuredMode !== "production" || communication.test_mode === true;
    const recipient = mustUseTestRecipient
      ? communication.test_recipient_email || requiredEnv("GUEST_EMAIL_TEST_RECIPIENT")
      : communication.customer_email;
    if (!recipient) throw new Error("No recipient email address is available.");

    const templateId = communication.communication_type === "arrival_reminder_day_before"
      ? requiredEnv("RESEND_REMINDER_TEMPLATE_ID")
      : requiredEnv("RESEND_CONFIRMATION_TEMPLATE_ID");
    const readiness = buildReadinessMessage(portalRows);
    const location = getLocation(portalRows);
    const portalUrl = `${requiredEnv("GUEST_PORTAL_BASE_URL").replace(/\/+$/, "")}/guest/${communication.guest_portal_token}`;

    const resend = new Resend(requiredEnv("RESEND_API_KEY"));
    const { data, error } = await resend.emails.send({
      from: requiredEnv("GUEST_EMAIL_FROM"),
      to: recipient,
      bcc: requiredEnv("GUEST_EMAIL_BCC"),
      replyTo: requiredEnv("GUEST_EMAIL_REPLY_TO"),
      template: {
        id: templateId,
        variables: {
          ARRIVAL_INSTRUCTIONS: "Please arrive 15 minutes before your scheduled departure time.",
          CONFIRMATION_CODE: communication.confirmation_code,
          DIRECTIONS_URL: location.directionsUrl,
          GUEST_NAME: firstName(communication.customer_name),
          INTENDED_RECIPIENT: communication.customer_email ?? "",
          LOCATION_SUMMARY: location.address,
          PORTAL_URL: portalUrl,
          READINESS_HEADLINE: readiness.headline,
          READINESS_MESSAGE: readiness.message,
          RESERVATION_SUMMARY: buildReservationSummary(portalRows),
        },
      },
    }, { idempotencyKey: `guest-communication-${communication.id}` });

    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("Resend did not return a message ID.");

    await updateCommunication(communication.id, {
      status: "sent",
      provider_message_id: data.id,
      sent_at: new Date().toISOString(),
      ready_at: communication.scheduled_for ?? attemptTime,
      test_mode: mustUseTestRecipient,
      test_recipient_email: mustUseTestRecipient ? recipient : null,
      last_error: null,
    });

    return NextResponse.json({
      ok: true,
      sent: true,
      communicationId: communication.id,
      confirmationCode: communication.confirmation_code,
      recipient,
      intendedRecipient: communication.customer_email,
      testMode: mustUseTestRecipient,
      providerMessageId: data.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email sender error.";
    await updateCommunication(communication.id, { status: "failed", last_error: message.slice(0, 1000) });
    return NextResponse.json({ ok: false, communicationId: communication.id, error: message }, { status: 500 });
  }
}
