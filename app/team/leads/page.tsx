import Link from "next/link";
import TeamSidebar from "../TeamSidebar";
import styles from "./Leads.module.css";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSupabaseConfig() {
  const rawUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const key = requiredEnv("SUPABASE_SECRET_KEY");
  return { url, key };
}

function dollars(cents: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format((Number(cents) || 0) / 100);
}

function dateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

type Opportunity = {
  id: string;
  customer_name: string | null;
  email: string | null;
  phone_e164: string | null;
  activity_date: string;
  status: string;
  lead_value_cents: number;
  captured_value_cents: number;
  draft_count: number;
  source_method: string | null;
  assigned_rep_name: string | null;
  matched_booking_confirmation_code: string | null;
  primary_draft_trip_id: number | null;
};

type Draft = {
  tripworks_trip_id: number;
  experience_name: string | null;
  option_name: string | null;
  value_cents: number | null;
};

async function supabaseRest<T>(path: string): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return response.json() as Promise<T>;
}

async function getLeads() {
  const select = encodeURIComponent(
    "id,customer_name,email,phone_e164,activity_date,status,lead_value_cents,captured_value_cents,draft_count,source_method,assigned_rep_name,matched_booking_confirmation_code,primary_draft_trip_id",
  );
  const opportunities = await supabaseRest<Opportunity[]>(
    `sales_opportunities?select=${select}`,
  );

  opportunities.sort((a, b) => {
    const statusCompare = a.status.localeCompare(b.status);
    if (statusCompare) return statusCompare;
    const dateCompare = a.activity_date.localeCompare(b.activity_date);
    if (dateCompare) return dateCompare;
    return Number(b.lead_value_cents || 0) - Number(a.lead_value_cents || 0);
  });

  const primaryIds = [
    ...new Set(
      opportunities
        .map((row) => Number(row.primary_draft_trip_id))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  ];

  let drafts = new Map<number, Draft>();
  if (primaryIds.length) {
    const draftSelect = encodeURIComponent("tripworks_trip_id,experience_name,option_name,value_cents");
    const rows = await supabaseRest<Draft[]>(
      `sales_drafts?select=${draftSelect}&tripworks_trip_id=in.(${primaryIds.join(",")})`,
    );
    drafts = new Map(rows.map((row) => [Number(row.tripworks_trip_id), row]));
  }

  return { opportunities, drafts };
}

export default async function LeadsPage() {
  let opportunities: Opportunity[] = [];
  let drafts = new Map<number, Draft>();
  let loadError = "";

  try {
    const loaded = await getLeads();
    opportunities = loaded.opportunities;
    drafts = loaded.drafts;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load Sales & Leads data.";
    console.error("Sales & Leads load error:", error);
  }

  const open = opportunities.filter((row) => row.status === "open");
  const booked = opportunities.filter((row) => row.status === "booked");
  const openValue = open.reduce((sum, row) => sum + Number(row.lead_value_cents || 0), 0);
  const capturedValue = booked.reduce((sum, row) => sum + Number(row.captured_value_cents || 0), 0);
  const conversion = opportunities.length ? Math.round((booked.length / opportunities.length) * 100) : 0;

  return (
    <div className={styles.shell}>
      <TeamSidebar active="Sales & Leads" />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Epic Tools Sales</div>
            <h1>Sales &amp; Leads</h1>
            <p>TripWorks shopping activity grouped into real customer opportunities.</p>
          </div>
          <Link className={styles.back} href="/team/readiness">Guest Readiness</Link>
        </header>

        {loadError ? (
          <div style={{ marginBottom: 18, padding: 16, background: "#fff1ef", border: "1px solid #efc0ba", borderRadius: 12, color: "#8c2f24", fontWeight: 750 }}>
            Sales data could not load: {loadError}
          </div>
        ) : null}

        <section className={styles.kpis}>
          <div className={`${styles.kpi} ${styles.kpiPrimary}`}>
            <div className={styles.kpiLabel}>Open Lead Value</div>
            <div className={styles.kpiValue}>{dollars(openValue)}</div>
            <div className={styles.kpiSub}>{open.length} active opportunities</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Captured Lead Value</div>
            <div className={styles.kpiValue}>{dollars(capturedValue)}</div>
            <div className={styles.kpiSub}>{booked.length} matched bookings</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Opportunities</div>
            <div className={styles.kpiValue}>{opportunities.length}</div>
            <div className={styles.kpiSub}>Grouped from TripWorks drafts</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Booking Rate</div>
            <div className={styles.kpiValue}>{conversion}%</div>
            <div className={styles.kpiSub}>Matched opportunities booked</div>
          </div>
        </section>

        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <span className={`${styles.tab} ${styles.tabActive}`}>All {opportunities.length}</span>
            <span className={styles.tab}>Open {open.length}</span>
            <span className={styles.tab}>Booked {booked.length}</span>
          </div>
          <div className={styles.muted}>Future activity dates only</div>
        </div>

        <section className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Activity</th>
                <th>Best Option</th>
                <th>Method</th>
                <th>Rep</th>
                <th>Drafts</th>
                <th>Status</th>
                <th>Lead Value</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((row) => {
                const draft = row.primary_draft_trip_id ? drafts.get(Number(row.primary_draft_trip_id)) : undefined;
                return (
                  <tr key={row.id}>
                    <td>
                      <div className={styles.name}>{row.customer_name || "Unknown customer"}</div>
                      <div className={styles.contact}>{row.phone_e164 || row.email || "No contact details"}</div>
                    </td>
                    <td className={styles.activity}>{dateLabel(row.activity_date)}</td>
                    <td>
                      <div className={styles.experience}>{draft?.experience_name || "TripWorks draft"}</div>
                      <div className={styles.contact}>{draft?.option_name || ""}</div>
                    </td>
                    <td className={styles.method}>{(row.source_method || "unknown").replaceAll("_", " ")}</td>
                    <td>{row.assigned_rep_name || <span className={styles.muted}>Unassigned</span>}</td>
                    <td><span className={styles.drafts}>{row.draft_count}</span></td>
                    <td>
                      <span className={`${styles.status} ${row.status === "booked" ? styles.booked : styles.open}`}>
                        {row.status}
                      </span>
                      {row.matched_booking_confirmation_code ? <div className={styles.contact}>{row.matched_booking_confirmation_code}</div> : null}
                    </td>
                    <td className={styles.money}>{dollars(row.status === "booked" ? row.captured_value_cents : row.lead_value_cents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loadError && opportunities.length === 0 ? (
            <div style={{ padding: 22, color: "#6f7885" }}>No future sales opportunities found.</div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
