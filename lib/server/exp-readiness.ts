import {expVideoDuration,matchesExpVideoDuration,EXP_VIDEO_VERSION,EXP_ASSESSMENT_VERSION} from "@/lib/server/exp-video";
import {supabaseSelect} from "@/lib/server/supabase-rest";
import {expTeamStatus} from "@/lib/exp/team-status";
import {loadRentalV2Readiness,type RentalV2ReadinessSummary} from "@/lib/server/rental-v2-readiness";
type Session={id:string;created_at:string;readiness_id:string;mode:string;outcome:string;completed_at:string|null;video_version:string;assessment_version:string;video_ended:boolean;video_duration_seconds:number|null;video_watched_seconds:number[]|null};
type Participant={id:string;readiness_id:string;session_id:string;display_name:string;initials:string;reconciliation_status:string;waiver_signer_reference:string|null;acknowledgement_at:string|null};
type Portal={readiness_id:string;confirmation_code:string;business_line:string;expected_guest_count:number|null;total_vehicle_count:number|null;epic_document_received_count:number|null;epic_document_expected_count:number|null;mpwr_document_received_count:number|null;mpwr_document_expected_count:number|null;mpwr_waivers:Array<{name:string;is_minor?:boolean;is_passenger?:boolean}>|null;ohv_required:boolean|null;ohv_certificate_uploaded:boolean|null};
type Task={id:string;readiness_id:string;template_id:string;task_status:string;required:boolean};
type Template={id:string;template_key:string};
type Submission={task_id:string;signer_name:string|null};
const normalize=(s:string)=>s.trim().replace(/\s+/g," ").toLowerCase();

type VerifiedWaiver={readiness_id:string;rider_name:string;is_minor:boolean|null;is_passenger:boolean|null;last_verified_at:string|null};
type OhvUpload={readiness_id:string;driver_name:string;storage_path:string};
type Evidence={portal:Portal;sessions:Session[];participants:Participant[];tasks:Task[];templates:Template[];signatures:Submission[];v2Record:RentalV2ReadinessSummary|undefined;verifiedWaivers:VerifiedWaiver[];ohvUploads:OhvUpload[];expectedVideoDuration:number|null};
/** The same policy determines guest, staff and board readiness. No browser scoring. */
export function determineExpReadiness({portal,sessions,participants,tasks,templates,signatures,v2Record,verifiedWaivers,ohvUploads,expectedVideoDuration}:Evidence){
  const signedTasks=tasks.filter(t=>templates.some(k=>k.id===t.template_id&&k.template_key==="rental_v2_driver_terms_targeted")&&t.task_status==="completed");
  const signedDrivers=new Map<string,string>();
  for(const p of v2Record?.signers??[]){if(p.role==="driver")signedDrivers.set(normalize(p.name),p.name)}
  for(const p of signatures){const name=p.signer_name?.trim();if(name&&name.includes(" "))signedDrivers.set(normalize(name),name)}
  const mpwrDrivers=new Set(verifiedWaivers.filter(w=>w.rider_name&&!w.is_minor&&!w.is_passenger&&w.last_verified_at)
    .map(w=>normalize(w.rider_name)));
  const allForms=tasks.filter(t=>t.required&&templates.some(k=>k.id===t.template_id&&k.template_key!=="damage_acknowledgment"));
  const formReady=(signedTasks.length>0||v2Record?.ready===true)&&allForms.every(t=>t.task_status==="completed");
  const epicReady=((portal.epic_document_expected_count??0)>0&&(portal.epic_document_received_count??0)>=(portal.epic_document_expected_count??0))||v2Record?.agreementsComplete===true;
  const verifiedWaiverNames=new Set(verifiedWaivers.map(w=>normalize(w.rider_name)));
  const mpwrReady=(portal.mpwr_document_expected_count??0)>0&&verifiedWaiverNames.size>=(portal.mpwr_document_expected_count??0);
  const ohvNames=new Set(ohvUploads.filter(u=>u.storage_path).map(u=>normalize(u.driver_name)));
  const ohvReady=portal.ohv_required===false||(portal.ohv_required===true&&signedDrivers.size>0&&[...signedDrivers.keys()].every(n=>ohvNames.has(n)));
  const vehicleCount=Math.max(1,portal.total_vehicle_count??1);
  const driverNames=(v2Record?.signers??[]).filter(p=>p.role==="driver").map(p=>normalize(p.name));
  const ambiguousDriverNames=new Set(driverNames.filter((n,i)=>driverNames.indexOf(n)!==i));
  const driverRosterReady=signedDrivers.size>=vehicleCount&&ambiguousDriverNames.size===0;
  const completedSessions=new Set(sessions.filter(s=>
    s.outcome==="complete"&&s.video_version===EXP_VIDEO_VERSION&&s.assessment_version===EXP_ASSESSMENT_VERSION&&!!s.completed_at&&s.video_ended&&
    matchesExpVideoDuration(s.video_duration_seconds,expectedVideoDuration)&&
    (s.video_duration_seconds??0)>=60&&
    new Set(s.video_watched_seconds??[]).size>=Math.ceil((s.video_duration_seconds??0)*0.98)&&
    (new Date(s.completed_at??"").getTime()-new Date(s.created_at).getTime())/1000 >= (s.video_duration_seconds??0)*0.98
  ).map(s=>s.id));
  // A newer participation supersedes older credit for that driver. A failed
  // recheck or required rewatch must never inherit an old successful attempt.
  const currentSessions=new Map(sessions.filter(s=>s.video_version===EXP_VIDEO_VERSION&&s.assessment_version===EXP_ASSESSMENT_VERSION).map(s=>[s.id,s]));
  const latestByDriver=new Map<string,string>();
  for(const p of participants){
    const session=currentSessions.get(p.session_id);
    if(!session)continue;
    const name=normalize(p.display_name);
    const prior=currentSessions.get(latestByDriver.get(name)??"");
    if(!prior||new Date(session.created_at).getTime()>new Date(prior.created_at).getTime())latestByDriver.set(name,session.id);
  }
  const qualified=participants.filter(p=>
    completedSessions.has(p.session_id)&&latestByDriver.get(normalize(p.display_name))===p.session_id&&!!p.acknowledgement_at&&
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
  const assessmentStatus=expTeamStatus(qualifiedNames.size,signedDrivers.size);
  const qualifiedIds=new Set(qualified.map(p=>p.id));
  return {
    sessions:sessions.map(({video_watched_seconds,...s})=>({...s,videoSecondsObserved:video_watched_seconds?.length??0})),
    participants:participants.map(p=>({
      id:p.id,session_id:p.session_id,display_name:p.display_name,
      reconciliation_status:qualifiedIds.has(p.id)?"verified":"unmatched",
      waiver_signer_reference:p.waiver_signer_reference,acknowledgement_at:p.acknowledgement_at,
      assessmentAndIdentityVerified:qualifiedIds.has(p.id),
      expReady:expReady&&qualifiedIds.has(p.id),
      outstanding
    })),
    assessmentStatus,
    videoVerificationAvailable:expectedVideoDuration!==null,
    verifiedPolarisWaivers:verifiedWaivers.map(w=>({name:w.rider_name,is_minor:w.is_minor,is_passenger:w.is_passenger})),
    signedDrivers:[...signedDrivers.values()],
    expectedDriverCount:signedDrivers.size,
    assessmentQualifiedDriverCount:qualifiedNames.size,
    documentChecks,outstanding,expReady,
    checkoutReady:false,
    readinessVerification:expReady?"exp_verified_checkout_separate":"pending_authoritative_document_checks",
    needsReconciliation:participants.filter(p=>!qualifiedIds.has(p.id)).length
  };
}

export type ExpReadiness=ReturnType<typeof determineExpReadiness>;
const inList=(values:string[])=>`in.(${values.map(value=>'"'+value.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"').join(",")})`;
/** Read every page; a REST row cap must not silently omit a later driver or reservation. */
async function selectAll<T>(resource:string,params:URLSearchParams){
 const rows:T[]=[];
 for(let offset=0;;offset+=500){
  const pageParams=new URLSearchParams(params);pageParams.set("limit","500");pageParams.set("offset",String(offset));
  const page=await supabaseSelect<T>(resource,pageParams);rows.push(...page);
  if(page.length<500)return rows;
 }
}
export async function loadExpReadiness(readinessId:string){
 return (await loadExpReadinessMany([readinessId])).get(readinessId)??null;
}
/** Bounded batches share evidence reads, V2 reconciliation and video metadata. */
export async function loadExpReadinessMany(readinessIds:string[]){
 const result=new Map<string,ExpReadiness>();
 const ids=[...new Set(readinessIds.filter(Boolean))];
 if(!ids.length)return result;
 const expectedVideoDuration=await expVideoDuration();
 for(let index=0;index<ids.length;index+=25){
  const batch=ids.slice(index,index+25),filter=inList(batch);
  const [portals,sessions,tasks,verifiedWaivers,ohvUploads]=await Promise.all([
   selectAll<Portal>("guest_portal_v",new URLSearchParams({select:"readiness_id,confirmation_code,business_line,expected_guest_count,total_vehicle_count,epic_document_received_count,epic_document_expected_count,mpwr_document_received_count,mpwr_document_expected_count,mpwr_waivers,ohv_required,ohv_certificate_uploaded",readiness_id:filter,order:"readiness_id.asc"})),
   selectAll<Session>("exp_sessions",new URLSearchParams({select:"id,created_at,readiness_id,mode,outcome,completed_at,video_version,assessment_version,video_ended,video_duration_seconds,video_watched_seconds",readiness_id:filter,order:"id.asc"})),
   selectAll<Task>("guest_form_tasks",new URLSearchParams({select:"id,readiness_id,template_id,task_status,required",readiness_id:filter,task_status:"neq.cancelled",order:"id.asc"})),
   selectAll<VerifiedWaiver>("scout_mpwr_waivers",new URLSearchParams({select:"readiness_id,rider_name,is_minor,is_passenger,last_verified_at",readiness_id:filter,last_verified_at:"not.is.null",order:"id.asc"})),
   selectAll<OhvUpload>("ohv_certificate_uploads",new URLSearchParams({select:"readiness_id,driver_name,storage_path",readiness_id:filter,order:"id.asc"}))
  ]);
  const rentals=portals.filter(p=>p.business_line==="rental");
  const templateIds=[...new Set(tasks.map(t=>t.template_id))];
  const sessionIds=sessions.map(s=>s.id);
  const [templates,participants,v2]=await Promise.all([
   templateIds.length?selectAll<Template>("guest_form_templates",new URLSearchParams({select:"id,template_key",id:inList(templateIds),order:"id.asc"})):Promise.resolve([]),
   sessionIds.length?selectAll<Participant>("exp_participants",new URLSearchParams({select:"id,readiness_id,session_id,display_name,initials,reconciliation_status,waiver_signer_reference,acknowledgement_at",readiness_id:filter,order:"id.asc"})):Promise.resolve([]),
   loadRentalV2Readiness(rentals.map(p=>({readinessId:p.readiness_id,confirmationCode:p.confirmation_code,expectedGuestCount:p.expected_guest_count,vehicleCount:p.total_vehicle_count})))
  ]);
  const signedTaskIds=tasks.filter(t=>t.task_status==="completed"&&templates.some(k=>k.id===t.template_id&&k.template_key==="rental_v2_driver_terms_targeted")).map(t=>t.id);
  // Keep URL lengths bounded when a party has many saved agreement tasks.
  const signatures:Submission[]=[];
  for(let offset=0;offset<signedTaskIds.length;offset+=100)signatures.push(...await selectAll<Submission>("guest_form_submissions",new URLSearchParams({select:"task_id,signer_name",task_id:inList(signedTaskIds.slice(offset,offset+100)),order:"id.asc"})));
  for(const portal of rentals){
   const id=portal.readiness_id,rowTasks=tasks.filter(t=>t.readiness_id===id),taskIds=new Set(rowTasks.map(t=>t.id));
   result.set(id,determineExpReadiness({portal,sessions:sessions.filter(s=>s.readiness_id===id),participants:participants.filter(p=>p.readiness_id===id),tasks:rowTasks,templates,signatures:signatures.filter(s=>taskIds.has(s.task_id)),v2Record:v2.get(id),verifiedWaivers:verifiedWaivers.filter(w=>w.readiness_id===id),ohvUploads:ohvUploads.filter(u=>u.readiness_id===id),expectedVideoDuration}));
  }
 }
 return result;
}
