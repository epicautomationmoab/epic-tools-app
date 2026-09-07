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

async function readinessPhoneForConfirmation(confirmation: string, fallback: string | null) {
  const rows = await rest<Array<{ customer_phone: string | null }>>(
    `guest_readiness_with_handoff_v?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=customer_phone&limit=1`,
  );
  return normalizePhone(rows[0]?.customer_phone || fallback);
}

type NormalizedCall = {
  callrail_call_id: string;
  start_time: string | null;
  last_received_at: string;
  direction: string | null;
  answered: boolean | null;
  voicemail: boolean | null;
  duration_seconds: number | null;
  customer_name: string | null;
  customer_phone_number: string | null;
  recording_player_url: string | null;
  recording_url: string | null;
  call_summary: string | null;
  transcription_text: string | null;
  lead_score: number | null;
  lead_explanation: string | null;
  sentiment: string | null;
  call_highlights: unknown[] | null;
  speaker_percent: Record<string, unknown> | null;
  keywords: string | null;
  source_name: string | null;
  campaign: string | null;
  medium: string | null;
  device_type: string | null;
  customer_city: string | null;
  customer_state: string | null;
  landing_page_url: string | null;
  referring_url: string | null;
  timeline_url: string | null;
  person_resource_id: string | null;
  lead_status: string | null;
  first_touch: Record<string, unknown> | null;
  last_touch: Record<string, unknown> | null;
};

export async function GET(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const confirmation = request.nextUrl.searchParams.get("confirmation")?.trim().toUpperCase();
  if (!confirmation) return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });

  try {
    const reservations = await rest<Array<{
      id: string;
      customer_phone: string | null;
      trip_method_name: string | null;
      reserved_at: string | null;
      trip_reserved_at: string | null;
    }>>(
      `operational_reservations?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=${encodeURIComponent("id,customer_phone,trip_method_name,reserved_at,trip_reserved_at")}&order=reserved_at.asc.nullslast&limit=1`,
    );
    const reservation = reservations[0];
    const reservationId = reservation?.id;
    if (!reservationId) return NextResponse.json({ ok: true, customer_phone: null, booking_method: null, booked_at: null, calls: [], messages: [] });

    const normalizedPhone = await readinessPhoneForConfirmation(confirmation, reservation.customer_phone || null);
    const callSelect = "callrail_call_id,start_time,last_received_at,direction,answered,voicemail,duration_seconds,customer_name,customer_phone_number,recording_player_url,recording_url,call_summary,transcription_text,lead_score,lead_explanation,sentiment,call_highlights,speaker_percent,keywords,source_name,campaign,medium,device_type,customer_city,customer_state,landing_page_url,referring_url,timeline_url,person_resource_id,lead_status,first_touch,last_touch";

    const [normalizedCalls, messages] = await Promise.all([
      rest<NormalizedCall[]>(
        `callrail_calls?matched_reservation_id=eq.${encodeURIComponent(reservationId)}&select=${encodeURIComponent(callSelect)}&order=start_time.asc.nullslast,last_received_at.asc&limit=500`,
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

    const calls = normalizedCalls.map((call) => ({
      id: call.callrail_call_id,
      at: call.start_time || call.last_received_at,
      direction: call.direction || "inbound",
      answered: call.answered,
      voicemail: call.voicemail,
      duration_seconds: call.duration_seconds,
      caller_name: call.customer_name,
      caller_phone: call.customer_phone_number,
      recording_url: call.recording_player_url || call.recording_url,
      summary: call.call_summary,
      transcription: call.transcription_text,
      lead_score: call.lead_score,
      lead_explanation: call.lead_explanation,
      sentiment: call.sentiment,
      call_highlights: call.call_highlights || [],
      speaker_percent: call.speaker_percent || {},
      keywords: call.keywords,
      source_name: call.source_name,
      campaign: call.campaign,
      medium: call.medium,
      device_type: call.device_type,
      customer_city: call.customer_city,
      customer_state: call.customer_state,
      landing_page_url: call.landing_page_url,
      referring_url: call.referring_url,
      timeline_url: call.timeline_url,
      person_resource_id: call.person_resource_id,
      lead_status: call.lead_status,
      first_touch: call.first_touch,
      last_touch: call.last_touch,
      received_at: call.last_received_at,
    }));

    return NextResponse.json({
      ok: true,
      reservation_id: reservationId,
      customer_phone: normalizedPhone,
      booking_method: reservation.trip_method_name,
      booked_at: reservation.reserved_at || reservation.trip_reserved_at,
      calls,
      messages,
    });
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

    const phone = await readinessPhoneForConfirmation(confirmation, reservation.customer_phone || null);
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
