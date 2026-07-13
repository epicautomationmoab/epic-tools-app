import Link from "next/link";
import ReadinessTable from "./ReadinessTable";
import { getReadinessRows, type ReadinessRow } from "@/lib/supabase";

export default async function TeamReadinessPage() {
  let rows: ReadinessRow[] = [];
  let error = "";

  try {
    rows = await getReadinessRows();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load readiness rows.";
  }

  const docsAttention = rows.filter((row) => row.epic_document_count_color !== "green").length;
  const balancesDue = rows.filter((row) => (row.amount_due_cents ?? 0) > 0).length;
  const ohvNeeded = rows.filter(
    (row) => row.business_line === "rental" && !row.ohv_certificate_uploaded,
  ).length;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">EpicTools</p>
          <h1>Guest Readiness</h1>
        </div>
        <nav className="navLinks">
          <Link href="/team/arrival-board">Arrival Board</Link>
          <Link href="/kiosk">Kiosk</Link>
        </nav>
      </header>

      <section className="metrics" aria-label="Readiness facts">
        <div className="metric">
          <span className="metricValue">{rows.length}</span>
          <span className="metricLabel">visits loaded</span>
        </div>
        <div className="metric">
          <span className="metricValue">{docsAttention}</span>
          <span className="metricLabel">Epic docs attention</span>
        </div>
        <div className="metric">
          <span className="metricValue">{balancesDue}</span>
          <span className="metricLabel">balance due</span>
        </div>
        <div className="metric">
          <span className="metricValue">{ohvNeeded}</span>
          <span className="metricLabel">OHV upload needed</span>
        </div>
      </section>

      {!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? (
        <section className="setupNote">
          Supabase is not connected yet. Add environment variables to load live rows.
        </section>
      ) : null}

      {error ? <section className="setupNote">{error}</section> : null}

      <ReadinessTable rows={rows} />
    </main>
  );
}
