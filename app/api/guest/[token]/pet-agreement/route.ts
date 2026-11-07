import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseInsert, supabaseSelect } from "@/lib/server/supabase-rest";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type PortalActivity = { readiness_id: string; business_line: string };
type Readiness = { readiness_id: string; source_store_visit_id: string | null; confirmation_code: string; customer_name: string; customer_email: string | null; business_line: string };
type FormTemplate = { id: string };
type Task = { id: string; task_status: string };

/** Guest-initiated pet acknowledgement, only for rental activities on this portal. */
export async function POST(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token) return NextResponse.json({ error: "Portal token required." }, { status: 400 });
    const activities = await supabaseSelect<PortalActivity>("guest_portal_v", new URLSearchParams({
      select: "readiness_id,business_line", guest_portal_token: `eq.${token}`,
    }));
    // Pet agreements are only permitted for rental reservations; never tours.
    const rental = activities.find((a) => a.business_line?.trim().toLowerCase() === "rental");
    if (!rental) return NextResponse.json({ error: "Pet agreement is unavailable for this reservation." }, { status: 403 });

    const [readiness] = await supabaseSelect<Readiness>("guest_readiness_operational", new URLSearchParams({
      select: "readiness_id,source_store_visit_id,confirmation_code,customer_name,customer_email,business_line",
      readiness_id: `eq.${rental.readiness_id}`, limit: "1",
    }));
    if (!readiness || readiness.business_line?.trim().toLowerCase() !== "rental") {
      return NextResponse.json({ error: "Rental reservation not found." }, { status: 404 });
    }
    const [template] = await supabaseSelect<FormTemplate>("guest_form_templates", new URLSearchParams({
      select: "id", template_key: "eq.pet_acknowledgment", is_active: "eq.true", limit: "1",
    }));
    if (!template) return NextResponse.json({ error: "Pet agreement is not available." }, { status: 404 });
    const [existing] = await supabaseSelect<Task>("guest_form_tasks", new URLSearchParams({
      select: "id,task_status", readiness_id: `eq.${readiness.readiness_id}`, template_id: `eq.${template.id}`,
      task_status: "not.in.(cancelled,expired)", limit: "1",
    }));
    if (existing) {
      return NextResponse.json({ ok: true, taskId: existing.id, status: existing.task_status, alreadyExists: true });
    }
    const initialToken = randomBytes(24).toString("hex");
    const [created] = await Promise.all([supabaseInsert<{ id: string }>("guest_form_tasks", {
      readiness_id: readiness.readiness_id,
      store_visit_id: readiness.source_store_visit_id,
      confirmation_code: readiness.confirmation_code,
      template_id: template.id,
      public_token_hash: hashToken(initialToken),
      expires_at: new Date(Date.now() + 180 * 86400000).toISOString(),
      assigned_guest_name: readiness.customer_name,
      assigned_guest_email: readiness.customer_email,
      created_by: "guest_portal_self_service",
      metadata: { delivery_mode: "guest_portal_self_service", business_line: "rental" },
    })]);
    return NextResponse.json({ ok: true, taskId: created.id, status: "created" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add pet agreement." }, { status: 500 });
  }
}
