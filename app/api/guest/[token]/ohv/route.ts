import { NextResponse } from "next/server";

const BUCKET = "ohv-certificates";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

type PortalRow = {
  readiness_id: string;
  confirmation_code: string;
  business_line: string;
  total_vehicle_count: number | null;
};

type UploadRow = {
  id: string;
  readiness_id: string;
  driver_name: string;
  original_filename: string;
  uploaded_at: string;
};

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!rawUrl || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  return {
    url: url.replace(/\/+$/, ""),
    key,
  };
}

function serviceHeaders(key: string, extra?: HeadersInit): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

function safeSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function loadRentalActivity(token: string, readinessId: string) {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "readiness_id,confirmation_code,business_line,total_vehicle_count",
    guest_portal_token: `eq.${token}`,
    readiness_id: `eq.${readinessId}`,
    limit: "1",
  });

  const response = await fetch(
    `${config.url}/rest/v1/guest_portal_v?${params.toString()}`,
    {
      headers: serviceHeaders(config.key),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Unable to validate this reservation.");
  }

  const rows = (await response.json()) as PortalRow[];
  const row = rows[0];

  if (!row || row.business_line.toLowerCase() !== "rental") {
    return null;
  }

  return row;
}

async function listUploads(token: string, readinessId?: string) {
  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "id,readiness_id,driver_name,original_filename,uploaded_at",
    guest_portal_token: `eq.${token}`,
    order: "uploaded_at.asc",
  });

  if (readinessId) {
    params.set("readiness_id", `eq.${readinessId}`);
  }

  const response = await fetch(
    `${config.url}/rest/v1/ohv_certificate_uploads?${params.toString()}`,
    {
      headers: serviceHeaders(config.key),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Unable to load OHV certificate uploads.");
  }

  return (await response.json()) as UploadRow[];
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const readinessId = new URL(request.url).searchParams.get("readinessId") ?? undefined;

    if (!token) {
      return NextResponse.json({ error: "Portal token is required." }, { status: 400 });
    }

    const uploads = await listUploads(token, readinessId);
    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load OHV certificates.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  let uploadedStoragePath: string | null = null;

  try {
    const { token } = await context.params;
    const formData = await request.formData();
    const readinessId = String(formData.get("readinessId") ?? "").trim();
    const driverName = String(formData.get("driverName") ?? "").trim();
    const fileValue = formData.get("certificate");

    if (!token || !readinessId || !driverName || !(fileValue instanceof File)) {
      return NextResponse.json(
        { error: "Driver name and certificate file are required." },
        { status: 400 },
      );
    }

    if (driverName.length > 120) {
      return NextResponse.json(
        { error: "Driver name is too long." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(fileValue.type)) {
      return NextResponse.json(
        { error: "Upload a PDF, JPG, PNG, HEIC, or HEIF certificate." },
        { status: 415 },
      );
    }

    if (fileValue.size <= 0 || fileValue.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Certificate files must be 10 MB or smaller." },
        { status: 413 },
      );
    }

    const activity = await loadRentalActivity(token, readinessId);

    if (!activity) {
      return NextResponse.json(
        { error: "Rental reservation not found." },
        { status: 404 },
      );
    }

    const config = getSupabaseConfig();
    const existingParams = new URLSearchParams({
      select: "id",
      readiness_id: `eq.${readinessId}`,
      driver_name: `ilike.${driverName}`,
      limit: "1",
    });
    const existingResponse = await fetch(
      `${config.url}/rest/v1/ohv_certificate_uploads?${existingParams.toString()}`,
      { headers: serviceHeaders(config.key), cache: "no-store" },
    );

    if (!existingResponse.ok) {
      throw new Error("Unable to validate the driver upload.");
    }

    const existing = (await existingResponse.json()) as Array<{ id: string }>;
    if (existing.length) {
      return NextResponse.json(
        { error: "A certificate has already been uploaded for this driver." },
        { status: 409 },
      );
    }

    const extension = safeSegment(fileValue.name.split(".").pop() || "file");
    const confirmation = safeSegment(activity.confirmation_code || "reservation");
    const driver = safeSegment(driverName.toLowerCase()) || "driver";
    uploadedStoragePath = `${confirmation}/${readinessId}/${crypto.randomUUID()}-${driver}.${extension}`;

    const storageResponse = await fetch(
      `${config.url}/storage/v1/object/${BUCKET}/${uploadedStoragePath}`,
      {
        method: "POST",
        headers: serviceHeaders(config.key, {
          "Content-Type": fileValue.type,
          "x-upsert": "false",
        }),
        body: await fileValue.arrayBuffer(),
      },
    );

    if (!storageResponse.ok) {
      const detail = await storageResponse.text();
      throw new Error(`Unable to store certificate: ${detail.slice(0, 180)}`);
    }

    const insertResponse = await fetch(
      `${config.url}/rest/v1/ohv_certificate_uploads`,
      {
        method: "POST",
        headers: serviceHeaders(config.key, {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        }),
        body: JSON.stringify({
          readiness_id: readinessId,
          guest_portal_token: token,
          driver_name: driverName,
          original_filename: fileValue.name,
          storage_path: uploadedStoragePath,
          mime_type: fileValue.type,
          file_size_bytes: fileValue.size,
        }),
      },
    );

    if (!insertResponse.ok) {
      const detail = await insertResponse.text();
      throw new Error(`Unable to record certificate: ${detail.slice(0, 180)}`);
    }

    const rows = (await insertResponse.json()) as UploadRow[];
    const uploads = await listUploads(token, readinessId);

    return NextResponse.json(
      {
        upload: rows[0],
        uploads,
        requiredCount: Math.max(activity.total_vehicle_count ?? 0, 0),
        complete: uploads.length >= Math.max(activity.total_vehicle_count ?? 0, 0),
      },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedStoragePath) {
      try {
        const config = getSupabaseConfig();
        await fetch(`${config.url}/storage/v1/object/${BUCKET}`, {
          method: "DELETE",
          headers: serviceHeaders(config.key, { "Content-Type": "application/json" }),
          body: JSON.stringify({ prefixes: [uploadedStoragePath] }),
        });
      } catch {
        // Preserve the original upload error.
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload OHV certificate.",
      },
      { status: 500 },
    );
  }
}
