import {supabaseSelect} from './supabase-rest';
import {loadExpReadiness} from './exp-readiness';
export const expNameKey=(name:string)=>name.trim().replace(/\s+/g,' ').toLowerCase();
export async function loadExpSessionOptions(token:string,readinessId:string){
 const activities=await supabaseSelect<{readiness_id:string;business_line:string;confirmation_code:string}>('guest_portal_v',new URLSearchParams({select:'readiness_id,business_line,confirmation_code',guest_portal_token:`eq.${token}`}));
 const activity=activities.find(a=>a.readiness_id===readinessId&&a.business_line.toLowerCase()==='rental');
 if(!activity)return null;
 const ids=activities.filter(a=>a.business_line.toLowerCase()==='rental'&&a.confirmation_code===activity.confirmation_code).map(a=>a.readiness_id);
 const [readiness,sessions]=await Promise.all([loadExpReadiness(readinessId),supabaseSelect<{id:string;readiness_id:string;outcome:string;created_at:string;result_summary:Record<string,unknown>}>('exp_sessions',new URLSearchParams({select:'id,readiness_id,outcome,created_at,result_summary',readiness_id:`in.(${ids.join(',')})`,assessment_version:'eq.exp-2026-10-26-v1',outcome:'in.(in_progress,critical_retry)',order:'created_at.desc'}))]);
 const participants=sessions.length?await supabaseSelect<{session_id:string;display_name:string}>('exp_participants',new URLSearchParams({select:'session_id,display_name',session_id:`in.(${sessions.map(s=>s.id).join(',')})`})) : [];
 return {bookingKey:token+'|'+activity.confirmation_code,ids,drivers:readiness?.drivers??[],sessions:sessions.map(s=>{
  const actual=participants.filter(p=>p.session_id===s.id).map(p=>p.display_name);
  const selected=s.result_summary?.selectedDriverNames;
  const names=actual.length?actual:Array.isArray(selected)?selected.filter((n):n is string=>typeof n==='string'):[];
  return {sessionId:s.id,readinessId:s.readiness_id,names,outcome:s.outcome};
 })};
}
