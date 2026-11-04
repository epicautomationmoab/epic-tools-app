import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../../lib/team-auth";
const DESTINATION=((process.env.EPIC_UNIFIED_INTERNAL_ORIGIN || "") + "/api/guest-communications/resend-confirmation");
async function forward(request:NextRequest,method:"GET"|"POST"){
 const token=request.cookies.get("epic_access_token")?.value;
 const employee=await getAuthenticatedTeamProfile(token);
 if(!token||!employee||employee.role==="workstation")return NextResponse.json({error:"Employee login required"},{status:401});
 let confirmationCode="";
 if(method==="GET")confirmationCode=request.nextUrl.searchParams.get("confirmationCode")||"";
 else {const b=await request.json().catch(()=>null);confirmationCode=b?.confirmationCode||"";}
 confirmationCode=confirmationCode.trim().toUpperCase();
 if(!/^[A-Z0-9-]{3,25}$/.test(confirmationCode))return NextResponse.json({error:"Invalid reservation"},{status:400});
 try {
  const url=method==="GET"?DESTINATION+"?confirmationCode="+encodeURIComponent(confirmationCode):DESTINATION;
  const result=await fetch(url,{method,cache:"no-store",headers:{Cookie:"epic_access_token="+encodeURIComponent(token),"Content-Type":"application/json"},...(method==="POST"?{body:JSON.stringify({confirmationCode})}:{})});
  const data=await result.json().catch(()=>({error:"Confirmation service unavailable"}));
  return NextResponse.json(data,{status:result.status,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Unable to reach confirmation service"},{status:502});}
}
export async function GET(request:NextRequest){return forward(request,"GET")}
export async function POST(request:NextRequest){return forward(request,"POST")}
