import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

type PodiumMessage = {
  uid?: string | null;
  body?: string | null;
  createdAt?: string | null;
  failureReason?: string | null;
  location?: { uid?: string | null };
  conversation?: { uid?: string | null; channel?: { type?: string; identifier?: string } };
};
type PodiumEvent = {
  metadata?: { eventType?: string; eventUid?: string };
  data?: PodiumMessage;
};

function validSignature(timestamp: string | null, signature: string | null, raw: string): boolean {
  const secret = process.env.PODIUM_WEBHOOK_SECRET?.trim();
  if (!secret || !timestamp || !signature) return false;
  // Reject stale events; configure Podium to retry promptly. Millisecond epoch in Podium docs.
  const millis = Number(timestamp);
  if (!Number.isFinite(millis) || Math.abs(Date.now() - millis) > 10 * 60 * 1000) return false;
  const hex = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const a = Buffer.from(hex, "hex");
  const supplied = signature.replace(/^sha256=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const b = Buffer.from(supplied, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizedPhone(value: string | undefined): string | null {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...serverSupabaseHeaders(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Podium persistence failed: ${response.status}`);
  const result = await response.text();
  return result ? JSON.parse(result) as T : undefined as T;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(request.headers.get("podium-timestamp"), request.headers.get("podium-signature"), raw)) {
    return NextResponse.json({ error: "Invalid Podium webhook signature." }, { status: 401 });
  }
  let event: PodiumEvent;
  try { event = JSON.parse(raw) as PodiumEvent; }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const kind = event.metadata?.eventType;
  const data = event.data;
  if (!["message.received", "message.sent", "message.failed"].includes(kind || "") ||
      data?.conversation?.channel?.type !== "phone") {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const phone = normalizedPhone(data.conversation.channel.identifier);
  if (!phone || !data.location?.uid) return NextResponse.json({ ok: true, ignored: true });

  try {
    // Only mirror events for the location connected to the 2700 Podium account.
    const connections = await rest<Array<{location_uid:string;podium_phone_number:string|null}>>(
      "podium_oauth_connections?select=location_uid,podium_phone_number&id=eq.primary&limit=1",
    );
    const connection = connections[0];
    if (!connection || connection.location_uid !== data.location.uid ||
        !connection.podium_phone_number?.replace(/\D/g, "").endsWith("2700")) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    const eventKey = event.metadata?.eventUid || createHash("sha256").update(raw).digest("hex");
    await rest("podium_sms_messages?on_conflict=event_key", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        event_key: eventKey,
        message_uid: data.uid || null,
        conversation_uid: data.conversation?.uid || null,
        location_uid: data.location.uid,
        customer_phone: phone,
        direction: kind === "message.received" ? "inbound" : "outbound",
        event_type: kind,
        body: data.body || null,
        failure_reason: data.failureReason || null,
        message_at: data.createdAt || null,
        raw_payload: event,
      }),
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Failure must be retryable by Podium; do not acknowledge an unpersisted event.
    return NextResponse.json({ error: "Temporarily unable to store message." }, { status: 503 });
  }
}
