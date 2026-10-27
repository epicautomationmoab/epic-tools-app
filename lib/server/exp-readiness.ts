import {supabaseSelect} from "@/lib/server/supabase-rest";
import {expTeamStatus} from "@/lib/exp/team-status";
import {loadRentalV2Readiness} from "@/lib/server/rental-v2-readiness";
type Session={id:string;created_at:string;readiness_id:string;mode:string;outcome:string;completed_at:string|null;video_version:string;video_ended:boolean;video_duration_seconds:number|null;video_watched_seconds:number[]|null};
type Participant={id:string;session_id:string;display_name:string;initials:string;reconciliation_status:string;waiver_signer_reference:string|null;acknowledgement_at:string|null};
type Portal={readiness_id:string;confirmation_code:string;business_line:string;expected_guest_count:number|null;total_vehicle_count:number|null;epic_document_received_count:number|null;epic_document_expected_count:number|null;mpwr_document_received_count:number|null;mpwr_document_expected_count:number|null;mpwr_waivers:Array<{name:string;is_minor?:boolean;is_passenger?:boolean}>|null;ohv_required:boolean|null;ohv_certificate_uploaded:boolean|null};
type Task={id:string;template_id:string;task_status:string;required:boolean};
type Template={id:string;template_key:string};
type Submission={task_id:string;signer_name:string|null};
const normalize=(s:string)=>s.trim().replace(/\s+/g," ").toLowerCase();
export async function loadExpReadiness(readinessId:string){
  const [portal]=await supabaseSelect<Portal>("guest_portal_v",new URLSearchParams({
    select:"readiness_id,confirmation_code,business_line,expected_guest_count,total_vehicle_count,epic_document_received_count,epic_document_expected_count,mpwr_document_received_count,mpwr_document_expected_count,mpwr_waivers,ohv_required,ohv_certificate_uploaded",
    readiness_id:`eq.${readinessId}`,limit:"1"
  }));
  if(!portal||portal.business_line!=="rental")return null;
  const sessions=await supabaseSelect<Session>("exp_sessions",new URLSearchParams({
    select:"id,created_at,readiness_id,mode,outcome,completed_at,video_version,video_ended,video_duration_seconds,video_watched_seconds",
    readiness_id:`eq.${readinessId}`,order:"created_at.desc",limit:"50"
  }));
  const participants=sessions.length?await supabaseSelect<Participant>("exp_participants",new URLSearchParams({
    select:"id,session_id,display_name,initials,reconciliation_status,waiver_signer_reference,acknowledgement_at",
    session_id:`in.(${sessions.map(s=>s.id).join(",")})`,limit:"1000"
  })):[];
  const tasks=await supabaseSelect<Task>("guest_form_tasks",new URLSearchParams({
    select:"id,template_id,task_status,required",readiness_id:`eq.${readinessId}`,
    task_status:"neq.cancelled"
  }));
  const templateIds=[...new Set(tasks.map(t=>t.template_id))];
  const templates=templateIds.length?await supabaseSelect<Template>("guest_form_templates",new URLSearchParams({
    select:"id,template_key",id:`in.(${templateIds.join(",")})`
  })):[];
  const rentalTemplateIds=new Set(templates.filter(t=>t.template_key==="rental_v2_driver_terms_targeted").map(t=>t.id));
  const signedTasks=tasks.filter(t=>rentalTemplateIds.has(t.template_id)&&t.task_status==="completed");
  const signatures=signedTasks.length?await supabaseSelect<Submission>("guest_form_submissions",new URLSearchParams({
    select:"task_id,signer_name",task_id:`in.(${signedTasks.map(t=>t.id).join(",")})`
  })):[];
  const v2 = await loadRentalV2Readiness([{readinessId,confirmationCode:portal.confirmation_code,expectedGuestCount:portal.expected_guest_count,vehicleCount:portal.total_vehicle_count}]);
  const v2Record=v2.get(readinessId);
  const signedDrivers=new Map<string,string>();
  for(const p of v2Record?.signers??[]){if(p.role==="driver")signedDrivers.set(normalize(p.name),p.name)}
  for(const p of signatures){const name=p.signer_name?.trim();if(name&&name.includes(" "))signedDrivers.set(normalize(name),name)}
  const mpwrDrivers=new Set((Array.isArray(portal.mpwr_waivers)?portal.mpwr_waivers:[])
    .filter(w=>w&&w.name&&!w.is_minor&&!w.is_passenger).map(w=>normalize(w.name)));
  const allForms=tasks.filter(t=>t.required&&templates.some(k=>k.id===t.template_id&&k.template_key!=="damage_acknowledgment"));
  const formReady=(signedTasks.length>0&&allForms.length>0&&allForms.every(t=>t.task_status==="completed"))||v2Record?.ready===true;
  const epicReady=((portal.epic_document_expected_count??0)>0&&(portal.epic_document_received_count??0)>=(portal.epic_document_expected_count??0))||v2Record?.agreementsComplete===true;
  const mpwrReady=(portal.mpwr_document_expected_count??0)>0&&(portal.mpwr_document_received_count??0)>=(portal.mpwr_document_expected_count??0);
  const ohvReady=portal.ohv_required===false||(portal.ohv_required===true&&portal.ohv_certificate_uploaded===true);
  const vehicleCount=Math.max(1,portal.total_vehicle_count??1);
  const driverRosterReady=signedDrivers.size>=vehicleCount;
  const completedSessions=new Set(sessions.filter(s=>
    s.outcome==="complete"&&!!s.completed_at&&s.video_ended&&
    (s.video_duration_seconds??0)>=60&&
    new Set(s.video_watched_seconds??[]).size>=Math.ceil((s.video_duration_seconds??0)*0.98)&&
    (new Date(s.completed_at??"").getTime()-new Date(s.created_at).getTime())/1000 >= (s.video_duration_seconds??0)*0.98
  ).map(s=>s.id));
  const qualified=participants.filter(p=>
    completedSessions.has(p.session_id)&&!!p.acknowledgement_at&&
    signedDrivers.has(normalize(p.display_name))&&mpwrDrivers.has(normalize(p.display_name))
  );
  const qualifiedNames=new Set(qualified.map(p=>normalize(p.display_name)));
  const allDriversQualified=driverRosterReady&&[...signedDrivers.keys()].every(n=>qualifiedNames.has(n));
  const documentChecks={
    signedEpicDriverAgreements:formReady,
    epicAgreements:epicReady,
    polarisWaivers:mpwrReady&&[...signedDrivers.keys()].every(n=>mpwrDrivers.has(n)),
    ohvCertificates:ohvReady,
    driverRoster:driverRosterReady,
    videoAndAssessment:allDriversQualified
  };
  const outstanding=Object.entries(documentChecks).filter(([,v])=>!v).map(([k])=>k);
  const expReady=outstanding.length===0;
  const assessmentStatus=expTeamStatus(expReady?qualifiedNames.size:0,signedDrivers.size);
  return {
    sessions:sessions.map(({video_watched_seconds,...s})=>({...s,videoSecondsObserved:video_watched_seconds?.length??0})),
    participants:participants.map(p=>({
      id:p.id,session_id:p.session_id,display_name:p.display_name,
      reconciliation_status:qualifiedNames.has(normalize(p.display_name))?"verified":"unmatched",
      waiver_signer_reference:p.waiver_signer_reference,acknowledgement_at:p.acknowledgement_at,
      assessmentAndIdentityVerified:qualifiedNames.has(normalize(p.display_name)),
      expReady:expReady&&qualifiedNames.has(normalize(p.display_name)),
      outstanding
    })),
    assessmentStatus,
    expectedDriverCount:signedDrivers.size,
    assessmentQualifiedDriverCount:qualifiedNames.size,
    documentChecks,outstanding,expReady,
    checkoutReady:false,
    readinessVerification:expReady?"exp_verified_checkout_separate":"pending_authoritative_document_checks",
    needsReconciliation:participants.filter(p=>!qualifiedNames.has(normalize(p.display_name))).length
  };
}
