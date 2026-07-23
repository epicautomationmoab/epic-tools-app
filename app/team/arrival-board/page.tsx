import Link from "next/link";
import { getArrivalBoardRows, type ArrivalBoardRow } from "@/lib/supabase";

function formatWallTime(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
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
    <main className="arrivalShell">
      <header className="arrivalTopbar">
        <div>
          <p className="eyebrow">Epic 4x4 Adventures</p>
          <h1>Find Your Visit</h1>
        </div>
        <nav className="navLinks">
          <Link href="/team/readiness">Staff Dashboard</Link>
        </nav>
      </header>

      {error ? <section className="setupNote">{error}</section> : null}

      <section className="arrivalRows">
        {rows.map((row) => (
          <article className="arrivalRow" key={`${row.confirmation_code}-${row.visit_start_time}-${row.business_line}`}>
            <div className="arrivalTime">{formatWallTime(row.visit_start_time)}</div>
            <div className="arrivalName">{row.customer_name}</div>
            <div className="arrivalCode">{row.confirmation_code}</div>
            <div className="arrivalActivity">{row.board_activity_label}</div>
            <div className={`arrivalAction ${row.board_action_type}`}>
  {row.board_action_label}
</div>

<div className="arrivalKioskCode">
  <span>ENTER CODE</span>
  <strong>{row.customer_phone_last_four || "----"}</strong>
</div>
          </article>
        ))}
        {!rows.length ? <div className="emptyState">No arrivals loaded yet.</div> : null}
      </section>
    </main>
  );
}
