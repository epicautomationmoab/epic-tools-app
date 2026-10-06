import Link from "next/link";
import TeamSidebar from "../TeamSidebar";
import HeaderClock from "../readiness/HeaderClock";
import LogoutButton from "../readiness/LogoutButton";
import ExceptionAction from "./ExceptionAction";
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

type EmailIncident = {
  id: string;
  confirmation_code: string;
  recipient_email: string | null;
  status: string;
  created_at: string;
};

type JobRow = {
  id: string;
  confirmation_code: string;
  mpwr_confirmation_number: string | null;
  mpwr_reservation_url: string | null;
  status: string;
  result_message: string | null;
  last_error: string | null;
  attempts: number | null;
  updated_at: string;
};

async function getEmailIncidents() {
  return rest<EmailIncident>("guest_email_delivery_incidents", new URLSearchParams({
    select: "id,confirmation_code,recipient_email,status,created_at",
    status: "neq.resolved",
    order: "created_at.desc",
    limit: "100",
  }));
}

async function getLatestJobs(table: "cassie_mpwr_jobs" | "victor_deposit_jobs") {
  const rows = await rest<JobRow>(table, new URLSearchParams({
    select: "id,confirmation_code,mpwr_confirmation_number,mpwr_reservation_url,status,result_message,last_error,attempts,updated_at",
    order: "updated_at.desc",
    limit: "1000",
  }));

  const latestByConfirmation = new Map<string, JobRow>();
  for (const row of rows) {
    if (!row.confirmation_code || latestByConfirmation.has(row.confirmation_code)) continue;
    latestByConfirmation.set(row.confirmation_code, row);
  }

  return [...latestByConfirmation.values()].filter((row) =>
    row.status === "failed" || row.status === "needs_review"
  );
}

type ResolutionRow = { source_type: "payment" | "deposit_release" | "email_delivery"; source_id: string; confirmation_code: string | null; original_status: string | null; original_message: string | null; resolved_by_name: string | null; resolved_at: string; };

async function getResolutions() {
  return rest<ResolutionRow>("operational_exception_resolutions", new URLSearchParams({
    select: "source_type,source_id,confirmation_code,original_status,original_message,resolved_by_name,resolved_at",
    order: "resolved_at.desc",
    limit: "200",
  }));
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

  return new Map(
    rows
      .filter((row) => row.customer_name?.trim())
      .map((row) => [row.confirmation_code, row.customer_name!.trim()]),
  );
}

const sectionStyle = {
  background: "#fff",
  border: "1px solid #dfe4e9",
  borderRadius: 14,
  overflow: "hidden",
  marginBottom: 18,
} as const;

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "190px minmax(300px, 1fr) auto",
  gap: 24,
  alignItems: "center",
  padding: "20px",
  borderBottom: "1px solid #eef0f2",
} as const;

function CountBadge({ count }: { count: number }) {
  return (
    <span style={{
      minWidth: 28,
      height: 28,
      padding: "0 8px",
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: count ? "#fff1ef" : "#eef7f1",
      color: count ? "#a73b2e" : "#187a45",
      fontWeight: 850,
    }}>
      {count}
    </span>
  );
}

function SectionHeader({ title, description, count }: { title: string; description: string; count: number }) {
  return (
    <div style={{ padding: "17px 20px", borderBottom: "1px solid #e6e9ed", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 900, color: "#202733" }}>{title}</div>
        <div style={{ marginTop: 3, color: "#6f7885", fontSize: 13 }}>{description}</div>
      </div>
      <CountBadge count={count} />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ padding: 20, margin: 0, color: "#6f7885" }}>{children}</p>;
}

function JobExceptionRow({ row, guestName, label, sourceType }: { row: JobRow; guestName?: string; label: string; sourceType: "payment" | "deposit_release" }) {
  const detail = row.last_error?.trim() || row.result_message?.trim() || "The automation did not complete normally.";
  return (
    <article style={rowStyle}>
      <div>
        {guestName ? <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{guestName}</div> : null}
        {row.mpwr_confirmation_number ? (
          row.mpwr_reservation_url ? (
            <a
              href={row.mpwr_reservation_url}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 16, fontWeight: 850, color: "#315f8a", textDecoration: "underline" }}
            >
              {row.mpwr_confirmation_number} ↗ MPWR
            </a>
          ) : (
            <strong style={{ fontSize: 16 }}>{row.mpwr_confirmation_number}</strong>
          )
        ) : (
          <strong style={{ fontSize: 16 }}>MPWR reservation unavailable</strong>
        )}
        <div style={{ fontSize: 12, color: "#7b8491", marginTop: 5 }}>{formatMoabTime(row.updated_at)}</div>
      </div>
      <div>
        <div style={{ fontWeight: 850, fontSize: 16 }}>{label}</div>
        <div style={{ marginTop: 4, color: "#394452" }}>{detail}</div>
        <div style={{ marginTop: 6, color: "#a73b2e", fontSize: 13, fontWeight: 700 }}>
          Status: {row.status === "needs_review" ? "Needs review" : "Failed"}{row.attempts ? ` · ${row.attempts} attempt${row.attempts === 1 ? "" : "s"}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Link
          href={`/team/previous-guests?q=${encodeURIComponent(row.mpwr_confirmation_number || row.confirmation_code)}`}
          style={{ whiteSpace: "nowrap", background: "#fff", border: "1px solid #c8d0d7", borderRadius: 8, padding: "10px 14px", color: "#26313b", fontWeight: 850, textDecoration: "none", textAlign: "center" }}
        >
          Guest Lookup
        </Link>
        <ExceptionAction sourceType={sourceType} sourceId={row.id} />
      </div>
    </article>
  );
}

export default async function ExceptionsPage() {
  let emailIncidents: EmailIncident[] = [];
  let paymentExceptions: JobRow[] = [];
  let depositExceptions: JobRow[] = [];
  let guestNames = new Map<string, string>();
  let resolutions: ResolutionRow[] = [];
  let error = "";

  try {
    [emailIncidents, paymentExceptions, depositExceptions, resolutions] = await Promise.all([
      getEmailIncidents(),
      getLatestJobs("cassie_mpwr_jobs"),
      getLatestJobs("victor_deposit_jobs"),
      getResolutions(),
    ]);

    const confirmationCodes = [...new Set([
      ...emailIncidents.map((row) => row.confirmation_code),
      ...paymentExceptions.map((row) => row.confirmation_code),
      ...depositExceptions.map((row) => row.confirmation_code),
    ].filter(Boolean))];
    guestNames = await getGuestNames(confirmationCodes);
    const resolvedKeys = new Set(resolutions.map((row) => `${row.source_type}:${row.source_id}`));
    paymentExceptions = paymentExceptions.filter((row) => !resolvedKeys.has(`payment:${row.id}`));
    depositExceptions = depositExceptions.filter((row) => !resolvedKeys.has(`deposit_release:${row.id}`));
    emailIncidents = emailIncidents.filter((row) => !resolvedKeys.has(`email_delivery:${row.id}`));

    if (process.env.VERCEL_ENV === "preview" && !resolvedKeys.has("payment:preview-test-exception")) {
      paymentExceptions.unshift({
        id: "preview-test-exception",
        confirmation_code: "PREVIEW-TEST",
        mpwr_confirmation_number: "CO-PREVIEW-TEST",
        mpwr_reservation_url: null,
        status: "failed",
        result_message: "Preview-only test exception for validating the Mark Fixed workflow.",
        last_error: null,
        attempts: 1,
        updated_at: new Date().toISOString(),
      });
      guestNames.set("PREVIEW-TEST", "Preview Test Guest");
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load exceptions.";
  }

  const total = emailIncidents.length + paymentExceptions.length + depositExceptions.length;

  return (
    <div className={styles.page}>
      <TeamSidebar active="Exceptions" />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Exceptions</h1>
            <HeaderClock />
            <p>Only items where an automated workflow failed or needs review.</p>
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

          {!error ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "15px 18px", marginBottom: 18, border: "1px solid #dfe4e9", borderRadius: 14, background: total ? "#fff" : "#f4fbf6" }}>
              <div>
                <div style={{ fontWeight: 900, color: total ? "#202733" : "#187a45" }}>{total ? "Active Exceptions" : "All clear"}</div>
                <div style={{ marginTop: 3, color: "#6f7885", fontSize: 13 }}>
                  {total ? "These items still need attention." : "No active payment, deposit-release, or email-delivery exceptions."}
                </div>
              </div>
              <CountBadge count={total} />
            </div>
          ) : null}

          <section style={sectionStyle}>
            <SectionHeader
              title="Payment Exceptions"
              description="Cassie payment settlements whose latest job failed or needs review."
              count={paymentExceptions.length}
            />
            {paymentExceptions.length === 0 ? <Empty>No active payment exceptions.</Empty> : paymentExceptions.map((row) => (
              <JobExceptionRow key={`payment-${row.id}`} row={row} guestName={guestNames.get(row.confirmation_code)} label="Payment settlement did not complete" sourceType="payment" />
            ))}
          </section>

          <section style={sectionStyle}>
            <SectionHeader
              title="Security Deposit Release Exceptions"
              description="Victor deposit releases whose latest job failed or needs review."
              count={depositExceptions.length}
            />
            {depositExceptions.length === 0 ? <Empty>No active security deposit release exceptions.</Empty> : depositExceptions.map((row) => (
              <JobExceptionRow key={`deposit-${row.id}`} row={row} guestName={guestNames.get(row.confirmation_code)} label="Security deposit release did not complete" sourceType="deposit_release" />
            ))}
          </section>

          <section style={sectionStyle}>
            <SectionHeader
              title="Email Delivery Exceptions"
              description="Confirmation emails that could not be delivered and still need attention."
              count={emailIncidents.length}
            />
            {emailIncidents.length === 0 ? <Empty>No unresolved email delivery problems.</Empty> : emailIncidents.map((incident) => (
              <article key={incident.id} style={rowStyle}>
                <div>
                  {guestNames.get(incident.confirmation_code) ? (
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{guestNames.get(incident.confirmation_code)}</div>
                  ) : null}
                  <strong style={{ fontSize: 16 }}>{incident.confirmation_code}</strong>
                  <div style={{ fontSize: 12, color: "#7b8491", marginTop: 5 }}>{formatMoabTime(incident.created_at)}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 850, fontSize: 16 }}>Email delivery problem</div>
                  <div style={{ marginTop: 4, color: "#394452" }}>Confirmation email could not be delivered to <strong>{incident.recipient_email || "the guest"}</strong>.</div>
                  <div style={{ marginTop: 6, color: "#315f8a", fontSize: 13, fontWeight: 700 }}>Check the guest&apos;s email address and resend the confirmation.</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Link
                    href={`/team/previous-guests?q=${encodeURIComponent(incident.confirmation_code)}`}
                    style={{ whiteSpace: "nowrap", background: "#fff", border: "1px solid #c8d0d7", borderRadius: 8, padding: "10px 14px", color: "#26313b", fontWeight: 850, textDecoration: "none", textAlign: "center" }}
                  >
                    Guest Lookup
                  </Link>
                  <ExceptionAction sourceType="email_delivery" sourceId={incident.id} />
                </div>
              </article>
            ))}
          </section>

          <details style={{ ...sectionStyle, padding: 0 }}>
            <summary style={{ cursor: "pointer", padding: "17px 20px", fontWeight: 900, color: "#202733" }}>
              Resolved History ({resolutions.length})
            </summary>
            {resolutions.length === 0 ? <Empty>No manually resolved exceptions yet.</Empty> : resolutions.map((row) => (
              <article key={`${row.source_type}-${row.source_id}`} style={{ ...rowStyle, gridTemplateColumns: "190px minmax(300px, 1fr)" }}>
                <div>
                  <strong>{row.confirmation_code || "No confirmation"}</strong>
                  <div style={{ fontSize: 12, color: "#7b8491", marginTop: 5 }}>{formatMoabTime(row.resolved_at)}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 850 }}>{row.source_type === "payment" ? "Payment" : row.source_type === "deposit_release" ? "Security Deposit Release" : "Email Delivery"} · Manually Fixed</div>
                  <div style={{ marginTop: 4, color: "#394452" }}>{row.original_message || "No failure detail recorded."}</div>
                  <div style={{ marginTop: 6, color: "#187a45", fontSize: 13, fontWeight: 700 }}>Resolved by {row.resolved_by_name || "EpicTools staff"}</div>
                </div>
              </article>
            ))}
          </details>
        </section>
      </main>
    </div>
  );
}
