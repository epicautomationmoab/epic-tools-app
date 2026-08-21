import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSupabaseConfig, supabaseInsert, supabaseSelect } from "@/lib/server/supabase-rest";

type Task = {
  id: string;
  confirmation_code: string;
  task_status: string;
  expires_at: string | null;
  template_id: string;
};

type Template = { template_key: string };
type Attachment = { id: string; original_filename: string | null; content_type: string | null; byte_size: number | null };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function loadTask(token: string) {
  const rows = await supabaseSelect<Task>("guest_form_tasks", new URLSearchParams({
    select: "id,confirmation_code,task_status,expires_at,template_id",
    public_token_hash: `eq.${hashToken(token)}`,
    limit: "1",
  }));
  return rows[0] ?? null;
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const task = await loadTask(token);
    if (!task) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    const attachments = await supabaseSelect<Attachment>("guest_form_attachments", new URLSearchParams({
      select: "id,original_filename,content_type,byte_size",
      task_id: `eq.${task.id}`,
      order: "sort_order.asc,uploaded_at.asc",
    }));
    return NextResponse.json({ attachments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load photos." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token || token.length < 32) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    const task = await loadTask(token);
    if (!task) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    if (task.task_status === "completed") return NextResponse.json({ error: "This form has already been submitted." }, { status: 409 });
    if (task.expires_at && new Date(task.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This form link has expired." }, { status: 410 });

    const templates = await supabaseSelect<Template>("guest_form_templates", new URLSearchParams({
      select: "template_key",
      id: `eq.${task.template_id}`,
      limit: "1",
    }));
    if (templates[0]?.template_key !== "damage_acknowledgment") {
      return NextResponse.json({ error: "Photo uploads are not enabled for this form." }, { status: 400 });
    }

    const existing = await supabaseSelect<{ id: string }>("guest_form_attachments", new URLSearchParams({
      select: "id",
      task_id: `eq.${task.id}`,
    }));

    const form = await request.formData();
    const files = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) return NextResponse.json({ error: "Choose at least one photo." }, { status: 400 });
    if (existing.length + files.length > 10) return NextResponse.json({ error: "You may attach up to 10 photos." }, { status: 400 });

    const { url, key } = getServerSupabaseConfig();
    const uploaded: Attachment[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file.type.startsWith("image/")) return NextResponse.json({ error: `${file.name || "One file"} is not an image.` }, { status: 400 });
      if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: `${file.name || "One photo"} is larger than 12 MB.` }, { status: 400 });

      const extension = file.name.includes(".") ? file.name.split(".").pop()!.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "jpg";
      const storagePath = `guest-form-attachments/${task.confirmation_code}/${task.id}/${randomUUID()}.${extension || "jpg"}`;
      const bytes = await file.arrayBuffer();
      const storageResponse = await fetch(`${url}/storage/v1/object/epic-legal-documents/${storagePath.split("/").map(encodeURIComponent).join("/")}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "false",
        },
        body: bytes,
        cache: "no-store",
      });
      if (!storageResponse.ok) throw new Error(`Unable to store ${file.name || "photo"}: ${(await storageResponse.text()).slice(0, 250)}`);

      const row = await supabaseInsert<Attachment>("guest_form_attachments", {
        task_id: task.id,
        storage_path: storagePath,
        original_filename: file.name || null,
        content_type: file.type || null,
        byte_size: file.size,
        sort_order: existing.length + index,
      });
      uploaded.push(row);
    }

    return NextResponse.json({ ok: true, attachments: uploaded });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload photos." }, { status: 500 });
  }
}
