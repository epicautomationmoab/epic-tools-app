import { getArrivalBoardRows, type ArrivalBoardRow } from "@/lib/supabase";
import ArrivalBoardRefresh from "./ArrivalBoardRefresh";
import styles from "./ArrivalBoard.module.css";

function formatWallTime(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

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
          <span>Today&apos;s Arrivals</span>
          <strong>{formatToday()}</strong>
        </div>
      </header>

      <section className={styles.legend} aria-label="Arrival instructions">
        <span className={styles.legendItem}>
          <i className={`${styles.legendDot} ${styles.kioskDot}`} />
          Proceed to Kiosk
        </span>
        <span className={styles.legendItem}>
          <i className={`${styles.legendDot} ${styles.agentDot}`} />
          Please See an Epic Team Member
        </span>
      </section>

      {error ? <section className={styles.error}>{error}</section> : null}

      <section className={styles.rows}>
        {rows.map((row) => (
          <article
            className={styles.row}
            key={`${row.confirmation_code}-${row.visit_start_time}-${row.business_line}`}
          >
            <div className={styles.time}>{formatWallTime(row.visit_start_time)}</div>

            <div className={styles.guest}>
              <strong>{row.customer_name}</strong>
              <span>{row.confirmation_code}</span>
            </div>

            <div className={styles.activity}>{row.board_activity_label}</div>

            <div
              className={`${styles.action} ${
                row.board_action_type === "kiosk" ? styles.kiosk : styles.agent
              }`}
            >
              {row.board_action_label}
            </div>
          </article>
        ))}

        {!rows.length && !error ? (
          <div className={styles.empty}>
            <img src="/epic-logo.png" alt="" className={styles.emptyLogo} />
            <h2>No arrivals are currently waiting.</h2>
            <p>Your name will appear here as your reservation time approaches.</p>
          </div>
        ) : null}
      </section>

      <footer className={styles.footer}>
        <span>Questions? Please see an Epic team member.</span>
        <span className={styles.refreshStatus}>Updates automatically every 30 seconds</span>
      </footer>
    </main>
  );
}
