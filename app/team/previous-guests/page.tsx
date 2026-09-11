import TeamSidebar from "../TeamSidebar";
import HistoricalReadinessSearch from "../readiness/HistoricalReadinessSearch";
import HistoricalPostVisitToggleEnhancer from "../readiness/HistoricalPostVisitToggleEnhancer";
import HeaderClock from "../readiness/HeaderClock";
import styles from "../readiness/ReadinessShell.module.css";

export default function PreviousGuestsPage() {
  return (
    <div className={styles.page}>
      <HistoricalPostVisitToggleEnhancer />
      <TeamSidebar active="Previous Guest Lookup" />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Previous Guest Lookup</h1>
            <HeaderClock />
          </div>
        </header>

        <section className={styles.content}>
          <HistoricalReadinessSearch />
        </section>
      </main>
    </div>
  );
}
