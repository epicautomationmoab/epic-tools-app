import TeamSidebar from "../TeamSidebar";
import ActiveRentalsPanel from "../readiness/ActiveRentalsPanel";
import AutoRefresh from "../readiness/AutoRefresh";
import HeaderClock from "../readiness/HeaderClock";
import LastSynced from "../readiness/LastSynced";
import LogoutButton from "../readiness/LogoutButton";
import { getHeldOverRentals } from "./data";
import type { ReadinessRow } from "@/lib/supabase";
import styles from "../readiness/ReadinessShell.module.css";

export default async function ActiveRentalsPage() {
  let rows: ReadinessRow[] = [];
  let error = "";

  try {
    rows = await getHeldOverRentals();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load held-over rentals.";
  }

  return (
    <div className={styles.page}>
      <AutoRefresh />
      <TeamSidebar active="Held-Over Rentals" />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Held-Over Rentals</h1>
            <HeaderClock />
          </div>
          <div className={styles.headerActions}>
            <div className={styles.sync}><LastSynced /></div>
            <LogoutButton />
          </div>
        </header>

        <section className={styles.content}>
          {error ? <div className={styles.error}>{error}</div> : null}
          <ActiveRentalsPanel rows={rows} />
        </section>
      </main>
    </div>
  );
}
