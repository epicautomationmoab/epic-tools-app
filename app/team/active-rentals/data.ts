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

export async function getCarryoverRentalCount() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) return 0;

  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const params = new URLSearchParams({
    select: "readiness_id",
    business_line: "eq.rental",
    handoff_status: "eq.rental_out",
    visit_start_time: `lt.${mountainDateKey()}T00:00:00`,
    limit: "100",
  });

  try {
    const response = await fetch(`${url}/rest/v1/guest_readiness_with_handoff_v?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) return 0;
    const rows = (await response.json()) as Array<{ readiness_id?: string | null }>;
    return rows.filter((row) => Boolean(row.readiness_id)).length;
  } catch {
    return 0;
  }
}
