import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce?: { message?: string; type?: string; subType?: string };
  };
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function supabaseConfig() {
  const rawUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key: requiredEnv("SUPABASE_SECRET_KEY") };
}

function headers(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function failureDetail(event: ResendEvent) {
  return event.data?.bounce?.message || event.data?.bounce?.subType || event.data?.bounce?.type || null;
}

function isFailure(type: string) {
  return ["email.bounced", "email.failed", "email.suppressed"].includes(type);
}

function copyEmailStatus(type: string) {
  if (type === "email.delivered") return "delivered";
  if (type === "email.bounced") return "bounced";
  if (type === "email.failed") return "failed";
  if (type === "email.suppressed") return "suppressed";
  return null;
}

function time(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

async function latestRecordedEvent(url: string, key: string, messageId: string) {
  const params = new URLSearchParams({
    select: "event_type,event_at",
    provider_message_id: `eq.${messageId}`,
    order: "event_at.desc",
    limit: "1",
  });
  const response = await fetch(`${url}/rest/v1/guest_email_delivery_events?${params}`, {
    headers: headers(key),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to inspect delivery event history: ${await response.text()}`);
  const rows = await response.json() as Array<{ event_type: string; event_at: string }>;
  return rows[0] ?? null;
}

async function verifyResendEvent(request: NextRequest) {
  const payload = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) throw new Error("Missing Resend webhook signature headers.");

  const resend = new Resend(requiredEnv("RESEND_API_KEY"));
  return resend.webhooks.verify({
    payload,
    headers: { id, timestamp, signature },
    webhookSecret: requiredEnv("RESEND_WEBHOOK_SECRET"),
  }) as ResendEvent;
}

export async function POST(request: NextRequest) {
  let event: ResendEvent;
  try {
    event = await verifyResendEvent(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Resend webhook signature.";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  try {
    const eventType = event.type?.trim();
    const messageId = event.data?.email_id?.trim();
    if (!eventType || !messageId) {
      return NextResponse.json({ ok: false, error: "Missing event type or email id." }, { status: 400 });
    }

    const { url, key } = supabaseConfig();
    const recipient = event.data?.to?.[0] ?? null;
    const eventAt = event.created_at ?? new Date().toISOString();

    const eventInsert = await fetch(`${url}/rest/v1/guest_email_delivery_events`, {
      method: "POST",
      headers: { ...headers(key), Prefer: "return=minimal" },
      body: JSON.stringify({
        provider: "resend",
        provider_event_id: request.headers.get("svix-id"),
        provider_message_id: messageId,
        event_type: eventType,
        recipient_email: recipient,
        event_at: eventAt,
        payload: event,
      }),
    });
    if (!eventInsert.ok && eventInsert.status !== 409) {
      throw new Error(`Unable to record Resend event: ${await eventInsert.text()}`);
    }

    const latest = await latestRecordedEvent(url, key, messageId);
    const isLatestEvent = !latest || time(eventAt) >= time(latest.event_at);
    if (!isLatestEvent) {
      return NextResponse.json({ ok: true, matched: true, stateChanged: false, reason: "older_event" });
    }

    const epicCopyParams = new URLSearchParams({
      select: "id",
      copy_email_message_id: `eq.${messageId}`,
      limit: "1",
    });
    const epicCopyResponse = await fetch(`${url}/rest/v1/epic_waiver_signatures?${epicCopyParams}`, {
      headers: headers(key),
      cache: "no-store",
    });
    if (!epicCopyResponse.ok) throw new Error(`Unable to match Epic document copy email: ${await epicCopyResponse.text()}`);
    const epicCopies = await epicCopyResponse.json() as Array<{ id: string }>;
    const epicCopy = epicCopies[0] ?? null;

    if (epicCopy) {
      const status = copyEmailStatus(eventType);
      if (status) {
        const response = await fetch(`${url}/rest/v1/epic_waiver_signatures?id=eq.${encodeURIComponent(epicCopy.id)}`, {
          method: "PATCH",
          headers: { ...headers(key), Prefer: "return=minimal" },
          body: JSON.stringify({
            copy_email_status: status,
            copy_email_error: isFailure(eventType) ? failureDetail(event) : null,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) throw new Error(`Unable to update Epic document copy delivery status: ${await response.text()}`);
      }
      return NextResponse.json({ ok: true, matched: true, source: "epic_document_copy", stateChanged: Boolean(status) });
    }

    const attemptParams = new URLSearchParams({
      select: "id,communication_id",
      provider_message_id: `eq.${messageId}`,
      limit: "1",
    });
    const attemptResponse = await fetch(`${url}/rest/v1/guest_communication_attempts?${attemptParams}`, {
      headers: headers(key), cache: "no-store",
    });
    if (!attemptResponse.ok) throw new Error(`Unable to match Resend attempt: ${await attemptResponse.text()}`);
    const attempts = await attemptResponse.json() as Array<{ id: string; communication_id: string }>;
    const attempt = attempts[0] ?? null;

    let communicationId = attempt?.communication_id ?? null;
    let confirmationCode: string | null = null;

    if (communicationId) {
      const params = new URLSearchParams({ select: "id,confirmation_code", id: `eq.${communicationId}`, limit: "1" });
      const response = await fetch(`${url}/rest/v1/guest_communications?${params}`, { headers: headers(key), cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load communication: ${await response.text()}`);
      const rows = await response.json() as Array<{ id: string; confirmation_code: string }>;
      confirmationCode = rows[0]?.confirmation_code ?? null;
    } else {
      const params = new URLSearchParams({ select: "id,confirmation_code", provider_message_id: `eq.${messageId}`, limit: "1" });
      const response = await fetch(`${url}/rest/v1/guest_communications?${params}`, { headers: headers(key), cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to match Resend communication: ${await response.text()}`);
      const rows = await response.json() as Array<{ id: string; confirmation_code: string }>;
      communicationId = rows[0]?.id ?? null;
      confirmationCode = rows[0]?.confirmation_code ?? null;
    }

    if (!communicationId) return NextResponse.json({ ok: true, matched: false });

    if (eventType === "email.delivered") {
      const response = await fetch(`${url}/rest/v1/guest_email_delivery_incidents?provider_message_id=eq.${encodeURIComponent(messageId)}&status=neq.resolved`, {
        method: "PATCH",
        headers: { ...headers(key), Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "resolved",
          resolved_by: "resend_delivery",
          resolved_at: eventAt,
          resolution_note: "Resend reported successful delivery.",
          updated_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error(`Unable to resolve delivery incident: ${await response.text()}`);
    } else if (isFailure(eventType) && confirmationCode) {
      const response = await fetch(`${url}/rest/v1/guest_email_delivery_incidents?on_conflict=provider_message_id`, {
        method: "POST",
        headers: { ...headers(key), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          communication_id: communicationId,
          attempt_id: attempt?.id ?? null,
          confirmation_code: confirmationCode,
          provider_message_id: messageId,
          recipient_email: recipient,
          failure_type: eventType,
          failure_detail: failureDetail(event),
          status: "open",
          claimed_by: null,
          claimed_at: null,
          resolved_by: null,
          resolved_at: null,
          resolution_note: null,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error(`Unable to record delivery incident: ${await response.text()}`);
    }

    return NextResponse.json({ ok: true, matched: true, stateChanged: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Resend webhook error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
