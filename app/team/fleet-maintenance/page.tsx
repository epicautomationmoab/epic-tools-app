import Link from "next/link";
import TeamSidebar from "../TeamSidebar";
import { getFleetVehicles } from "@/lib/fleet-maintenance";
import styles from "../readiness/ReadinessShell.module.css";

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function tone(status: string) {
  if (["out_of_service","overdue","due"].includes(status)) return { bg:"#fff0ee", fg:"#9f2f24", bd:"#efc5bf" };
  if (["repair","waiting_for_parts","upcoming","due_soon"].includes(status)) return { bg:"#fff8e9", fg:"#946313", bd:"#ead39d" };
  if (["available","current","not_due"].includes(status)) return { bg:"#effbf4", fg:"#257248", bd:"#bfe3cd" };
  return { bg:"#f3f5f7", fg:"#68717c", bd:"#dce1e6" };
}

export default async function FleetMaintenancePage() {
  const vehicles = await getFleetVehicles();

  const counts = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.operational_status === "available").length,
    serviceDue: vehicles.filter((v) => ["due","upcoming"].includes(v.service_status)).length,
    inspectionsDue: vehicles.filter((v) => ["due","overdue","due_soon"].includes(v.inspection_status)).length,
    repair: vehicles.filter((v) => ["repair","waiting_for_parts","out_of_service"].includes(v.operational_status)).length,
    setup: vehicles.filter((v) => v.operational_status === "setup_needed").length,
  };

  return (
    <div className={styles.page}>
      <TeamSidebar active="Fleet Maintenance" />
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <h1>Fleet Maintenance</h1>
            <div style={{ color:"#7a8490", fontSize:13, marginTop:4 }}>2027 Fleet · Vehicles 1–72</div>
          </div>
        </header>

        <section className={styles.content}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,minmax(0,1fr))", gap:12, marginBottom:18 }}>
            {[
              ["Fleet", counts.total],
              ["Available", counts.available],
              ["Service Due", counts.serviceDue],
              ["Inspection Due", counts.inspectionsDue],
              ["Repair / OOS", counts.repair],
              ["Setup Needed", counts.setup],
            ].map(([label,value]) => (
              <div key={String(label)} style={{ background:"white", border:"1px solid #e0e4e8", borderRadius:14, padding:15 }}>
                <div style={{ fontSize:11, fontWeight:900, textTransform:"uppercase", color:"#7a8490" }}>{label}</div>
                <div style={{ fontSize:30, fontWeight:900, marginTop:4 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ background:"white", border:"1px solid #e0e4e8", borderRadius:16, overflow:"hidden" }}>
            <div style={{ padding:"16px 18px", borderBottom:"1px solid #e7eaee", display:"flex", justifyContent:"space-between", gap:20, alignItems:"center" }}>
              <div>
                <div style={{ fontSize:19, fontWeight:900 }}>Fleet Registry</div>
                <div style={{ color:"#6f7883", fontSize:13, marginTop:3 }}>Mileage, service, inspections, readiness, repairs, and future M Power links all hang from these vehicle records.</div>
              </div>
              <div style={{ fontSize:13, color:"#6f7883" }}>Click any vehicle to open its maintenance record.</div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(6,minmax(0,1fr))", gap:10, padding:14 }}>
              {vehicles.map((v) => {
                const op = tone(v.operational_status);
                const svc = tone(v.service_status);
                const ins = tone(v.inspection_status);
                return (
                  <Link
                    key={v.id}
                    href={`/team/fleet-maintenance/${v.vehicle_number}`}
                    style={{ textDecoration:"none", color:"inherit", border:"1px solid #dde2e7", borderRadius:13, padding:13, background:"#fff", minHeight:150 }}
                  >
                    <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"start" }}>
                      <div>
                        <div style={{ fontSize:26, fontWeight:900 }}>#{v.vehicle_number}</div>
                        <div style={{ fontSize:13, fontWeight:800, marginTop:2 }}>{v.model_family}</div>
                      </div>
                      <span style={{ ...pill, background:op.bg, color:op.fg, borderColor:op.bd }}>{labelize(v.operational_status)}</span>
                    </div>

                    <div style={{ marginTop:14, display:"grid", gap:7, fontSize:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                        <span style={{ color:"#7a8490" }}>Mileage</span>
                        <strong>{v.current_mileage == null ? "—" : v.current_mileage.toLocaleString()}</strong>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                        <span style={{ color:"#7a8490" }}>Service</span>
                        <span style={{ ...pill, background:svc.bg, color:svc.fg, borderColor:svc.bd }}>{labelize(v.service_status)}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                        <span style={{ color:"#7a8490" }}>Inspection</span>
                        <span style={{ ...pill, background:ins.bg, color:ins.fg, borderColor:ins.bd }}>{labelize(v.inspection_status)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const pill: React.CSSProperties = {
  border:"1px solid",
  borderRadius:999,
  padding:"4px 7px",
  fontSize:10,
  fontWeight:900,
  lineHeight:1.1,
  whiteSpace:"nowrap",
};
