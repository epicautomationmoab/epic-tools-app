import Link from "next/link";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function getIncidents() {
  const rawUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  const key = requiredEnv("SUPABASE_SECRET_KEY");
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

export default async function EmailDeliveryPage() {
  let incidents: Awaited<ReturnType<typeof getIncidents>> = [];
  let error = "";
  try {
    incidents = await getIncidents();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load email delivery problems.";
  }

  const active = incidents.filter((incident) => incident.status !== "resolved");

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6f8", color: "#18202b", padding: "32px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, marginBottom: 24 }}>
          <div>
            <p style={{ margin: "0 0 5px", color: "#d5521d", fontWeight: 800, fontSize: 13 }}>EPIC TOOLS</p>
            <h1 style={{ margin: 0, fontSize: 34 }}>Email Delivery</h1>
            <p style={{ margin: "7px 0 0", color: "#6f7885" }}>Confirmation emails that could not be delivered and need the team&apos;s attention.</p>
          </div>
          <Link href="/team/readiness" style={{ background: "#fff", border: "1px solid #dce1e7", borderRadius: 9, padding: "11px 16px", color: "#202834", fontWeight: 800, textDecoration: "none" }}>Back to Guest Readiness</Link>
        </div>

        {error ? <div style={{ background: "#fff1ef", color: "#a73b2e", border: "1px solid #f0c0b9", borderRadius: 10, padding: 14 }}>{error}</div> : null}

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
                <strong style={{ fontSize: 16 }}>{incident.confirmation_code}</strong>
                <div style={{ fontSize: 12, color: "#7b8491", marginTop: 5 }}>{new Date(incident.created_at).toLocaleString()}</div>
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
      </div>
    </main>
  );
}
