import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../../lib/team-auth";
export async function GET(request:NextRequest){
 const profile=await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
 return NextResponse.json({authenticated:Boolean(profile),profile:profile||null},{headers:{"Cache-Control":"no-store"}});
}