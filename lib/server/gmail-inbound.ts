import { getServerSupabaseConfig, serverSupabaseHeaders } from "@/lib/server/supabase-rest";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const EPIC_MAILBOXES = ["hello@epic4x4adventures.com", "customerservice@epic4x4adventures.com"] as const;

type Connection = { mailbox_email:string; refresh_token: string; gmail_history_id: string | null; last_inbound_sync_at: string | null };
type GmailHeader = { name?: string; value?: string };
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = { id: string; threadId?: string; internalDate?: string; payload?: GmailPart & { headers?: GmailHeader[] } };

type Match = {
  confirmation: string | null;
  reservationId: string | null;
  opportunityId: string | null;
  method: string | null;
  confidence: string | null;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...serverSupabaseHeaders(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

function decodeBase64Url(value?: string) {
  if (!value) return "";
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function textFromPart(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts || []) {
    const text = textFromPart(child);
    if (text.trim()) return text;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }
  return "";
}

function header(message: GmailMessage, name: string) {
  return message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value?.trim() || "";
}

function emailFromHeader(value: string) {
  const angle = value.match(/<([^>]+)>/);
  const raw = (angle?.[1] || value).trim().toLowerCase();
  const match = raw.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match?.[0]?.toLowerCase() || null;
}

function emailsFromHeader(value: string) {
  return value.split(",").map(emailFromHeader).filter((item): item is string => Boolean(item));
}

async function accessToken(refreshToken: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
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
  const payload = await response.json();
  if (!response.ok || !payload?.access_token) throw new Error(payload?.error_description || payload?.error || "Unable to refresh Gmail authorization.");
  return String(payload.access_token);
}

async function gmail<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Gmail request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

async function fallbackInboxIds(token: string) {
  const ids: string[] = [];
  let pageToken = "";
  for (let page = 0; page < 5; page += 1) {
    const params = new URLSearchParams({ maxResults: "100", q: "in:inbox newer_than:30d" });
    if (pageToken) params.set("pageToken", pageToken);
    const payload = await gmail<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(token, `/messages?${params}`);
    ids.push(...(payload.messages || []).map((message) => message.id));
    pageToken = payload.nextPageToken || "";
    if (!pageToken) break;
  }
  return [...new Set(ids)];
}

async function historyInboxIds(token: string, startHistoryId: string) {
  const ids: string[] = [];
  let pageToken = "";
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", labelId: "INBOX", maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`${GMAIL_API}/history?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const text = await response.text();
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(text || `Gmail history request failed (${response.status}).`);
    const payload = text ? JSON.parse(text) as { history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>; nextPageToken?: string } : {};
    for (const history of payload.history || []) for (const added of history.messagesAdded || []) if (added.message?.id) ids.push(added.message.id);
    pageToken = payload.nextPageToken || "";
    if (!pageToken) break;
  }
  return [...new Set(ids)];
}

async function matchMessage(fromEmail: string, threadId: string | null): Promise<Match> {
  if (threadId) {
    const prior = await rest<Array<{ matched_confirmation_code: string | null; matched_reservation_id: string | null; matched_sales_opportunity_id: string | null }>>(
      `gmail_messages?gmail_thread_id=eq.${encodeURIComponent(threadId)}&or=${encodeURIComponent("(matched_reservation_id.not.is.null,matched_sales_opportunity_id.not.is.null)")}&select=matched_confirmation_code,matched_reservation_id,matched_sales_opportunity_id&order=created_at.desc&limit=1`,
    );
    if (prior[0]) return { confirmation: prior[0].matched_confirmation_code, reservationId: prior[0].matched_reservation_id, opportunityId: prior[0].matched_sales_opportunity_id, method: "gmail_thread", confidence: "high" };

    const sent = await rest<Array<{ confirmation_code: string; provider_thread_id: string | null }>>(
      `guest_communications?provider_thread_id=eq.${encodeURIComponent(threadId)}&select=confirmation_code,provider_thread_id&order=created_at.desc&limit=1`,
    );
    if (sent[0]?.confirmation_code) {
      const reservations = await rest<Array<{ id: string }>>(`operational_reservations?confirmation_code=eq.${encodeURIComponent(sent[0].confirmation_code)}&select=id&limit=1`);
      return { confirmation: sent[0].confirmation_code, reservationId: reservations[0]?.id || null, opportunityId: null, method: "sent_gmail_thread", confidence: "high" };
    }
  }

  const readiness = await rest<Array<{ readiness_id: string | null; confirmation_code: string }>>(
    `guest_readiness_with_handoff_v?customer_email=ilike.${encodeURIComponent(fromEmail)}&select=readiness_id,confirmation_code&limit=3`,
  ).catch(() => []);
  if (readiness.length === 1) {
    const reservations = await rest<Array<{ id: string }>>(`operational_reservations?confirmation_code=eq.${encodeURIComponent(readiness[0].confirmation_code)}&select=id&limit=1`);
    return { confirmation: readiness[0].confirmation_code, reservationId: reservations[0]?.id || null, opportunityId: null, method: "unique_readiness_email", confidence: "medium" };
  }

  const opportunities = await rest<Array<{ id: string; matched_booking_confirmation_code: string | null }>>(
    `sales_opportunities?email=ilike.${encodeURIComponent(fromEmail)}&closed_at=is.null&select=id,matched_booking_confirmation_code&order=last_seen_at.desc&limit=3`,
  );
  if (opportunities.length === 1) {
    return { confirmation: opportunities[0].matched_booking_confirmation_code, reservationId: null, opportunityId: opportunities[0].id, method: "unique_open_lead_email", confidence: "medium" };
  }

  return { confirmation: null, reservationId: null, opportunityId: null, method: null, confidence: null };
}

async function syncMailbox(mailbox:string, connection:Connection, force:boolean) {
  if (!force && connection.last_inbound_sync_at) {
    const age = Date.now() - new Date(connection.last_inbound_sync_at).getTime();
    if (Number.isFinite(age) && age < 45_000) return { mailbox, ok:true, skipped:true, processed:0, matched:0, unmatched:0 };
  }

  const token = await accessToken(connection.refresh_token);
  const profile = await gmail<{ historyId?: string }>(token, "/profile");
  let ids: string[] | null = null;
  if (connection.gmail_history_id) ids = await historyInboxIds(token, connection.gmail_history_id);
  if (ids === null) ids = await fallbackInboxIds(token);

  let processed = 0, matched = 0, unmatched = 0;
  for (const id of ids) {
    const existing = await rest<Array<{ gmail_message_id: string }>>(`gmail_messages?mailbox_email=eq.${encodeURIComponent(mailbox)}&gmail_message_id=eq.${encodeURIComponent(id)}&select=gmail_message_id&limit=1`);
    if (existing.length) continue;

    const message = await gmail<GmailMessage>(token, `/messages/${encodeURIComponent(id)}?format=full`);
    const fromEmail = emailFromHeader(header(message, "From"));
    if (!fromEmail || EPIC_MAILBOXES.includes(fromEmail as typeof EPIC_MAILBOXES[number])) continue;
    const toEmails = emailsFromHeader(header(message, "To"));
    const subject = header(message, "Subject") || "(No subject)";
    const bodyText = textFromPart(message.payload).slice(0, 100_000);
    const receivedAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();
    const threadId = message.threadId || null;
    const match = await matchMessage(fromEmail, threadId);

    await rest("gmail_messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        mailbox_email: mailbox,
        gmail_message_id: message.id,
        gmail_thread_id: threadId,
        direction: "inbound",
        from_email: fromEmail,
        to_emails: toEmails,
        subject,
        body_text: bodyText || null,
        received_at: receivedAt,
        in_reply_to: header(message, "In-Reply-To") || null,
        references_header: header(message, "References") || null,
        matched_confirmation_code: match.confirmation,
        matched_reservation_id: match.reservationId,
        matched_sales_opportunity_id: match.opportunityId,
        match_method: match.method,
        match_confidence: match.confidence,
        updated_at: new Date().toISOString(),
      }),
    });
    processed += 1;
    if (match.reservationId || match.opportunityId || match.confirmation) matched += 1; else unmatched += 1;
  }

  await rest(`google_mailbox_connections?mailbox_email=eq.${encodeURIComponent(mailbox)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ gmail_history_id: profile.historyId || connection.gmail_history_id, last_inbound_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });

  return { mailbox, ok:true, skipped:false, processed, matched, unmatched, history_id:profile.historyId||null };
}

export async function syncEpicInboxes({ force = false }: { force?: boolean } = {}) {
  const connections = await rest<Connection[]>(`google_mailbox_connections?mailbox_email=in.(${EPIC_MAILBOXES.map(encodeURIComponent).join(",")})&select=mailbox_email,refresh_token,gmail_history_id,last_inbound_sync_at`);
  const byMailbox = new Map(connections.map(c=>[c.mailbox_email.toLowerCase(),c]));
  const results=[];
  for(const mailbox of EPIC_MAILBOXES){const connection=byMailbox.get(mailbox);if(!connection){results.push({mailbox,ok:false,connected:false,processed:0,matched:0,unmatched:0});continue;}results.push(await syncMailbox(mailbox,connection,force));}
  return { ok:true, mailboxes:results, processed:results.reduce((s,r)=>s+(r.processed||0),0), matched:results.reduce((s,r)=>s+(r.matched||0),0), unmatched:results.reduce((s,r)=>s+(r.unmatched||0),0) };
}

export async function syncHelloInbox(options:{force?:boolean}={}) { return syncEpicInboxes(options); }
