import {NextRequest,NextResponse} from "next/server";
import {getGuestFormsActor} from "@/lib/workstation-auth";
import {loadExpReadiness} from "@/lib/server/exp-readiness";
const response=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:NextRequest){
 if(process.env.EXP_ASSESSMENT_SERVER_ENABLED!=="true")return response({error:"EXP Readiness is not enabled."},503);
 const actor=await getGuestFormsActor(request);
 if(!actor)return response({error:"Authentication required."},401);
 const readinessId=request.nextUrl.searchParams.get("readinessId")?.trim()||"";
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(readinessId))return response({error:"Valid readinessId required."},400);
 try{
  const result=await loadExpReadiness(readinessId);
  return result?response(result):response({error:"Rental reservation not found."},404);
 }catch(error){
  console.error("EXP Readiness query failed",error);
  return response({error:"Unable to load EXP Readiness."},500);
 }
}
