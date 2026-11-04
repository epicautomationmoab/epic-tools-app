import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../lib/team-auth";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!token||!profile||profile.role==="workstation"||!profile.tripworks_user_id)return NextResponse.json({candidates:[]});
 const url=new URL(((process.env.EPIC_UNIFIED_INTERNAL_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")) + "/api/team/cancellation-popup-candidates"));
 const since=request.nextUrl.searchParams.get("since");
 if(since)url.searchParams.set("since",since);
 try{
  const upstream=await fetch(url,{headers:{Cookie:"epic_access_token="+encodeURIComponent(token)},cache:"no-store"});
  return new NextResponse(await upstream.text(),{status:upstream.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Candidate lookup unavailable"},{status:502})}
}