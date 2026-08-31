import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

function getString(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function getObject(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getNestedString(payload: Record<string, unknown>, objectKey: string, ...keys: string[]) {
  const nested = getObject(payload, objectKey);
  return nested ? getString(nested, ...keys) : null;
}

function getBoolean(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
  }
  return null;
}

function getNumber(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function getArray(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function normalizePhone(input: string | null) {
  if (!input) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function verifySignature(rawBody: string, signature: string | null, secret: string | undefined) {
  if (!secret?.trim() || !signature?.trim()) return false;
  const expected = createHmac("sha1", secret.trim()).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseFormBody(rawBody: string) {
  const result: Record<string, unknown> = {};
  const params = new URLSearchParams(rawBody);
  for (const [key, value] of params.entries()) {
    const trimmed = value.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        result[key] = JSON.parse(trimmed);
        continue;
      } catch {}
    }
    result[key] = value;
  }
  return result;
}

function parsePayload(rawBody: string, contentType: string | null): unknown {
  if (contentType?.toLowerCase().includes("json")) {
    try { return JSON.parse(rawBody); } catch {}
  }
  try { return JSON.parse(rawBody); } catch {}
  const form = parseFormBody(rawBody);
  return Object.keys(form).length ? form : { raw_body: rawBody };
}

function payloadObject(parsed: unknown): Record<string, unknown> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const root = parsed as Record<string, unknown>;
  for (const key of ["call", "text_message", "message", "data"]) {
    const nested = root[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) return { ...root, ...(nested as Record<string, unknown>) };
  }
  return root;
}

function normalizeEventName(value: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function looksLikeText(payload: Record<string, unknown>) {
  return Boolean(
    getString(payload, "message_id", "text_message_id", "conversation_id", "content", "message_body", "body") ||
    (getString(payload, "customer_phone_number") && getString(payload, "tracking_phone_number")) ||
    (getString(payload, "source_number", "from") && getString(payload, "destination_number", "to")),
  );
}

function eventType(request: NextRequest, payload: Record<string, unknown>) {
  const explicit = normalizeEventName(
    request.headers.get("x-callrail-event") ||
    request.headers.get("x-event-type") ||
    getString(payload, "event_type", "event", "webhook_type"),
  );
  if (explicit) return explicit;
  if (looksLikeText(payload)) {
    const direction = normalizeEventName(getString(payload, "direction", "message_direction"));
    const agent = getString(payload, "agent", "agent_name") || getNestedString(payload, "agent", "name", "full_name", "email", "id");
    if (direction.includes("out") || direction === "sent" || agent) return "text_message_sent";
    return "text_message_received";
  }
  return Array.isArray(payload.changes) ? "call_modified" : "post_call";
}

async function dryRunMatch(normalizedPhone: string | null) {
  let contactId: string | null = null;
  let opportunityId: string | null = null;
  let matchType: string | null = null;
  let matchConfidence: string | null = null;
  let matchDetail: Record<string, unknown> = {};

  if (!normalizedPhone) return { contactId, opportunityId, matchType, matchConfidence, matchDetail };

  const contacts = await rest<Array<{ id: string; display_name: string | null }>>(
    `sales_contacts?canonical_phone=eq.${encodeURIComponent(normalizedPhone)}&select=id,display_name&limit=2`,
  );
  if (contacts.length === 1) {
    contactId = contacts[0].id;
    matchType = "phone_to_contact";
    matchConfidence = "exact_phone";
    matchDetail = { contact_name: contacts[0].display_name };
  } else if (contacts.length > 1) {
    matchType = "ambiguous_phone";
    matchConfidence = "ambiguous";
    matchDetail = { contact_count: contacts.length };
  }

  const opportunities = await rest<Array<{ id: string; customer_name: string | null; contact_id: string | null; shopping_started_at: string | null; shopping_last_activity_at: string | null; lead_value_cents: number }>>(
    `sales_opportunities?status=eq.open&phone_e164=eq.${encodeURIComponent(normalizedPhone)}&select=id,customer_name,contact_id,shopping_started_at,shopping_last_activity_at,lead_value_cents&order=shopping_last_activity_at.desc&limit=3`,
  );
  if (opportunities.length === 1) {
    opportunityId = opportunities[0].id;
    contactId = opportunities[0].contact_id || contactId;
    matchType = "phone_to_open_shopping_episode";
    matchConfidence = "exact_phone_open_lead";
    matchDetail = {
      customer_name: opportunities[0].customer_name,
      shopping_started_at: opportunities[0].shopping_started_at,
      shopping_last_activity_at: opportunities[0].shopping_last_activity_at,
      lead_value_cents: opportunities[0].lead_value_cents,
    };
  } else if (opportunities.length > 1) {
    matchType = "multiple_open_episodes_same_phone";
    matchConfidence = "needs_review";
    matchDetail = { opportunity_count: opportunities.length, candidate_ids: opportunities.map((item) => item.id) };
  }

  return { contactId, opportunityId, matchType, matchConfidence, matchDetail };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const parsed = parsePayload(rawBody, request.headers.get("content-type"));
  const payload = payloadObject(parsed);
  const signingSecret = process.env.CALLRAIL_WEBHOOK_SIGNING_SECRET;
  const suppliedSignature = request.headers.get("signature") || request.headers.get("x-callrail-signature");
  const signatureValid = verifySignature(rawBody, suppliedSignature, signingSecret);

  if (signingSecret?.trim() && !signatureValid) {
    return NextResponse.json({ ok: false, error: "Invalid CallRail signature." }, { status: 401 });
  }

  const event = eventType(request, payload);
  const isText = event.includes("text") || looksLikeText(payload);

  try {
    const now = new Date().toISOString();

    if (isText) {
      const explicitDirection = normalizeEventName(getString(payload, "direction", "message_direction"));
      const agentName = getString(payload, "agent_name") || getNestedString(payload, "agent", "name", "full_name", "email");
      const direction = event.includes("sent") || explicitDirection.includes("out") || explicitDirection === "sent" || Boolean(agentName) ? "outbound" : "inbound";

      const customerNumber = getString(payload, "customer_phone_number", "customer_number", "customer_phone");
      const trackingNumber = getString(payload, "tracking_phone_number", "tracking_number", "business_phone_number");
      let sourceNumber = getString(payload, "source_number", "from", "sender_number");
      let destinationNumber = getString(payload, "destination_number", "to", "recipient_number");
      if (!sourceNumber) sourceNumber = direction === "outbound" ? trackingNumber : customerNumber;
      if (!destinationNumber) destinationNumber = direction === "outbound" ? customerNumber : trackingNumber;

      const customerPhone = customerNumber || (direction === "outbound" ? destinationNumber : sourceNumber);
      const normalizedPhone = normalizePhone(customerPhone);
      const match = await dryRunMatch(normalizedPhone);

      const resourceId = getString(payload, "resource_id");
      const personResourceId = getString(payload, "person_resource_id", "person_id") || getNestedString(payload, "person", "resource_id", "id");
      const companyResourceId = getString(payload, "company_resource_id") || getNestedString(payload, "company", "resource_id", "id");
      const messageId = getString(payload, "message_id", "text_message_id", "id") || resourceId || `raw_${createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;
      const conversationId = getString(payload, "conversation_id", "thread_id", "conversation_resource_id") || personResourceId;

      const eventRow = {
        message_id: messageId,
        conversation_id: conversationId,
        channel: "sms",
        callrail_call_id: null,
        event_type: event,
        received_at: now,
        signature_valid: signatureValid,
        changes: null,
        raw_payload: parsed,
        normalized_customer_phone: normalizedPhone,
        matched_contact_id: match.contactId,
        matched_opportunity_id: match.opportunityId,
        match_type: match.matchType,
        match_confidence: match.matchConfidence,
        match_detail: match.matchDetail,
      };
      await rest<void>("callrail_webhook_events", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(eventRow),
      });

      const textRow = {
        message_id: messageId,
        conversation_id: conversationId,
        resource_id: resourceId,
        person_resource_id: personResourceId,
        company_resource_id: companyResourceId,
        agent_name: agentName,
        company_id: getString(payload, "company_id") || companyResourceId,
        company_name: getString(payload, "company_name") || getNestedString(payload, "company", "name"),
        direction,
        source_number: sourceNumber,
        destination_number: destinationNumber,
        customer_phone_number: customerPhone,
        normalized_customer_phone: normalizedPhone,
        message_body: getString(payload, "content", "message_body", "body", "message", "text"),
        message_type: getString(payload, "message_type", "type") || "sms",
        media_urls: getArray(payload, "media_urls", "media", "attachments"),
        status: getString(payload, "status", "message_status"),
        lead_status: getString(payload, "lead_status"),
        sent_at: getString(payload, "sent_at", "created_at", "timestamp", "date"),
        matched_contact_id: match.contactId,
        matched_opportunity_id: match.opportunityId,
        match_type: match.matchType,
        match_confidence: match.matchConfidence,
        match_detail: match.matchDetail,
        first_received_at: now,
        last_received_at: now,
        raw_payload: parsed,
      };

      await rest<void>("callrail_text_messages?on_conflict=message_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(textRow),
      });

      return NextResponse.json({
        ok: true,
        shadow_mode: true,
        channel: "sms",
        event_type: event,
        message_id: messageId,
        conversation_id: conversationId,
        direction,
        signature_valid: signatureValid,
        normalized_phone: normalizedPhone,
        match: {
          contact_id: match.contactId,
          opportunity_id: match.opportunityId,
          type: match.matchType,
          confidence: match.matchConfidence,
        },
      });
    }

    const callId = getString(payload, "id", "call_id", "callrail_call_id", "resource_id") || `raw_${createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;
    const customerPhone = getString(payload, "customer_phone_number", "caller_number", "customer_phone", "caller_phone_number", "from");
    const normalizedPhone = normalizePhone(customerPhone);
    const match = await dryRunMatch(normalizedPhone);
    const changes = Array.isArray(payload.changes) ? payload.changes : null;
    const tags = Array.isArray(payload.tags) ? payload.tags : [];

    const eventRow = {
      callrail_call_id: callId,
      message_id: null,
      conversation_id: null,
      channel: "call",
      event_type: event,
      received_at: now,
      signature_valid: signatureValid,
      changes,
      raw_payload: parsed,
      normalized_customer_phone: normalizedPhone,
      matched_contact_id: match.contactId,
      matched_opportunity_id: match.opportunityId,
      match_type: match.matchType,
      match_confidence: match.matchConfidence,
      match_detail: match.matchDetail,
    };
    await rest<void>("callrail_webhook_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(eventRow),
    });

    const callRow = {
      callrail_call_id: callId,
      company_id: getString(payload, "company_id"),
      company_name: getString(payload, "company_name"),
      customer_name: getString(payload, "customer_name", "caller_name"),
      customer_phone_number: customerPhone,
      normalized_customer_phone: normalizedPhone,
      tracking_phone_number: getString(payload, "tracking_phone_number", "tracking_number", "business_phone_number"),
      direction: getString(payload, "direction"),
      call_type: getString(payload, "type", "call_type", "call_status"),
      answered: getBoolean(payload, "answered"),
      voicemail: getBoolean(payload, "voicemail"),
      start_time: getString(payload, "start_time", "started_at", "created_at"),
      duration_seconds: getNumber(payload, "duration", "duration_seconds"),
      source_name: getString(payload, "source_name", "source"),
      campaign: getString(payload, "campaign", "campaign_name"),
      medium: getString(payload, "medium"),
      utm_source: getString(payload, "utm_source"),
      utm_medium: getString(payload, "utm_medium"),
      utm_campaign: getString(payload, "utm_campaign"),
      gclid: getString(payload, "gclid"),
      first_call: getBoolean(payload, "first_call"),
      prior_calls: getNumber(payload, "prior_calls", "previous_calls"),
      total_calls: getNumber(payload, "total_calls"),
      recording_url: getString(payload, "recording", "recording_url"),
      recording_player_url: getString(payload, "recording_player", "recording_player_url"),
      recording_duration: getNumber(payload, "recording_duration"),
      transcription_text: getString(payload, "transcription_text", "transcription"),
      call_summary: getString(payload, "call_summary", "summary"),
      auto_score: getString(payload, "auto_score"),
      manual_score: getString(payload, "manual_score"),
      tags,
      note: getString(payload, "note", "notes"),
      changes,
      matched_contact_id: match.contactId,
      matched_opportunity_id: match.opportunityId,
      match_type: match.matchType,
      match_confidence: match.matchConfidence,
      match_detail: match.matchDetail,
      last_received_at: now,
      last_event_type: event,
      raw_payload: parsed,
    };

    await rest<void>("callrail_calls?on_conflict=callrail_call_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(callRow),
    });

    return NextResponse.json({
      ok: true,
      shadow_mode: true,
      channel: "call",
      event_type: event,
      callrail_call_id: callId,
      signature_valid: signatureValid,
      normalized_phone: normalizedPhone,
      match: {
        contact_id: match.contactId,
        opportunity_id: match.opportunityId,
        type: match.matchType,
        confidence: match.matchConfidence,
      },
    });
  } catch (error) {
    console.error("CallRail webhook ingest failed", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "CallRail ingest failed." }, { status: 500 });
  }
}
