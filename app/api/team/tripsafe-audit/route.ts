import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getPattiPolicyDecision } from "@/lib/server/patti-policy-source";
import { supabaseSelect } from "@/lib/server/supabase-rest";

type FutureReadinessRow = {
  readiness_id: string;
  confirmation_code: string;
  customer_name: string;
  product_display_name: string;
  visit_start_time: string;
};

function hasPreviewAccess(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  return Boolean(previewToken && request.cookies.get("epic_preview_access")?.value === previewToken);
}

async function authorized(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  return Boolean(profile || hasPreviewAccess(request));
}

export async function GET(request: NextRequest) {
  if (!await authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const rows = await supabaseSelect<FutureReadinessRow>(
      "guest_readiness_with_handoff_v",
      new URLSearchParams({
        select: "readiness_id,confirmation_code,customer_name,product_display_name,visit_start_time",
        visit_start_time: `gte.${new Date().toISOString()}`,
        order: "visit_start_time.asc",
        limit: "500",
      }),
    );

    const uniqueRows = [...new Map(
      rows.map((row) => [`${row.confirmation_code}|${row.visit_start_time}`, row]),
    ).values()];

    const results = [];
    for (const row of uniqueRows) {
      const decision = await getPattiPolicyDecision(row.confirmation_code, row.visit_start_time);
      results.push({
        readinessId: row.readiness_id,
        confirmationCode: row.confirmation_code,
        customerName: row.customer_name,
        productDisplayName: row.product_display_name,
        visitStartTime: row.visit_start_time,
        tripSafe: decision.tripSafeSelection,
        agreementPolicy: decision.status,
        decisionSource: decision.source,
      });
    }

    const summary = results.reduce(
      (counts, row) => {
        counts.total += 1;
        counts[row.tripSafe] += 1;
        return counts;
      },
      { total: 0, purchased: 0, declined: 0, unknown: 0 },
    );

    return NextResponse.json({
      scope: "future active readiness reservations only",
      generatedAt: new Date().toISOString(),
      summary,
      reservations: results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to audit TripSafe selections." },
      { status: 500 },
    );
  }
}
