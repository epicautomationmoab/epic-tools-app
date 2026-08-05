import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  return NextResponse.redirect(new URL(`/agreement/${encodeURIComponent(token)}`, request.url), 307);
}
