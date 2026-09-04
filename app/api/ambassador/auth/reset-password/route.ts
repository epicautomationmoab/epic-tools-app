import { NextResponse } from "next/server";

function getConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase public environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { access_token?: string; password?: string } | null;
  const accessToken = body?.access_token?.trim() || "";
  const password = body?.password || "";
  if (!accessToken) return NextResponse.json({ error: "This reset link is missing or expired." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Choose a password with at least 8 characters." }, { status: 400 });

  try {
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.msg || payload?.message || "Unable to reset password.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reset password." }, { status: 500 });
  }
}
