import { getArrivalBoardRows, type ArrivalBoardRow } from "@/lib/supabase";
import ArrivalBoardRefresh from "./ArrivalBoardRefresh";
import ArrivalBoardDisplay from "./ArrivalBoardDisplay";
import styles from "./ArrivalBoard.module.css";

function formatToday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  }).format(new Date());
}

export default async function ArrivalBoardPage() {
  let rows: ArrivalBoardRow[] = [];
  let error = "";

  try {
    rows = await getArrivalBoardRows();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load arrival board rows.";
  }

  return (
    <main className={styles.page}>
      <ArrivalBoardRefresh />

      <header className={styles.header}>
        <div className={styles.brand}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" className={styles.logo} />
          <div>
            <p className={styles.kicker}>Welcome to Epic 4X4 Adventures</p>
            <h1>Find Your Visit</h1>
          </div>
        </div>

        <div className={styles.dateBlock}>
          <span>Today's Arrivals</span>
          <strong>{formatToday()}</strong>
        </div>
      </header>

      {error ? <section className={styles.error}>{error}</section> : <ArrivalBoardDisplay rows={rows} />}

      <footer className={styles.footer}>
        <span>Questions? Please see an Epic team member.</span>
        <span className={styles.refreshStatus}>Updates automatically every 30 seconds</span>
      </footer>
    </main>
  );
}
