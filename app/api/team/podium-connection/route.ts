import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { ensurePodiumConnectionFresh } from "@/lib/server/podium";
export async function POST(request: NextRequest) {
 const bearer = request.headers.get("authorization")?.replace(/^Bearer /i, "");
 const employee = await getAuthenticatedTeamProfile(bearer);
 if (!employee || !employee.active || employee.role === "workstation") return NextResponse.json({error:"Not authorized"},{status:403});
 try { await ensurePodiumConnectionFresh(); return NextResponse.json({ok:true}); }
 catch { return NextResponse.json({error:"Unable to renew Podium connection"},{status:503}); }
}
