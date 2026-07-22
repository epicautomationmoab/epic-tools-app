import { NextResponse } from "next/server";

type ReadinessLookupRow = {
  confirmation_code: string;
  customer_phone: string | null;
  customer_phone_last_four: string | null;
  handoff_status: string | null;
};

type PortalLookupRow = {
  guest_portal_token: string;
  confirmation_code: string;
};

const PUBLIC_PORTAL_ORIGIN = "https://myepicreservation.com";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");

  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: normalizedUrl.replace(/\/+$/, ""), key };
}

function getMountainDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function getMountainOffsetMs(date: Date) {
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
  for (let index = 0; index < 3; index += 1) instant = localMidnightAsUtc - getMountainOffsetMs(new Date(instant));
  return new Date(instant);
}

function phoneLastFour(row: ReadinessLookupRow) {
  const stored = (row.customer_phone_last_four ?? "").replace(/\D/g, "");
  if (stored.length === 4) return stored;

  const digits = (row.customer_phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

async function fetchRows<T>(path: string, params: URLSearchParams): Promise<T[]> {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/${path}?${params.toString()}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Lookup failed.");
  return response.json() as Promise<T[]>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { lastFour?: string; website?: string };
    if (body.website) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

    const lastFour = (body.lastFour ?? "").replace(/\D/g, "");
    if (lastFour.length !== 4) {
      return NextResponse.json({ error: "Enter the last four digits of the reservation phone number." }, { status: 400 });
    }

    const today = getMountainDateParts(new Date());
    const start = mountainMidnightUtc(today.year, today.month, today.day);

    const readinessParams = new URLSearchParams({
      select: "confirmation_code,customer_phone,customer_phone_last_four,handoff_status",
      limit: "500",
    });
    readinessParams.append("visit_start_time", `gte.${start.toISOString()}`);

    const rows = await fetchRows<ReadinessLookupRow>("guest_readiness_with_handoff_v", readinessParams);
    const matchingRows = rows.filter(
      (row) =>
        phoneLastFour(row) === lastFour &&
        !["checked_in", "tour_returned", "rental_out", "rental_returned"].includes(row.handoff_status ?? ""),
    );
    const confirmations = [...new Set(matchingRows.map((row) => row.confirmation_code).filter(Boolean))];

    if (confirmations.length !== 1) {
      return NextResponse.json(
        {
          error:
            confirmations.length > 1
              ? "More than one upcoming reservation uses that code. Please see an Epic team member."
              : "We could not find an upcoming reservation. Please see an Epic team member.",
        },
        { status: 404 },
      );
    }

    const portalParams = new URLSearchParams({
      select: "guest_portal_token,confirmation_code",
      confirmation_code: `eq.${confirmations[0]}`,
      limit: "1",
    });
    const portalRows = await fetchRows<PortalLookupRow>("guest_portal_v", portalParams);
    const token = portalRows[0]?.guest_portal_token;

    if (!token) return NextResponse.json({ error: "Please see an Epic team member for assistance." }, { status: 404 });

    return NextResponse.json({
      portalPath: `${PUBLIC_PORTAL_ORIGIN}/guest/${encodeURIComponent(token)}`,
    });
  } catch {
    return NextResponse.json({ error: "Please see an Epic team member for assistance." }, { status: 500 });
  }
}
