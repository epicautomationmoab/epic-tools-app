import { NextResponse } from "next/server";

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

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        { error: "Portal token is required." },
        { status: 400 },
      );
    }

    const config = getSupabaseConfig();
    const params = new URLSearchParams({
      select: "confirmation_code,mpwr_waiver_url",
      guest_portal_token: `eq.${token}`,
      limit: "1",
    });

    const response = await fetch(
      `${config.url}/rest/v1/guest_portal_v?${params.toString()}`,
      {
        headers: {
          apikey: config.key,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const body = await response.text();

      console.error(
        "MPWR waiver click listener could not load guest portal:",
        body.slice(0, 300),
      );

      return NextResponse.json(
        { error: "Unable to open Polaris waiver." },
        { status: response.status },
      );
    }

    const rows = (await response.json()) as Array<{
      confirmation_code: string;
      mpwr_waiver_url: string | null;
    }>;

    const row = rows[0];

    if (!row?.mpwr_waiver_url) {
      return NextResponse.json(
        { error: "Polaris waiver link is not available." },
        { status: 404 },
      );
    }

    console.log(
      JSON.stringify({
        event: "mpwr_waiver_clicked",
        source: "guest_portal",
        guestPortalToken: token,
        confirmationCode: row.confirmation_code,
        clickedAt: new Date().toISOString(),
      }),
    );

    return NextResponse.redirect(row.mpwr_waiver_url, 302);
  } catch (error) {
    console.error("MPWR waiver click listener failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to open Polaris waiver.",
      },
      { status: 500 },
    );
  }
}
