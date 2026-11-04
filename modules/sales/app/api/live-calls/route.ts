import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";

export const dynamic = "force-dynamic";
const SOURCE = ((process.env.EPIC_UNIFIED_INTERNAL_ORIGIN || "") + "/api/team/live-calls");

async function relay(request: NextRequest, method: "GET" | "POST") {
  const token = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(token);
  if (!token || !profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required" }, { status: 401 });
  }
  try {
    const response = await fetch(SOURCE, {
      method,
      headers: { Cookie: `epic_access_token=${encodeURIComponent(token)}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
      body: method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      console.warn("[c360-live-calls] Upstream failed", { method, status: response.status });
      return NextResponse.json({ error: "Live-call service unavailable" }, { status: 502 });
    }
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Live-call service unavailable" }, { status: 502 });
  }
}
export async function GET(request: NextRequest) { return relay(request, "GET"); }
export async function POST(request: NextRequest) { return relay(request, "POST"); }
