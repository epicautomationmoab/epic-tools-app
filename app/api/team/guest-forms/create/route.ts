import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseInsert, supabaseSelect } from "@/lib/server/supabase-rest";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
    if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json() as { readinessId?: string; templateKey?: string; expiresInDays?: number };
    if (!body.readinessId || !body.templateKey) return NextResponse.json({ error: "readinessId and templateKey are required." }, { status: 400 });

    const readinessRows = await supabaseSelect<{
      readiness_id: string; source_store_visit_id: string | null; confirmation_code: string; customer_name: string; customer_email: string | null;
    }>("guest_readiness_operational", new URLSearchParams({
      select: "readiness_id,source_store_visit_id,confirmation_code,customer_name,customer_email",
      readiness_id: `eq.${body.readinessId}`,
      limit: "1",
    }));
    const readiness = readinessRows[0];
    if (!readiness) return NextResponse.json({ error: "Reservation readiness record not found." }, { status: 404 });

    const templateRows = await supabaseSelect<{ id: string; template_key: string; template_name: string }>("guest_form_templates", new URLSearchParams({
      select: "id,template_key,template_name",
      template_key: `eq.${body.templateKey}`,
      is_active: "eq.true",
      limit: "1",
    }));
    const template = templateRows[0];
    if (!template) return NextResponse.json({ error: "Form template not found." }, { status: 404 });

    const existing = await supabaseSelect<{ id: string; task_status: string }>("guest_form_tasks", new URLSearchParams({
      select: "id,task_status",
      readiness_id: `eq.${readiness.readiness_id}`,
      template_id: `eq.${template.id}`,
      task_status: "not.in.(expired,cancelled)",
      limit: "1",
    }));
    if (existing[0]) return NextResponse.json({ error: `${template.template_name} is already in this guest portal.` }, { status: 409 });

    // The guest reaches this form through their existing reservation portal.
    // A one-time task token is still initialized here and rotated whenever the portal opens the form.
    const initialToken = randomBytes(24).toString("hex");
    const expiryDays = Math.max(1, Math.min(body.expiresInDays ?? 30, 180));
    const expiresAt = new Date(Date.now() + expiryDays * 86400000).toISOString();
    const task = await supabaseInsert<{ id: string }>("guest_form_tasks", {
      readiness_id: readiness.readiness_id,
      store_visit_id: readiness.source_store_visit_id,
      confirmation_code: readiness.confirmation_code,
      template_id: template.id,
      public_token_hash: hashToken(initialToken),
      expires_at: expiresAt,
      assigned_guest_name: readiness.customer_name,
      assigned_guest_email: readiness.customer_email,
      created_by: profile.display_name,
      metadata: { created_by_profile_id: profile.id, delivery_mode: "guest_portal" },
    });

    return NextResponse.json({
      ok: true,
      taskId: task.id,
      templateName: template.template_name,
      portalAdded: true,
      expiresAt,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add guest form to portal." }, { status: 500 });
  }
}
