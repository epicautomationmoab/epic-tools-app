import Link from "next/link";
import { cookies } from "next/headers";
import TeamSidebar from "../TeamSidebar";
import HeaderClock from "../readiness/HeaderClock";
import styles from "../readiness/ReadinessShell.module.css";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

type Booking = {
  confirmation_code: string | null;
  customer_name: string | null;
  reserved_at: string | null;
  experience_name: string | null;
  trip_method_name: string | null;
  trip_status: string | null;
  is_cancelled: boolean | null;
  total_sales_cents: number | null;
  total_amount_cents: number | null;
  start_time: string | null;
  business_line: string | null;
};

const moab = "America/Denver";
const localDay = (value: string | Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: moab, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));
const formatTime = (value: string) => new Intl.DateTimeFormat("en-US", {
  timeZone: moab, hour: "numeric", minute: "2-digit",
}).format(new Date(value));
const formatVisit = (value: string) => new Intl.DateTimeFormat("en-US", {
  timeZone: moab, month: "short", day: "numeric", year: "numeric",
}).format(new Date(value));
const money = (cents: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
}).format(cents / 100);

async function getBookings(date: string): Promise<Booking[]> {
  const urlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!urlRaw || !key) throw new Error("Sales report configuration is missing.");
  const url = (/^https?:\/\//i.test(urlRaw) ? urlRaw : `https://${urlRaw}`).replace(/\/+$/, "");

  // Fetch a generously padded UTC window, then filter by the actual Denver
  // calendar day. This avoids DST and off-by-one bugs around midnight.
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  const from = new Date(utcMidnight - 24 * 3600000).toISOString();
  const to = new Date(utcMidnight + 48 * 3600000).toISOString();
  const params = new URLSearchParams({
    select: "confirmation_code,customer_name,reserved_at,experience_name,trip_method_name,trip_status,is_cancelled,total_sales_cents,total_amount_cents,start_time,business_line",
    reserved_at: `gte.${from}`,
    order: "reserved_at.desc",
    limit: "5000",
  });
  params.append("reserved_at", `lt.${to}`);
  const response = await fetch(`${url}/rest/v1/operational_reservations?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to load TripWorks sales: " + await response.text());
  const all = await response.json() as Booking[];
  if (all.length === 5000) throw new Error("Booking volume exceeded report safety limit; results not shown as incomplete.");
  const today = all.filter(row => row.reserved_at && localDay(row.reserved_at) === date);
  // One row per TripWorks confirmation even if a source sync duplicates it.
  return [...new Map(today.map(row => [row.confirmation_code || row.reserved_at, row])).values()];
}

const panel = { background: "#fff", border: "1px solid #e0e6ec", borderRadius: 14, padding: 20 } as const;
export default async function SalesReport({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const token = (await cookies()).get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(token);
  if (!profile || profile.role === "workstation") {
    return <main style={{ padding: 32 }}>Named employee login required. <Link href="/team/readiness">Return to Epic Tools</Link></main>;
  }
  const requested = (await searchParams).date || "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) && !Number.isNaN(Date.parse(requested))
    ? requested : localDay(new Date());
  let bookings: Booking[] = [];
  let error = "";
  try { bookings = await getBookings(date); }
  catch (e) { error = e instanceof Error ? e.message : "Unable to load sales."; }

  const active = bookings.filter(row => !row.is_cancelled && !/cancel/i.test(row.trip_status || ""));
  const cancelled = bookings.length - active.length;
  const salesCents = active.reduce((sum, row) => sum + (row.total_sales_cents ?? row.total_amount_cents ?? 0), 0);
  const bySource = new Map<string, { count: number; cents: number }>();
  for (const row of active) {
    const name = row.trip_method_name?.trim() || "Not specified";
    const current = bySource.get(name) || { count: 0, cents: 0 };
    current.count += 1;
    current.cents += row.total_sales_cents ?? row.total_amount_cents ?? 0;
    bySource.set(name, current);
  }
  return <div className={styles.page}>
    <TeamSidebar active="Guest Readiness" />
    <main className={styles.main}>
      <header className={styles.topbar}>
        <div className={styles.titleBlock}>
          <h1>Today's Sales</h1><HeaderClock />
          <p>TripWorks bookings made on the selected Moab calendar date, regardless of the activity date.</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.actionButton} href="/team/readiness">Guest Readiness</Link>
        </div>
      </header>
      <section className={styles.content}>
        <div style={{ ...panel, marginBottom: 16 }}>
          <form method="GET" action="/team/sales-report" style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 5, fontWeight: 750 }}>Booking date (Moab)
              <input type="date" name="date" defaultValue={date} style={{ border: "1px solid #cbd5df", borderRadius: 7, padding: "9px 12px", fontSize: 15 }} />
            </label>
            <button type="submit" style={{ padding: "10px 18px", border: 0, borderRadius: 8, background: "#255783", color: "#fff", fontWeight: 800 }}>Run Report</button>
            <Link href="/team/sales-report" style={{ padding: 10 }}>Today</Link>
          </form>
          <div style={{ fontSize: 12, color: "#607080", marginTop: 10 }}>
            Based on synchronized TripWorks reservations. Recent bookings may appear after webhook processing; this is not a direct live TripWorks API query.
          </div>
        </div>
        {error ? <div style={{ ...panel, color: "#a12a2a" }}>{error}</div> : <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div style={panel}><div style={{ color: "#637184" }}>Bookings</div><div style={{ fontSize: 29, fontWeight: 900 }}>{active.length}</div></div>
            <div style={panel}><div style={{ color: "#637184" }}>Booked sales</div><div style={{ fontSize: 29, fontWeight: 900 }}>{money(salesCents)}</div></div>
            <div style={panel}><div style={{ color: "#637184" }}>Cancelled / voided</div><div style={{ fontSize: 29, fontWeight: 900 }}>{cancelled}</div></div>
          </div>
          <div style={{ ...panel, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Sales by booking method</h2>
            {[...bySource.entries()].sort((a,b) => b[1].cents - a[1].cents).map(([name,data]) =>
              <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #edf0f4" }}>
                <span>{name} ({data.count})</span><strong>{money(data.cents)}</strong>
              </div>)}
            {bySource.size === 0 && <div style={{ color: "#637184" }}>No bookings for this day.</div>}
          </div>
          <div style={{ ...panel, padding: 0, overflowX: "auto" }}>
            <h2 style={{ fontSize: 18, padding: "16px 20px", margin: 0 }}>Booking activity</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead><tr style={{ background: "#f5f7fa" }}>
                {["Booked", "Guest", "TripWorks", "Experience", "Visit date", "Method", "Sales", "Status"].map(col => <th key={col} style={{ padding: "11px 10px", whiteSpace: "nowrap" }}>{col}</th>)}
              </tr></thead>
              <tbody>{bookings.map((row,i) => <tr key={row.confirmation_code || i} style={{ borderTop: "1px solid #ebeff3" }}>
                <td style={{ padding: 10, whiteSpace: "nowrap" }}>{row.reserved_at ? formatTime(row.reserved_at) : "—"}</td>
                <td style={{ padding: 10 }}>{row.customer_name || "Unknown"}</td>
                <td style={{ padding: 10, fontWeight: 750 }}>{row.confirmation_code || "—"}</td>
                <td style={{ padding: 10 }}>{row.experience_name || "Not specified"}</td>
                <td style={{ padding: 10, whiteSpace: "nowrap" }}>{row.start_time ? formatVisit(row.start_time) : "—"}</td>
                <td style={{ padding: 10 }}>{row.trip_method_name || "—"}</td>
                <td style={{ padding: 10, whiteSpace: "nowrap" }}>{money(row.total_sales_cents ?? row.total_amount_cents ?? 0)}</td>
                <td style={{ padding: 10, color: row.is_cancelled ? "#a52c2c" : "#276b42" }}>{row.is_cancelled ? "Cancelled" : row.trip_status || "Booked"}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
      </section>
    </main>
  </div>;
}
