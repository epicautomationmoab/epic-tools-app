import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

type HistoryRow = {
  readiness_id: string;
  source_store_visit_id: string | null;
  confirmation_code: string;
  visit_start_time: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_phone_last_four: string | null;
  business_line: string;
  product_display_name: string;
  rental_duration: string | null;
  expected_guest_count: number | null;
  total_vehicle_count: number | null;
  vehicle_breakdown: Array<{ model: string; quantity: number }> | null;
  epic_document_received_count: number | null;
  epic_document_expected_count: number | null;
  mpwr_document_received_count: number | null;
  mpwr_document_expected_count: number | null;
  mpwr_confirmation_number: string | null;
  mpwr_waiver_url: string | null;
  mpwr_reservation_url: string | null;
  amount_due_cents: number | null;
  premier_adventure_assure: boolean | null;
  adventure_assure_level: string | null;
  ohv_required: boolean | null;
  ohv_certificate_uploaded: boolean | null;
  tripworks_booking_url: string | null;
  attention_flags: string[] | null;
  notes: string | null;
  handoff_status: string | null;
  courtesy_call_completed: boolean;
  courtesy_call_completed_by: string | null;
  courtesy_call_completed_at: string | null;
  courtesy_call_notes: string | null;
  courtesy_call_outcome: string | null;
  is_historical: boolean;
};

type EpicDocument = {
  store_visit_id: string;
  waiver_id: string;
  signer_name: string;
  signer_email: string | null;
  signer_phone: string | null;
  waiver_is_adult: boolean | null;
  signer_category: string | null;
  waiver_type_name: string | null;
  signed_pdf_url: string | null;
  received_at: string | null;
};

type MpwrWaiver = {
  mpwr_confirmation_number: string;
  rider_name: string;
  rider_email: string | null;
  waiver_url: string | null;
  is_minor: boolean | null;
  is_passenger: boolean | null;
  waiver_sequence_number: number | null;
  last_verified_at: string | null;
};

function hasPreviewAccess(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  return Boolean(
    previewToken && request.cookies.get("epic_preview_access")?.value === previewToken,
  );
}

async function authorized(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  if (await getAuthenticatedTeamProfile(accessToken)) return true;
  if (verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value)) return true;
  return hasPreviewAccess(request);
}

function cleanSearchTerm(value: string) {
  return value
    .trim()
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function quoteList(values: string[]) {
  return values
    .map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const query = cleanSearchTerm(request.nextUrl.searchParams.get("q") ?? "");
  if (query.length < 2) return NextResponse.json({ rows: [] });

  try {
    const digits = query.replace(/\D/g, "");
    const clauses = [
      `customer_name.ilike.*${query}*`,
      `confirmation_code.ilike.*${query}*`,
      `customer_email.ilike.*${query}*`,
      `product_display_name.ilike.*${query}*`,
      `mpwr_confirmation_number.ilike.*${query}*`,
    ];

    if (digits.length >= 4) {
      clauses.push(`customer_phone.ilike.*${digits}*`);
      clauses.push(`customer_phone_last_four.eq.${digits.slice(-4)}`);
    }

    const params = new URLSearchParams({
      select: "*",
      or: `(${clauses.join(",")})`,
      order: "visit_start_time.desc",
      limit: "50",
    });

    const rows = await supabaseSelect<HistoryRow>(
      "guest_readiness_history_search_v",
      params,
    );

    if (!rows.length) return NextResponse.json({ rows: [] });

    const storeVisitIds = [
      ...new Set(
        rows
          .map((row) => row.source_store_visit_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const mpwrConfirmations = [
      ...new Set(
        rows
          .map((row) => row.mpwr_confirmation_number)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [epicDocuments, mpwrWaivers] = await Promise.all([
      storeVisitIds.length
        ? supabaseSelect<EpicDocument>(
            "epic_store_visit_document_evidence_v",
            new URLSearchParams({
              select:
                "store_visit_id,waiver_id,signer_name,signer_email,signer_phone,waiver_is_adult,signer_category,waiver_type_name,signed_pdf_url,received_at",
              store_visit_id: `in.(${quoteList(storeVisitIds)})`,
              order: "received_at.asc",
              limit: "1000",
            }),
          )
        : Promise.resolve([]),
      mpwrConfirmations.length
        ? supabaseSelect<MpwrWaiver>(
            "scout_mpwr_waivers",
            new URLSearchParams({
              select:
                "mpwr_confirmation_number,rider_name,rider_email,waiver_url,is_minor,is_passenger,waiver_sequence_number,last_verified_at",
              mpwr_confirmation_number: `in.(${quoteList(mpwrConfirmations)})`,
              order: "waiver_sequence_number.asc,last_verified_at.asc",
              limit: "1000",
            }),
          )
        : Promise.resolve([]),
    ]);

    const epicByStoreVisit = new Map<string, EpicDocument[]>();
    for (const document of epicDocuments) {
      const current = epicByStoreVisit.get(document.store_visit_id) ?? [];
      current.push(document);
      epicByStoreVisit.set(document.store_visit_id, current);
    }

    const mpwrByConfirmation = new Map<string, MpwrWaiver[]>();
    for (const waiver of mpwrWaivers) {
      const current = mpwrByConfirmation.get(waiver.mpwr_confirmation_number) ?? [];
      current.push(waiver);
      mpwrByConfirmation.set(waiver.mpwr_confirmation_number, current);
    }

    return NextResponse.json({
      rows: rows.map((row) => ({
        ...row,
        is_paid: (row.amount_due_cents ?? 0) <= 0,
        requires_mpwr:
          (row.mpwr_document_expected_count ?? 0) > 0 ||
          Boolean(row.mpwr_confirmation_number),
        epic_document_count_label: `${row.epic_document_received_count ?? 0}/${row.epic_document_expected_count ?? row.expected_guest_count ?? 0}`,
        epic_document_count_color: "gray",
        epic_document_signers: row.source_store_visit_id
          ? (epicByStoreVisit.get(row.source_store_visit_id) ?? []).map((document) => ({
              name: document.signer_name,
              document_url: document.signed_pdf_url,
              is_minor_or_child:
                document.waiver_is_adult === null
                  ? document.signer_category === "minor"
                  : !document.waiver_is_adult,
              is_waiver_adult: document.waiver_is_adult,
            }))
          : [],
        mpwr_waivers: row.mpwr_confirmation_number
          ? (mpwrByConfirmation.get(row.mpwr_confirmation_number) ?? []).map((waiver) => ({
              name: waiver.rider_name,
              email: waiver.rider_email,
              document_url: waiver.waiver_url,
              is_minor: waiver.is_minor,
              is_passenger: waiver.is_passenger,
            }))
          : [],
      })),
    });
  } catch (error) {
    console.error("Historical readiness search failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Historical search failed." },
      { status: 500 },
    );
  }
}
