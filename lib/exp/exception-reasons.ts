import type {ExpReadiness} from '@/lib/server/exp-readiness';
const labels:Record<string,string>={signedEpicDriverAgreements:'signed driver agreements',minorAcknowledgments:'minor/guardian acknowledgements',epicAgreements:'participant agreements',polarisWaivers:'Polaris waivers',ohvCertificates:'OHV certificates',driverRoster:'driver roster',videoAndAssessment:'remaining driver orientations'};
/** Only attempted orientations needing action, not guests who elect standard checkout. */
export function expExceptionReasons(status:ExpReadiness):string[]{
 if(status.expReady)return [];
 const sessions=new Map(status.sessions.map(s=>[s.id,s]));
 const latest=new Map<string,(typeof status.sessions)[number]>();
 for(const p of status.participants){
  const session=sessions.get(p.session_id);if(!session)continue;
  const key=p.display_name.trim().replace(/\s+/g,' ').toLowerCase();
  const previous=latest.get(key);
  if(!previous||session.created_at>previous.created_at)latest.set(key,session);
 }
 const reasons=new Set<string>();
 for(const session of latest.values()){
  if(session.outcome==='critical_retry')reasons.add('Safety question retry pending');
  if(session.outcome==='retry_or_technician')reasons.add('Another knowledge check or Adventure Tech assistance needed');
  if(session.outcome==='technician_required'||session.pause_reason==='technician')reasons.add('Adventure Tech assistance requested');
 }
 if(status.drivers.some(d=>d.orientationComplete)){
  const pending=status.outstanding.map(k=>labels[k]??k);
  if(pending.length)reasons.add('Orientation completed; verify '+pending.join(', '));
 }
 return [...reasons];
}
