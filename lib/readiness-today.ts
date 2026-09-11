import type { ReadinessRow } from "@/lib/supabase";

function config(useSecretKey = false) {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = useSecretKey
    ? process.env.SUPABASE_SECRET_KEY?.trim()
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function fetchView<T>(viewName: string, params: URLSearchParams, useSecretKey = false): Promise<T[]> {
  const { url, key } = config(useSecretKey);
  const response = await fetch(`${url}/rest/v1/${viewName}?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${viewName} request failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return response.json() as Promise<T[]>;
}

function mountainParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function mountainOffsetMs(date: Date) {
  const zoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    timeZoneName: "longOffset",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  const match = zoneName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error("Unable to determine America/Denver UTC offset.");
  const direction = match[1] === "+" ? 1 : -1;
  return direction * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

function mountainMidnightUtc(year: number, month: number, day: number) {
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let instant = localMidnightAsUtc;
  for (let index = 0; index < 3; index += 1) instant = localMidnightAsUtc - mountainOffsetMs(new Date(instant));
  return new Date(instant);
}

export async function getTodayReadinessRows() {
  const today = mountainParts(new Date());
  const start = mountainMidnightUtc(today.year, today.month, today.day);
  const end = mountainMidnightUtc(today.year, today.month, today.day + 1);
  const params = new URLSearchParams({ select: "*", limit: "100" });
  params.append("visit_start_time", `gte.${start.toISOString()}`);
  params.append("visit_start_time", `lt.${end.toISOString()}`);

  const rows = await fetchView<ReadinessRow>("guest_readiness_with_handoff_v", params);
  const confirmationCodes = [...new Set(rows.map((row) => row.confirmation_code).filter(Boolean))];
  const portalTokenByConfirmation = new Map<string, string>();
  const deliveryFailuresByConfirmation = new Map<string, Array<{ name: string; email?: string | null; error?: string | null }>>();

  if (confirmationCodes.length > 0) {
    const quotedCodes = confirmationCodes
      .map((code) => `"${code.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
      .join(",");
    const portalParams = new URLSearchParams({
      select: "confirmation_code,guest_portal_token",
      confirmation_code: `in.(${quotedCodes})`,
      limit: "200",
    });
    const failureParams = new URLSearchParams({
      select: "confirmation_code,signer_full_name,signer_email,copy_email_error",
      confirmation_code: `in.(${quotedCodes})`,
      copy_email_status: "eq.failed",
      limit: "200",
    });
    const [portalRows, failedDocs] = await Promise.all([
      fetchView<{ confirmation_code: string; guest_portal_token: string | null }>("guest_portal_v", portalParams, true),
      fetchView<{ confirmation_code: string; signer_full_name: string; signer_email: string | null; copy_email_error: string | null }>("epic_waiver_signatures", failureParams, true),
    ]);

    for (const row of portalRows) {
      if (row.confirmation_code && row.guest_portal_token && !portalTokenByConfirmation.has(row.confirmation_code)) {
        portalTokenByConfirmation.set(row.confirmation_code, row.guest_portal_token);
      }
    }
    for (const row of failedDocs) {
      if (!row.confirmation_code || !row.signer_full_name) continue;
      const failures = deliveryFailuresByConfirmation.get(row.confirmation_code) ?? [];
      failures.push({ name: row.signer_full_name, email: row.signer_email, error: row.copy_email_error });
      deliveryFailuresByConfirmation.set(row.confirmation_code, failures);
    }
  }

  return rows
    .map((row) => ({
      ...row,
      handoff_status: row.handoff_status === "tour_returned" ? "checked_in" : row.handoff_status,
      guest_portal_token: portalTokenByConfirmation.get(row.confirmation_code) ?? null,
      epic_document_delivery_failures: deliveryFailuresByConfirmation.get(row.confirmation_code) ?? [],
    }))
    .sort((a, b) => a.visit_start_time.localeCompare(b.visit_start_time) || a.customer_name.localeCompare(b.customer_name));
}
