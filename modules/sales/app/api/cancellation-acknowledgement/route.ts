import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../lib/team-auth";

const ORIGIN=(process.env.EPIC_UNIFIED_INTERNAL_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""));
async function forward(request:NextRequest,method:"GET"|"POST"|"DELETE"){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!token||!profile||profile.role==="workstation")return NextResponse.json({error:"Employee login required."},{status:401});
 const url=new URL("/api/sales/team/cancellation-agreements",ORIGIN);
 let body:unknown;
 if(method==="GET"||method==="DELETE"){
   const readinessId=request.nextUrl.searchParams.get("readinessId")||"";
   if(!/^[a-zA-Z0-9_-]{3,100}$/.test(readinessId))return NextResponse.json({error:"Invalid readiness ID."},{status:400});
   url.searchParams.set("readinessId",readinessId);
 }else{
   try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400})}
   if(!body||typeof body!=="object"||!("readinessId" in body)||typeof body.readinessId!=="string")return NextResponse.json({error:"Reservation required."},{status:400});
 }
 try{
   const response=await fetch(url,{method,headers:{Cookie:`epic_access_token=${encodeURIComponent(token)}`,...(method==="POST"?{"Content-Type":"application/json"}:{})},...(method==="POST"?{body:JSON.stringify(body)}:{}),cache:"no-store"});
   return new NextResponse(await response.text(),{status:response.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Cancellation acknowledgement service is unavailable."},{status:502})}
}
export async function GET(request:NextRequest){return forward(request,"GET")}
export async function POST(request:NextRequest){return forward(request,"POST")}
export async function DELETE(request:NextRequest){return forward(request,"DELETE")}
