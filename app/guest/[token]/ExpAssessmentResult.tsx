"use client";
import styles from './ExpAssessment.module.css';
type AssessmentResult={status:string;expReady?:boolean;corrections?:Array<{questionId:string;correctAnswer:string;explanation:string}>};
export default function ExpAssessmentResult({result,onExit}:{result:AssessmentResult;onExit:()=>void}){
 const complete=result.status==='assessment_complete';
 return <>
  <h3>{complete?'One Last Step to More Trail Time':'Let’s Get You Ready for the Trail'}</h3>
  {complete?<p>{result.expReady?'EXP Ready — all required paperwork and driver orientation verified.':'Knowledge check saved. Final EXP readiness remains pending paperwork and driver verification.'}</p>:<>
   <p>Thank you for completing your Epic Xpress Ready knowledge assessment. Some important vehicle operation and safety topics need further review before you head out.</p>
   <p>Please see an Adventure Technician when you arrive so we can go over those topics together and answer any questions. We’re looking forward to welcoming you and getting you on the trail well prepared and confident!</p>
  </>}
  {result.corrections?.map(c=><p key={c.questionId}>{c.correctAnswer} — {c.explanation}</p>)}
  <div className={styles.actions}><button className={styles.primary} type='button' onClick={onExit}>Return to Guest Portal</button></div>
 </>;
}
