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
    const readinessId = new URL(request.url).searchParams.get("readinessId")?.trim();

    if (!token) {
      return NextResponse.json({ error: "Portal token is required." }, { status: 400 });
    }

    if (!readinessId) {
      return NextResponse.json({ error: "Readiness ID is required." }, { status: 400 });
    }

    const config = getSupabaseConfig();
    const params = new URLSearchParams({
      select: "epic_document_url",
      guest_portal_token: `eq.${token}`,
      readiness_id: `eq.${readinessId}`,
      limit: "1",
    });

    const response = await fetch(
      `${config.url}/rest/v1/guest_portal_v?${params.toString()}`,
      {
        headers: { apikey: config.key },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json(
        { error: "Unable to open Epic document.", detail: body.slice(0, 300) },
        { status: response.status },
      );
    }

    const rows = (await response.json()) as Array<{ epic_document_url: string | null }>;
    const documentUrl = rows[0]?.epic_document_url;

    if (!documentUrl) {
      return NextResponse.json(
        { error: "Epic document link is not available." },
        { status: 404 },
      );
    }

    const redirectUrl = new URL(documentUrl, request.url);
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to open Epic document.",
      },
      { status: 500 },
    );
  }
}
