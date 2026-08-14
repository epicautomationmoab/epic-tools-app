import { NextResponse } from "next/server";

function config() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (payload.p_signature_method !== "typed") return NextResponse.json({ error: "Secure drawn-signature storage is not enabled yet." }, { status: 501 });
    const c = config();
    const response = await fetch(`${c.url}/rest/v1/rpc/submit_epic_tour_waiver_v3`, {
      method: "POST",
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = await response.text();
    if (!response.ok) return NextResponse.json({ error: body.slice(0, 500) }, { status: response.status });
    return NextResponse.json({ result: JSON.parse(body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit waiver." }, { status: 500 });
  }
}
