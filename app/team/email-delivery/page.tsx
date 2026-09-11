import Link from "next/link";
import TeamSidebar from "../TeamSidebar";
import HeaderClock from "../readiness/HeaderClock";
import LogoutButton from "../readiness/LogoutButton";
import styles from "../readiness/ReadinessShell.module.css";

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

async function rest<T>(table: string, params: URLSearchParams): Promise<T[]> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load ${table}: ${await response.text()}`);
  return response.json() as Promise<T[]>;
}

function mountainDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatMoabTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatVisitDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00-06:00`));
}

type EmailIncident = {
  id: string;
  confirmation_code: string;
  recipient_email: string | null;
  failure_type: string;
  failure_detail: string | null;
  status: string;
  created_at: string;
};

type ReadinessException = {
  readiness_id: string | null;
  visit_start_time: string;
  confirmation_code: string;
  customer_name: string;
  business_line: string;
  product_display_name: string;
  requires_mpwr: boolean | null;
  mpwr_confirmation_number: string | null;
  mpwr_reservation_url: string | null;
  handoff_status: string | null;
};

type TourReturnException = {
  store_visit_id: string;
  readiness_id: string | null;
  confirmation_code: string;
  customer_name: string;
  product_display_name: string;
  visit_start_time: string;
  visit_date: string;
  vehicle_slot: number;
  vehicle_label: string | null;
  checkout_status: string;
  checkin_status: string;
};

async function getEmailIncidents() {
  return rest<EmailIncident>("guest_email_delivery_incidents", new URLSearchParams({
    select: "id,confirmation_code,recipient_email,failure_type,failure_detail,status,created_at",
    status: "neq.resolved",
    order: "created_at.desc",
    limit: "100",
  }));
}

async function getMissingMpwr() {
  const rows = await rest<ReadinessException>("guest_readiness_with_handoff_v", new URLSearchParams({
    select: "readiness_id,visit_start_time,confirmation_code,customer_name,business_line,product_display_name,requires_mpwr,mpwr_confirmation_number,mpwr_reservation_url,handoff_status",
    requires_mpwr: "eq.true",
    order: "visit_start_time.asc",
    limit: "500",
  }));

  const terminal = new Set(["checked_in", "tour_returned", "rental_out", "rental_returned"]);
  return rows.filter((row) => {
    if (row.handoff_status && terminal.has(row.handoff_status)) return false;
    return !row.mpwr_confirmation_number?.trim() && !row.mpwr_reservation_url?.trim();
  });
}

async function getTourReturnExceptions() {
  const today = mountainDateString();
  const rows = await rest<TourReturnException>("tour_vehicle_dispatch_roster_v", new URLSearchParams({
    select: "store_visit_id,readiness_id,confirmation_code,customer_name,product_display_name,visit_start_time,visit_date,vehicle_slot,vehicle_label,checkout_status,checkin_status",
    visit_date: `lt.${today}`,
    checkout_status: "eq.out",
    order: "visit_date.desc,visit_start_time.desc,confirmation_code.asc,vehicle_slot.asc",
    limit: "200",
  }));

  const complete = new Set(["returned", "completed", "checked_in"]);
  return rows.filter((row) => !complete.has(row.checkin_status));
}

async function getGuestNames(confirmationCodes: string[]) {
  if (!confirmationCodes.length) return new Map<string, string>();

  const quotedCodes = confirmationCodes.map((code) => `"${code.replace(/"/g, "\\\"")}"`).join(",");
  const rows = await rest<{ confirmation_code: string; customer_name: string | null }>(
    "guest_communications",
    new URLSearchParams({
      select: "confirmation_code,customer_name",
      confirmation_code: `in.(${quotedCodes})`,
      communication_type: "eq.initial_guest_portal",
      limit: "500",
    }),
  );
  return new Map(rows.filter((row) => row.customer_name?.trim()).map((row) => [row.confirmation_code, row.customer_name!.trim()]));
}

const sectionStyle = { background: "#fff", border: "1px solid #dfe4e9", borderRadius: 14, overflow: "hidden", marginBottom: 18 } as const;
const sectionHeadStyle = { padding: "18px 20px", borderBottom: "1px solid #e6e9ed", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 } as const;
const badgeStyle = { minWidth: 28, height: 28, padding: "0 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#fff1ef", color: "#a73b2e", fontWeight: 800 } as const;
const rowStyle = { display: "grid", gridTemplateColumns: "190px minmax(320px, 1fr) auto", gap: 24, alignItems: "center", padding: "20px", borderBottom: "1px solid #eef0f2" } as const;
const actionStyle = { whiteSpace: "nowrap", background: "#fff", border: "1px solid #c8d0d7", borderRadius: 8, padding: "10px 14px", color: "#26313b", fontWeight: 850, textDecoration: "none" } as const;

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ padding: 20, margin: 0, color: "#6f7885" }}>{children}</p>;
}

export default async function ExceptionsPage() {
  let emailIncidents: EmailIncident[] = [];
  let missingMpwr: ReadinessException[] = [];
  let tourReturns: TourReturnException[] = [];
  let guestNames = new Map<string, string>();
  let error = "";

  try {
    [emailIncidents, missingMpwr, tourReturns] = await Promise.all([
      getEmailIncidents(),
      getMissingMpwr(),
      getTourReturnExceptions(),
    ]);
    guestNames = await getGuestNames([...new Set(emailIncidents.map((incident) => incident.confirmation_code))]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load exceptions.";
  }

  const total = emailIncidents.length + missingMpwr.length + tourReturns.length;

  return (
    <div className={styles.page}>
      <TeamSidebar active="Exceptions" />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Exceptions</h1>
            <HeaderClock />
            <p>Operational items that fell outside the normal automated workflow and need attention.</p>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.actionButton} href="/team/readiness">Guest Readiness</Link>
            <Link className={styles.actionButton} href="/team/arrival-board">Arrival Board</Link>
            <Link className={`${styles.actionButton} ${styles.kioskButton}`} href="/kiosk">Kiosk</Link>
            <LogoutButton />
          </div>
        </header>

        <section className={styles.content}>
          {error ? <div className={styles.error}>{error}</div> : null}

          {!error && total === 0 ? (
            <section style={{ ...sectionStyle, padding: 24 }}>
              <strong style={{ color: "#187a45", fontSize: 18 }}>All clear</strong>
              <p style={{ margin: "6px 0 0", color: "#6f7885" }}>No active operational exceptions need attention.</p>
            </section>
          ) : null}

          <section style={sectionStyle}>
            <div style={sectionHeadStyle}>
              <div>
                <strong>Tour Return Exceptions</strong>
                <div style={{ marginTop: 3, color: "#6f7885", fontSize: 13 }}>Prior-day tour vehicles still out or not fully checked in after Tour Dispatch rolled over.</div>
              </div>
              <span style={tourReturns.length ? badgeStyle : { ...badgeStyle, background: "#eef7f1", color: "#187a45" }}>{tourReturns.length}</span>
            </div>
            {tourReturns.length === 0 ? <Empty>No unresolved prior-day tour returns.</Empty> : tourReturns.map((row) => (
              <article key={`${row.store_visit_id}-${row.vehicle_slot}`} style={rowStyle}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{row.customer_name}</div>
                  <strong>{row.confirmation_code}</strong>
                  <div style={{ fontSize: 12, color: "#7b8491", marginTop: 5 }}>{formatVisitDate(row.visit_date)} · Car {row.vehicle_label || row.vehicle_slot}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Tour vehicle was not fully returned</div>
                  <div style={{ marginTop: 4, color: "#394452" }}>{row.product_display_name}</div>
                  <div style={{ marginTop: 6, color: "#a73b2e", fontSize: 13, fontWeight: 650 }}>Checkout: {row.checkout_status} · Check-in: {row.checkin_status}</div>
                </div>
                <Link href={`/team/readiness?confirmation=${encodeURIComponent(row.confirmation_code)}`} style={actionStyle}>Open Reservation</Link>
              </article>
            ))}
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeadStyle}>
              <div>
                <strong>Missing MPWR</strong>
                <div style={{ marginTop: 3, color: "#6f7885", fontSize: 13 }}><code>requires_mpwr = true</code> but no MPWR confirmation or reservation URL is present.</div>
              </div>
              <span style={missingMpwr.length ? badgeStyle : { ...badgeStyle, background: "#eef7f1", color: "#187a45" }}>{missingMpwr.length}</span>
            </div>
            {missingMpwr.length === 0 ? <Empty>No active reservations are missing required MPWR data.</Empty> : missingMpwr.map((row) => (
              <article key={row.readiness_id || `${row.confirmation_code}-${row.visit_start_time}`} style={rowStyle}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{row.customer_name}</div>
                  <strong>{row.confirmation_code}</strong>
                  <div style={{ fontSize: 12, color: "#7b8491", marginTop: 5 }}>{formatMoabTime(row.visit_start_time)}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Required MPWR booking data is missing</div>
                  <div style={{ marginTop: 4, color: "#394452" }}>{row.product_display_name} · {row.business_line}</div>
                  <div style={{ marginTop: 6, color: "#a73b2e", fontSize: 13, fontWeight: 650 }}>Rhett/MPWR needs review before this reservation can be considered ready.</div>
                </div>
                <Link href={`/team/readiness?confirmation=${encodeURIComponent(row.confirmation_code)}`} style={actionStyle}>Open Reservation</Link>
              </article>
            ))}
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeadStyle}>
              <div>
                <strong>Email Delivery Exceptions</strong>
                <div style={{ marginTop: 3, color: "#6f7885", fontSize: 13 }}>Confirmation emails that could not be delivered and still need attention.</div>
              </div>
              <span style={emailIncidents.length ? badgeStyle : { ...badgeStyle, background: "#eef7f1", color: "#187a45" }}>{emailIncidents.length}</span>
            </div>
            {emailIncidents.length === 0 ? <Empty>No unresolved email delivery problems.</Empty> : emailIncidents.map((incident) => (
              <article key={incident.id} style={rowStyle}>
                <div>
                  {guestNames.get(incident.confirmation_code) ? <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{guestNames.get(incident.confirmation_code)}</div> : null}
                  <strong>{incident.confirmation_code}</strong>
                  <div style={{ fontSize: 12, color: "#7b8491", marginTop: 5 }}>{formatMoabTime(incident.created_at)}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Email delivery problem</div>
                  <div style={{ marginTop: 4, color: "#394452" }}>Confirmation email could not be delivered to <strong>{incident.recipient_email || "the guest"}</strong>.</div>
                  <div style={{ marginTop: 6, color: "#a73b2e", fontSize: 13, fontWeight: 650 }}>Check the guest&apos;s email address and resend the confirmation.</div>
                </div>
                <Link href={`/team/readiness?confirmation=${encodeURIComponent(incident.confirmation_code)}`} style={actionStyle}>Open Reservation</Link>
              </article>
            ))}
          </section>
        </section>
      </main>
    </div>
  );
}
