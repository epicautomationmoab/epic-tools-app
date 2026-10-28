"use client";
import styles from './ExpAssessment.module.css';
type DriverResult={name:string;expReady:boolean;orientationComplete:boolean;outstanding:string[]};
export type AssessmentResult={status:string;expReady?:boolean;participatingDrivers?:DriverResult[];otherDriversPending?:boolean;corrections?:Array<{questionId:string;correctAnswer:string;explanation:string}>};
const stepLabels:Record<string,string>={driverIdentity:'Driver identity needs confirmation',polarisWaiver:'Polaris waiver still needed',ohvCertificate:'OHV certificate still needed',videoAndAssessment:'Orientation still needed'};
export default function ExpAssessmentResult({result,onExit,onRetry}:{result:AssessmentResult;onExit:()=>void;onRetry?:()=>void}){
 const complete=result.status==='assessment_complete';
 const retry=result.status==='retry_quiz';
 const drivers=result.participatingDrivers??[];
 const ready=complete&&(result.expReady===true||drivers.some(d=>d.expReady));
 return <>
  {ready?<div className={styles.readyMark} aria-hidden="true">✓</div>:null}
  <h3>{complete?(ready?'You’re Epic Xpress Ready!':'Orientation Complete!'):'Let’s Get You Ready for the Trail'}</h3>
  {retry?<p>A few topics need another look. You can try the knowledge check again now, or finish with an Adventure Technician when you arrive. Your video viewing is saved.</p>:complete?<>
   <p>{result.expReady?'Your required paperwork and safety orientation are complete. You’re set for our fastest check-out—and more time on the trail. We’ll see you at Epic!':ready?'The drivers marked EXP Ready below have completed their required steps. We’re looking forward to seeing you at Epic!':'Your safety orientation and knowledge check are complete. Finish the remaining driver steps in your guest portal to become Epic Xpress Ready.'}</p>
   {drivers.length?<ul className={styles.resultDrivers} aria-label="Participating driver results">{drivers.map(d=><li key={d.name} className={d.expReady?styles.readyDriver:styles.pendingDriver}><strong>{d.name}</strong><span>{d.expReady?'✓ EXP Ready':'Orientation complete'}</span>{!d.expReady&&d.outstanding.length?<small>{d.outstanding.map(x=>stepLabels[x]??'Guest portal step still needed').join(' · ')}</small>:null}</li>)}</ul>:null}
   {result.otherDriversPending?<p>Other drivers on your reservation can finish their own steps in the guest portal. Completed drivers keep their EXP Ready status.</p>:!result.expReady&&ready?<p>Your reservation still has steps to finish. Check your guest portal for what remains.</p>:null}
  </>:<>
   <p>Thank you for completing your Epic Xpress Ready knowledge assessment. Some important vehicle operation and safety topics need further review before you head out.</p>
   <p>Please see an Adventure Technician when you arrive so we can go over those topics together and answer any questions. We’re looking forward to welcoming you and getting you on the trail well prepared and confident!</p>
  </>}
  {result.corrections?.length?<div aria-label="Knowledge check review"><h4>A Quick Review Before You Go</h4>{result.corrections.map(c=><p className={styles.correction} key={c.questionId}><strong>{c.correctAnswer}</strong><br/>{c.explanation}</p>)}</div>:null}
  <div className={styles.actions}>{retry&&onRetry?<button className={styles.primary} type="button" onClick={onRetry}>Try Knowledge Check Again</button>:null}<button className={styles.primary} type='button' onClick={onExit}>Return to Guest Portal</button></div>
 </>;
}
