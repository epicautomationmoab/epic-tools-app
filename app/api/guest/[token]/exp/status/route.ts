import {NextRequest,NextResponse} from "next/server";
import {supabaseSelect} from "@/lib/server/supabase-rest";
import {loadExpReadiness} from "@/lib/server/exp-readiness";
type Portal={readiness_id:string;business_line:string};
const reply=(value:object,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(_request:NextRequest,context:{params:Promise<{token:string}>}){
 if(process.env.EXP_ASSESSMENT_SERVER_ENABLED!=="true")return reply({error:"EXP status is not enabled."},503);
 try{
  const {token}=await context.params;
  if(!/^[0-9a-f-]{36}$/i.test(token))return reply({error:"Reservation token required."},400);
  const rows=await supabaseSelect<Portal>("guest_portal_v",new URLSearchParams({
   select:"readiness_id,business_line",guest_portal_token:`eq.${token}`
  }));
  if(!rows.length)return reply({error:"Reservation not found."},404);
  const results=[];
  for(const row of rows.filter(r=>r.business_line.toLowerCase()==="rental")){
   const status=await loadExpReadiness(row.readiness_id);
   results.push({readinessId:row.readiness_id,expReady:status?.expReady===true,
    outstanding:status?.outstanding??["reservationVerification"],
    documentChecks:status?.documentChecks??null,
    recordedParticipants:status?.participants.length??0,
    assessmentSessions:status?.sessions.length??0,
    checkoutReady:false});
  }
  return reply({rentals:results});
 }catch(error){
  console.error("Guest EXP status failed",error);
  return reply({error:"Unable to load EXP status."},500);
 }
}
