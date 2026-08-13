import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

const PODIUM_API_BASE = "https://api.podium.com";
const PODIUM_SCOPES = ["read_locations", "write_messages", "read_messages"];
const CONNECTION_ID = "primary";

type PodiumConnection = {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string | null;
  location_uid: string;
  location_name: string | null;
  podium_phone_number: string | null;
};

type PodiumTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type PodiumLocation = {
  uid: string;
  name?: string;
  displayName?: string;
  archived?: boolean;
  podiumPhoneNumber?: string | null;
};

function requiredEnv(name: "PODIUM_CLIENT_ID" | "PODIUM_CLIENT_SECRET" | "PODIUM_REDIRECT_URI") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function podiumEnvironmentConfigured() {
  return Boolean(
    process.env.PODIUM_CLIENT_ID?.trim()
      && process.env.PODIUM_CLIENT_SECRET?.trim()
      && process.env.PODIUM_REDIRECT_URI?.trim(),
  );
}

function signState(payload: string) {
  return createHmac("sha256", requiredEnv("PODIUM_CLIENT_SECRET")).update(payload).digest("base64url");
}

export function createPodiumAuthorizationUrl() {
  const payload = Buffer.from(JSON.stringify({
    createdAt: Date.now(),
    nonce: randomBytes(18).toString("base64url"),
  })).toString("base64url");
  const state = `${payload}.${signState(payload)}`;
  const url = new URL(`${PODIUM_API_BASE}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", requiredEnv("PODIUM_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requiredEnv("PODIUM_REDIRECT_URI"));
  url.searchParams.set("scope", PODIUM_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url;
}

export function validatePodiumOAuthState(state: string) {
  const [payload, suppliedSignature, ...extra] = state.split(".");
  if (!payload || !suppliedSignature || extra.length) throw new Error("Invalid Podium connection state.");
  const expectedSignature = signState(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Invalid Podium connection state.");
  }
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { createdAt?: number };
  if (!decoded.createdAt || Date.now() - decoded.createdAt > 15 * 60 * 1000) {
    throw new Error("The Podium connection link expired. Start the connection again.");
  }
}

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch(`${PODIUM_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Podium authorization failed: ${await response.text()}`);
  return (await response.json()) as PodiumTokenResponse;
}

function expiresAt(token: PodiumTokenResponse) {
  const lifetimeSeconds = Number.isFinite(token.expires_in) ? Number(token.expires_in) : 10 * 60 * 60;
  return new Date(Date.now() + Math.max(60, lifetimeSeconds - 60) * 1000).toISOString();
}

function collection<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of ["data", "items", "results"]) {
    if (Array.isArray(object[key])) return object[key] as T[];
  }
  return [];
}

async function loadLocations(accessToken: string) {
  const response = await fetch(`${PODIUM_API_BASE}/v4/locations?limit=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to read Podium locations: ${await response.text()}`);
  return collection<PodiumLocation>(await response.json());
}

function selectLocation(locations: PodiumLocation[]) {
  const active = locations.filter((location) => location.archived !== true);
  const selected = active.find((location) => Boolean(location.podiumPhoneNumber)) ?? active[0] ?? locations[0];
  if (!selected?.uid) throw new Error("Podium did not return an active location for Epic 4X4 Adventures.");
  return selected;
}

async function loadConnection() {
  const rows = await supabaseSelect<PodiumConnection>(
    "podium_oauth_connections",
    new URLSearchParams({
      select: "id,access_token,refresh_token,expires_at,scopes,location_uid,location_name,podium_phone_number",
      id: `eq.${CONNECTION_ID}`,
      limit: "1",
    }),
  );
  return rows[0] ?? null;
}

async function saveConnection(token: PodiumTokenResponse, location: PodiumLocation, existing?: PodiumConnection | null) {
  const values = {
    access_token: token.access_token,
    refresh_token: token.refresh_token || existing?.refresh_token || "",
    expires_at: expiresAt(token),
    scopes: token.scope || existing?.scopes || PODIUM_SCOPES.join(" "),
    location_uid: location.uid,
    location_name: location.displayName || location.name || null,
    podium_phone_number: location.podiumPhoneNumber || null,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    await supabasePatch("podium_oauth_connections", new URLSearchParams({ id: `eq.${CONNECTION_ID}` }), values);
    return;
  }
  await supabaseInsert("podium_oauth_connections", { id: CONNECTION_ID, ...values });
}

export async function exchangePodiumAuthorizationCode(code: string) {
  const token = await tokenRequest({
    client_id: requiredEnv("PODIUM_CLIENT_ID"),
    client_secret: requiredEnv("PODIUM_CLIENT_SECRET"),
    redirect_uri: requiredEnv("PODIUM_REDIRECT_URI"),
    grant_type: "authorization_code",
    code,
  });
  if (!token.access_token || !token.refresh_token) throw new Error("Podium did not return a complete OAuth connection.");
  const location = selectLocation(await loadLocations(token.access_token));
  const existing = await loadConnection();
  await saveConnection(token, location, existing);
}

async function refreshConnection(connection: PodiumConnection) {
  const token = await tokenRequest({
    client_id: requiredEnv("PODIUM_CLIENT_ID"),
    client_secret: requiredEnv("PODIUM_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: connection.refresh_token,
  });
  if (!token.access_token) throw new Error("Podium did not return a refreshed access token.");
  await saveConnection(token, {
    uid: connection.location_uid,
    displayName: connection.location_name || undefined,
    podiumPhoneNumber: connection.podium_phone_number,
  }, connection);
  return { ...connection, access_token: token.access_token, refresh_token: token.refresh_token || connection.refresh_token, expires_at: expiresAt(token) };
}

async function activeConnection() {
  const connection = await loadConnection();
  if (!connection) throw new Error("Podium is not connected. Connect it once from EpicTools setup.");
  if (new Date(connection.expires_at).getTime() <= Date.now() + 5 * 60 * 1000) return refreshConnection(connection);
  return connection;
}

export async function podiumConnected() {
  if (!podiumEnvironmentConfigured()) return false;
  try {
    return Boolean(await loadConnection());
  } catch {
    return false;
  }
}

async function sendMessageRequest(connection: PodiumConnection, input: { phone: string; body: string; contactName?: string; senderName?: string }) {
  return fetch(`${PODIUM_API_BASE}/v4/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body: input.body,
      channel: { type: "phone", identifier: input.phone },
      contactName: input.contactName || undefined,
      locationUid: connection.location_uid,
      senderName: input.senderName || "Epic 4X4 Adventures",
      setOpenInbox: true,
    }),
    cache: "no-store",
  });
}

export async function sendPodiumSms(input: { phone: string; body: string; contactName?: string; senderName?: string }) {
  let connection = await activeConnection();
  let response = await sendMessageRequest(connection, input);
  if (response.status === 401) {
    connection = await refreshConnection(connection);
    response = await sendMessageRequest(connection, input);
  }
  if (!response.ok) throw new Error(`Podium text failed: ${await response.text()}`);
  const result = await response.json() as {
    uid?: string;
    data?: { uid?: string; items?: Array<{ deliveryStatus?: string; failureReason?: string | null }> };
    items?: Array<{ deliveryStatus?: string; failureReason?: string | null }>;
  };
  const message = result.data ?? result;
  const item = message.items?.[0];
  return {
    messageUid: message.uid ?? null,
    deliveryStatus: item?.deliveryStatus || "sent",
    failureReason: item?.failureReason || null,
  };
}
