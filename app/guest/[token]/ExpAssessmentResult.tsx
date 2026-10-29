"use client";
import styles from './ExpAssessment.module.css';
import ExcCompletion from './ExcCompletion';
type DriverResult={name:string;expReady:boolean;orientationComplete:boolean;outstanding:string[]};
export type AssessmentResult={status:string;expReady?:boolean;participatingDrivers?:DriverResult[];drivers?:DriverResult[];otherDriversPending?:boolean;corrections?:Array<{questionId:string;correctAnswer:string;explanation:string}>};
export default function ExpAssessmentResult({result,onExit,onRetry}:{result:AssessmentResult;onExit:()=>void;onRetry?:()=>void}){
 const complete=result.status==='assessment_complete';
 const retry=result.status==='retry_quiz';
 const drivers=result.drivers??result.participatingDrivers??[];
 return <>
  {!complete?<h3>Let’s Get You Ready for the Trail</h3>:null}
  {retry?<p>A few topics need another look. You can try the knowledge check again now, or finish with an Adventure Tech when you arrive. Your video viewing is saved.</p>:complete?<>
   <ExcCompletion drivers={drivers} qualified={result.expReady===true}/>
   {!drivers.some(d=>d.orientationComplete)?<p>Your knowledge assessment has been saved.</p>:null}
  </>:<>
   <p>Thank you for completing your Epic Xpress Checkout knowledge assessment. Some important vehicle operation and safety topics need further review before you head out.</p>
   <p>Please see an Adventure Tech when you arrive so we can go over those topics together and answer any questions. We’re looking forward to welcoming you and getting you on the trail well prepared and confident!</p>
  </>}
  {result.corrections?.length?<div aria-label="Knowledge check review"><h4>A Quick Review Before You Go</h4>{result.corrections.map(c=><p className={styles.correction} key={c.questionId}><strong>{c.correctAnswer}</strong><br/>{c.explanation}</p>)}</div>:null}
  <div className={styles.actions}>{retry&&onRetry?<button className={styles.primary} type="button" onClick={onRetry}>Try Knowledge Check Again</button>:null}<button className={styles.primary} type='button' onClick={onExit}>Return to Guest Portal</button></div>
 </>;
}
