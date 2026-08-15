import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";

function hasPreviewAccess(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  return Boolean(
    previewToken &&
      request.cookies.get("epic_preview_access")?.value === previewToken,
  );
}

async function authorized(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  return Boolean(profile || hasPreviewAccess(request));
}

type ReadinessLookup = {
  source_store_visit_id: string | null;
  confirmation_code: string;
};

type VisitLookup = {
  operational_reservation_id: string | null;
  confirmation_code: string;
};

type SignatureRow = {
  id: string;
  signer_first_name: string | null;
  signer_middle_initial: string | null;
  signer_last_name: string | null;
  signer_full_name: string | null;
  signer_email: string | null;
  signed_at: string;
  signed_pdf_storage_path: string | null;
  copy_email_status: string | null;
  copy_email_sent_at: string | null;
};

function signatureName(row: SignatureRow) {
  const composed = [
    row.signer_first_name,
    row.signer_middle_initial,
    row.signer_last_name,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

  return composed || row.signer_full_name || "Signed participant";
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const readinessId = request.nextUrl.searchParams.get("readiness_id")?.trim();
  if (!readinessId) {
    return NextResponse.json(
      { error: "readiness_id is required." },
      { status: 400 },
    );
  }

  try {
    const readinessRows = await supabaseSelect<ReadinessLookup>(
      "guest_readiness_operational",
      new URLSearchParams({
        select: "source_store_visit_id,confirmation_code",
        readiness_id: `eq.${readinessId}`,
        limit: "1",
      }),
      true,
    );

    const readiness = readinessRows[0];
    if (!readiness) {
      return NextResponse.json({ waivers: [] });
    }

    let operationalReservationId: string | null = null;
    if (readiness.source_store_visit_id) {
      const visits = await supabaseSelect<VisitLookup>(
        "portal_patti_store_visits",
        new URLSearchParams({
          select: "operational_reservation_id,confirmation_code",
          store_visit_id: `eq.${readiness.source_store_visit_id}`,
          limit: "1",
        }),
        true,
      );
      operationalReservationId = visits[0]?.operational_reservation_id ?? null;
    }

    const params = new URLSearchParams({
      select:
        "id,signer_first_name,signer_middle_initial,signer_last_name,signer_full_name,signer_email,signed_at,signed_pdf_storage_path,copy_email_status,copy_email_sent_at",
      signed_pdf_storage_path: "not.is.null",
      archived_at: "is.null",
      order: "signed_at.desc",
      limit: "50",
    });

    if (operationalReservationId) {
      params.set("operational_reservation_id", `eq.${operationalReservationId}`);
    } else {
      params.set("confirmation_code", `eq.${readiness.confirmation_code}`);
    }

    const signatures = await supabaseSelect<SignatureRow>(
      "epic_waiver_signatures",
      params,
      true,
    );

    return NextResponse.json({
      waivers: signatures.map((signature) => ({
        id: signature.id,
        signerName: signatureName(signature),
        signerEmail: signature.signer_email,
        signedAt: signature.signed_at,
        copyEmailStatus: signature.copy_email_status,
        copyEmailSentAt: signature.copy_email_sent_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load signed waivers.",
      },
      { status: 500 },
    );
  }
}
