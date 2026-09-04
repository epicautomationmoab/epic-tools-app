import { NextResponse } from "next/server";

function getConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase public environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase() || "";
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    const { url, key } = getConfig();
    const redirectTo = "https://www.epic4x4ambassador.com/ambassador/reset-password";
    const response = await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.msg || payload?.message || payload?.error_description || "Unable to send password reset email.");

    return NextResponse.json({ ok: true, message: "If an Ambassador account exists for that email, a password reset link has been sent." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send password reset email." }, { status: 500 });
  }
}
