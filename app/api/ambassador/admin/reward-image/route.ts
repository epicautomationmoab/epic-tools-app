import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAmbassadorAdmin } from "@/lib/ambassador-admin-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAmbassadorAdmin(request.cookies.get("epic_ambassador_admin_access_token")?.value);
  if (!admin) return NextResponse.json({ error: "Ambassador administrator access required." }, { status: 403 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    const slugRaw = String(form.get("slug") || "reward").trim().toLowerCase();
    const slug = slugRaw.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "reward";
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });

    const { url, key } = getSupabaseConfig();
    const filename = `${slug}-${Date.now()}.${extensionFor(file.type)}`;
    const upload = await fetch(`${url}/storage/v1/object/ambassador-reward-images/${encodeURIComponent(filename)}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": file.type, "x-upsert": "false" },
      body: await file.arrayBuffer(),
    });
    const payload = await upload.text();
    if (!upload.ok) throw new Error(payload || "Unable to upload reward image.");

    const publicUrl = `${url}/storage/v1/object/public/ambassador-reward-images/${encodeURIComponent(filename)}`;
    return NextResponse.json({ ok: true, image_url: publicUrl, uploaded_by: admin.display_name });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload reward image." }, { status: 500 });
  }
}
