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
  vehicle_breakdown: Array<{ model: string; quantity: number }> | null;
  premier_adventure_assure: boolean | null;
  adventure_assure_level: string | null;
  belt_tire_protection: boolean | null;
  epic_document_url: string | null;
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
    isMinor?: boolean | null;
    isPassenger?: boolean | null;
    is_minor?: boolean | null;
    is_passenger?: boolean | null;
  }> | null;
  ohv_required: boolean | null;
  ohv_certificate_uploaded: boolean | null;
  ohv_certificate_filename: string | null;
  ohv_certificate_uploaded_at: string | null;
};

type GuestFormTaskRow = {
  id: string;
  readiness_id: string | null;
  task_status: string;
  required: boolean;
  assigned_guest_name: string | null;
  completed_at: string | null;
  template_id: string;
};

type GuestFormTemplateRow = {
  id: string;
  template_key: string;
  template_name: string;
  form_title: string;
  form_description: string | null;
};

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: normalizedUrl.replace(/\/+$/, ""), key };
}

async function restSelect<T>(config: { url: string; key: string }, resource: string, params: URLSearchParams) {
  const response = await fetch(`${config.url}/rest/v1/${resource}?${params.toString()}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load ${resource}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T[];
}

function denverWallTimeToIso(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?/);
  if (!match) return value;
  const [, year, month, day, hour, minute, rawSecond = "00"] = match;
  const second = Number.parseFloat(rawSecond);
  const wholeSecond = Math.floor(second);
  const millisecond = Math.round((second - wholeSecond) * 1000);
  const wallClockAsUtc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), wholeSecond, millisecond));
  const offsetName = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", timeZoneName: "longOffset" })
    .formatToParts(wallClockAsUtc)
    .find((part) => part.type === "timeZoneName")?.value;
  const offsetMatch = offsetName?.match(/^GMT([+-]\d{2}:\d{2})$/);
  if (!offsetMatch) return value;
  const seconds = String(wholeSecond).padStart(2, "0");
  const fraction = millisecond ? `.${String(millisecond).padStart(3, "0")}` : "";
  return `${year}-${month}-${day}T${hour}:${minute}:${seconds}${fraction}${offsetMatch[1]}`;
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token) return NextResponse.json({ error: "Portal token is required." }, { status: 400 });

    const config = getSupabaseConfig();
    const rows = await restSelect<GuestPortalRow>(config, "guest_portal_v", new URLSearchParams({
      select: "*",
      guest_portal_token: `eq.${token}`,
      order: "visit_start_time.asc",
    }));
    if (!rows.length) return NextResponse.json({ error: "Guest portal not found." }, { status: 404 });

    const readinessIds = Array.from(new Set(rows.map((row) => row.readiness_id).filter(Boolean)));
    let guestForms: Array<Record<string, unknown>> = [];

    if (readinessIds.length) {
      const tasks = await restSelect<GuestFormTaskRow>(config, "guest_form_tasks", new URLSearchParams({
        select: "id,readiness_id,task_status,required,assigned_guest_name,completed_at,template_id",
        readiness_id: `in.(${readinessIds.join(",")})`,
        task_status: "not.in.(cancelled,expired)",
        order: "created_at.asc",
      }));

      if (tasks.length) {
        const templateIds = Array.from(new Set(tasks.map((task) => task.template_id)));
        const templates = await restSelect<GuestFormTemplateRow>(config, "guest_form_templates", new URLSearchParams({
          select: "id,template_key,template_name,form_title,form_description",
          id: `in.(${templateIds.join(",")})`,
          is_active: "eq.true",
        }));
        const templateById = new Map(templates.map((template) => [template.id, template]));
        guestForms = tasks.map((task) => {
          const template = templateById.get(task.template_id);
          return {
            taskId: task.id,
            readinessId: task.readiness_id,
            status: task.task_status,
            required: task.required,
            completedAt: task.completed_at,
            assignedGuestName: task.assigned_guest_name,
            templateKey: template?.template_key ?? null,
            templateName: template?.template_name ?? null,
            title: template?.form_title ?? template?.template_name ?? "Required Form",
            description: template?.form_description ?? null,
            openUrl: task.task_status === "completed"
              ? null
              : `/api/guest/${encodeURIComponent(token)}/guest-forms/${encodeURIComponent(task.id)}/open`,
          };
        });
      }
    }

    const hasMpwrWaiver = rows.some((row) => Boolean(row.mpwr_waiver_url));

    return NextResponse.json({
      reservation: {
        guestPortalToken: rows[0].guest_portal_token,
        confirmationCode: rows[0].confirmation_code,
        customerName: rows[0].customer_name,
        customerEmail: rows[0].customer_email,
        customerPhoneLastFour: rows[0].customer_phone_last_four,
        mpwrWaiverUrl: hasMpwrWaiver ? `/api/guest/${encodeURIComponent(token)}/mpwr-waiver` : null,
        guestForms,
        activities: rows.map((row) => ({
          readinessId: row.readiness_id,
          businessLine: row.business_line,
          productDisplayName: row.product_display_name,
          visitStartTime: denverWallTimeToIso(row.visit_start_time),
          rentalDuration: row.rental_duration,
          expectedGuestCount: row.expected_guest_count,
          totalVehicleCount: row.total_vehicle_count,
          vehicleBreakdown: row.vehicle_breakdown,
          premierAdventureAssure: row.premier_adventure_assure,
          adventureAssureLevel: row.adventure_assure_level,
          beltTireProtection: row.belt_tire_protection,
          epicDocumentUrl: row.epic_document_url
            ? `/api/guest/${encodeURIComponent(token)}/epic-document?readinessId=${encodeURIComponent(row.readiness_id)}`
            : null,
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load guest portal." }, { status: 500 });
  }
}
