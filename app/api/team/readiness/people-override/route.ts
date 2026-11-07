import {NextRequest,NextResponse} from "next/server";
import {getGuestFormsActor} from "@/lib/workstation-auth";
import {supabaseRpc} from "@/lib/server/supabase-rest";

const commands={get:"get_readiness_people_override",set:"set_readiness_people_override",clear:"clear_readiness_people_override"} as const;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:NextRequest){
 const actor=await getGuestFormsActor(request);
 if(!actor)return reply({error:"Staff authentication required."},401);
 let body:Record<string,unknown>;
 try{body=await request.json()}catch{return reply({error:"Invalid request."},400)}
 const action=body.action;
 const readinessId=body.readinessId;
 if(action!=="get"&&action!=="set"&&action!=="clear")return reply({error:"Invalid action."},400);
 if(typeof readinessId!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(readinessId))return reply({error:"Invalid reservation."},400);
 if(action==="set"&&(!Number.isInteger(body.peopleCount)||typeof body.peopleCount!=="number"||body.peopleCount<0||body.peopleCount>100))return reply({error:"Invalid people count."},400);
 const params:Record<string,unknown>={p_readiness_id:readinessId};
 if(action==="set"){
  params.p_people_count=body.peopleCount;
  params.p_reason=typeof body.reason==="string"?body.reason.slice(0,500):null;
  params.p_updated_by=actor.actorName;
 }
 try{
  const result=await supabaseRpc<unknown>(commands[action],params);
  return reply(result);
 }catch(e){
  console.error("People count override failed",e);
  return reply({error:"Unable to update people count. Please try again or contact an administrator."},500);
 }
}
