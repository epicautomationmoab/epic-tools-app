import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";
import { firstNameFromDisplayName, renderEpicEmailHtml, renderEpicPlainTextSignature } from "@/lib/server/epic-email-signature";

const EXPECTED_MAILBOX = "hello@epic4x4adventures.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function canSend(role?: string | null) {
  return role === "admin" || role === "manager";
}

function encodeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function buildRawMessage(to: string, subject: string, body: string, senderFirstName: string) {
  const boundary = `epic_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const plainText = `${body}\n\n${renderEpicPlainTextSignature(senderFirstName)}`;
  const html = renderEpicEmailHtml(body, senderFirstName);
  const lines = [
    `From: ${senderFirstName} at Epic 4X4 Adventures <${EXPECTED_MAILBOX}>`,
    `To: ${to}`,
    `Reply-To: ${EXPECTED_MAILBOX}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    plainText,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${boundary}--`,
  ];
  return base64Url(lines.join("\r\n"));
}

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

type MailboxConnection = { refresh_token: string };
type GuestRow = { customer_email: string | null; customer_name: string | null };

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || !canSend(profile.role)) {
    return NextResponse.json({ error: "Admin or Manager access is required to email guests." }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const confirmation = String(payload?.confirmation || "").trim().toUpperCase();
    const subject = String(payload?.subject || "").trim();
    const body = String(payload?.body || "").trim();
    if (!confirmation || !subject || !body) {
      return NextResponse.json({ error: "Confirmation, subject, and message are required." }, { status: 400 });
    }
    if (subject.length > 250) return NextResponse.json({ error: "Subject is too long." }, { status: 400 });
    if (body.length > 20000) return NextResponse.json({ error: "Message is too long." }, { status: 400 });

    const guests = await rest<GuestRow[]>(
      `guest_readiness_with_handoff_v?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=${encodeURIComponent("customer_email,customer_name")}&limit=1`,
    );
    const guest = guests[0];
    const recipient = guest?.customer_email?.trim().toLowerCase();
    if (!recipient || !recipient.includes("@")) {
      return NextResponse.json({ error: "This reservation does not have a valid customer email address." }, { status: 400 });
    }

    const connections = await rest<MailboxConnection[]>(
      `google_mailbox_connections?mailbox_email=eq.${encodeURIComponent(EXPECTED_MAILBOX)}&select=refresh_token&limit=1`,
    );
    const refreshToken = connections[0]?.refresh_token;
    if (!refreshToken) {
      return NextResponse.json({ error: "The hello@epic4x4adventures.com mailbox is not connected." }, { status: 503 });
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: requiredEnv("GOOGLE_GMAIL_CLIENT_ID"),
        client_secret: requiredEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      throw new Error(tokenPayload?.error_description || tokenPayload?.error || "Unable to refresh Gmail authorization.");
    }

    const senderFirstName = firstNameFromDisplayName(profile.display_name);
    const gmailResponse = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: buildRawMessage(recipient, subject, body, senderFirstName) }),
      cache: "no-store",
    });
    const gmailPayload = await gmailResponse.json();
    if (!gmailResponse.ok || !gmailPayload?.id) {
      throw new Error(gmailPayload?.error?.message || "Gmail did not send the message.");
    }

    const now = new Date().toISOString();
    await rest("guest_communications", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        confirmation_code: confirmation,
        communication_type: "manual_guest_email",
        customer_name: guest?.customer_name || null,
        customer_email: recipient,
        status: "sent",
        provider_message_id: gmailPayload.id,
        sent_at: now,
        queued_at: now,
        subject,
        body_text: body,
        sender_email: EXPECTED_MAILBOX,
        sender_name: profile.display_name,
        attempt_count: 1,
        last_attempt_at: now,
        test_mode: false,
      }),
    });

    return NextResponse.json({ ok: true, message_id: gmailPayload.id, thread_id: gmailPayload.threadId || null, recipient });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send guest email." }, { status: 500 });
  }
}
