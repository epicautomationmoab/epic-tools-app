import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string; taskId: string }> },
) {
  try {
    const { token, taskId } = await context.params;
    if (!token || !taskId) return NextResponse.json({ error: "Form link is incomplete." }, { status: 400 });

    const portalRows = await supabaseSelect<{ readiness_id: string }>(
      "guest_portal_v",
      new URLSearchParams({ select: "readiness_id", guest_portal_token: `eq.${token}` }),
    );
    const readinessIds = new Set(portalRows.map((row) => row.readiness_id));
    if (!readinessIds.size) return NextResponse.json({ error: "Guest portal not found." }, { status: 404 });

    const taskRows = await supabaseSelect<{
      id: string;
      readiness_id: string | null;
      task_status: string;
      expires_at: string | null;
    }>(
      "guest_form_tasks",
      new URLSearchParams({
        select: "id,readiness_id,task_status,expires_at",
        id: `eq.${taskId}`,
        limit: "1",
      }),
    );
    const task = taskRows[0];
    if (!task || !task.readiness_id || !readinessIds.has(task.readiness_id)) {
      return NextResponse.json({ error: "This form does not belong to this reservation." }, { status: 404 });
    }
    if (["cancelled", "expired"].includes(task.task_status)) {
      return NextResponse.json({ error: "This form is no longer available." }, { status: 410 });
    }
    if (task.task_status === "completed") {
      return NextResponse.redirect(new URL(`/guest/${encodeURIComponent(token)}`, request.url), 302);
    }
    if (task.expires_at && new Date(task.expires_at).getTime() <= Date.now()) {
      await supabasePatch("guest_form_tasks", new URLSearchParams({ id: `eq.${task.id}` }), {
        task_status: "expired",
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json({ error: "This form has expired." }, { status: 410 });
    }

    const rawToken = randomBytes(24).toString("hex");
    await supabasePatch("guest_form_tasks", new URLSearchParams({ id: `eq.${task.id}` }), {
      public_token_hash: hashToken(rawToken),
      metadata: { portal_opened: true, portal_token_access: true },
      updated_at: new Date().toISOString(),
    });

    return NextResponse.redirect(new URL(`/form/${rawToken}`, request.url), 302);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open this form." },
      { status: 500 },
    );
  }
}
