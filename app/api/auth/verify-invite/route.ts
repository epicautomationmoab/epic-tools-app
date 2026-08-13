import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const tokenHash = typeof body?.token_hash === "string" ? body.token_hash.trim() : "";

  if (!tokenHash) {
    return NextResponse.json({ error: "Invitation token is missing." }, { status: 400 });
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) {
    return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
  }

  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");

  try {
    const response = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token_hash: tokenHash, type: "invite" }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.msg ||
            payload?.message ||
            payload?.error_description ||
            "This invitation is invalid or has expired. Please request a fresh invitation.",
        },
        { status: response.status },
      );
    }

    const accessToken = typeof payload?.access_token === "string" ? payload.access_token : "";
    const refreshToken = typeof payload?.refresh_token === "string" ? payload.refresh_token : "";

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: "Supabase verified the invitation but did not return a session." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify the EpicTools invitation.",
      },
      { status: 500 },
    );
  }
}
