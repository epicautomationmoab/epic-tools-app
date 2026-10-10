import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/** Public callback; authorization is the provider HMAC, never an anonymous database grant. */
const base = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const authHeaders = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const field = (value: unknown, key: string): unknown => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
const str = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const normalize = (value: unknown): string | null => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
};
async function select(table: string, query: string) {
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: authHeaders });
  if (!response.ok) throw new Error(`Database read failure ${response.status}`);
  return await response.json() as Array<Record<string, unknown>>;
}
async function authenticated(raw: string, timestamp: string, signature: string, secret: string) {
  const epoch = Number(timestamp);
  // The Podium timestamp is milliseconds since epoch.
  if (!Number.isFinite(epoch) || Math.abs(Date.now() - epoch) > 600000) return false;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(`${timestamp}.${raw}`)));
  const hex = [...digest].map(n => n.toString(16).padStart(2, "0")).join("");
  const given = signature.replace(/^sha256=/i, "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(given)) return false;
  let delta = 0;
  for (let i = 0; i < 64; i++) delta |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return delta === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const raw = await request.text();
  try {
    const settings = await select("podium_webhook_settings", "id=eq.primary&select=signing_secret&limit=1");
    const secret = str(settings[0]?.signing_secret);
    if (!secret || !await authenticated(raw, request.headers.get("podium-timestamp") || "", request.headers.get("podium-signature") || "", secret)) {
      return reply({ error: "Invalid webhook signature" }, 401);
    }
    const event = JSON.parse(raw) as Record<string, unknown>;
    const metadata = field(event, "metadata");
    const kind = str(field(metadata, "event_type")) || str(field(metadata, "eventType"));
    if (!kind || !["message.received", "message.sent", "message.failed"].includes(kind)) { console.info("Podium webhook ignored", { reason: "non_message_event", event_type: kind || "missing" }); return reply({ ok: true, ignored: true }); }
    const data = field(event, "data");
    const conversation = field(data, "conversation");
    const channel = field(conversation, "channel") || field(data, "channel");
    if (field(channel, "type") !== "phone") { console.info("Podium webhook ignored", { reason: "non_phone_channel", event_type: kind, channel_type: field(channel, "type") || "missing" }); return reply({ ok: true, ignored: true }); }
    const location = field(field(data, "location"), "uid") || field(data, "locationUid");
    const number = normalize(field(channel, "identifier"));
    const connections = await select("podium_oauth_connections", "id=eq.primary&select=location_uid,podium_phone_number&limit=1");
    if (!number || !connections[0] || location !== connections[0].location_uid || !String(connections[0].podium_phone_number || "").replace(/\D/g, "").endsWith("2700")) {
      console.info("Podium webhook ignored", { reason: "location_or_number_mismatch", event_type: kind, has_number: Boolean(number), has_connection: Boolean(connections[0]), location_matches: Boolean(connections[0] && location === connections[0].location_uid), number_configured: Boolean(connections[0] && String(connections[0].podium_phone_number || "").replace(/\\D/g, "").endsWith("2700")) });
      return reply({ ok: true, ignored: true });
    }
    const items = field(data, "items");
    const parts = Array.isArray(items) ? items.map(i => str(field(i, "body"))).filter(Boolean) : [];
    const body = str(field(data, "body")) || parts.join("\n") || null;
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
    const fallback = [...digest].map(n => n.toString(16).padStart(2, "0")).join("");
    const row = {
      event_key: str(field(metadata, "eventUid")) || str(field(metadata, "event_uid")) || fallback,
      event_type: kind,
      direction: kind === "message.received" ? "inbound" : "outbound",
      location_uid: location,
      customer_phone: number,
      conversation_uid: str(field(conversation, "uid")),
      message_uid: str(field(data, "uid")),
      body,
      failure_reason: str(field(data, "failureReason")),
      message_at: str(field(data, "createdAt")) || str(field(data, "created_at")),
      raw_payload: event,
    };
    const response = await fetch(`${base}/rest/v1/podium_sms_messages?on_conflict=event_key`, {
      method: "POST", headers: { ...authHeaders, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(row),
    });
    if (!response.ok) {
      console.error("Podium SMS persistence failed", response.status);
      return reply({ error: "Temporary storage failure" }, 503);
    }
    console.info("Podium webhook stored", { event_type: kind });
    return reply({ ok: true });
  } catch (error) {
    console.error("Podium SMS webhook error", error instanceof Error ? error.message : "unknown");
    return reply({ error: "Temporary webhook failure" }, 503);
  }
});
