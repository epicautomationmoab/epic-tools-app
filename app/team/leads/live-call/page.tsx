import { Suspense } from "react";
import TeamSidebar from "../../TeamSidebar";
import LiveLeadCapture from "./LiveLeadCapture";
import styles from "../Leads.module.css";

export default function LiveCallLeadPage() {
  return <div className={styles.shell}>
    <TeamSidebar active="Sales & Leads" />
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Epic Tools Sales</div>
          <h1>Live Call</h1>
          <p>Capture the details you learn while the customer is on the phone.</p>
        </div>
      </header>
      <Suspense fallback={<div style={{padding:28,fontWeight:800,color:"#657384"}}>Loading incoming call…</div>}>
        <LiveLeadCapture />
      </Suspense>
    </main>
  </div>;
}
