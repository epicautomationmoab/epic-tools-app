import Link from "next/link";
import styles from "./staging.module.css";
export default function StagingHome(){return <main className={styles.page}><div className={styles.content}>
 <div className={styles.eyebrow}>Epic 4x4 Adventures · isolated staging</div><h1>Your EXP test drive</h1>
 <p className={styles.intro}>Explore the guest experience with prepared sample reservations. All names and records below are synthetic. Guest communications and operational writes remain disabled.</p>
 <div className={styles.grid}>
 <article className={styles.card}><h2>Run the full flow yourself</h2><p>A fresh three-driver reservation, pre-filled test agreements, sample certificate files, and step-by-step instructions for the real EXP workflow.</p><Link href="/staging/walkthrough">Start my complete walkthrough →</Link></article>
 <article className={styles.card}><h2>Review the new quiz design</h2><p>Try the answer cards and navigation immediately. This visual preview uses the same quiz styles and does not award completion.</p><Link href="/staging/quiz">Open quiz design →</Link></article>
 <article className={styles.card}><h2>Completed party · 3 drivers</h2><p>Avery, Blake, and Casey have signed agreements, uploaded certificates, and completed the orientation. This is the reservation used in the successful end-to-end test.</p><Link href="/guest/ee100000-0000-4000-8000-000000000002">Open completed guest portal →</Link></article>
 <article className={styles.card}><h2>Incomplete reservation</h2><p>See how missing paperwork and orientation appear before the party is ready. Readiness should remain incomplete.</p><Link href="/guest/355335d7-8546-47da-8603-93e16abbe194">Open incomplete guest portal →</Link></article>
 <article className={styles.card}><h2>Staff and arrival</h2><p>Compare the guest result with staff Readiness, Arrival Board, and kiosk routing. Staff pages require a staging staff login. Choose Tomorrow in Readiness. Kiosk test code: 0982.</p><Link href="/team/readiness">Open staff Readiness →</Link><Link href="/team/arrival-board?date=2026-10-28">Open sample Arrival Board →</Link><Link href="/kiosk">Open kiosk →</Link></article>
 <article className={styles.card}><h2>Rental reminder draft</h2><p>Review the proposed EXP invitation before any email template is published or any message is sent.</p><Link href="/staging/reminder">Preview reminder wording →</Link></article>
 </div><p className={styles.notice}>Sample rentals are dated October 28, 2026. Production is on hold. The Polaris waiver observations in these records are simulated. The completed party has actual staging video, quiz, signature, and certificate test evidence. This test area is available only with the isolated staging database.</p>
 </div></main>}
