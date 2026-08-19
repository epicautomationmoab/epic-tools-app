import Link from "next/link";
import HistoricalReadinessSearch from "../readiness/HistoricalReadinessSearch";
import HeaderClock from "../readiness/HeaderClock";
import LogoutButton from "../readiness/LogoutButton";
import styles from "../readiness/ReadinessShell.module.css";

const navItems = [
  { label: "Guest Readiness", href: "/team/readiness", external: false },
  { label: "Previous Guest Lookup", href: "/team/previous-guests", external: false },
  { label: "Email Delivery", href: "/team/email-delivery", external: false },
  { label: "Reservations", href: "https://epic4x4.tripworks.com", external: true },
  { label: "MPWR", href: "https://mpwr-hq.poladv.com/orders", external: true },
] as const;

export default function PreviousGuestsPage() {
  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" />
        </div>

        <nav className={styles.nav} aria-label="EpicTools navigation">
          {navItems.map((item) => {
            const className = item.label === "Previous Guest Lookup" ? styles.active : undefined;
            const content = <><span aria-hidden="true">◇</span>{item.label}</>;
            return item.external ? (
              <a key={item.label} href={item.href} className={className} target="_blank" rel="noreferrer">{content}</a>
            ) : (
              <Link key={item.label} href={item.href} className={className}>{content}</Link>
            );
          })}
        </nav>

        <div className={styles.sidebarPhoto} />
      </aside>

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
