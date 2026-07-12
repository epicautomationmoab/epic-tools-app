import Link from "next/link";
import { getReadinessRows, type ReadinessRow } from "@/lib/supabase";

function formatWallTime(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function formatDate(value: string) {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;

  const date = new Date(`${match[2]}/${match[3]}/${match[1]}`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function mpwrLabel(row: ReadinessRow) {
  const expected = row.expected_guest_count ?? "?";
  return `0/${expected}`;
}

function hasAttention(row: ReadinessRow) {
  return (row.attention_flags ?? []).some((flag) => flag !== "mpwr_check");
}

function ohvCell(row: ReadinessRow) {
  if (row.business_line !== "rental") {
    return <span className="ohvStatus ohvGood">N/A</span>;
  }

  if (row.ohv_certificate_uploaded) {
    return <span className="ohvStatus ohvGood">✓</span>;
  }

  return <span className="ohvStatus ohvBad">✕</span>;
}

function Row({ row }: { row: ReadinessRow }) {
  const due = row.amount_due_cents ?? 0;

  return (
    <tr>
      <td>
        <div className="mainLine">{formatDate(row.visit_start_time)}</div>
        <div className="subLine">{formatWallTime(row.visit_start_time)}</div>
      </td>
      <td>
        <div className="mainLine">{row.customer_name}</div>
      </td>
      <td>
        <div className="mainLine">{row.product_display_name}</div>
      </td>
      <td>
        <div className="cue">
          <i className={`dot ${row.epic_document_count_color || "gray"}`} />
          {row.epic_document_count_label}
        </div>
        {row.tripworks_booking_url ? (
          <div className="subLine">
            <a className="inlineLink" href={row.tripworks_booking_url} target="_blank">
              {row.confirmation_code}
            </a>
          </div>
        ) : (
          <div className="subLine">{row.confirmation_code}</div>
        )}
      </td>
      <td>
        <div className="cue">
          <i className="dot red" />
          {mpwrLabel(row)}
        </div>
        {row.mpwr_reservation_url && row.mpwr_confirmation_number ? (
          <div className="subLine">
            <a className="inlineLink" href={row.mpwr_reservation_url} target="_blank">
              {row.mpwr_confirmation_number}
            </a>
          </div>
        ) : (
          <div className="subLine">Missing</div>
        )}
      </td>
      <td>
        {due > 0 ? (
          <i className="money moneyDue">$</i>
        ) : (
          <i className="money moneyPaid">$0</i>
        )}
      </td>
      <td>{ohvCell(row)}</td>
      <td>
        <span className={`reviewButton ${hasAttention(row) ? "" : "clear"}`}>
          {hasAttention(row) ? "Review" : "OK"}
        </span>
      </td>
    </tr>
  );
}

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
  const ohvNeeded = rows.filter((row) => row.business_line === "rental" && !row.ohv_certificate_uploaded).length;

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

      <section className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Visit</th>
              <th>Guest</th>
              <th>Activity</th>
              <th>Epic Docs</th>
              <th>MPWR</th>
              <th>Bal</th>
              <th>OHV</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row key={`${row.confirmation_code}-${row.visit_start_time}-${row.product_display_name}`} row={row} />
            ))}
          </tbody>
        </table>
        {!rows.length ? <div className="emptyState">No rows loaded yet.</div> : null}
      </section>
    </main>
  );
}
