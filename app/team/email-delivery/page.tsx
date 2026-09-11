import Link from "next/link";
import TeamSidebar from "../TeamSidebar";
import HeaderClock from "../readiness/HeaderClock";
import TourReturnExceptionActions from "./TourReturnExceptionActions";
import styles from "../readiness/ReadinessShell.module.css";
import exceptionStyles from "./Exceptions.module.css";

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

function quotedIn(values: string[]) {
  return values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
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

type MissingMpwrException = {
  store_visit_id: string;
  visit_start_time: string;
  confirmation_code: string;
  customer_name: string;
  business_line: string;
  product_display_name: string;
  requires_mpwr: boolean;
  mpwr_confirmation_number: string | null;
  mpwr_waiver_url: string | null;
  live_dashboard_visible: boolean;
};

type ReadinessMpwrEvidence = {
  source_store_visit_id: string | null;
  confirmation_code: string;
  mpwr_confirmation_number: string | null;
  mpwr_reservation_url: string | null;
  mpwr_waiver_url: string | null;
};

type QueueMpwrEvidence = {
  confirmation_code: string;
  mpwr_confirmation_number: string | null;
  mpwr_waiver_url: string | null;
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
  const candidates = await rest<MissingMpwrException>("portal_patti_store_visits", new URLSearchParams({
    select: "store_visit_id,visit_start_time,confirmation_code,customer_name,business_line,product_display_name,requires_mpwr,mpwr_confirmation_number,mpwr_waiver_url,live_dashboard_visible",
    requires_mpwr: "eq.true",
    live_dashboard_visible: "eq.true",
    order: "visit_start_time.asc",
    limit: "500",
  }));

  if (!candidates.length) return [];

  const storeVisitIds = [...new Set(candidates.map((row) => row.store_visit_id).filter(Boolean))];
  const confirmationCodes = [...new Set(candidates.map((row) => row.confirmation_code).filter(Boolean))];
  const readinessEvidence: ReadinessMpwrEvidence[] = [];
  const queueEvidence: QueueMpwrEvidence[] = [];

  for (let index = 0; index < storeVisitIds.length; index += 100) {
    const batch = storeVisitIds.slice(index, index + 100);
    readinessEvidence.push(...await rest<ReadinessMpwrEvidence>("guest_readiness_operational", new URLSearchParams({
      select: "source_store_visit_id,confirmation_code,mpwr_confirmation_number,mpwr_reservation_url,mpwr_waiver_url",
      source_store_visit_id: `in.(${quotedIn(batch)})`,
      limit: "1000",
    })));
  }

  for (let index = 0; index < confirmationCodes.length; index += 100) {
    const batch = confirmationCodes.slice(index, index + 100);
    queueEvidence.push(...await rest<QueueMpwrEvidence>("mpwr_agent_queue", new URLSearchParams({
      select: "confirmation_code,mpwr_confirmation_number,mpwr_waiver_url",
      confirmation_code: `in.(${quotedIn(batch)})`,
      limit: "2000",
    })));
  }

  const storeVisitsWithMpwr = new Set(
    readinessEvidence
      .filter((row) => row.mpwr_confirmation_number?.trim() || row.mpwr_reservation_url?.trim() || row.mpwr_waiver_url?.trim())
      .map((row) => row.source_store_visit_id)
      .filter((value): value is string => Boolean(value)),
  );
  const confirmationsWithMpwr = new Set(
    queueEvidence
      .filter((row) => row.mpwr_confirmation_number?.trim() || row.mpwr_waiver_url?.trim())
      .map((row) => row.confirmation_code),
  );

  return candidates.filter((row) =>
    !row.mpwr_confirmation_number?.trim() &&
    !row.mpwr_waiver_url?.trim() &&
    !storeVisitsWithMpwr.has(row.store_visit_id) &&
    !confirmationsWithMpwr.has(row.confirmation_code)
  );
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

  const rows = await rest<{ confirmation_code: string; customer_name: string | null }>(
    "guest_communications",
    new URLSearchParams({
      select: "confirmation_code,customer_name",
      confirmation_code: `in.(${quotedIn(confirmationCodes)})`,
      communication_type: "eq.initial_guest_portal",
      limit: "500",
    }),
  );
  return new Map(rows.filter((row) => row.customer_name?.trim()).map((row) => [row.confirmation_code, row.customer_name!.trim()]));
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className={exceptionStyles.empty}>{children}</p>;
}

function CountBadge({ count }: { count: number }) {
  return <span className={`${exceptionStyles.countBadge} ${count ? exceptionStyles.countActive : exceptionStyles.countClear}`}>{count}</span>;
}

export default async function ExceptionsPage() {
  let emailIncidents: EmailIncident[] = [];
  let missingMpwr: MissingMpwrException[] = [];
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
        </header>

        <section className={styles.content}>
          {error ? <div className={styles.error}>{error}</div> : null}

          {!error && total > 0 ? (
            <div className={exceptionStyles.summaryBar}>
              <div>
                <div className={exceptionStyles.summaryTitle}>Active Exceptions</div>
                <div className={exceptionStyles.summaryText}>Items below still need attention. Resolved items disappear automatically.</div>
              </div>
              <span className={exceptionStyles.summaryCount}>{total}</span>
            </div>
          ) : null}

          {!error && total === 0 ? (
            <section className={exceptionStyles.allClear}>
              <div className={exceptionStyles.allClearTitle}>All clear</div>
              <p className={exceptionStyles.allClearText}>No active operational exceptions need attention.</p>
            </section>
          ) : null}

          <section className={exceptionStyles.section}>
            <div className={`${exceptionStyles.sectionHeader} ${exceptionStyles.returnHeader}`}>
              <div>
                <div className={exceptionStyles.sectionTitle}>Tour Return Exceptions</div>
                <div className={exceptionStyles.sectionDescription}>Prior-day tour vehicles still out or not fully checked in after Tour Dispatch rolled over.</div>
              </div>
              <CountBadge count={tourReturns.length} />
            </div>
            {tourReturns.length === 0 ? <Empty>No unresolved prior-day tour returns.</Empty> : tourReturns.map((row) => (
              <article key={`${row.store_visit_id}-${row.vehicle_slot}`} className={`${exceptionStyles.exceptionRow} ${exceptionStyles.returnRow}`}>
                <div>
                  <div className={exceptionStyles.customerName}>{row.customer_name}</div>
                  <div className={exceptionStyles.confirmation}>{row.confirmation_code}</div>
                  <div className={exceptionStyles.meta}>{formatVisitDate(row.visit_date)} · Car {row.vehicle_label || row.vehicle_slot}</div>
                </div>
                <div>
                  <div className={exceptionStyles.problemTitle}>Tour vehicle was not fully returned</div>
                  <div className={exceptionStyles.detail}>{row.product_display_name}</div>
                  <div className={exceptionStyles.returnStatus}>Checkout: {row.checkout_status} · Check-in: {row.checkin_status}</div>
                </div>
                <TourReturnExceptionActions storeVisitId={row.store_visit_id} vehicleSlot={row.vehicle_slot} checkinStatus={row.checkin_status} />
              </article>
            ))}
          </section>

          <section className={exceptionStyles.section}>
            <div className={`${exceptionStyles.sectionHeader} ${exceptionStyles.mpwrHeader}`}>
              <div>
                <div className={exceptionStyles.sectionTitle}>Missing MPWR</div>
                <div className={exceptionStyles.sectionDescription}><code>requires_mpwr = true</code> and no MPWR booking evidence exists in Patti, Readiness, or Rhett.</div>
              </div>
              <CountBadge count={missingMpwr.length} />
            </div>
            {missingMpwr.length === 0 ? <Empty>No active reservations are missing required MPWR data.</Empty> : missingMpwr.map((row) => (
              <article key={row.store_visit_id || `${row.confirmation_code}-${row.visit_start_time}`} className={`${exceptionStyles.exceptionRow} ${exceptionStyles.mpwrRow}`}>
                <div>
                  <div className={exceptionStyles.customerName}>{row.customer_name}</div>
                  <div className={exceptionStyles.confirmation}>{row.confirmation_code}</div>
                  <div className={exceptionStyles.meta}>{formatMoabTime(row.visit_start_time)}</div>
                </div>
                <div>
                  <div className={exceptionStyles.problemTitle}>Required MPWR booking data is missing</div>
                  <div className={exceptionStyles.detail}>{row.product_display_name} · {row.business_line}</div>
                  <div className={exceptionStyles.mpwrStatus}>Rhett/MPWR needs review before this reservation can be considered ready.</div>
                </div>
                <Link href={`/team/readiness?confirmation=${encodeURIComponent(row.confirmation_code)}`} className={exceptionStyles.actionLink}>Open Reservation</Link>
              </article>
            ))}
          </section>

          <section className={exceptionStyles.section}>
            <div className={`${exceptionStyles.sectionHeader} ${exceptionStyles.emailHeader}`}>
              <div>
                <div className={exceptionStyles.sectionTitle}>Email Delivery Exceptions</div>
                <div className={exceptionStyles.sectionDescription}>Confirmation emails that could not be delivered and still need attention.</div>
              </div>
              <CountBadge count={emailIncidents.length} />
            </div>
            {emailIncidents.length === 0 ? <Empty>No unresolved email delivery problems.</Empty> : emailIncidents.map((incident) => (
              <article key={incident.id} className={`${exceptionStyles.exceptionRow} ${exceptionStyles.emailRow}`}>
                <div>
                  {guestNames.get(incident.confirmation_code) ? <div className={exceptionStyles.customerName}>{guestNames.get(incident.confirmation_code)}</div> : null}
                  <div className={exceptionStyles.confirmation}>{incident.confirmation_code}</div>
                  <div className={exceptionStyles.meta}>{formatMoabTime(incident.created_at)}</div>
                </div>
                <div>
                  <div className={exceptionStyles.problemTitle}>Email delivery problem</div>
                  <div className={exceptionStyles.detail}>Confirmation email could not be delivered to <strong>{incident.recipient_email || "the guest"}</strong>.</div>
                  <div className={exceptionStyles.emailStatus}>Check the guest&apos;s email address and resend the confirmation.</div>
                </div>
                <Link href={`/team/readiness?confirmation=${encodeURIComponent(incident.confirmation_code)}`} className={exceptionStyles.actionLink}>Open Reservation</Link>
              </article>
            ))}
          </section>
        </section>
      </main>
    </div>
  );
}
