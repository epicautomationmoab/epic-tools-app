"use client";
import {useEffect,useState} from "react";
type Driver={id:string;display_name:string;acknowledgement_at:string|null;reconciliation_status:string;assessmentAndIdentityVerified:boolean;outstanding:string[]};
type Session={id:string;outcome:string;completed_at:string|null;video_version:string};
type Status={sessions:Session[];participants:Driver[];checkoutReady:boolean;readinessVerification:string;needsReconciliation:number};
export default function ExpReadinessDetail({readinessId}:{readinessId:string|null|undefined}){
 const [data,setData]=useState<Status|null>(null),[error,setError]=useState("");
 useEffect(()=>{if(!readinessId)return;let active=true;setData(null);setError("");
  const load=()=>fetch(`/api/team/exp/readiness?readinessId=${encodeURIComponent(readinessId)}`,{cache:"no-store"})
   .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load EXP");if(active)setData(d as Status)})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load EXP")});
  void load();const timer=window.setInterval(()=>void load(),30000);
  return()=>{active=false;window.clearInterval(timer)};
 },[readinessId]);
 return <section aria-label="Epic Xpress Ready" style={{padding:"16px 0"}}>
  <h3>Epic Xpress Ready</h3>
  <p>Verified driver orientation is required in addition to Epic agreements, Polaris waivers and OHV certificates. EXP never bypasses missing paperwork.</p>
  {!readinessId?<p>No reservation ID available.</p>:error?<p role="alert">{error}</p>:!data?<p>Checking saved EXP records…</p>:
   <><p><strong>{data.sessions.length?"EXP activity recorded":"EXP not started"}</strong> · {data.checkoutReady?"Verified EXP ready":"Not cleared for EXP checkout"}</p>
   <p>Recorded sessions: {data.sessions.length} · Participating drivers: {data.participants.length} · Waiver identities awaiting reconciliation: {data.needsReconciliation}</p>
   {data.sessions.map(s=><p key={s.id}>Knowledge check: {s.outcome.replace(/_/g," ")} {s.completed_at? `· ${new Date(s.completed_at).toLocaleString()}`:""}</p>)}
   {data.participants.map(p=><div key={p.id} style={{padding:"8px 0",borderTop:"1px solid #dde5ea"}}>
    <strong>{p.display_name}</strong> — {p.acknowledgement_at?"Initials/acknowledgment saved":"Acknowledgment missing"}; {p.assessmentAndIdentityVerified?"identity checked":"waiver verification pending"}
   </div>)}
   <p>{data.checkoutReady?"All required checks passed.":"EXP Ready remains blocked until paperwork, driver identity, video and knowledge check are fully verified."}</p>
   </>}
 </section>;
