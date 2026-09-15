const BATCH_SIZE = 100;

function getServerSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!rawUrl || !key) {
    throw new Error("Supabase secret environment variables are missing.");
  }

  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: normalizedUrl.replace(/\/+$/, ""), key };
}

function quotePostgrestValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export async function getPriorEveningReadinessIds(readinessIds: string[]) {
  const uniqueIds = [...new Set(readinessIds.filter(Boolean))];
  const result = new Set<string>();
  if (!uniqueIds.length) return result;

  const { url, key } = getServerSupabaseConfig();

  for (let index = 0; index < uniqueIds.length; index += BATCH_SIZE) {
    const batch = uniqueIds.slice(index, index + BATCH_SIZE);
    const params = new URLSearchParams({
      select: "readiness_id,pickup_prior_evening",
      readiness_id: `in.(${batch.map(quotePostgrestValue).join(",")})`,
      pickup_prior_evening: "eq.true",
      limit: "1000",
    });

    const response = await fetch(
      `${url}/rest/v1/guest_readiness_operational?${params.toString()}`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Unable to load prior-evening readiness flags (${response.status}): ${detail.slice(0, 300)}`,
      );
    }

    const rows = (await response.json()) as Array<{
      readiness_id: string;
      pickup_prior_evening: boolean | null;
    }>;

    for (const row of rows) {
      if (row.pickup_prior_evening === true) result.add(row.readiness_id);
    }
  }

  return result;
}

export function shiftWallDateBackOneDay(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})([ T])/);
  if (!match) return value;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() - 1);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const separator = match[4];

  // Prior Evening Pickup is an operational 5:00 PM arrival on the day
  // before the TripWorks rental start. Preserve the source timestamp separator
  // so Readiness' existing chronological string sort remains valid.
  return `${year}-${month}-${day}${separator}17:00:00`;
}
