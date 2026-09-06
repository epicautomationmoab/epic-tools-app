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

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function POST(request: NextRequest) {
  const accessToken = bearerToken(request) || request.cookies.get("epic_access_token")?.value || null;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || profile.role === "workstation") return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const body = await request.json().catch(() => null) as { opportunity_id?: string; message_text?: string } | null;
  const opportunityId = body?.opportunity_id?.trim();
  const messageText = body?.message_text?.trim() || "";
  if (!opportunityId) return NextResponse.json({ error: "Opportunity is required." }, { status: 400 });
  if (!messageText) return NextResponse.json({ error: "Message cannot be blank." }, { status: 400 });
  if (messageText.length > 1600) return NextResponse.json({ error: "Message is too long. Keep it under 1,600 characters." }, { status: 400 });

  try {
    const opportunities = await rest<Array<{ id:string; status:string; contact_id:string|null; phone_e164:string|null }>>(
      `sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}&select=id,status,contact_id,phone_e164&limit=1`,
    );
    const opportunity = opportunities[0];
    if (!opportunity) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    if (opportunity.status !== "open") return NextResponse.json({ error: "This lead is no longer open." }, { status: 409 });

    let contact: { tripworks_is_opt_in:boolean|null; canonical_phone:string|null } | null = null;
    if (opportunity.contact_id) {
      const contacts = await rest<Array<{ tripworks_is_opt_in:boolean|null; canonical_phone:string|null }>>(
        `sales_contacts?id=eq.${encodeURIComponent(opportunity.contact_id)}&select=tripworks_is_opt_in,canonical_phone&limit=1`,
      );
      contact = contacts[0] || null;
    }

    if (contact?.tripworks_is_opt_in === false) {
      return NextResponse.json({ error: "SMS blocked: this customer opted out in TripWorks." }, { status: 403 });
    }

    const phone = contact?.canonical_phone || opportunity.phone_e164;
    if (!phone) return NextResponse.json({ error: "This customer does not have a phone number." }, { status: 409 });

    const result = await sendCallRailSms({ phone, body: messageText });
    return NextResponse.json({
      ok: true,
      sent_at: new Date().toISOString(),
      conversation_id: result.conversationId,
      agent_name: profile.display_name,
      consent: contact?.tripworks_is_opt_in === true ? "opted_in" : "unknown",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send text." }, { status: 500 });
  }
}
