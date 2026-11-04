import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../../lib/team-auth";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || !accessToken || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }

  const callId = request.nextUrl.searchParams.get("call");
  if (!callId) return NextResponse.json({ error: "Call ID is required." }, { status: 400 });

  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
  };

  const metaResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/telnyx_call_recordings?grandstream_cdr_id=eq.${encodeURIComponent(callId)}&select=storage_path&order=updated_at.desc&limit=1`,
    { headers, cache: "no-store" },
  );

  if (!metaResponse.ok) {
    return NextResponse.json({ error: "Unable to load call recording." }, { status: 500 });
  }

  const rows = await metaResponse.json().catch(() => []) as Array<{storage_path:string|null}>;
  const storagePath = rows[0]?.storage_path;
  if (!storagePath) return NextResponse.json({ error: "Recording is not available." }, { status: 404 });

  const mediaResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/call-recordings/${storagePath.split("/").map(encodeURIComponent).join("/")}`,
    { headers, cache: "no-store" },
  );

  if (!mediaResponse.ok || !mediaResponse.body) {
    return NextResponse.json({ error: "Unable to retrieve call recording." }, { status: 502 });
  }

  return new NextResponse(mediaResponse.body, {
    status: 200,
    headers: {
      "Content-Type": mediaResponse.headers.get("content-type") || "audio/wav",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": "inline",
    },
  });
}
