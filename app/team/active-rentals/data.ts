import type { ReadinessRow } from "@/lib/supabase";

function mountainDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

type HandoffRow = {
  readiness_id: string;
  handoff_status: string;
  updated_at: string;
};

type NoShowRow = {
  readiness_id: string;
};

type PortalRow = {
  confirmation_code: string;
  guest_portal_token: string | null;
};

function supabaseServerConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server configuration is missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function fetchJson<T>(path: string, params: URLSearchParams): Promise<T[]> {
  const { url, key } = supabaseServerConfig();
  const response = await fetch(`${url}/rest/v1/${path}?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Unable to load ${path}.`);
  }
  return response.json() as Promise<T[]>;
}

function quoteList(values: string[]) {
  return values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
}

export async function getHeldOverRentals(): Promise<ReadinessRow[]> {
  const today = mountainDateKey();
  const yesterday = mountainDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const readinessParams = new URLSearchParams({
    select: "*",
    business_line: "eq.rental",
    visit_start_time: `gte.${yesterday}T00:00:00`,
    order: "visit_start_time.asc",
    limit: "500",
  });
  readinessParams.append("visit_start_time", `lt.${today}T00:00:00`);

  const readinessRows = await fetchJson<ReadinessRow>("guest_readiness_with_handoff_v", readinessParams);
  if (readinessRows.length === 0) return [];

  const readinessIds = readinessRows.map((row) => row.readiness_id).filter((id): id is string => Boolean(id));
  const confirmationCodes = [...new Set(readinessRows.map((row) => row.confirmation_code).filter(Boolean))];
  const quotedIds = readinessIds.map((id) => `"${id}"`).join(",");
  const handoffParams = new URLSearchParams({
    select: "readiness_id,handoff_status,updated_at",
    readiness_id: `in.(${quotedIds})`,
    order: "updated_at.desc",
    limit: "1000",
  });
  const noShowParams = new URLSearchParams({
    select: "readiness_id",
    readiness_id: `in.(${quotedIds})`,
    limit: "1000",
  });
  const portalParams = new URLSearchParams({
    select: "confirmation_code,guest_portal_token",
    confirmation_code: `in.(${quoteList(confirmationCodes)})`,
    limit: "1000",
  });

  const [handoffs, noShows, portalRows] = await Promise.all([
    fetchJson<HandoffRow>("epic_operational_handoffs", handoffParams),
    fetchJson<NoShowRow>("epic_no_show_status", noShowParams),
    fetchJson<PortalRow>("guest_portal_v", portalParams),
  ]);

  const noShowReadinessIds = new Set(noShows.map((row) => row.readiness_id));
  const latestHandoffByReadinessId = new Map<string, HandoffRow>();
  for (const handoff of handoffs) {
    if (!latestHandoffByReadinessId.has(handoff.readiness_id)) {
      latestHandoffByReadinessId.set(handoff.readiness_id, handoff);
    }
  }

  const portalTokenByConfirmation = new Map<string, string>();
  for (const portalRow of portalRows) {
    if (portalRow.guest_portal_token) portalTokenByConfirmation.set(portalRow.confirmation_code, portalRow.guest_portal_token);
  }

  return readinessRows
    .filter((row) => {
      if (!row.readiness_id) return true;
      if (noShowReadinessIds.has(row.readiness_id)) return false;
      return latestHandoffByReadinessId.get(row.readiness_id)?.handoff_status !== "rental_returned";
    })
    .map((row) => ({
      ...row,
      guest_portal_token: portalTokenByConfirmation.get(row.confirmation_code) ?? null,
    }));
}

export async function getCarryoverRentalCount() {
  try {
    return (await getHeldOverRentals()).length;
  } catch {
    return 0;
  }
}
