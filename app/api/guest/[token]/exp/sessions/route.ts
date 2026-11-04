import {NextRequest,NextResponse} from 'next/server';
import {loadExpSessionOptions} from '@/lib/server/exp-session-options';
export async function GET(request:NextRequest,context:{params:Promise<{token:string}>}){
 const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(process.env.EXP_ASSESSMENT_SERVER_ENABLED!=='true')return reply({error:'Orientation is not enabled.'},503);
 try{const {token}=await context.params;const options=await loadExpSessionOptions(token,request.nextUrl.searchParams.get('readinessId')||'');
  return options?reply({drivers:options.drivers.map(d=>({name:d.name,orientationComplete:d.orientationComplete})),sessions:options.sessions}):reply({error:'Rental reservation not found.'},404);
 }catch(error){console.error('EXP session choices failed',error);return reply({error:'Unable to load saved orientations.'},500)}
}
