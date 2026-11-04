import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value || "";
  if (!accessToken) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const response = await fetch(((process.env.EPIC_UNIFIED_INTERNAL_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")) + "/api/team/sales-introduction-email"), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile?.active || profile.role === "workstation") {
    return reply({ error: "Signed-in employee required." }, 401);
  }
  const id = request.nextUrl.searchParams.get("opportunity_id") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return reply({ error: "Invalid opportunity." }, 400);
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!base || !key) return reply({ error: "Introduction history unavailable." }, 503);
  // Keep mailbox access server-only. This employee-guarded endpoint exposes only
  // the most recent introduction timestamp for the requested sales opportunity.
  const url = base + "/rest/v1/gmail_messages?matched_sales_opportunity_id=eq." + encodeURIComponent(id)
    + "&source_type=eq.sales_introduction&direction=eq.outbound&select=sent_at&order=sent_at.desc&limit=1";
  try {
    const response = await fetch(url, {
      headers: { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + key }) },
      cache: "no-store",
    });
    if (!response.ok) return reply({ error: "Unable to verify introduction history." }, 502);
    const rows = await response.json();
    if (!Array.isArray(rows)) return reply({ error: "Unable to verify introduction history." }, 502);
    return reply({ sentAt: rows[0]?.sent_at || null });
  } catch {
    return reply({ error: "Introduction history is temporarily unavailable." }, 502);
  }
}
