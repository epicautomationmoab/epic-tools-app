import Link from "next/link";
import TeamSidebar from "../TeamSidebar";
import HistoricalReadinessSearch from "../readiness/HistoricalReadinessSearch";
import HeaderClock from "../readiness/HeaderClock";
import LogoutButton from "../readiness/LogoutButton";
import styles from "../readiness/ReadinessShell.module.css";

export default function PreviousGuestsPage() {
  return (
    <div className={styles.page}>
      <TeamSidebar active="Previous Guest Lookup" />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Previous Guest Lookup</h1>
            <HeaderClock />
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.actionButton} href="/team/readiness">Guest Readiness</Link>
            <Link className={styles.actionButton} href="/team/arrival-board">Arrival Board</Link>
            <Link className={`${styles.actionButton} ${styles.kioskButton}`} href="/kiosk">Kiosk</Link>
            <LogoutButton />
          </div>
        </header>

        <section className={styles.content}>
          <HistoricalReadinessSearch />
        </section>
      </main>
    </div>
  );
}
