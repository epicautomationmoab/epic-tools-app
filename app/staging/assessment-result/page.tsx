"use client";
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import ExpAssessmentResult,{type AssessmentResult} from '../../guest/[token]/ExpAssessmentResult';
import ExpAssessmentRetryIntro from '../../guest/[token]/ExpAssessmentRetryIntro';
import assessmentStyles from '../../guest/[token]/ExpAssessment.module.css';
import styles from '../staging.module.css';
const readyDriver={name:'Jordan Trailtest',expReady:true,orientationComplete:true,outstanding:[]};
const examples:Record<string,AssessmentResult>={
 ready:{status:'assessment_complete',expReady:true,participatingDrivers:[readyDriver]},
 individual:{status:'assessment_complete',expReady:false,participatingDrivers:[readyDriver],otherDriversPending:true},
 paperwork:{status:'assessment_complete',expReady:false,participatingDrivers:[{...readyDriver,expReady:false,outstanding:['ohvCertificate']}]},
 technician:{status:'retry_or_technician'},
 retry:{status:'retry_quiz'},
};
export default function ResultWordingPreview(){
 const router=useRouter();
 const [view,setView]=useState('ready');
 return <main className={styles.page}><div className={styles.content}>
  <Link className={styles.link} href='/staging'>← Staging test area</Link>
  <p className={styles.notice}>Screen previews only. These use the same components as the guest assessment and do not change your test results or progress.</p>
  <div className={assessmentStyles.actions} style={{flexWrap:'wrap'}} aria-label="Preview scenario">{[['ready','Ready'],['individual','One driver ready'],['paperwork','Paperwork pending'],['review','Safety review'],['retry','Quiz retry'],['technician','Technician review']].map(([key,label])=><button type="button" className={view===key?assessmentStyles.primary:assessmentStyles.secondary} aria-pressed={view===key} key={key} onClick={()=>setView(key)}>{label}</button>)}</div>
  <div className={styles.preview}><div className={styles.eyebrow}>Our fastest check-out · optional</div><h2>Epic Xpress Ready</h2><section className={assessmentStyles.assessment}>{view==='review'?<ExpAssessmentRetryIntro count={1}/>:<ExpAssessmentResult result={examples[view]} onRetry={()=>setView('review')} onExit={()=>router.push('/guest/ee200000-0000-4000-8000-000000000002')}/>}</section></div>
 </div></main>;
}
