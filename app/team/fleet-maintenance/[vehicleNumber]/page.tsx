import Link from "next/link";
import { notFound } from "next/navigation";
import TeamSidebar from "../../TeamSidebar";
import { getFleetIncidentCases, getFleetVehicle } from "@/lib/fleet-maintenance";
import styles from "../../readiness/ReadinessShell.module.css";

function fmt(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default async function FleetVehiclePage({ params }: { params: Promise<{ vehicleNumber: string }> }) {
  const { vehicleNumber } = await params;
  const n = Number(vehicleNumber);
  if (!Number.isInteger(n)) notFound();
  const [v, cases] = await Promise.all([getFleetVehicle(n), getFleetIncidentCases(n)]);
  if (!v) notFound();

  return (
    <div className={styles.page}>
      <TeamSidebar active="Fleet Maintenance" />
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <Link href="/team/fleet-maintenance" style={{ textDecoration:"none", color:"#6f7883", fontWeight:800 }}>← Fleet</Link>
              <h1 style={{ margin:0 }}>Vehicle #{v.vehicle_number}</h1>
            </div>
            <div style={{ color:"#7a8490", fontSize:13, marginTop:5 }}>{v.model_year} {v.model_family}</div>
          </div>
        </header>

        <section className={styles.content}>
          <div style={{ display:"grid", gridTemplateColumns:"1.2fr .8fr", gap:18 }}>
            <section style={card}>
              <h2 style={{ marginTop:0 }}>Vehicle Record</h2>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:12 }}>
                <Field label="Vehicle Number" value={String(v.vehicle_number)} />
                <Field label="Model" value={v.model_family} />
                <Field label="VIN" value={v.vin || "Not entered"} muted={!v.vin} />
                <Field label="M Power Reference" value={v.mpwr_vehicle_reference || "Not linked"} muted={!v.mpwr_vehicle_reference} />
                <Field label="Current Mileage" value={v.current_mileage == null ? "Not entered" : v.current_mileage.toLocaleString()} muted={v.current_mileage == null} />
                <Field label="Engine Hours" value={v.current_engine_hours == null ? "Not entered" : String(v.current_engine_hours)} muted={v.current_engine_hours == null} />
              </div>
            </section>

            <aside style={card}>
              <h2 style={{ marginTop:0 }}>Current Status</h2>
              <div style={{ fontSize:28, fontWeight:900 }}>{fmt(v.operational_status)}</div>
              <div style={{ color:"#68717d", marginTop:6 }}>{v.status_reason || "No status note yet."}</div>
              <div style={{ borderTop:"1px solid #e3e6ea", margin:"18px 0" }} />
              <Field label="Service Status" value={fmt(v.service_status)} />
              <Field label="Weekly Inspection" value={fmt(v.inspection_status)} />
              <Field label="Iron Jack Inventory" value={v.on_ride ? "On-Ride" : fmt(v.booking_inventory_state)} />
            </aside>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:18, marginTop:18 }}>
            <section style={card}>
              <div style={sectionKicker}>SCHEDULED MAINTENANCE</div>
              <h3 style={{ margin:"5px 0 14px", fontSize:22 }}>1,000-Mile Service</h3>
              <Field label="Last Service Mileage" value={v.last_service_mileage == null ? "Not entered" : v.last_service_mileage.toLocaleString()} muted={v.last_service_mileage == null} />
              <Field label="Miles Until Service" value={v.miles_until_service == null ? "Waiting for mileage" : String(v.miles_until_service)} muted={v.miles_until_service == null} />
              <div style={placeholder}>Service checklist and completion history will live here.</div>
            </section>

            <section style={card}>
              <div style={sectionKicker}>WEEKLY INSPECTION</div>
              <h3 style={{ margin:"5px 0 14px", fontSize:22 }}>{fmt(v.inspection_status)}</h3>
              <Field label="Last Inspection" value={v.last_weekly_inspection_at ? new Date(v.last_weekly_inspection_at).toLocaleString() : "Never recorded"} muted={!v.last_weekly_inspection_at} />
              <Field label="Next Due" value={v.next_weekly_inspection_due_at ? new Date(v.next_weekly_inspection_due_at).toLocaleDateString() : "Due now"} />
              <div style={placeholder}>Joe's Pass / Fail / N/A checklist will attach here next.</div>
            </section>

            <section style={card}>
              <div style={sectionKicker}>REPAIRS & DAMAGE</div>
              <h3 style={{ margin:"5px 0 14px", fontSize:22 }}>Open Work</h3>
              {cases.length ? (
                <div style={{ display:"grid", gap:9 }}>
                  {cases.slice(0,6).map((item) => (
                    <div key={item.id} style={{ border:"1px solid #e0e4e8", borderRadius:10, padding:11 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                        <strong>{fmt(item.case_type)}</strong>
                        <span style={{ fontSize:11, fontWeight:900, color:item.status==="closed"?"#257248":"#9f5e16" }}>{fmt(item.status)}</span>
                      </div>
                      <div style={{ color:"#6f7883", fontSize:12, marginTop:5 }}>
                        {item.opened_at ? new Date(item.opened_at).toLocaleDateString() : "Date unavailable"}
                        {item.confirmation_code ? ` · Reservation ${item.confirmation_code}` : ""}
                      </div>
                      <div style={{ color:"#8b949e", fontSize:10, marginTop:5 }}>Case {item.id.slice(0,8).toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={placeholder}>No Incident & Damage cases are linked to this vehicle yet.</div>
              )}
              <div style={{ marginTop:12, fontSize:13, color:"#6f7883" }}>New Incident Cases using Vehicle #{v.vehicle_number} will link here automatically.</div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, value, muted=false }: { label:string; value:string; muted?:boolean }) {
  return <div style={{ marginBottom:12 }}><div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".05em", color:"#7a8490", fontWeight:900 }}>{label}</div><div style={{ marginTop:4, fontSize:16, fontWeight:800, color:muted ? "#9aa2ab" : "#20252b" }}>{value}</div></div>;
}

const card: React.CSSProperties = { background:"white", border:"1px solid #e0e4e8", borderRadius:16, padding:20, boxShadow:"0 6px 20px rgba(20,28,36,.05)" };
const sectionKicker: React.CSSProperties = { fontSize:11, color:"#7b8490", fontWeight:900, letterSpacing:".1em" };
const placeholder: React.CSSProperties = { marginTop:14, background:"#f6f7f9", border:"1px dashed #cfd5dc", borderRadius:11, padding:13, color:"#69727e", fontSize:13, lineHeight:1.5 };
