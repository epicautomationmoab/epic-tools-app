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
type PrepareBody = { action: "prepare"; filename?: string; contentType?: string; byteSize?: number };
type CompleteBody = { action: "complete"; storagePath?: string; filename?: string; contentType?: string; byteSize?: number };

const BUCKET = "epic-legal-documents";
const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 30 * 1024 * 1024;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeExtension(filename: string, contentType: string) {
  const fromName = filename.includes(".") ? filename.split(".").pop()!.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
  if (fromName) return fromName;
  if (contentType === "image/heic") return "heic";
  if (contentType === "image/heif") return "heif";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

async function loadTask(token: string) {
  const rows = await supabaseSelect<Task>("guest_form_tasks", new URLSearchParams({
    select: "id,confirmation_code,task_status,expires_at,template_id",
    public_token_hash: `eq.${hashToken(token)}`,
    limit: "1",
  }));
  return rows[0] ?? null;
}

async function validateTask(token: string) {
  if (!token || token.length < 32) throw new Error("FORM_NOT_FOUND");
  const task = await loadTask(token);
  if (!task) throw new Error("FORM_NOT_FOUND");
  if (task.task_status === "completed") throw new Error("FORM_COMPLETED");
  if (task.expires_at && new Date(task.expires_at).getTime() <= Date.now()) throw new Error("FORM_EXPIRED");

  const templates = await supabaseSelect<Template>("guest_form_templates", new URLSearchParams({
    select: "template_key",
    id: `eq.${task.template_id}`,
    limit: "1",
  }));
  if (templates[0]?.template_key !== "damage_acknowledgment") throw new Error("PHOTO_NOT_ENABLED");
  return task;
}

async function countAttachments(taskId: string) {
  const rows = await supabaseSelect<{ id: string }>("guest_form_attachments", new URLSearchParams({
    select: "id",
    task_id: `eq.${taskId}`,
  }));
  return rows.length;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "FORM_NOT_FOUND") return NextResponse.json({ error: "Form not found." }, { status: 404 });
  if (message === "FORM_COMPLETED") return NextResponse.json({ error: "This form has already been submitted." }, { status: 409 });
  if (message === "FORM_EXPIRED") return NextResponse.json({ error: "This form link has expired." }, { status: 410 });
  if (message === "PHOTO_NOT_ENABLED") return NextResponse.json({ error: "Photo uploads are not enabled for this form." }, { status: 400 });
  return NextResponse.json({ error: message || "Unable to upload photo." }, { status: 500 });
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
    const task = await validateTask(token);
    const body = await request.json() as PrepareBody | CompleteBody;

    if (body.action === "prepare") {
      const filename = String(body.filename || "photo.jpg").trim();
      const contentType = String(body.contentType || "application/octet-stream").trim().toLowerCase();
      const byteSize = Number(body.byteSize || 0);

      if (!contentType.startsWith("image/")) return NextResponse.json({ error: "Only image files can be attached." }, { status: 400 });
      if (!Number.isFinite(byteSize) || byteSize <= 0) return NextResponse.json({ error: "Photo size is unavailable." }, { status: 400 });
      if (byteSize > MAX_PHOTO_BYTES) return NextResponse.json({ error: "This photo is unusually large. Please choose another photo." }, { status: 400 });

      const existingCount = await countAttachments(task.id);
      if (existingCount >= MAX_PHOTOS) return NextResponse.json({ error: "You may attach up to 10 photos." }, { status: 409 });

      const extension = safeExtension(filename, contentType);
      const storagePath = `guest-form-attachments/${task.confirmation_code}/${task.id}/${randomUUID()}.${extension}`;
      const { url, key } = getServerSupabaseConfig();
      const encodedPath = `${BUCKET}/${storagePath}`.split("/").map(encodeURIComponent).join("/");
      const signResponse = await fetch(`${url}/storage/v1/object/upload/sign/${encodedPath}`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "x-upsert": "false",
        },
        body: "{}",
        cache: "no-store",
      });
      const signText = await signResponse.text();
      if (!signResponse.ok) throw new Error(`Unable to prepare photo upload: ${signText.slice(0, 250)}`);
      const signed = JSON.parse(signText) as { url?: string };
      if (!signed.url) throw new Error("Supabase did not return a signed upload URL.");
      const uploadUrl = signed.url.startsWith("http") ? signed.url : `${url}/storage/v1${signed.url}`;

      return NextResponse.json({ ok: true, uploadUrl, storagePath });
    }

    if (body.action === "complete") {
      const storagePath = String(body.storagePath || "").trim();
      const filename = String(body.filename || "photo").trim();
      const contentType = String(body.contentType || "application/octet-stream").trim().toLowerCase();
      const byteSize = Number(body.byteSize || 0);
      const requiredPrefix = `guest-form-attachments/${task.confirmation_code}/${task.id}/`;
      if (!storagePath.startsWith(requiredPrefix)) return NextResponse.json({ error: "Invalid photo upload path." }, { status: 400 });
      if (!contentType.startsWith("image/")) return NextResponse.json({ error: "Only image files can be attached." }, { status: 400 });
      if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_PHOTO_BYTES) return NextResponse.json({ error: "Invalid photo size." }, { status: 400 });

      const existingCount = await countAttachments(task.id);
      if (existingCount >= MAX_PHOTOS) return NextResponse.json({ error: "You may attach up to 10 photos." }, { status: 409 });

      const { url, key } = getServerSupabaseConfig();
      const encodedObjectPath = storagePath.split("/").map(encodeURIComponent).join("/");
      const verifyResponse = await fetch(`${url}/storage/v1/object/authenticated/${BUCKET}/${encodedObjectPath}`, {
        method: "HEAD",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      if (!verifyResponse.ok) return NextResponse.json({ error: "Photo upload could not be verified. Please try again." }, { status: 409 });

      const row = await supabaseInsert<Attachment>("guest_form_attachments", {
        task_id: task.id,
        storage_path: storagePath,
        original_filename: filename || null,
        content_type: contentType || null,
        byte_size: byteSize,
        sort_order: existingCount,
      });
      return NextResponse.json({ ok: true, attachment: row });
    }

    return NextResponse.json({ error: "Unknown photo upload action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
