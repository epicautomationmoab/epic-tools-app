import Link from "next/link";
import DeliveryIncidentActions from "./DeliveryIncidentActions";

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
    claimed_by: string | null;
    resolved_by: string | null;
    created_at: string;
    updated_at: string;
  }>>;
}

function displayFailure(type: string) {
  return type.replace(/^email\./, "").replace(/_/g, " ");
}

export default async function EmailDeliveryPage() {
  let incidents: Awaited<ReturnType<typeof getIncidents>> = [];
  let error = "";
  try { incidents = await getIncidents(); } catch (err) { error = err instanceof Error ? err.message : "Unable to load email delivery incidents."; }
  const active = incidents.filter((incident) => incident.status !== "resolved");
  const resolved = incidents.filter((incident) => incident.status === "resolved");

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6f8", color: "#18202b", padding: "32px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, marginBottom: 24 }}>
          <div>
            <p style={{ margin: "0 0 5px", color: "#d5521d", fontWeight: 800, fontSize: 13 }}>EPIC TOOLS</p>
            <h1 style={{ margin: 0, fontSize: 34 }}>Email Delivery</h1>
            <p style={{ margin: "7px 0 0", color: "#6f7885" }}>Guest emails that need attention after Resend reports a delivery problem.</p>
          </div>
          <Link href="/team/readiness" style={{ background: "#fff", border: "1px solid #dce1e7", borderRadius: 9, padding: "11px 16px", color: "#202834", fontWeight: 800, textDecoration: "none" }}>Back to Guest Readiness</Link>
        </div>

        {error ? <div style={{ background: "#fff1ef", color: "#a73b2e", border: "1px solid #f0c0b9", borderRadius: 10, padding: 14 }}>{error}</div> : null}

        <section style={{ background: "#fff", border: "1px solid #dfe4e9", borderRadius: 14, overflow: "hidden", marginBottom: 22 }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #e6e9ed", display: "flex", justifyContent: "space-between" }}>
            <strong>Needs Attention</strong><span>{active.length}</span>
          </div>
          {active.length === 0 ? <p style={{ padding: 20, margin: 0, color: "#6f7885" }}>No active email delivery problems. Everything is clear.</p> : active.map((incident) => (
            <article key={incident.id} style={{ display: "grid", gridTemplateColumns: "150px minmax(220px, 1fr) 150px 180px", gap: 18, alignItems: "center", padding: "17px 20px", borderBottom: "1px solid #eef0f2" }}>
              <div><strong>{incident.confirmation_code}</strong><div style={{ fontSize: 12, color: "#7b8491", marginTop: 4 }}>{new Date(incident.created_at).toLocaleString()}</div></div>
              <div><div style={{ fontWeight: 700 }}>{incident.recipient_email || "Unknown recipient"}</div><div style={{ fontSize: 12, color: "#a73b2e", marginTop: 4 }}>{incident.failure_detail || displayFailure(incident.failure_type)}</div></div>
              <div><span style={{ display: "inline-block", borderRadius: 999, padding: "5px 9px", background: incident.status === "claimed" ? "#fff4d6" : "#fff1ef", color: incident.status === "claimed" ? "#8a6400" : "#a73b2e", fontSize: 12, fontWeight: 800 }}>{incident.status}</span>{incident.claimed_by ? <div style={{ fontSize: 11, color: "#7b8491", marginTop: 5 }}>{incident.claimed_by}</div> : null}</div>
              <DeliveryIncidentActions incidentId={incident.id} status={incident.status} />
            </article>
          ))}
        </section>

        <section style={{ background: "#fff", border: "1px solid #dfe4e9", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #e6e9ed", display: "flex", justifyContent: "space-between" }}><strong>Resolved</strong><span>{resolved.length}</span></div>
          {resolved.slice(0, 25).map((incident) => (
            <article key={incident.id} style={{ display: "grid", gridTemplateColumns: "150px minmax(220px, 1fr) 150px 180px", gap: 18, alignItems: "center", padding: "15px 20px", borderBottom: "1px solid #eef0f2" }}>
              <strong>{incident.confirmation_code}</strong>
              <div><div>{incident.recipient_email || "Unknown recipient"}</div><div style={{ fontSize: 12, color: "#7b8491", marginTop: 4 }}>{displayFailure(incident.failure_type)}</div></div>
              <div><span style={{ color: "#187a45", fontWeight: 800, fontSize: 12 }}>Resolved</span>{incident.resolved_by ? <div style={{ fontSize: 11, color: "#7b8491", marginTop: 5 }}>{incident.resolved_by}</div> : null}</div>
              <DeliveryIncidentActions incidentId={incident.id} status={incident.status} />
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
