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
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

function parseForm(raw: string) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of new URLSearchParams(raw).entries()) out[key] = value;
  return out;
}

function parsePayload(raw: string, contentType: string | null): Record<string, unknown> {
  if (contentType?.toLowerCase().includes("json")) {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch {}
  }
  try { return JSON.parse(raw) as Record<string, unknown>; } catch {}
  return parseForm(raw);
}

function value(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function normalizePhone(input: string | null) {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function verify(raw: string, signature: string | null, secret: string | undefined) {
  if (!secret?.trim() || !signature?.trim()) return false;
  const expected = createHmac("sha1", secret.trim()).update(raw, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const payload = parsePayload(raw, request.headers.get("content-type"));
  const signingSecret = process.env.CALLRAIL_WEBHOOK_SIGNING_SECRET;
  const signature = request.headers.get("signature") || request.headers.get("x-callrail-signature");
  const signatureValid = verify(raw, signature, signingSecret);
  if (signingSecret?.trim() && !signatureValid) return NextResponse.json({ ok: false, error: "Invalid CallRail signature." }, { status: 401 });

  const callerPhone = normalizePhone(value(payload, "customer_phone_number", "caller_number", "callernum", "from"));
  if (!callerPhone) return NextResponse.json({ ok: false, error: "Caller phone missing." }, { status: 400 });

  try {
    const digits = callerPhone.replace(/\D/g, "");
    const now = new Date();
    const today = now.toISOString();

    const [opportunities, reservations, contacts] = await Promise.all([
      rest<Array<{ id:string; customer_name:string|null; contact_id:string|null }>>(`sales_opportunities?status=eq.open&phone_e164=eq.${encodeURIComponent(callerPhone)}&select=id,customer_name,contact_id&order=shopping_last_activity_at.desc&limit=2`),
      rest<Array<{ id:string; confirmation_code:string|null; customer_name:string|null; customer_phone:string|null; start_time:string|null; sale_date:string|null }>>(`operational_reservations?is_cancelled=eq.false&or=(customer_phone.eq.${encodeURIComponent(callerPhone)},customer_phone.like.*${encodeURIComponent(digits.slice(-10))}*)&select=id,confirmation_code,customer_name,customer_phone,start_time,sale_date&order=start_time.asc&limit=10`),
      rest<Array<{ id:string; display_name:string|null }>>(`sales_contacts?canonical_phone=eq.${encodeURIComponent(callerPhone)}&select=id,display_name&limit=2`),
    ]);

    const futureReservations = reservations.filter((r) => {
      const stamp = r.start_time || r.sale_date;
      return !stamp || new Date(stamp).getTime() >= now.getTime() - 24 * 60 * 60 * 1000;
    });

    let routeKind: "open_lead"|"active_reservation"|"known_contact"|"new_lead" = "new_lead";
    let opportunityId: string|null = null;
    let reservationId: string|null = null;
    let contactId: string|null = null;
    let confirmationCode: string|null = null;
    let routeLabel = "New caller";

    if (opportunities.length === 1) {
      routeKind = "open_lead";
      opportunityId = opportunities[0].id;
      contactId = opportunities[0].contact_id;
      routeLabel = opportunities[0].customer_name || "Open sales lead";
    } else if (futureReservations.length === 1) {
      routeKind = "active_reservation";
      reservationId = futureReservations[0].id;
      confirmationCode = futureReservations[0].confirmation_code;
      routeLabel = futureReservations[0].customer_name || confirmationCode || "Active reservation";
    } else if (contacts.length === 1) {
      routeKind = "known_contact";
      contactId = contacts[0].id;
      routeLabel = contacts[0].display_name || "Known Epic contact";
    }

    const callId = value(payload, "resource_id", "id", "call_id", "callrail_call_id") || `pre_${createHash("sha256").update(raw).digest("hex").slice(0,32)}`;
    const personId = value(payload, "person_resource_id", "person_id");
    const row = {
      callrail_call_id: callId,
      callrail_person_id: personId,
      caller_phone: callerPhone,
      caller_name: value(payload, "customer_name", "callername", "caller_name", "formatted_customer_name"),
      tracking_phone: value(payload, "tracking_phone_number", "trackingnum", "business_phone_number"),
      source_name: value(payload, "source_name", "source"),
      campaign: value(payload, "campaign", "utm_campaign"),
      received_at: today,
      route_kind: routeKind,
      opportunity_id: opportunityId,
      reservation_id: reservationId,
      contact_id: contactId,
      confirmation_code: confirmationCode,
      route_label: routeLabel,
      raw_payload: payload,
      updated_at: today,
    };

    const saved = await rest<Array<{id:string}>>("live_calls?on_conflict=callrail_call_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(row),
    });

    return NextResponse.json({ ok: true, live_call_id: saved[0]?.id || null, route_kind: routeKind, route_label: routeLabel, confirmation_code: confirmationCode, opportunity_id: opportunityId, reservation_id: reservationId, contact_id: contactId, signature_valid: signatureValid });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to route pre-call." }, { status: 500 });
  }
}
