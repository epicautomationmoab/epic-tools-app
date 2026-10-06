import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";
import { firstNameFromDisplayName, renderEpicEmailHtml, renderEpicPlainTextSignature, renderEpicSignatureHtml } from "@/lib/server/epic-email-signature";
import { sendCallRailSms } from "@/lib/server/callrail";

const EXPECTED_MAILBOX = "hello@epic4x4adventures.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizePhone(input: string | null | undefined) {
  if (!input) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function latestCallRailTrackingNumber(phone: string | null, opportunityId: string | null, reservationId: string | null) {
  const filters: string[] = [];
  if (opportunityId) filters.push(`matched_opportunity_id.eq.${encodeURIComponent(opportunityId)}`);
  if (reservationId) filters.push(`matched_reservation_id.eq.${encodeURIComponent(reservationId)}`);
  if (phone) filters.push(`normalized_customer_phone.eq.${encodeURIComponent(phone)}`);
  if (!filters.length) return null;
  const rows = await rest<Array<{direction:string|null;source_number:string|null;destination_number:string|null;sent_at:string|null;first_received_at:string|null}>>(
    `callrail_text_messages?or=(${filters.join(",")})&select=${encodeURIComponent("direction,source_number,destination_number,sent_at,first_received_at")}&order=sent_at.desc.nullslast,first_received_at.desc&limit=25`,
  );
  for (const row of rows) {
    const tracking = (row.direction || "").toLowerCase() === "inbound" ? row.destination_number : row.source_number;
    if (tracking?.trim()) return tracking.trim();
  }
  return null;
}

function encodeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function buildRawMessage(to: string, subject: string, body: string, senderFirstName: string, trackingUrl: string, htmlBody?: string | null) {
  const altBoundary = `epic_alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const plainText = `${body}\n\n${renderEpicPlainTextSignature(senderFirstName)}`;
  const html = `${htmlBody || renderEpicEmailHtml(body, senderFirstName)}${renderEpicSignatureHtml(senderFirstName)}<img src="${trackingUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`;
  const lines = [
    `From: ${senderFirstName} at Epic 4X4 Adventures <${EXPECTED_MAILBOX}>`,
    `To: ${to}`,
    `Reply-To: ${EXPECTED_MAILBOX}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    plainText,
    "",
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${altBoundary}--`,
  ];
  return base64Url(lines.join("\r\n"));
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...serverSupabaseHeaders(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

type OpportunityRow = {
  id: string;
  contact_id: string | null;
  customer_name: string | null;
  email: string | null;
  phone_e164: string | null;
  matched_booking_trip_id: string | null;
};

type ContactRow = {
  id: string;
  display_name: string | null;
  canonical_email: string | null;
  canonical_phone: string | null;
  tripworks_is_opt_in: boolean | null;
  tripworks_customer_id: number | null;
};

type ReservationRow = {
  id: string;
  confirmation_code: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  tripworks_customer_id: number | null;
};

async function firstReservationForIdentity(contact: ContactRow | null, email: string | null, phone: string | null) {
  if (contact?.tripworks_customer_id) {
    const rows = await rest<ReservationRow[]>(
      `operational_reservations?tripworks_customer_id=eq.${encodeURIComponent(String(contact.tripworks_customer_id))}&select=id,confirmation_code,customer_name,customer_email,customer_phone,tripworks_customer_id&limit=1`,
    );
    if (rows[0]) return rows[0];
  }
  if (email) {
    const rows = await rest<ReservationRow[]>(
      `operational_reservations?customer_email=ilike.${encodeURIComponent(email)}&select=id,confirmation_code,customer_name,customer_email,customer_phone,tripworks_customer_id&limit=1`,
    );
    if (rows[0]) return rows[0];
  }
  if (phone) {
    const rows = await rest<ReservationRow[]>(
      `operational_reservations?customer_phone=eq.${encodeURIComponent(phone)}&select=id,confirmation_code,customer_name,customer_email,customer_phone,tripworks_customer_id&limit=1`,
    );
    if (rows[0]) return rows[0];
  }
  return null;
}

export async function POST(request: NextRequest) {
  const accessToken = bearerToken(request) || request.cookies.get("epic_access_token")?.value || null;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as {
    channel?: "email" | "text";
    confirmation?: string | null;
    opportunity_id?: string | null;
    contact_id?: string | null;
    email?: string | null;
    phone?: string | null;
    customer_name?: string | null;
    subject?: string | null;
    message_text?: string | null;
    message_html?: string | null;
  } | null;

  const channel = payload?.channel;
  const confirmation = payload?.confirmation?.trim().toUpperCase() || null;
  const opportunityId = payload?.opportunity_id?.trim() || null;
  let contactId = payload?.contact_id?.trim() || null;
  const requestedEmail = payload?.email?.trim().toLowerCase() || null;
  const requestedPhone = normalizePhone(payload?.phone || null);
  const messageText = payload?.message_text?.trim() || "";
  const messageHtml = payload?.message_html?.trim() || null;

  if (channel !== "email" && channel !== "text") {
    return NextResponse.json({ error: "Choose Email or Text." }, { status: 400 });
  }
  if (!messageText) return NextResponse.json({ error: "Message cannot be blank." }, { status: 400 });
  if (channel === "text" && messageText.length > 1600) {
    return NextResponse.json({ error: "Message is too long. Keep it under 1,600 characters." }, { status: 400 });
  }
  if (channel === "email" && messageText.length > 20000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  try {
    let opportunity: OpportunityRow | null = null;
    if (opportunityId) {
      const rows = await rest<OpportunityRow[]>(
        `sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}&select=id,contact_id,customer_name,email,phone_e164,matched_booking_trip_id&limit=1`,
      );
      opportunity = rows[0] || null;
      if (!contactId) contactId = opportunity?.contact_id || null;
    }

    let contact: ContactRow | null = null;
    if (contactId) {
      const rows = await rest<ContactRow[]>(
        `sales_contacts?id=eq.${encodeURIComponent(contactId)}&select=id,display_name,canonical_email,canonical_phone,tripworks_is_opt_in,tripworks_customer_id&limit=1`,
      );
      contact = rows[0] || null;
    }

    let reservation: ReservationRow | null = null;
    if (confirmation) {
      const rows = await rest<ReservationRow[]>(
        `operational_reservations?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=id,confirmation_code,customer_name,customer_email,customer_phone,tripworks_customer_id&limit=1`,
      );
      reservation = rows[0] || null;
      if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    }

    const recipientEmail = (
      reservation?.customer_email ||
      contact?.canonical_email ||
      opportunity?.email ||
      requestedEmail
    )?.trim().toLowerCase() || null;
    const recipientPhone = normalizePhone(
      reservation?.customer_phone ||
      contact?.canonical_phone ||
      opportunity?.phone_e164 ||
      requestedPhone,
    );
    const customerName = reservation?.customer_name || contact?.display_name || opportunity?.customer_name || payload?.customer_name || null;

    let customerReservation = reservation;
    if (!customerReservation && opportunity?.matched_booking_trip_id) {
      const rows = await rest<ReservationRow[]>(
        `operational_reservations?tripworks_trip_id=eq.${encodeURIComponent(opportunity.matched_booking_trip_id)}&select=id,confirmation_code,customer_name,customer_email,customer_phone,tripworks_customer_id&limit=1`,
      );
      customerReservation = rows[0] || null;
    }
    if (!customerReservation) {
      customerReservation = await firstReservationForIdentity(contact, recipientEmail, recipientPhone);
    }
    const isCustomer = Boolean(customerReservation);

    if (channel === "text") {
      if (!recipientPhone) return NextResponse.json({ error: "This person does not have a phone number." }, { status: 409 });
      if (!isCustomer && contact?.tripworks_is_opt_in === false) {
        return NextResponse.json({ error: "SMS blocked: this prospect opted out in TripWorks." }, { status: 403 });
      }

      const trackingNumber = await latestCallRailTrackingNumber(recipientPhone, opportunityId, reservation?.id || customerReservation?.id || null);
      const result = await sendCallRailSms({ phone: recipientPhone, body: messageText, trackingNumber });
      return NextResponse.json({
        ok: true,
        channel: "text",
        sent_at: new Date().toISOString(),
        sent_by: profile.display_name,
        customer_phone: recipientPhone,
        conversation_id: result.conversationId,
        transactional_customer: isCustomer,
      });
    }

    const subject = payload?.subject?.trim() || "Your Epic 4X4 Adventure";
    if (subject.length > 250) return NextResponse.json({ error: "Subject is too long." }, { status: 400 });
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json({ error: "This person does not have a valid email address." }, { status: 409 });
    }

    const connections = await rest<Array<{ refresh_token: string }>>(
      `google_mailbox_connections?mailbox_email=eq.${encodeURIComponent(EXPECTED_MAILBOX)}&select=refresh_token&limit=1`,
    );
    const refreshToken = connections[0]?.refresh_token;
    if (!refreshToken) {
      return NextResponse.json({ error: "The hello@epic4x4adventures.com mailbox is not connected." }, { status: 503 });
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: requiredEnv("GOOGLE_GMAIL_CLIENT_ID"),
        client_secret: requiredEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      throw new Error(tokenPayload?.error_description || tokenPayload?.error || "Unable to refresh Gmail authorization.");
    }

    const senderFirstName = firstNameFromDisplayName(profile.display_name);
    const communicationId = randomUUID();
    const trackingUrl = new URL(`/api/email/open/${communicationId}`, request.nextUrl.origin).toString();
    const gmailResponse = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: buildRawMessage(recipientEmail, subject, messageText, senderFirstName, trackingUrl, messageHtml) }),
      cache: "no-store",
    });
    const gmailPayload = await gmailResponse.json();
    if (!gmailResponse.ok || !gmailPayload?.id) {
      throw new Error(gmailPayload?.error?.message || "Gmail did not send the message.");
    }

    const now = new Date().toISOString();
    const threadId = gmailPayload.threadId || null;
    const matchedReservation = reservation || customerReservation;

    if (confirmation) {
      await rest("guest_communications", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          id: communicationId,
          confirmation_code: confirmation,
          communication_type: "manual_guest_email",
          customer_name: customerName,
          customer_email: recipientEmail,
          status: "sent",
          provider_message_id: gmailPayload.id,
          provider_thread_id: threadId,
          sent_at: now,
          queued_at: now,
          subject,
          body_text: messageText,
          sender_email: EXPECTED_MAILBOX,
          sender_name: profile.display_name,
          attempt_count: 1,
          last_attempt_at: now,
          test_mode: false,
        }),
      });
    }

    await rest("gmail_messages", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        mailbox_email: EXPECTED_MAILBOX,
        gmail_message_id: gmailPayload.id,
        gmail_thread_id: threadId,
        direction: "outbound",
        from_email: EXPECTED_MAILBOX,
        to_emails: [recipientEmail],
        subject,
        body_text: messageText,
        sent_at: now,
        matched_confirmation_code: confirmation || matchedReservation?.confirmation_code || null,
        matched_reservation_id: matchedReservation?.id || null,
        matched_sales_opportunity_id: opportunityId,
        match_method: "epic_send",
        match_confidence: "high",
        contact_name: customerName,
        contact_email: recipientEmail,
        contact_phone: recipientPhone,
        source_type: "manual_send",
        updated_at: now,
      }),
    });

    return NextResponse.json({
      ok: true,
      channel: "email",
      message_id: gmailPayload.id,
      thread_id: threadId,
      recipient: recipientEmail,
      transactional_customer: isCustomer,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send message." }, { status: 500 });
  }
}
