import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: normalizedUrl.replace(/\/+$/, ""), key };
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function GET(request: NextRequest) {
  const actor = await getGuestFormsActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const confirmationCode = request.nextUrl.searchParams.get("confirmationCode")?.trim();
  if (!confirmationCode) return NextResponse.json({ error: "Confirmation code is required." }, { status: 400 });

  const config = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "guest_portal_payment_hidden",
    confirmation_code: `eq.${confirmationCode}`,
    limit: "1",
  });

  const response = await fetch(`${config.url}/rest/v1/operational_reservations?${params.toString()}`, {
    headers: headers(config.key),
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ error: "Unable to load payment visibility." }, { status: 500 });

  const rows = (await response.json()) as Array<{ guest_portal_payment_hidden: boolean | null }>;
  return NextResponse.json({ hidden: rows[0]?.guest_portal_payment_hidden === true });
}

export async function POST(request: NextRequest) {
  const actor = await getGuestFormsActor(request);
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null) as { confirmationCode?: string; hidden?: boolean } | null;
  const confirmationCode = body?.confirmationCode?.trim();
  if (!confirmationCode || typeof body?.hidden !== "boolean") {
    return NextResponse.json({ error: "Confirmation code and hidden state are required." }, { status: 400 });
  }

  const config = getSupabaseConfig();
  const params = new URLSearchParams({ confirmation_code: `eq.${confirmationCode}` });
  const response = await fetch(`${config.url}/rest/v1/operational_reservations?${params.toString()}`, {
    method: "PATCH",
    headers: { ...headers(config.key), Prefer: "return=representation" },
    body: JSON.stringify({ guest_portal_payment_hidden: body.hidden }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "Unable to update payment visibility.", detail: detail.slice(0, 300) }, { status: 500 });
  }

  const rows = (await response.json()) as Array<{ guest_portal_payment_hidden: boolean | null }>;
  return NextResponse.json({ ok: true, hidden: rows[0]?.guest_portal_payment_hidden === true });
}
