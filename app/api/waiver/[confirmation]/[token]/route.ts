import { NextResponse } from "next/server";

function config() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

export async function GET(_request: Request, context: { params: Promise<{ confirmation: string; token: string }> }) {
  try {
    const { confirmation, token } = await context.params;
    const c = config();
    const response = await fetch(`${c.url}/rest/v1/rpc/resolve_epic_waiver_session_v2`, {
      method: "POST",
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_confirmation_code: confirmation, p_public_token: token }),
      cache: "no-store",
    });
    const body = await response.text();
    if (!response.ok) return NextResponse.json({ error: "Unable to load waiver.", detail: body.slice(0, 300) }, { status: response.status });
    const rows = JSON.parse(body);
    if (!rows?.length) return NextResponse.json({ error: "This waiver link is invalid, inactive, or expired." }, { status: 404 });
    return NextResponse.json({ session: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load waiver." }, { status: 500 });
  }
}
