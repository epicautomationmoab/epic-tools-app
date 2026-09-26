import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

type Task = {
  id: string;
  task_status: string;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function loadTask(token: string) {
  const rows = await supabaseSelect<Task>("guest_form_tasks", new URLSearchParams({
    select: "id,task_status,expires_at,metadata",
    public_token_hash: `eq.${hashToken(token)}`,
    limit: "1",
  }));
  return rows[0] ?? null;
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token || token.length < 32) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    const task = await loadTask(token);
    if (!task) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    if (task.task_status === "completed") return NextResponse.json({ draft: null, savedAt: null });
    if (task.expires_at && new Date(task.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This form link has expired." }, { status: 410 });

    const metadata = task.metadata ?? {};
    return NextResponse.json({
      draft: (metadata.draft_form_data as Record<string, string> | undefined) ?? null,
      savedAt: (metadata.draft_saved_at as string | undefined) ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load saved draft." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token || token.length < 32) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    const task = await loadTask(token);
    if (!task) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    if (task.task_status === "completed") return NextResponse.json({ error: "This form has already been completed." }, { status: 409 });
    if (task.expires_at && new Date(task.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This form link has expired." }, { status: 410 });

    const body = await request.json() as { formData?: Record<string, string> };
    const formData = body.formData ?? {};
    const savedAt = new Date().toISOString();
    const metadata = {
      ...(task.metadata ?? {}),
      draft_form_data: formData,
      draft_saved_at: savedAt,
    };

    await supabasePatch("guest_form_tasks", new URLSearchParams({ id: `eq.${task.id}` }), {
      task_status: "in_progress",
      metadata,
      updated_at: savedAt,
    });

    return NextResponse.json({ ok: true, savedAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save draft." }, { status: 500 });
  }
}
