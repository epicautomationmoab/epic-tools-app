import { getArrivalBoardRows } from "@/lib/supabase";
import type { LobbyArrivalRow } from "./ArrivalBoardDisplay";
import ArrivalBoardRefresh from "./ArrivalBoardRefresh";
import ArrivalBoardDisplay from "./ArrivalBoardDisplay";
import styles from "./ArrivalBoard.module.css";

function displayGuestName(fullName: string) {
  const words = fullName.trim().split(" ").filter(Boolean);
  if (words.length < 2) return words[0] || "Guest";
  return words[0] + " " + words[words.length - 1].slice(0, 1).toUpperCase() + ".";
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
  let rows: LobbyArrivalRow[] = [];
  let error = "";

  try {
    const rawRows = await getArrivalBoardRows();
    // Public lobby display: allowlist fields before serializing data to the client.
    // Never pass through the entire internal Arrival Board database record.
    rows = rawRows.map((row) => ({
      visit_start_time: row.visit_start_time,
      customer_name: displayGuestName(row.customer_name),
      customer_phone_last_four: row.customer_phone_last_four,
      business_line: row.business_line,
      board_activity_label: row.board_activity_label,
      product_display_name: row.product_display_name,
      rental_duration: row.rental_duration,
      total_vehicle_count: row.total_vehicle_count,
      vehicle_breakdown: row.vehicle_breakdown,
      board_action_label: row.board_action_label,
      board_action_type: row.board_action_type,
    }));
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load arrival board rows.";
  }

  return (
    <main className={styles.page}>
      <ArrivalBoardRefresh />

      <header className={styles.header}>
        <div className={styles.brand}>
          <img src="/epic-logo-black.png" alt="Epic 4X4 Adventures" className={styles.logo} />
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

      {error ? <section className={styles.error}>{error}</section> : <ArrivalBoardDisplay rows={rows} />}

      <footer className={styles.footer}>
        <span>Questions? Please see an Epic team member.</span>
        <span className={styles.refreshStatus}>Updates automatically every 30 seconds</span>
      </footer>
    </main>
  );
}
