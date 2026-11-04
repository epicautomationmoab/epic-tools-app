"use client";
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import ExpAssessmentResult from '../../guest/[token]/ExpAssessmentResult';
import ExpAssessmentRetryIntro from '../../guest/[token]/ExpAssessmentRetryIntro';
import ExcCompletion,{ExcOptionalInvitation} from '../../guest/[token]/ExcCompletion';
import assessmentStyles from '../../guest/[token]/ExpAssessment.module.css';
import excStyles from '../../guest/[token]/ExpVideoPreview.module.css';
import styles from '../staging.module.css';
const jordan={name:'Jordan Trailtest',orientationComplete:true};
const morgan={name:'Morgan Trailtest',orientationComplete:true};
const scenarios=[['none','No completed drivers'],['partial','One of two complete'],['forms','Passenger forms pending'],['minor','Minor acknowledgment pending'],['ohv','OHV verification pending'],['qualified','Entire reservation qualified'],['invitation','In-person option'],['review','Safety review'],['technician','Technician review'],['modal','Completion screen']];
export default function ResultWordingPreview(){
 const router=useRouter();const [view,setView]=useState('qualified');
 const [assisted,setAssisted]=useState(false);
 const drivers=view==='none'?[]:view==='partial'?[jordan,{...morgan,orientationComplete:false}]:[jordan,morgan];
 return <main className={styles.page}><div className={styles.content}>
  <Link className={styles.link} href='/staging'>← Staging test area</Link>
  <p className={styles.notice}>Read-only screen previews. These use the guest components and do not change your test progress. Pending requirements are described by the selector for review; they are not added to the guest completion card.</p>
  <div className={assessmentStyles.actions} style={{flexWrap:'wrap'}} aria-label="Preview scenario">{scenarios.map(([key,label])=><button type="button" className={view===key?assessmentStyles.primary:assessmentStyles.secondary} aria-pressed={view===key} key={key} onClick={()=>{setView(key);setAssisted(false)}}>{label}</button>)}</div>
  <section className={excStyles.panel}><div><span className={excStyles.eyebrow}>OUR FASTEST CHECK-OUT · OPTIONAL</span><h2>Epic Xpress Checkout</h2>
   {view==='invitation'?<><ExcOptionalInvitation onChooseInPerson={()=>setAssisted(true)}/>{assisted?<p role="status">You can complete orientation with an Adventure Tech when you arrive.</p>:null}</>:view==='review'?<ExpAssessmentRetryIntro count={1}/>:view==='technician'?<ExpAssessmentResult result={{status:'retry_or_technician'}} onExit={()=>router.push('/guest/ee200000-0000-4000-8000-000000000002')}/>:view==='modal'?<ExpAssessmentResult result={{status:'assessment_complete',expReady:true,drivers:[jordan,morgan].map(d=>({...d,expReady:true,outstanding:[]}))}} onExit={()=>router.push('/guest/ee200000-0000-4000-8000-000000000002')}/>:<ExcCompletion drivers={drivers} qualified={view==='qualified'}/>}
   {view==='none'?<><p>Get a head start on your adventure. Complete a short safety orientation and quick knowledge check before you arrive for our fastest check-out — and more time on the trail.</p><button className={excStyles.action} type="button" onClick={()=>setView('invitation')}>Get Started</button></>:view==='partial'?<button className={excStyles.action} type="button" onClick={()=>setView('invitation')}>Continue Orientation</button>:null}
  </div></section>
 </div></main>;
}
