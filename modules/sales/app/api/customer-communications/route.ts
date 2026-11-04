import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value || "";
  if (!accessToken) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const response = await fetch(((process.env.EPIC_UNIFIED_INTERNAL_ORIGIN || "") + "/api/team/customer-communications"), {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  return new NextResponse(text, { status: response.status, headers: { "Content-Type": "application/json" } });
}
