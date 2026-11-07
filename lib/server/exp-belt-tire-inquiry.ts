import {supabaseSelect} from './supabase-rest';
import {loadExpReadiness} from './exp-readiness';
import {beltTireNameKey,beltTirePrice,beltTireIndicator,type BeltTireResponse} from '@/lib/exp/belt-tire-inquiry';
type Portal={readiness_id:string;guest_portal_token:string;confirmation_code:string;business_line:string;premier_adventure_assure:boolean|null;adventure_assure_level:string|null};
type Saved={booking_token:string;confirmation_code:string;driver_key:string;driver_name:string;response:BeltTireResponse;member_keys:string[];responded_at:string};
const portalColumns='readiness_id,guest_portal_token,confirmation_code,business_line,premier_adventure_assure,adventure_assure_level';
const responseColumns='booking_token,confirmation_code,driver_key,driver_name,response,member_keys,responded_at';
function answerForDriver(saved:Saved[],key:string){return saved.filter(s=>s.driver_key===key||s.member_keys?.includes(key)).sort((a,b)=>a.responded_at.localeCompare(b.responded_at))[0]}
async function savedForBooking(token:string,confirmation:string){return supabaseSelect<Saved>('exp_belt_tire_inquiries',new URLSearchParams({select:responseColumns,booking_token:`eq.${token}`,confirmation_code:`eq.${confirmation}`}))}
export async function loadBeltTireGuestContext(token:string,readinessId:string,sessionId:string){
 const activities=await supabaseSelect<Portal>('guest_portal_v',new URLSearchParams({select:portalColumns,guest_portal_token:`eq.${token}`}));
 const activity=activities.find(a=>a.readiness_id===readinessId&&a.business_line.toLowerCase()==='rental');if(!activity)return null;
 const ids=activities.filter(a=>a.confirmation_code===activity.confirmation_code&&a.business_line.toLowerCase()==='rental').map(a=>a.readiness_id);
 const [session]=await supabaseSelect<{id:string;result_summary:Record<string,unknown>}>('exp_sessions',new URLSearchParams({select:'id,result_summary',id:`eq.${sessionId}`,readiness_id:`in.(${ids.join(',')})`,assessment_version:'eq.exp-2026-10-26-v1',limit:'1'}));
 if(!session)return null;
 const [participants,readiness,saved]=await Promise.all([
  supabaseSelect<{display_name:string}>('exp_participants',new URLSearchParams({select:'display_name',session_id:`eq.${sessionId}`})),loadExpReadiness(readinessId),savedForBooking(token,activity.confirmation_code)
 ]);
 const roster=participants.length?participants.map(p=>p.display_name):Array.isArray(session.result_summary?.selectedDriverNames)?session.result_summary.selectedDriverNames.filter((n):n is string=>typeof n==='string'):[];
 const signed=new Map((readiness?.signedDrivers??[]).map(n=>[beltTireNameKey(n),n]));
 const names=[...new Set(roster.map(beltTireNameKey))].filter(n=>signed.has(n)).map(n=>signed.get(n)!);
 return {token,confirmation:activity.confirmation_code,sessionId,price:beltTirePrice(activity),isGroup:names.length>1,drivers:names.map(name=>({name,response:answerForDriver(saved,beltTireNameKey(name))?.response??null}))};
}
/** Batch only the preferences; reuse canonical booking driver lists and existing purchase flags. */
export async function loadBeltTireReadinessMany(rows:Array<{readiness_id?:string;belt_tire_protection?:boolean|null}>,statuses:Map<string,{drivers:Array<{name:string}>}>){
 const result=new Map<string,ReturnType<typeof beltTireIndicator>>();const ids=rows.map(r=>r.readiness_id).filter((id):id is string=>Boolean(id));
 for(let offset=0;offset<ids.length;offset+=100){
  const portals=await supabaseSelect<Portal>('guest_portal_v',new URLSearchParams({select:portalColumns,readiness_id:`in.(${ids.slice(offset,offset+100).join(',')})`}));
  const tokens=[...new Set(portals.map(p=>p.guest_portal_token))];if(!tokens.length)continue;
  const saved:Saved[]=[];
  for(let page=0;;page+=500){const chunk=await supabaseSelect<Saved>('exp_belt_tire_inquiries',new URLSearchParams({select:responseColumns,booking_token:`in.(${tokens.join(',')})`,order:'booking_token.asc,confirmation_code.asc,driver_key.asc',limit:'500',offset:String(page)}));saved.push(...chunk);if(chunk.length<500)break;}
  for(const portal of portals){const drivers=(statuses.get(portal.readiness_id)?.drivers??[]).map(d=>({name:d.name,response:answerForDriver(saved.filter(s=>s.booking_token===portal.guest_portal_token&&s.confirmation_code===portal.confirmation_code),beltTireNameKey(d.name))?.response??null}));result.set(portal.readiness_id,beltTireIndicator(rows.find(r=>r.readiness_id===portal.readiness_id)?.belt_tire_protection===true,drivers));}
 }
 return result;
}
