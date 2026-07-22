import { NextResponse } from "next/server";

type PortalLookupRow = {
  guest_portal_token?: string | null;
  confirmation_code?: string | null;
  customer_phone?: string | null;
  customer_phone_last_four?: string | null;
  visit_start_time?: string | null;
};

const PUBLIC_PORTAL_ORIGIN = "https://myepicreservation.com";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");

  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: normalizedUrl.replace(/\/+$/, ""), key };
}

function phoneLastFour(row: PortalLookupRow) {
  const stored = (row.customer_phone_last_four ?? "").replace(/\D/g, "");
  if (stored.length === 4) return stored;

  const digits = (row.customer_phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

async function fetchPortalRows() {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "*",
    limit: "1000",
  });

  const response = await fetch(
    `${config.url}/rest/v1/guest_portal_v?${params.toString()}`,
    {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Portal lookup failed.");
  }

  return response.json() as Promise<PortalLookupRow[]>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lastFour?: string;
      website?: string;
    };

    if (body.website) {
      return NextResponse.json(
        { error: "Reservation not found." },
        { status: 404 },
      );
    }

    const lastFour = (body.lastFour ?? "").replace(/\D/g, "");
    if (lastFour.length !== 4) {
      return NextResponse.json(
        { error: "Enter the last four digits of the reservation phone number." },
        { status: 400 },
      );
    }

    const rows = await fetchPortalRows();
    const now = Date.now();

    const matches = rows
      .filter(
        (row) =>
          Boolean(row.guest_portal_token) && phoneLastFour(row) === lastFour,
      )
      .sort((a, b) => {
        const aTime = a.visit_start_time
          ? new Date(a.visit_start_time).getTime()
          : Number.POSITIVE_INFINITY;
        const bTime = b.visit_start_time
          ? new Date(b.visit_start_time).getTime()
          : Number.POSITIVE_INFINITY;

        const aUpcoming = aTime >= now ? 0 : 1;
        const bUpcoming = bTime >= now ? 0 : 1;

        if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
        return aUpcoming === 0 ? aTime - bTime : bTime - aTime;
      });

    const match = matches[0];

    if (!match?.guest_portal_token) {
      return NextResponse.json(
        {
          error:
            "We could not find a reservation with that phone number. Please see an Epic team member.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      portalPath: `${PUBLIC_PORTAL_ORIGIN}/guest/${encodeURIComponent(match.guest_portal_token)}`,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Kiosk lookup failed:", detail);

    return NextResponse.json(
      { error: "Please see an Epic team member for assistance." },
      { status: 500 },
    );
  }
}
