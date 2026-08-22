import Link from "next/link";
import TeamSidebar from "../TeamSidebar";
import HeaderClock from "../readiness/HeaderClock";
import LogoutButton from "../readiness/LogoutButton";
import styles from "../readiness/ReadinessShell.module.css";
import { supabaseSelect } from "@/lib/server/supabase-rest";
import CreateDamageCaseCard from "./CreateDamageCaseCard";

type Reservation = {
  id: string;
  confirmation_code: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  business_line: string | null;
  experience_name: string | null;
  start_time: string | null;
  people_count: number | null;
};

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
  }).format(new Date(value));
}

export default async function IncidentDamagePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; beacon?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim().toUpperCase() ?? "";
  const beaconMode = params.beacon === "1";
  let reservation: Reservation | null = null;

  if (q) {
    const rows = await supabaseSelect<Reservation>(
      "operational_reservations",
      new URLSearchParams({
        select: "id,confirmation_code,customer_name,customer_email,customer_phone,business_line,experience_name,start_time,people_count",
        confirmation_code: `eq.${q}`,
        limit: "1",
      }),
    );
    reservation = rows[0] ?? null;
  }

  const cardStyle = {
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 14,
    padding: 18,
    background: "rgba(255,255,255,.04)",
  } as const;

  const inputStyle = {
    minHeight: 44,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(0,0,0,.18)",
    color: "inherit",
    padding: "0 13px",
    fontSize: 16,
    fontWeight: 700,
  } as const;

  return (
    <div className={styles.page}>
      <TeamSidebar active="Incident & Damage" />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Incident & Damage</h1>
            <HeaderClock />
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.actionButton} href="/team/readiness">Guest Readiness</Link>
            <LogoutButton />
          </div>
        </header>

        <section className={styles.content}>
          <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 18 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", opacity: .65, textTransform: "uppercase" }}>
                Find a reservation
              </div>
              <form method="get" style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Confirmation number"
                  autoComplete="off"
                  style={{ ...inputStyle, flex: "1 1 280px" }}
                />
                <button className={styles.actionButton} type="submit">Find</button>
              </form>

              {!reservation ? (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.10)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Beacon activation?</div>
                    <div style={{ opacity: .68, fontSize: 13 }}>You do not need to know the reservation to begin.</div>
                  </div>
                  <Link
                    className={styles.actionButton}
                    href="/team/incident-damage?beacon=1"
                    style={{ borderColor: "rgba(181,36,36,.55)", fontWeight: 900 }}
                  >
                    Beacon Activated
                  </Link>
                </div>
              ) : null}
            </div>

            {beaconMode && !reservation ? (
              <div style={{ ...cardStyle, borderColor: "rgba(181,36,36,.35)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", opacity: .68, textTransform: "uppercase" }}>
                      Beacon Activation Response
                    </div>
                    <h2 style={{ margin: "5px 0 4px" }}>Begin without a reservation</h2>
                    <div style={{ opacity: .72 }}>Capture the incoming activation first. We will identify the vehicle and reservation from the beacon information.</div>
                  </div>
                  <Link className={styles.actionButton} href="/team/incident-damage">Cancel</Link>
                </div>

                <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                  <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
                    Caller / Agency
                    <input style={inputStyle} placeholder="NOAA, Dispatch, SAR..." />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
                    Caller Callback
                    <input style={inputStyle} placeholder="Phone number" />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
                    Beacon ID
                    <input style={inputStyle} placeholder="Beacon ID" autoCapitalize="characters" />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
                    Coordinates
                    <input style={inputStyle} placeholder="Latitude / Longitude" />
                  </label>
                </div>

                <label style={{ display: "grid", gap: 6, fontWeight: 800, marginTop: 12 }}>
                  Other location information
                  <input style={{ ...inputStyle, width: "100%" }} placeholder="Trail, landmark, dispatch notes..." />
                </label>

                <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                  <button className={styles.actionButton} type="button" disabled title="Saving the beacon case is the next build step">
                    Begin Beacon Incident
                  </button>
                </div>
              </div>
            ) : null}

            {q && !reservation ? (
              <div style={{ ...cardStyle, borderColor: "rgba(255,193,7,.45)" }}>
                No reservation found for <strong>{q}</strong>.
              </div>
            ) : null}

            {reservation ? (
              <>
                <div style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", opacity: .65, textTransform: "uppercase" }}>
                        Reservation
                      </div>
                      <h2 style={{ margin: "5px 0 4px" }}>{reservation.customer_name}</h2>
                      <div style={{ opacity: .8 }}>
                        {reservation.confirmation_code} · {reservation.business_line ?? "Business line unknown"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", lineHeight: 1.55 }}>
                      <div>{reservation.experience_name ?? "Experience unavailable"}</div>
                      <div>{formatDate(reservation.start_time)}</div>
                      <div>{reservation.people_count ?? "—"} guests</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                    <div><strong>Phone</strong><br />{reservation.customer_phone ?? "—"}</div>
                    <div><strong>Email</strong><br />{reservation.customer_email ?? "—"}</div>
                    <div>
                      <strong>Vehicle #</strong><br />
                      <span style={{ opacity: .7 }}>
                        {reservation.business_line?.toLowerCase() === "rental"
                          ? "Enter when the case is created"
                          : "Use tour dispatch when available"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 style={{ margin: "4px 0 12px" }}>What are we dealing with?</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
                    <div style={cardStyle}>
                      <h3 style={{ marginTop: 0 }}>Returned With Damage</h3>
                      <p style={{ opacity: .75, minHeight: 48 }}>Guest returned normally, but the vehicle has damage that needs documentation and repair follow-up.</p>
                      <CreateDamageCaseCard confirmationCode={reservation.confirmation_code} />
                    </div>
                    <div style={cardStyle}>
                      <h3 style={{ marginTop: 0 }}>On-Trail Problem / Recovery</h3>
                      <p style={{ opacity: .75, minHeight: 48 }}>Guest, guide, or staff reports a trail problem requiring intake, support, recovery, or incident documentation.</p>
                      <button className={styles.actionButton} type="button" disabled title="Trail response wiring comes after the damage documentation path">Start Trail Response</button>
                    </div>
                    <div style={cardStyle}>
                      <h3 style={{ marginTop: 0 }}>Beacon Activation</h3>
                      <p style={{ opacity: .75, minHeight: 48 }}>Begin the structured NOAA / PLB response workflow and Incident Commander process.</p>
                      <Link className={styles.actionButton} href="/team/incident-damage?beacon=1">Start Beacon Response</Link>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
