import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value || "";
  if (!accessToken) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const response = await fetch(((process.env.EPIC_UNIFIED_INTERNAL_ORIGIN || "") + "/api/team/sales-introduction-email"), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("epic_access_token")?.value || "";
  const id = request.nextUrl.searchParams.get("opportunity_id") || "";
  if (!token) return NextResponse.json({error:"Employee login required"}, {status:401});
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:"Invalid opportunity"}, {status:400});
  const base=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  const url=base+"/rest/v1/gmail_messages?matched_sales_opportunity_id=eq."+encodeURIComponent(id)+"&source_type=eq.sales_introduction&direction=eq.outbound&select=sent_at&order=sent_at.desc&limit=1";
  const response=await fetch(url,{headers:{apikey:key,Authorization:"Bearer "+token},cache:"no-store"});
  if(!response.ok)return NextResponse.json({error:"Unable to verify introduction history"},{status:response.status});
  const rows=await response.json();
  return NextResponse.json({sentAt:rows?.[0]?.sent_at||null},{headers:{"Cache-Control":"no-store"}});
}
