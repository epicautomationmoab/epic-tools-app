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

    const attemptParams = new URLSearchParams({
      select: "id,communication_id",
      provider_message_id: `eq.${messageId}`,
      limit: "1",
    });
    const attemptResponse = await fetch(`${url}/rest/v1/guest_communication_attempts?${attemptParams}`, {
      headers: headers(key),
      cache: "no-store",
    });
    if (!attemptResponse.ok) throw new Error(`Unable to match Resend event: ${await attemptResponse.text()}`);
    const attempts = await attemptResponse.json() as Array<{ id: string; communication_id: string }>;
    const attempt = attempts[0];

    if (!attempt) {
      return NextResponse.json({ ok: true, matched: false });
    }

    if (eventType === "email.delivered") {
      const resolveResponse = await fetch(`${url}/rest/v1/guest_email_delivery_incidents?provider_message_id=eq.${encodeURIComponent(messageId)}&status=neq.resolved`, {
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
      if (!resolveResponse.ok) throw new Error(`Unable to resolve delivery incident: ${await resolveResponse.text()}`);
    } else if (isFailure(eventType)) {
      const communicationParams = new URLSearchParams({
        select: "confirmation_code",
        id: `eq.${attempt.communication_id}`,
        limit: "1",
      });
      const communicationResponse = await fetch(`${url}/rest/v1/guest_communications?${communicationParams}`, {
        headers: headers(key),
        cache: "no-store",
      });
      if (!communicationResponse.ok) throw new Error(`Unable to load communication: ${await communicationResponse.text()}`);
      const communications = await communicationResponse.json() as Array<{ confirmation_code: string }>;
      const confirmationCode = communications[0]?.confirmation_code;

      if (confirmationCode) {
        const incidentResponse = await fetch(`${url}/rest/v1/guest_email_delivery_incidents?on_conflict=provider_message_id`, {
          method: "POST",
          headers: { ...headers(key), Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            communication_id: attempt.communication_id,
            attempt_id: attempt.id,
            confirmation_code: confirmationCode,
            provider_message_id: messageId,
            recipient_email: recipient,
            failure_type: eventType,
            failure_detail: failureDetail(event),
            status: "open",
            updated_at: new Date().toISOString(),
          }),
        });
        if (!incidentResponse.ok) throw new Error(`Unable to record delivery incident: ${await incidentResponse.text()}`);
      }
    }

    return NextResponse.json({ ok: true, matched: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Resend webhook error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
