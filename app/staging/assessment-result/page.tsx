"use client";
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import ExpAssessmentResult from '../../guest/[token]/ExpAssessmentResult';
import assessmentStyles from '../../guest/[token]/ExpAssessment.module.css';
import styles from '../staging.module.css';
export default function ResultWordingPreview(){
 const router=useRouter();
 return <main className={styles.page}><div className={styles.content}>
  <Link className={styles.link} href='/staging'>← Staging test area</Link>
  <p className={styles.notice}>Result wording preview only. This uses the same result component as the live staging assessment and does not change your test results or progress.</p>
  <div className={styles.preview}><div className={styles.eyebrow}>Our fastest check-out · optional</div><h2>Epic Xpress Ready</h2><section className={assessmentStyles.assessment}><ExpAssessmentResult result={{status:'retry_or_technician'}} onExit={()=>router.push('/guest/ee200000-0000-4000-8000-000000000002')}/></section></div>
 </div></main>;
}
