import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";

export const dynamic = "force-dynamic";

function normalizedPhone(input: string | null): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function GET(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const profile = await getAuthenticatedTeamProfile(bearer || request.cookies.get("epic_access_token")?.value || null);
  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }
  const phone = normalizedPhone(request.nextUrl.searchParams.get("phone"));
  if (!phone) return NextResponse.json({ error: "Valid customer phone required." }, { status: 400 });

  try {
    const { url } = getServerSupabaseConfig();
    const qs = new URLSearchParams({
      customer_phone: `eq.${phone}`,
      select: "event_key,message_uid,conversation_uid,direction,event_type,body,message_at,received_at,failure_reason,raw_payload",
      order: "message_at.asc.nullslast,received_at.asc",
      limit: "500",
    });
    const response = await fetch(`${url}/rest/v1/podium_sms_messages?${qs}`, {
      headers: serverSupabaseHeaders(), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Message query failed: ${response.status}`);
    const events = await response.json() as Array<{
      event_key:string;message_uid:string|null;conversation_uid:string|null;direction:string;
      event_type:string;body:string|null;message_at:string|null;received_at:string;
      failure_reason:string|null;raw_payload: {data?: {items?: Array<{attachmentUrl?:string;type?:string}>}};
    }>;
    // Do not hand the original webhook payload to clients; retain it server-side.
    const messages = events.map(({raw_payload, ...event}) => ({
      ...event,
      provider: "podium",
      attachments: (raw_payload?.data?.items || []).filter(item => item.type === "attachment" && item.attachmentUrl)
        .map(item => item.attachmentUrl),
    }));
    return NextResponse.json({ ok:true, phone, messages });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Podium texts." }, { status: 500 });
  }
}
