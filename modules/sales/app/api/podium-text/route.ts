import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function proxy(request: NextRequest, method: "GET" | "POST") {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  if (!accessToken) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  if (method !== "POST") return NextResponse.json({error:"Method not supported."},{status:405});

  const response = await fetch(`${SUPABASE_URL}/functions/v1/podium-sms-send`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(PUBLIC_KEY ? {apikey:PUBLIC_KEY} : {}), "Content-Type": "application/json" },
    ...(method === "POST" ? { body: await request.text() } : {}),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return NextResponse.json({error:typeof data?.error==="string"?data.error:"Podium reply failed; no confirmation received."},{status:response.status});
  return NextResponse.json(data);
}

export async function GET(request: NextRequest) { return proxy(request, "GET"); }
export async function POST(request: NextRequest) { return proxy(request, "POST"); }
