import Link from "next/link";
import HeaderClock from "../readiness/HeaderClock";
import LogoutButton from "../readiness/LogoutButton";
import styles from "../readiness/ReadinessShell.module.css";

const navItems = [
  { label: "Guest Readiness", href: "/team/readiness", external: false },
  { label: "Previous Guest Lookup", href: "/team/previous-guests", external: false },
  { label: "Email Delivery", href: "/team/email-delivery", external: false },
  { label: "Reservations", href: "https://epic4x4.tripworks.com", external: true },
  { label: "MPWR", href: "https://mpwr-hq.poladv.com/orders", external: true },
] as const;

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

function formatMoabTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

async function getIncidents() {
  const { url, key } = getSupabaseConfig();
  const params = new URLSearchParams({ select: "*", order: "created_at.desc", limit: "100" });
  const response = await fetch(`${url}/rest/v1/guest_email_delivery_incidents?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load email delivery incidents: ${await response.text()}`);
  return response.json() as Promise<Array<{
    id: string;
    confirmation_code: string;
    recipient_email: string | null;
    failure_type: string;
    failure_detail: string | null;
    status: string;
    created_at: string;
  }>>;
}

async function getGuestNames(confirmationCodes: string[]) {
  if (!confirmationCodes.length) return new Map<string, string>();

  const { url, key } = getSupabaseConfig();
  const quotedCodes = confirmationCodes.map((code) => `"${code.replace(/"/g, "\\\"")}"`).join(",");
  const params = new URLSearchParams({
    select: "confirmation_code,customer_name",
    confirmation_code: `in.(${quotedCodes})`,
    communication_type: "eq.initial_guest_portal",
  });
  const response = await fetch(`${url}/rest/v1/guest_communications?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load guest names: ${await response.text()}`);

  const rows = (await response.json()) as Array<{ confirmation_code: string; customer_name: string | null }>;
  return new Map(rows.filter((row) => row.customer_name?.trim()).map((row) => [row.confirmation_code, row.customer_name!.trim()]));
}

export default async function EmailDeliveryPage() {
  let incidents: Awaited<ReturnType<typeof getIncidents>> = [];
  let guestNames = new Map<string, string>();
  let error = "";
  try {
    incidents = await getIncidents();
    guestNames = await getGuestNames([...new Set(incidents.map((incident) => incident.confirmation_code))]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load email delivery problems.";
  }

  const active = incidents.filter((incident) => incident.status !== "resolved");

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" />
        </div>

        <nav className={styles.nav} aria-label="EpicTools navigation">
          {navItems.map((item) => {
            const className = item.label === "Email Delivery" ? styles.active : undefined;
            const content = <><span aria-hidden="true">◇</span>{item.label}</>;
            return item.external ? (
              <a key={item.label} href={item.href} className={className} target="_blank" rel="noreferrer">{content}</a>
            ) : (
              <Link key={item.label} href={item.href} className={className}>{content}</Link>
            );
          })}
        </nav>

        <div className={styles.sidebarPhoto} />
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Email Delivery</h1>
            <HeaderClock />
            <p>Confirmation emails that could not be delivered and need the team&apos;s attention.</p>
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

          <section style={{ background: "#fff", border: "1px solid #dfe4e9", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: active.length ? "1px solid #e6e9ed" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Needs Attention</strong>
              <span style={{ minWidth: 28, height: 28, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: active.length ? "#fff1ef" : "#eef7f1", color: active.length ? "#a73b2e" : "#187a45", fontWeight: 800 }}>{active.length}</span>
            </div>

            {active.length === 0 ? (
              <p style={{ padding: 20, margin: 0, color: "#6f7885" }}>No email delivery problems. Everything is clear.</p>
            ) : active.map((incident) => (
              <article key={incident.id} style={{ display: "grid", gridTemplateColumns: "170px minmax(300px, 1fr) auto", gap: 24, alignItems: "center", padding: "22px 20px", borderBottom: "1px solid #eef0f2" }}>
                <div>
                  {guestNames.get(incident.confirmation_code) ? (
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{guestNames.get(incident.confirmation_code)}</div>
                  ) : null}
                  <strong style={{ fontSize: 16 }}>{incident.confirmation_code}</strong>
                  <div style={{ fontSize: 12, color: "#7b8491", marginTop: 5 }}>{formatMoabTime(incident.created_at)}</div>
                </div>

                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Email Delivery Problem</div>
                  <div style={{ marginTop: 4, color: "#394452" }}>Confirmation email could not be delivered to <strong>{incident.recipient_email || "the guest"}</strong>.</div>
                  <div style={{ marginTop: 6, color: "#a73b2e", fontSize: 13, fontWeight: 650 }}>Check the guest&apos;s email address and resend the confirmation.</div>
                </div>

                <Link
                  href={`/team/readiness?confirmation=${encodeURIComponent(incident.confirmation_code)}`}
                  style={{ whiteSpace: "nowrap", background: "#fff", border: "1px solid #c8d0d7", borderRadius: 8, padding: "10px 14px", color: "#26313b", fontWeight: 850, textDecoration: "none" }}
                >
                  Open Reservation
                </Link>
              </article>
            ))}
          </section>
        </section>
      </main>
    </div>
  );
}
