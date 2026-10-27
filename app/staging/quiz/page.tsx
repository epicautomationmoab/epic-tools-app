import Link from "next/link";
import QuizPreview from "./QuizPreview";
import styles from "../staging.module.css";
export default function QuizPreviewPage(){return <main className={styles.page}><div className={styles.content}><Link className={styles.link} href="/staging">← Back to test area</Link><p className={styles.notice}>Design preview only. Answers here stay in this open page. This does not bypass the real video, saving, or quiz requirements.</p><div className={styles.preview}><div className={styles.eyebrow}>Our fastest check-out · optional</div><h2>Epic Xpress Ready</h2><QuizPreview/></div></div></main>}
