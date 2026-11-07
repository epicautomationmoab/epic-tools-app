import { NextResponse } from "next/server";
import {supabaseSelect} from "@/lib/server/supabase-rest";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!rawUrl || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  const normalizedUrl = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `https://${rawUrl}`;

  return {
    url: normalizedUrl.replace(/\/+$/, ""),
    key,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const requestUrl = new URL(request.url);
    const readinessId = requestUrl.searchParams.get("readinessId")?.trim();
    const v2Preview = requestUrl.searchParams.get("v2") === "preview";

    if (!token) {
      return NextResponse.json({ error: "Portal token is required." }, { status: 400 });
    }

    if (!readinessId) {
      return NextResponse.json({ error: "Readiness ID is required." }, { status: 400 });
    }

    const config = getSupabaseConfig();
    const params = new URLSearchParams({
      select: "epic_document_url,confirmation_code,business_line",
      guest_portal_token: `eq.${token}`,
      readiness_id: `eq.${readinessId}`,
      limit: "1",
    });

    const response = await fetch(
      `${config.url}/rest/v1/guest_portal_v?${params.toString()}`,
      {
        headers: { apikey: config.key },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json(
        { error: "Unable to open Epic document.", detail: body.slice(0, 300) },
        { status: response.status },
      );
    }

    const rows = (await response.json()) as Array<{ epic_document_url: string | null;confirmation_code:string;business_line:string }>;
    let documentUrl = rows[0]?.epic_document_url;
    // Use the authenticated reservation's existing store visit when a legacy
    // wall-time/UTC join cannot resolve its agreement. Never guess another booking.
    if(!documentUrl&&rows[0]?.business_line==='rental'){
      const [source]=await supabaseSelect<{source_store_visit_id:string|null}>('guest_readiness_operational',new URLSearchParams({select:'source_store_visit_id',readiness_id:`eq.${readinessId}`,confirmation_code:`eq.${rows[0].confirmation_code}`,limit:'1'}));
      if(source?.source_store_visit_id){
        const [session]=await supabaseSelect<{public_path:string|null}>('epic_waiver_sessions',new URLSearchParams({select:'public_path',store_visit_id:`eq.${source.source_store_visit_id}`,confirmation_code:`eq.${rows[0].confirmation_code}`,business_line:'eq.rental',session_status:'eq.active',expires_at:`gte.${new Date().toISOString()}`,order:'updated_at.desc',limit:'1'}));
        documentUrl=session?.public_path;
      }
    }

    if (!documentUrl) {
      return NextResponse.json(
        { error: "Epic document link is not available." },
        { status: 404 },
      );
    }

    const redirectUrl = new URL(documentUrl, request.url);
    if (v2Preview) redirectUrl.searchParams.set("v2", "preview");
    return NextResponse.redirect(redirectUrl, 302);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to open Epic document.",
      },
      { status: 500 },
    );
  }
}
