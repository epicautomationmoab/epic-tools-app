import { NextResponse } from "next/server";

const BUCKET = "ohv-certificates";

type UploadRow = {
  id: string;
  readiness_id: string;
  driver_name: string;
  original_filename: string;
  storage_path: string;
  uploaded_at: string;
};

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!rawUrl || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: url.replace(/\/+$/, ""), key };
}

function headers(key: string, extra?: HeadersInit): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

async function createSignedUrl(
  config: ReturnType<typeof getSupabaseConfig>,
  storagePath: string,
) {
  const response = await fetch(
    `${config.url}/storage/v1/object/sign/${BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: headers(config.key, { "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: 600 }),
      cache: "no-store",
    },
  );

  if (!response.ok) return null;
  const data = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = data.signedURL ?? data.signedUrl;
  if (!signedPath) return null;
  return signedPath.startsWith("http") ? signedPath : `${config.url}/storage/v1${signedPath}`;
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token")?.trim();
    if (!token) {
      return NextResponse.json({ error: "Portal token is required." }, { status: 400 });
    }

    const config = getSupabaseConfig();
    const params = new URLSearchParams({
      select: "id,readiness_id,driver_name,original_filename,storage_path,uploaded_at",
      guest_portal_token: `eq.${token}`,
      order: "uploaded_at.asc",
    });

    const response = await fetch(
      `${config.url}/rest/v1/ohv_certificate_uploads?${params.toString()}`,
      { headers: headers(config.key), cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error("Unable to load OHV certificates.");
    }

    const rows = (await response.json()) as UploadRow[];
    const uploads = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        readinessId: row.readiness_id,
        driverName: row.driver_name,
        filename: row.original_filename,
        uploadedAt: row.uploaded_at,
        viewUrl: await createSignedUrl(config, row.storage_path),
      })),
    );

    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load OHV certificates." },
      { status: 500 },
    );
  }
}
