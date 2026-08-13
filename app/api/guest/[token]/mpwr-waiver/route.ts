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

async function recordMpwrPortalClick(
  config: { url: string; key: string },
  confirmationCode: string,
  clickedAt: string,
) {
  const headers = {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
  };

  const queueParams = new URLSearchParams({
    select: "id,mpwr_portal_click_count",
    confirmation_code: `eq.${confirmationCode}`,
  });

  const queueResponse = await fetch(
    `${config.url}/rest/v1/scout_mpwr_queue?${queueParams.toString()}`,
    {
      headers,
      cache: "no-store",
    },
  );

  if (!queueResponse.ok) {
    const body = await queueResponse.text();
    throw new Error(
      `Could not load Scout queue rows for MPWR click: ${body.slice(0, 300)}`,
    );
  }

  const queueRows = (await queueResponse.json()) as Array<{
    id: number;
    mpwr_portal_click_count: number | null;
  }>;

  if (!queueRows.length) {
    console.warn(
      `MPWR click recorded in logs but no scout_mpwr_queue row matched confirmation ${confirmationCode}.`,
    );
    return 0;
  }

  let updatedCount = 0;

  for (const queueRow of queueRows) {
    const updateResponse = await fetch(
      `${config.url}/rest/v1/scout_mpwr_queue?id=eq.${encodeURIComponent(String(queueRow.id))}`,
      {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          last_guest_mpwr_click_at: clickedAt,
          mpwr_portal_click_count:
            (queueRow.mpwr_portal_click_count ?? 0) + 1,
        }),
        cache: "no-store",
      },
    );

    if (!updateResponse.ok) {
      const body = await updateResponse.text();
      throw new Error(
        `Could not update Scout queue row ${queueRow.id} for MPWR click: ${body.slice(0, 300)}`,
      );
    }

    updatedCount += 1;
  }

  return updatedCount;
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

    const clickedAt = new Date().toISOString();
    let scoutQueueRowsUpdated = 0;

    try {
      scoutQueueRowsUpdated = await recordMpwrPortalClick(
        config,
        row.confirmation_code,
        clickedAt,
      );
    } catch (error) {
      console.error(
        "MPWR waiver click listener could not write Scout queue signal:",
        error,
      );
    }

    console.log(
      JSON.stringify({
        event: "mpwr_waiver_clicked",
        source: "guest_portal",
        guestPortalToken: token,
        confirmationCode: row.confirmation_code,
        clickedAt,
        scoutQueueRowsUpdated,
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
