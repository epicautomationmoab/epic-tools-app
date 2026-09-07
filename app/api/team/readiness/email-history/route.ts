import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

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

type CommunicationRow = {
  id: string;
  confirmation_code: string;
  communication_type: string;
  customer_email: string | null;
  status: string;
  provider_message_id: string | null;
  sent_at: string | null;
  created_at: string;
  last_error: string | null;
  subject: string | null;
  body_text: string | null;
  sender_email: string | null;
  sender_name: string | null;
};

type DeliveryRow = {
  provider_message_id: string;
  event_type: string;
  event_at: string;
};

function labelForType(type: string, senderName?: string | null) {
  if (type === "initial_guest_portal") return "Confirmation Email";
  if (type === "arrival_reminder_day_before") return "Day-Before Reminder";
  if (type === "arrival_readiness_two_hour") return "Last-Minute Readiness Email";
  if (type === "manual_guest_email") return senderName ? `Email from ${senderName}` : "Manual Guest Email";
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function subjectForType(type: string, storedSubject?: string | null) {
  if (storedSubject?.trim()) return storedSubject.trim();
  if (type === "initial_guest_portal") return "Your Epic 4X4 Adventure Is Confirmed";
  if (type === "arrival_reminder_day_before") return "Adventure Reminder";
  if (type === "arrival_readiness_two_hour") return "Action Required - Your Adventure Begins Soon";
  return labelForType(type);
}

function deliveryLabel(eventType: string | null, fallback: string) {
  if (eventType === "email.delivered") return "delivered";
  if (eventType === "email.bounced") return "bounced";
  if (eventType === "email.failed") return "failed";
  if (eventType === "email.suppressed") return "suppressed";
  return fallback;
}

export async function GET(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const confirmation = request.nextUrl.searchParams.get("confirmation")?.trim().toUpperCase();
  if (!confirmation) return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });

  try {
    const communications = await rest<CommunicationRow[]>(
      `guest_communications?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=${encodeURIComponent("id,confirmation_code,communication_type,customer_email,status,provider_message_id,sent_at,created_at,last_error,subject,body_text,sender_email,sender_name")}&order=created_at.asc&limit=100`,
    );

    const resendMessageIds = communications
      .filter((row) => row.communication_type !== "manual_guest_email")
      .map((row) => row.provider_message_id)
      .filter((value): value is string => Boolean(value));

    let deliveries: DeliveryRow[] = [];
    if (resendMessageIds.length) {
      const inList = `(${resendMessageIds.map((id) => `\"${id.replaceAll('"', '')}\"`).join(",")})`;
      deliveries = await rest<DeliveryRow[]>(
        `guest_email_delivery_events?provider_message_id=in.${encodeURIComponent(inList)}&select=${encodeURIComponent("provider_message_id,event_type,event_at")}&order=event_at.desc&limit=500`,
      );
    }

    const latestByMessage = new Map<string, DeliveryRow>();
    for (const delivery of deliveries) {
      if (!latestByMessage.has(delivery.provider_message_id)) latestByMessage.set(delivery.provider_message_id, delivery);
    }

    const emails = communications
      .filter((row) => row.sent_at || row.provider_message_id || row.status === "sent" || row.status === "failed")
      .map((row) => {
        const delivery = row.communication_type !== "manual_guest_email" && row.provider_message_id
          ? latestByMessage.get(row.provider_message_id) ?? null
          : null;
        return {
          id: row.id,
          direction: "outbound",
          at: row.sent_at || row.created_at,
          label: labelForType(row.communication_type, row.sender_name),
          subject: subjectForType(row.communication_type, row.subject),
          communication_type: row.communication_type,
          recipient: row.customer_email,
          sender: row.sender_email,
          sender_name: row.sender_name,
          body: row.body_text,
          provider_message_id: row.provider_message_id,
          status: deliveryLabel(delivery?.event_type ?? null, row.status),
          error: row.last_error,
        };
      });

    return NextResponse.json({ ok: true, emails });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load email history." }, { status: 500 });
  }
}
