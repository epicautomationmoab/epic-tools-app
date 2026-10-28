import {NextRequest,NextResponse} from 'next/server';
import {loadBeltTireGuestContext} from '@/lib/server/exp-belt-tire-inquiry';
import {beltTireNameKey} from '@/lib/exp/belt-tire-inquiry';
import {getServerSupabaseConfig,serverSupabaseHeaders} from '@/lib/server/supabase-rest';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const publicContext=(c:NonNullable<Awaited<ReturnType<typeof loadBeltTireGuestContext>>>)=>({price:c.price,drivers:c.drivers});
export async function GET(request:NextRequest,context:{params:Promise<{token:string}>}){
 if(process.env.EXP_ASSESSMENT_SERVER_ENABLED!=='true')return reply({error:'Orientation is not enabled.'},503);
 try{const {token}=await context.params;const c=await loadBeltTireGuestContext(token,request.nextUrl.searchParams.get('readinessId')||'',request.nextUrl.searchParams.get('sessionId')||'');return c?reply(publicContext(c)):reply({error:'Orientation not found.'},404)}catch(error){console.error('Belt/tire inquiry read failed',error);return reply({error:'Unable to load optional information preferences.'},500)}
}
export async function POST(request:NextRequest,context:{params:Promise<{token:string}>}){
 if(process.env.EXP_ASSESSMENT_SERVER_ENABLED!=='true')return reply({error:'Orientation is not enabled.'},503);
 try{const {token}=await context.params;const b=await request.json() as {readinessId?:string;sessionId?:string;driverName?:string;response?:string};
  if(!b.readinessId||!b.sessionId||typeof b.driverName!=='string'||!['information_requested','declined'].includes(b.response||''))return reply({error:'Choose a valid response for one participating driver.'},400);
  const c=await loadBeltTireGuestContext(token,b.readinessId,b.sessionId);if(!c)return reply({error:'Orientation not found.'},404);
  const driver=c.drivers.find(d=>beltTireNameKey(d.name)===beltTireNameKey(b.driverName!));if(!driver)return reply({error:'Select a driver participating in this orientation.'},409);
  if(!driver.response){const {url}=getServerSupabaseConfig();const r=await fetch(url+'/rest/v1/exp_belt_tire_inquiries?on_conflict=booking_token,confirmation_code,driver_key',{method:'POST',headers:serverSupabaseHeaders('resolution=ignore-duplicates,return=minimal'),body:JSON.stringify({booking_token:token,confirmation_code:c.confirmation,driver_key:beltTireNameKey(driver.name),driver_name:driver.name,response:b.response,source_session_id:b.sessionId,price_shown:c.price}),cache:'no-store'});if(!r.ok)throw new Error('Preference insert failed: '+r.status)}
  const saved=await loadBeltTireGuestContext(token,b.readinessId,b.sessionId);return reply(publicContext(saved!));
 }catch(error){console.error('Belt/tire inquiry save failed',error);return reply({error:'Unable to save your response. Please try again.'},500)}
}
