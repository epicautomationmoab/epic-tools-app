import { NextResponse } from "next/server";
import { ambassadorCookieOptions } from "@/lib/ambassador-auth";

function getConfig(useSecretKey = false) {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = useSecretKey ? process.env.SUPABASE_SECRET_KEY?.trim() : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

async function getAuthUser(accessToken: string) {
  const { url, key } = getConfig(false);
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<{ id: string; email?: string | null }>;
}

async function setPassword(accessToken: string, password: string) {
  const { url, key } = getConfig(false);
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.msg || payload?.message || "Unable to set password.");
}

async function linkProfiles(email: string, userId: string) {
  const { url, key } = getConfig(true);
  const query = `referral_partner_profiles?email=ilike.${encodeURIComponent(email)}&active=eq.true&select=id,user_id`;
  const response = await fetch(`${url}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error("Unable to load Ambassador access records.");

  for (const row of rows as Array<{ id: string; user_id: string | null }>) {
    if (row.user_id && row.user_id !== userId) continue;
    if (row.user_id === userId) continue;
    const patch = await fetch(`${url}/rest/v1/referral_partner_profiles?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ user_id: userId, last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
    if (!patch.ok) throw new Error("Unable to link Ambassador access record.");
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accessToken = typeof body?.access_token === "string" ? body.access_token.trim() : "";
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!accessToken || password.length < 8) {
    return NextResponse.json({ error: "A valid invitation and a password of at least 8 characters are required." }, { status: 400 });
  }

  try {
    const user = await getAuthUser(accessToken);
    if (!user?.id || !user.email) throw new Error("This invitation is invalid or has expired.");

    await setPassword(accessToken, password);
    await linkProfiles(user.email.trim().toLowerCase(), user.id);

    const response = NextResponse.json({ success: true });
    response.cookies.set("epic_ambassador_access_token", accessToken, ambassadorCookieOptions(3600));
    if (refreshToken) {
      response.cookies.set("epic_ambassador_refresh_token", refreshToken, ambassadorCookieOptions(60 * 60 * 24 * 30));
    }
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to finish Ambassador setup." }, { status: 400 });
  }
}
