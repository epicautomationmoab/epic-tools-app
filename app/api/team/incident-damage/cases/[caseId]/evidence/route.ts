import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { getServerSupabaseConfig, supabaseInsert, supabaseSelect } from "@/lib/server/supabase-rest";

const BUCKET = "epic-legal-documents";
const MAX_PHOTO_BYTES = 30 * 1024 * 1024;
const MAX_CASE_PHOTOS = 80;

type CaseRow = { id: string; vehicle_number: string | null };
type WorkflowRow = { id: string };
type PrepareBody = { action: "prepare"; filename?: string; contentType?: string; byteSize?: number };
type CompleteBody = {
  action: "complete";
  storagePath?: string;
  filename?: string;
  contentType?: string;
  byteSize?: number;
  photoSlot?: string | null;
  damageItemId?: string | null;
};

function safeExtension(filename: string, contentType: string) {
  const fromName = filename.includes(".") ? filename.split(".").pop()!.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
  if (fromName) return fromName;
  if (contentType === "image/heic") return "heic";
  if (contentType === "image/heif") return "heif";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

async function loadCase(caseId: string) {
  const rows = await supabaseSelect<CaseRow>("operational_cases", new URLSearchParams({
    select: "id,vehicle_number",
    id: `eq.${caseId}`,
    limit: "1",
  }));
  return rows[0] ?? null;
}

async function loadWorkflow(caseId: string) {
  const rows = await supabaseSelect<WorkflowRow>("operational_case_workflows", new URLSearchParams({
    select: "id",
    case_id: `eq.${caseId}`,
    workflow_type: "eq.damage_documentation",
    limit: "1",
  }));
  return rows[0] ?? null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getGuestFormsActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { caseId } = await context.params;
    const rows = await supabaseSelect("operational_case_evidence", new URLSearchParams({
      select: "id,damage_item_id,photo_slot,original_filename,content_type,byte_size,uploaded_at",
      case_id: `eq.${caseId}`,
      source_type: "eq.staff_damage_documentation",
      order: "created_at.asc",
    }));
    return NextResponse.json({ evidence: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load evidence." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getGuestFormsActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { caseId } = await context.params;
    const caseRow = await loadCase(caseId);
    if (!caseRow) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    const workflow = await loadWorkflow(caseId);
    if (!workflow) return NextResponse.json({ error: "Damage documentation workflow not found." }, { status: 404 });

    const body = await request.json() as PrepareBody | CompleteBody;
    const current = await supabaseSelect<{ id: string }>("operational_case_evidence", new URLSearchParams({
      select: "id",
      case_id: `eq.${caseId}`,
      source_type: "eq.staff_damage_documentation",
    }));
    if (current.length >= MAX_CASE_PHOTOS) return NextResponse.json({ error: `This case already has ${MAX_CASE_PHOTOS} staff photos.` }, { status: 409 });

    if (body.action === "prepare") {
      const filename = String(body.filename || "photo.jpg").trim();
      const contentType = String(body.contentType || "application/octet-stream").trim().toLowerCase();
      const byteSize = Number(body.byteSize || 0);
      if (!contentType.startsWith("image/")) return NextResponse.json({ error: "Only image files can be attached." }, { status: 400 });
      if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_PHOTO_BYTES) return NextResponse.json({ error: "Invalid photo size." }, { status: 400 });

      const storagePath = `case-evidence/${caseId}/${randomUUID()}.${safeExtension(filename, contentType)}`;
      const { url, key } = getServerSupabaseConfig();
      const encodedPath = `${BUCKET}/${storagePath}`.split("/").map(encodeURIComponent).join("/");
      const signedResponse = await fetch(`${url}/storage/v1/object/upload/sign/${encodedPath}`, {
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
      const text = await signedResponse.text();
      if (!signedResponse.ok) throw new Error(`Unable to prepare photo upload: ${text.slice(0, 250)}`);
      const signed = JSON.parse(text) as { url?: string };
      if (!signed.url) throw new Error("Supabase did not return a signed upload URL.");
      return NextResponse.json({
        ok: true,
        uploadUrl: signed.url.startsWith("http") ? signed.url : `${url}/storage/v1${signed.url}`,
        storagePath,
      });
    }

    if (body.action === "complete") {
      const storagePath = String(body.storagePath || "").trim();
      const filename = String(body.filename || "photo").trim();
      const contentType = String(body.contentType || "application/octet-stream").trim().toLowerCase();
      const byteSize = Number(body.byteSize || 0);
      const requiredPrefix = `case-evidence/${caseId}/`;
      if (!storagePath.startsWith(requiredPrefix)) return NextResponse.json({ error: "Invalid photo upload path." }, { status: 400 });
      if (!contentType.startsWith("image/")) return NextResponse.json({ error: "Only image files can be attached." }, { status: 400 });
      if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_PHOTO_BYTES) return NextResponse.json({ error: "Invalid photo size." }, { status: 400 });

      const damageItemId = body.damageItemId?.trim() || null;
      if (damageItemId) {
        const items = await supabaseSelect<{ id: string }>("operational_case_damage_items", new URLSearchParams({
          select: "id",
          id: `eq.${damageItemId}`,
          case_id: `eq.${caseId}`,
          limit: "1",
        }));
        if (!items[0]) return NextResponse.json({ error: "Damage item not found for this case." }, { status: 400 });
      }

      const { url, key } = getServerSupabaseConfig();
      const encodedObjectPath = storagePath.split("/").map(encodeURIComponent).join("/");
      const verifyResponse = await fetch(`${url}/storage/v1/object/authenticated/${BUCKET}/${encodedObjectPath}`, {
        method: "HEAD",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      if (!verifyResponse.ok) return NextResponse.json({ error: "Photo upload could not be verified. Please try again." }, { status: 409 });

      const evidence = await supabaseInsert("operational_case_evidence", {
        case_id: caseId,
        workflow_id: workflow.id,
        damage_item_id: damageItemId,
        evidence_type: "photo",
        source_type: "staff_damage_documentation",
        stage: damageItemId ? "damage_item" : "post_return_documentation",
        photo_slot: body.photoSlot?.trim() || null,
        vehicle_number: caseRow.vehicle_number,
        storage_path: storagePath,
        original_filename: filename || null,
        content_type: contentType || null,
        byte_size: byteSize,
        metadata: { uploaded_by: actor.actorName },
      });
      return NextResponse.json({ ok: true, evidence });
    }

    return NextResponse.json({ error: "Unknown evidence action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload evidence." }, { status: 500 });
  }
}
