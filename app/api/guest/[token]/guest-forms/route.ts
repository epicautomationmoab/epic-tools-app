import { NextResponse } from "next/server";
import { loadRentalV2Readiness } from "@/lib/server/rental-v2-readiness";

type PortalRow = { readiness_id: string; business_line: string; confirmation_code: string; expected_guest_count: number|null; total_vehicle_count: number|null };
type TaskRow = {
  id: string;
  readiness_id: string | null;
  task_status: string;
  required: boolean;
  assigned_guest_name: string | null;
  completed_at: string | null;
  template_id: string;
};
type TemplateRow = {
  id: string;
  template_key: string;
  template_name: string;
  form_title: string;
  form_description: string | null;
};
type SubmissionRow = { id: string; task_id: string; signed_pdf_storage_path: string | null; signer_name: string | null };

function getConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function select<T>(resource: string, params: URLSearchParams) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/${resource}?${params.toString()}`, {
    headers: { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }) },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load ${resource}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T[];
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token) return NextResponse.json({ error: "Portal token is required." }, { status: 400 });

    const portalRows = await select<PortalRow>("guest_portal_v", new URLSearchParams({
      select: "readiness_id,business_line,confirmation_code,expected_guest_count,total_vehicle_count",
      guest_portal_token: `eq.${token}`,
    }));
    if (!portalRows.length) return NextResponse.json({ error: "Guest portal not found." }, { status: 404 });

    const readinessIds = Array.from(new Set(portalRows.map((row) => row.readiness_id).filter(Boolean)));
    if (!readinessIds.length) return NextResponse.json({ tasks: [], signedRentalDrivers: [] });
    const rentalSources = portalRows.filter(row=>row.business_line==="rental").map(row=>({
      readinessId:row.readiness_id,confirmationCode:row.confirmation_code,
      expectedGuestCount:row.expected_guest_count,vehicleCount:row.total_vehicle_count
    }));
    const rentalV2 = await loadRentalV2Readiness(rentalSources);
    const v2Drivers = [...new Set([...rentalV2.values()].flatMap(r=>r.signers.filter(s=>s.role==="driver").map(s=>s.name)))];

    const tasks = await select<TaskRow>("guest_form_tasks", new URLSearchParams({
      select: "id,readiness_id,task_status,required,assigned_guest_name,completed_at,template_id",
      readiness_id: `in.(${readinessIds.join(",")})`,
      task_status: "not.in.(cancelled,expired)",
      order: "created_at.asc",
    }));
    if (!tasks.length) return NextResponse.json({ tasks: [], signedRentalDrivers: v2Drivers });

    const templateIds = Array.from(new Set(tasks.map((task) => task.template_id)));
    const templates = await select<TemplateRow>("guest_form_templates", new URLSearchParams({
      select: "id,template_key,template_name,form_title,form_description",
      id: `in.(${templateIds.join(",")})`,
      is_active: "eq.true",
    }));
    const submissions = await select<SubmissionRow>("guest_form_submissions", new URLSearchParams({
      select: "id,task_id,signed_pdf_storage_path,signer_name",
      task_id: `in.(${tasks.map((task) => task.id).join(",")})`,
    }));
    const templateById = new Map(templates.map((template) => [template.id, template]));
    const submissionByTask = new Map(submissions.map((submission) => [submission.task_id, submission]));

    return NextResponse.json({
      signedRentalDrivers: [...new Set([...v2Drivers, ...tasks.filter(task => task.task_status === "completed" && templateById.get(task.template_id)?.template_key === "rental_v2_driver_terms_targeted").map(task => submissionByTask.get(task.id)?.signer_name?.trim()).filter((name): name is string => Boolean(name && name.includes(" ")))])],
      tasks: tasks.map((task) => {
        const template = templateById.get(task.template_id);
        const submission = submissionByTask.get(task.id);
        return {
          taskId: task.id,
          businessLine: portalRows.find(row=>row.readiness_id===task.readiness_id)?.business_line??null,
          readinessId: task.readiness_id,
          status: task.task_status,
          required: task.required,
          completedAt: task.completed_at,
          assignedGuestName: task.assigned_guest_name,
          templateKey: template?.template_key ?? null,
          templateName: template?.template_name ?? null,
          title: template?.form_title ?? template?.template_name ?? "Required Form",
          description: template?.form_description ?? null,
          openUrl: task.task_status === "completed" ? null : `/api/guest/${encodeURIComponent(token)}/guest-forms/${encodeURIComponent(task.id)}/open`,
          documentUrl: task.task_status === "completed" && submission?.signed_pdf_storage_path
            ? `/api/guest/${encodeURIComponent(token)}/guest-forms/${encodeURIComponent(task.id)}/document`
            : null,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load guest forms." }, { status: 500 });
  }
}
