import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

type CommunicationRow = {
  id: string;
  confirmation_code: string;
  guest_portal_token: string;
  customer_name: string;
  customer_email: string | null;
};

type ReadinessContactRow = {
  effective_email: string | null;
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
const DEFAULT_GUEST_PORTAL_BASE_URL = "https://team.myepicreservation.com";

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

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

async function canResendConfirmation(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  return Boolean(profile || workstation || hasPreviewAccess(request));
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

async function loadCommunication(confirmationCode: string) {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "id,confirmation_code,guest_portal_token,customer_name,customer_email",
    communication_type: "eq.initial_guest_portal",
    confirmation_code: `eq.${confirmationCode}`,
    limit: "1",
  });
  const response = await fetch(`${config.url}/rest/v1/guest_communications?${params}`, {
    headers: supabaseHeaders(config.key),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load confirmation communication: ${await response.text()}`);
  const rows = (await response.json()) as CommunicationRow[];
  return rows[0] ?? null;
}

async function loadEffectiveEmail(confirmationCode: string, fallback: string | null) {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "effective_email",
    confirmation_code: `eq.${confirmationCode}`,
    limit: "1",
  });
  const response = await fetch(`${config.url}/rest/v1/dashboard_guest_readiness_sot?${params}`, {
    headers: supabaseHeaders(config.key),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load effective guest email: ${await response.text()}`);
  const rows = (await response.json()) as ReadinessContactRow[];
  return rows[0]?.effective_email?.trim() || fallback?.trim() || null;
}

async function recordManualAttempt(
  communicationId: string,
  recipientEmail: string,
  requestedBy: string,
  providerMessageId: string,
) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/guest_communication_attempts`, {
    method: "POST",
    headers: { ...supabaseHeaders(config.key), Prefer: "return=minimal" },
    body: JSON.stringify({
      communication_id: communicationId,
      attempt_type: "manual",
      recipient_email: recipientEmail,
      status: "sent",
      requested_by: requestedBy,
      provider_message_id: providerMessageId,
      sending_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Confirmation sent, but the resend audit could not be recorded: ${await response.text()}`);
}

async function loadGuestPortalRows(token: string) {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "*",
    guest_portal_token: `eq.${token}`,
    order: "visit_start_time.asc",
  });
  const response = await fetch(`${config.url}/rest/v1/guest_portal_v?${params}`, {
    headers: supabaseHeaders(config.key),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load portal data: ${await response.text()}`);
  return (await response.json()) as GuestPortalRow[];
}

export async function POST(request: NextRequest) {
  if (!await canResendConfirmation(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { confirmationCode?: string };
  try {
    body = (await request.json()) as { confirmationCode?: string };
  } catch {
    return NextResponse.json({ error: "A JSON body with confirmationCode is required." }, { status: 400 });
  }

  const confirmationCode = body.confirmationCode?.trim();
  if (!confirmationCode) {
    return NextResponse.json({ error: "confirmationCode is required." }, { status: 400 });
  }

  try {
    const communication = await loadCommunication(confirmationCode);
    if (!communication) {
      return NextResponse.json({ error: "No confirmation communication exists for this booking." }, { status: 404 });
    }

    const recipientEmail = await loadEffectiveEmail(communication.confirmation_code, communication.customer_email);
    if (!recipientEmail) {
      return NextResponse.json({ error: "The guest does not have an email address." }, { status: 409 });
    }

    const portalRows = await loadGuestPortalRows(communication.guest_portal_token);
    if (!portalRows.length) {
      return NextResponse.json({ error: "No guest portal rows were found." }, { status: 409 });
    }

    const readiness = buildReadinessMessage(portalRows);
    const location = getLocation(portalRows);
    const portalBaseUrl = (process.env.GUEST_PORTAL_BASE_URL?.trim() || DEFAULT_GUEST_PORTAL_BASE_URL).replace(/\/+$/, "");
    const portalUrl = `${portalBaseUrl}/guest/${communication.guest_portal_token}`;

    const resend = new Resend(requiredEnv("RESEND_API_KEY"));
    const { data, error } = await resend.emails.send({
      from: requiredEnv("GUEST_EMAIL_FROM"),
      to: recipientEmail,
      bcc: requiredEnv("GUEST_EMAIL_BCC"),
      replyTo: requiredEnv("GUEST_EMAIL_REPLY_TO"),
      template: {
        id: requiredEnv("RESEND_CONFIRMATION_TEMPLATE_ID"),
        variables: {
          ARRIVAL_INSTRUCTIONS: "Please arrive 15 minutes before your scheduled departure time.",
          CONFIRMATION_CODE: communication.confirmation_code,
          DIRECTIONS_URL: location.directionsUrl,
          GUEST_NAME: firstName(communication.customer_name),
          INTENDED_RECIPIENT: recipientEmail,
          LOCATION_SUMMARY: location.address,
          PORTAL_URL: portalUrl,
          READINESS_HEADLINE: readiness.headline,
          READINESS_MESSAGE: readiness.message,
          RESERVATION_SUMMARY: buildReservationSummary(portalRows),
        },
      },
    }, { idempotencyKey: `manual-confirmation-${communication.id}-${Date.now()}` });

    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("Resend did not return a message ID.");

    const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
    await recordManualAttempt(
      communication.id,
      recipientEmail,
      profile?.display_name || profile?.email || "EpicTools",
      data.id,
    );

    return NextResponse.json({
      ok: true,
      confirmationCode: communication.confirmation_code,
      recipient: recipientEmail,
      providerMessageId: data.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown manual confirmation error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
