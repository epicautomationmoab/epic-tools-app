import {supabaseSelect} from './supabase-rest';
import {loadExpReadinessMany} from './exp-readiness';
import {expExceptionReasons} from '@/lib/exp/exception-reasons';
import {expCheckoutClosed} from '@/lib/exp/window';
type Rental={readiness_id:string;confirmation_code:string;customer_name:string;product_display_name:string;visit_start_time:string;handoff_status:string|null};
export async function loadExpExceptions(){
 if(process.env.EXP_ASSESSMENT_SERVER_ENABLED!=='true')return [];
 const results:Array<Rental&{reasons:string[]}>=[];
 for(let offset=0;;offset+=100){
  const rows=await supabaseSelect<Rental>('guest_readiness_with_handoff_v',new URLSearchParams({select:'readiness_id,confirmation_code,customer_name,product_display_name,visit_start_time,handoff_status',business_line:'eq.rental',order:'readiness_id.asc',limit:'100',offset:String(offset)}));
  const open=rows.filter(r=>!expCheckoutClosed(r.handoff_status));
  const statuses=await loadExpReadinessMany(open.map(r=>r.readiness_id));
  for(const row of open){const status=statuses.get(row.readiness_id);if(!status)continue;const reasons=expExceptionReasons(status);if(reasons.length)results.push({...row,reasons});}
  if(rows.length<100)return results;
 }
}
