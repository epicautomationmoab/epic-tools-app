import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { sendPodiumSms } from "@/lib/server/podium";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

function token(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    request.cookies.get("epic_access_token")?.value || null;
}

async function rest<T>(path: string): Promise<T> {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: serverSupabaseHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load Podium conversation: ${response.status}`);
  return response.json() as Promise<T>;
}

/**
 * Explicit Podium reply path: never infer a provider from just a phone number.
 * The caller must identify an existing mirrored Podium conversation.
 * C360 UI integration will call this only after a Podium thread is selected.
 */
export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(token(request));
  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as {
    conversation_uid?: string;
    message_text?: string;
  } | null;
  const conversationUid = body?.conversation_uid?.trim();
  const message = body?.message_text?.trim();
  if (!conversationUid || !message || message.length > 1600) {
    return NextResponse.json({ error: "Select a Podium conversation and enter up to 1,600 characters." }, { status: 400 });
  }

  try {
    const rows = await rest<Array<{customer_phone:string; location_uid:string}>>(
      `podium_sms_messages?conversation_uid=eq.${encodeURIComponent(conversationUid)}&select=customer_phone,location_uid&order=message_at.desc.nullslast&limit=10`,
    );
    if (!rows.length) return NextResponse.json({ error: "Podium conversation not found." }, { status: 404 });
    // If messages disagree about the number or location, do not risk misdirecting the reply.
    if (new Set(rows.map(row => row.customer_phone)).size !== 1 ||
        new Set(rows.map(row => row.location_uid)).size !== 1) {
      return NextResponse.json({ error: "Podium conversation identity needs review." }, { status: 409 });
    }
    const phone = rows[0].customer_phone;
    const blocked = await rest<Array<{tripworks_is_opt_in:boolean|null}>>(
      `sales_contacts?canonical_phone=eq.${encodeURIComponent(phone)}&select=tripworks_is_opt_in&limit=20`,
    );
    if (blocked.some(row => row.tripworks_is_opt_in === false)) {
      return NextResponse.json({ error: "SMS blocked: this contact opted out in TripWorks." }, { status: 403 });
    }

    const sent = await sendPodiumSms({ phone, body: message, senderName: profile.display_name });
    // Podium's outbound webhook will mirror the message asynchronously.
    return NextResponse.json({ ok: true, channel: "podium_sms", sent_at: new Date().toISOString(),
      message_uid: sent.messageUid, delivery_status: sent.deliveryStatus });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send Podium text." }, { status: 500 });
  }
}
