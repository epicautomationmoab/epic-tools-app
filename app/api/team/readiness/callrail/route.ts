import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { sendCallRailSms } from "@/lib/server/callrail";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function rest<T>(path: string): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

async function requireEmployee(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return null;
  return profile;
}

function getString(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
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

async function effectivePhoneForConfirmation(confirmation: string, fallback: string | null) {
  const overrides = await rest<Array<{ effective_phone: string | null }>>(
    `guest_contact_overrides?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=effective_phone&limit=1`,
  );
  return normalizePhone(overrides[0]?.effective_phone || fallback);
}

export async function GET(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const confirmation = request.nextUrl.searchParams.get("confirmation")?.trim().toUpperCase();
  if (!confirmation) return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });

  try {
    const reservations = await rest<Array<{ id: string; customer_phone: string | null }>>(
      `operational_reservations?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=id,customer_phone&limit=1`,
    );
    const reservationId = reservations[0]?.id;
    if (!reservationId) return NextResponse.json({ ok: true, customer_phone: null, calls: [], messages: [] });

    const normalizedPhone = await effectivePhoneForConfirmation(confirmation, reservations[0]?.customer_phone || null);

    const [events, messages] = await Promise.all([
      rest<Array<{ id: string; received_at: string; raw_payload: Record<string, unknown> }>>(
        `callrail_webhook_events?matched_reservation_id=eq.${encodeURIComponent(reservationId)}&select=${encodeURIComponent("id,received_at,raw_payload")}&order=received_at.asc&limit=500`,
      ),
      normalizedPhone
        ? rest<Array<{
            message_id: string;
            direction: string;
            message_body: string | null;
            status: string | null;
            sent_at: string | null;
            first_received_at: string;
            agent_name: string | null;
            source_number: string | null;
            destination_number: string | null;
          }>>(
            `callrail_text_messages?normalized_customer_phone=eq.${encodeURIComponent(normalizedPhone)}&select=${encodeURIComponent("message_id,direction,message_body,status,sent_at,first_received_at,agent_name,source_number,destination_number")}&order=sent_at.asc.nullslast,first_received_at.asc&limit=500`,
          )
        : Promise.resolve([]),
    ]);

    const byCall = new Map<string, {
      id: string;
      at: string;
      direction: string;
      answered: boolean | null;
      voicemail: boolean | null;
      duration_seconds: number | null;
      caller_name: string | null;
      caller_phone: string | null;
      recording_url: string | null;
      summary: string | null;
      transcription: string | null;
      lead_explanation: string | null;
      received_at: string;
    }>();

    for (const event of events) {
      const p = event.raw_payload || {};
      const callId = getString(p, "resource_id", "call_id", "id");
      if (!callId?.startsWith("CAL")) continue;
      const current = byCall.get(callId);
      const next = {
        id: callId,
        at: getString(p, "start_time", "timestamp", "created_at") || event.received_at,
        direction: getString(p, "direction") || "inbound",
        answered: getBoolean(p, "answered"),
        voicemail: getBoolean(p, "voicemail"),
        duration_seconds: getNumber(p, "duration", "duration_seconds"),
        caller_name: getString(p, "customer_name", "callername", "caller_name", "formatted_customer_name"),
        caller_phone: getString(p, "customer_phone_number", "callernum", "caller_number", "formatted_customer_phone_number"),
        recording_url: getString(p, "recording_player", "recording_player_url", "recording", "recording_url"),
        summary: getString(p, "call_summary", "summary"),
        transcription: getString(p, "conversational_transcript", "transcription", "transcription_text"),
        lead_explanation: getString(p, "lead_explanation"),
        received_at: event.received_at,
      };
      if (!current || new Date(event.received_at).getTime() >= new Date(current.received_at).getTime()) byCall.set(callId, next);
    }

    const calls = [...byCall.values()].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return NextResponse.json({ ok: true, reservation_id: reservationId, customer_phone: normalizedPhone, calls, messages });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load CallRail activity." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const body = await request.json().catch(() => null) as { confirmation?: string; message_text?: string } | null;
  const confirmation = body?.confirmation?.trim().toUpperCase();
  const messageText = body?.message_text?.trim() || "";
  if (!confirmation) return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });
  if (!messageText) return NextResponse.json({ error: "Message cannot be blank." }, { status: 400 });
  if (messageText.length > 1600) return NextResponse.json({ error: "Message is too long. Keep it under 1,600 characters." }, { status: 400 });

  try {
    const reservations = await rest<Array<{
      id: string;
      customer_phone: string | null;
      tripworks_customer_id: number | null;
    }>>(
      `operational_reservations?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=id,customer_phone,tripworks_customer_id&limit=1`,
    );
    const reservation = reservations[0];
    if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

    const phone = await effectivePhoneForConfirmation(confirmation, reservation.customer_phone || null);
    if (!phone) return NextResponse.json({ error: "This customer does not have a phone number." }, { status: 409 });

    if (reservation.tripworks_customer_id) {
      const contacts = await rest<Array<{ tripworks_is_opt_in: boolean | null }>>(
        `sales_contacts?tripworks_customer_id=eq.${encodeURIComponent(String(reservation.tripworks_customer_id))}&select=tripworks_is_opt_in&limit=1`,
      );
      if (contacts[0]?.tripworks_is_opt_in === false) {
        return NextResponse.json({ error: "SMS blocked: this customer opted out in TripWorks." }, { status: 403 });
      }
    }

    const result = await sendCallRailSms({ phone, body: messageText });
    return NextResponse.json({
      ok: true,
      sent_at: new Date().toISOString(),
      sent_by: profile.display_name,
      customer_phone: phone,
      conversation_id: result.conversationId,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send text message." }, { status: 500 });
  }
}
