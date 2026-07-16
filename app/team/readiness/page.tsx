import Link from "next/link";
import ReadinessTable from "./ReadinessTable";
import { getReadinessRows, type ReadinessRow } from "@/lib/supabase";
import styles from "./ReadinessShell.module.css";

const navItems = [
  { label: "Guest Readiness", href: "/team/readiness", external: false },
  { label: "Reservations", href: "https://epic4x4.tripworks.com", external: true },
  { label: "MPWR", href: "https://mpwr-hq.poladv.com/orders", external: true },
] as const;

const agents = ["MPWR Agent", "Waiver Agent", "Portal Agent"] as const;

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
          {navItems.map((item) => {
            const className = item.label === "Guest Readiness" ? styles.active : undefined;
            const content = (
              <>
                <span aria-hidden="true">◇</span>
                {item.label}
              </>
            );

            return item.external ? (
              <a key={item.label} href={item.href} className={className} target="_blank" rel="noreferrer">
                {content}
              </a>
            ) : (
              <Link key={item.label} href={item.href} className={className}>
                {content}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarPhoto}>
          <div className={styles.agentStack}>
            {agents.map((agent) => (
              <div className={styles.agentCard} key={agent}>
                <div className={styles.agentTitle}>{agent}</div>
                <div className={styles.agentStatus}>
                  <span className={styles.onlineDot} />Online
                </div>
              </div>
            ))}
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
