import {NextRequest,NextResponse} from 'next/server';
import {getAuthenticatedTeamProfile} from '@/lib/team-auth';
import {supabaseSelect} from '@/lib/server/supabase-rest';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:NextRequest){
 const profile=await getAuthenticatedTeamProfile(request.cookies.get('epic_access_token')?.value);
 if(!profile?.active||profile.role==='workstation')return reply({error:'Employee login required.'},401);
 const id=request.nextUrl.searchParams.get('readiness_id')||'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return reply({error:'Valid reservation ID required.'},400);
 try{
  const rows=await supabaseSelect<Record<string,unknown>>('guest_readiness_with_handoff_v',new URLSearchParams({select:'readiness_id,epic_document_signers,mpwr_waivers',readiness_id:'eq.'+id,limit:'1'}));
  if(!rows.length)return reply({error:'Reservation not found.'},404);
  return reply(rows);
 }catch{return reply({error:'Unable to retrieve reservation documents. Please retry.'},502);}
}
