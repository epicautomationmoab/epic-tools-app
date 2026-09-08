import { NextRequest } from "next/server";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...serverSupabaseHeaders(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

type CommunicationRow = {
  provider_message_id: string | null;
  customer_email: string | null;
};

export async function GET(_request: NextRequest, context: { params: Promise<{ communicationId: string }> }) {
  const { communicationId } = await context.params;

  try {
    const rows = await rest<CommunicationRow[]>(
      `guest_communications?id=eq.${encodeURIComponent(communicationId)}&communication_type=eq.manual_guest_email&select=${encodeURIComponent("provider_message_id,customer_email")}&limit=1`,
    );
    const communication = rows[0];

    if (communication?.provider_message_id) {
      await rest("guest_email_delivery_events", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          provider: "gmail",
          provider_event_id: null,
          provider_message_id: communication.provider_message_id,
          event_type: "email.opened",
          recipient_email: communication.customer_email,
          event_at: new Date().toISOString(),
          payload: { source: "epic_tracking_pixel", communication_id: communicationId },
        }),
      });
    }
  } catch {
    // Tracking must never break image delivery or expose internal errors to recipients.
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
