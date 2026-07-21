import { NextResponse } from "next/server";

type GuestPortalRow = {
  guest_portal_token: string;
  readiness_id: string;
  confirmation_code: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone_last_four: string | null;
  business_line: string;
  product_display_name: string;
  visit_start_time: string;
  rental_duration: string | null;
  expected_guest_count: number | null;
  total_vehicle_count: number | null;
  vehicle_breakdown: Array<{
    model: string;
    quantity: number;
  }> | null;
  additional_waivers_url: string | null;
  mpwr_waiver_url: string | null;
  epic_document_received_count: number | null;
  epic_document_expected_count: number | null;
  epic_document_signers: Array<{
    name: string;
    is_minor_or_child?: boolean | null;
    is_waiver_adult?: boolean | null;
  }> | null;
  mpwr_document_received_count: number | null;
  mpwr_document_expected_count: number | null;
  mpwr_waivers: Array<{
    name: string;
    is_minor?: boolean | null;
    is_passenger?: boolean | null;
  }> | null;
  ohv_required: boolean | null;
  ohv_certificate_uploaded: boolean | null;
  ohv_certificate_filename: string | null;
  ohv_certificate_uploaded_at: string | null;
};

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
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        { error: "Portal token is required." },
        { status: 400 },
      );
    }

    const config = getSupabaseConfig();

    const params = new URLSearchParams({
      select: "*",
      guest_portal_token: `eq.${token}`,
      order: "visit_start_time.asc",
    });

    const response = await fetch(
      `${config.url}/rest/v1/guest_portal_v?${params.toString()}`,
      {
        headers: {
          apikey: config.key,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const body = await response.text();

      return NextResponse.json(
        {
          error: "Unable to load guest portal.",
          detail: body.slice(0, 300),
        },
        { status: response.status },
      );
    }

    const rows = (await response.json()) as GuestPortalRow[];

    if (!rows.length) {
      return NextResponse.json(
        { error: "Guest portal not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      reservation: {
        guestPortalToken: rows[0].guest_portal_token,
        confirmationCode: rows[0].confirmation_code,
        customerName: rows[0].customer_name,
        customerEmail: rows[0].customer_email,
        customerPhoneLastFour: rows[0].customer_phone_last_four,
        additionalWaiversUrl: rows[0].additional_waivers_url,
        mpwrWaiverUrl: rows[0].mpwr_waiver_url,

        activities: rows.map((row) => ({
          readinessId: row.readiness_id,
          businessLine: row.business_line,
          productDisplayName: row.product_display_name,
          visitStartTime: row.visit_start_time,
          rentalDuration: row.rental_duration,
          expectedGuestCount: row.expected_guest_count,
          totalVehicleCount: row.total_vehicle_count,
          vehicleBreakdown: row.vehicle_breakdown,
          ohvRequired: row.ohv_required,
          ohvCertificateUploaded: row.ohv_certificate_uploaded,
          ohvCertificateFilename: row.ohv_certificate_filename,
          ohvCertificateUploadedAt: row.ohv_certificate_uploaded_at,
        })),

        epicDocuments: rows.map((row) => ({
          readinessId: row.readiness_id,
          received: row.epic_document_received_count ?? 0,
          expected: row.epic_document_expected_count ?? 0,
          signers: row.epic_document_signers ?? [],
        })),

        mpwrWaivers: rows.map((row) => ({
          readinessId: row.readiness_id,
          received: row.mpwr_document_received_count ?? 0,
          expected: row.mpwr_document_expected_count ?? 0,
          signers: row.mpwr_waivers ?? [],
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load guest portal.",
      },
      { status: 500 },
    );
  }
}