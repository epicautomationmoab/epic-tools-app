import { NextResponse } from "next/server";

type LookupRow = {
  guest_portal_token: string;
  confirmation_code: string;
  customer_name: string;
};

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!rawUrl || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  const normalizedUrl = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `https://${rawUrl}`;

  return {
    url: normalizedUrl.replace(/\/+$/, ""),
    key,
  };
}

function normalizeConfirmation(value: string) {
  return value.trim().toUpperCase();
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function getLastName(fullName: string) {
  const parts = normalizeName(fullName).split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      confirmationCode?: string;
      lastName?: string;
      website?: string;
    };

    // Honeypot field. Real guests never see or fill this.
    if (body.website) {
      return NextResponse.json(
        { error: "We could not locate that reservation." },
        { status: 404 },
      );
    }

    const confirmationCode = normalizeConfirmation(body.confirmationCode ?? "");
    const lastName = normalizeName(body.lastName ?? "");

    if (!confirmationCode || !lastName) {
      return NextResponse.json(
        { error: "Enter your confirmation number and last name." },
        { status: 400 },
      );
    }

    if (confirmationCode.length > 40 || lastName.length > 80) {
      return NextResponse.json(
        { error: "We could not locate that reservation." },
        { status: 404 },
      );
    }

    const config = getSupabaseConfig();
    const params = new URLSearchParams({
      select: "guest_portal_token,confirmation_code,customer_name",
      confirmation_code: `eq.${confirmationCode}`,
      limit: "10",
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
      return NextResponse.json(
        { error: "We could not locate that reservation." },
        { status: 404 },
      );
    }

    const rows = (await response.json()) as LookupRow[];
    const match = rows.find((row) => getLastName(row.customer_name) === lastName);

    if (!match?.guest_portal_token) {
      return NextResponse.json(
        { error: "We could not locate that reservation." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      portalPath: `/guest/${encodeURIComponent(match.guest_portal_token)}`,
    });
  } catch {
    return NextResponse.json(
      { error: "We could not locate that reservation." },
      { status: 500 },
    );
  }
}
