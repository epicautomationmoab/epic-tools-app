import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../lib/team-auth";
import * as agreements from "@/app/api/team/cancellation-agreements/route";

// Both workspaces use the existing EpicTools implementation in this deployment.
// Do not send employee cookies through a second HTTP hop or a legacy live URL.
async function handle(request:NextRequest,method:"GET"|"POST"|"DELETE"){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!token||!profile||profile.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});
 return agreements[method](request);
}
export async function GET(request:NextRequest){return handle(request,"GET")}
export async function POST(request:NextRequest){return handle(request,"POST")}
export async function DELETE(request:NextRequest){return handle(request,"DELETE")}
