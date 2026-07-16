import Link from "next/link";
import ReadinessTable from "./ReadinessTable";
import { getReadinessRows, type ReadinessRow } from "@/lib/supabase";
import styles from "./ReadinessShell.module.css";

const navItems = [
  ["Guest Readiness", "/team/readiness"],
  ["Reservations", "#"],
  ["Activities", "#"],
  ["Documents", "#"],
  ["Waivers", "#"],
  ["MPWR", "#"],
  ["Reports", "#"],
  ["Settings", "#"],
] as const;

export default async function TeamReadinessPage() {
  let rows: ReadinessRow[] = [];
  let error = "";

  try {
    rows = await getReadinessRows();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load readiness rows.";
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" />
        </div>

        <nav className={styles.nav} aria-label="EpicTools navigation">
          {navItems.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className={label === "Guest Readiness" ? styles.active : undefined}
            >
              <span aria-hidden="true">◇</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarPhoto}>
          <div className={styles.agentCard}>
            <div className={styles.agentTitle}>Rhett Status</div>
            <div className={styles.agentStatus}>
              <span className={styles.onlineDot} />Online
            </div>
            <div className={styles.agentStatus}>Guest readiness automation</div>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Guest Readiness</h1>
            <p>One view. Every guest. Fully ready.</p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.sync}>Last synced<br />just now</div>
            <Link className={styles.actionButton} href="/team/arrival-board">Arrival Board</Link>
            <Link className={`${styles.actionButton} ${styles.kioskButton}`} href="/kiosk">Kiosk</Link>
          </div>
        </header>

        <section className={styles.content}>
          {error ? <div className={styles.error}>{error}</div> : null}
          <ReadinessTable rows={rows} />
        </section>
      </main>
    </div>
  );
}
