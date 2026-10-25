"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ActiveTechTimeRow, FleetVehicle } from "@/lib/fleet-maintenance";

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function tone(status: string) {
  if (["out_of_service","hard_blackout","overdue","due"].includes(status)) return { bg:"#fff0ee", fg:"#9f2f24", bd:"#efc5bf" };
  if (["repair","waiting_for_parts","soft_blackout","out_for_service","upcoming","due_soon"].includes(status)) return { bg:"#fff8e9", fg:"#946313", bd:"#ead39d" };
  if (["available","current","not_due"].includes(status)) return { bg:"#effbf4", fg:"#257248", bd:"#bfe3cd" };
  if (status === "on_ride") return { bg:"#eef5ff", fg:"#2b5f9d", bd:"#c7d8ef" };
  return { bg:"#f3f5f7", fg:"#68717c", bd:"#dce1e6" };
}

export default function FleetDashboardClient({ initialVehicles, activeTechRows }: { initialVehicles: FleetVehicle[]; activeTechRows: ActiveTechTimeRow[] }) {
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [setupOpen, setSetupOpen] = useState(false);
  const [menuVehicle, setMenuVehicle] = useState<FleetVehicle | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [modelFilter, setModelFilter] = useState("all");
  const [attentionFilters, setAttentionFilters] = useState<string[]>([]);

  const activeTechByVehicle = useMemo(() => {
    const map = new Map<number, ActiveTechTimeRow[]>();
    for (const row of activeTechRows) {
      const n = Number(row.vehicle_number);
      if (!Number.isFinite(n)) continue;
      const list = map.get(n) || [];
      list.push(row);
      map.set(n, list);
    }
    return map;
  }, [activeTechRows]);

  const counts = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter((v) => v.operational_status === "available" && !v.on_ride && v.booking_inventory_state === "available").length,
    onRide: vehicles.filter((v) => v.on_ride).length,
    serviceDue: vehicles.filter((v) => ["due","upcoming"].includes(v.service_status)).length,
    inspectionsDue: vehicles.filter((v) => ["due","overdue","due_soon"].includes(v.inspection_status)).length,
    unavailable: vehicles.filter((v) => ["repair","waiting_for_parts","out_of_service"].includes(v.operational_status) || v.booking_inventory_state !== "available").length,
    setup: vehicles.filter((v) => v.setup_needed).length,
  }), [vehicles]);

  const modelOutline = (model: string) => {
    if (model === "Pro R Boost") return "#6f1d2b"; // deep burgundy
    if (model === "Xpedition") return "#0f5b45"; // deep emerald
    if (model === "XP S" || model === "XP S4") return "#174a7e"; // deep sapphire
    return "#5a2f6f"; // deep plum for Pro S / Pro S4
  };

  const toggleAttentionFilter = (key: string) => {
    setAttentionFilters((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (modelFilter !== "all" && v.model_family !== modelFilter) return false;
      if (!attentionFilters.length) return true;

      return attentionFilters.every((filter) => {
        if (filter === "service") return v.service_status === "due";
        if (filter === "hard_blackout") return v.booking_inventory_state === "hard_blackout";
        if (filter === "soft_blackout") return v.booking_inventory_state === "soft_blackout";
        if (filter === "damage") return v.operational_status === "repair";
        if (filter === "service_hold") return v.booking_inventory_state === "out_for_service";
        return true;
      });
    });
  }, [vehicles, modelFilter, attentionFilters]);

  async function patchVehicle(vehicleNumber: number, patch: Record<string, unknown>) {
    setSaving(true);
    setMessage("");
    try {
      const r = await fetch("/api/team/fleet-maintenance/vehicle", {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ vehicleNumber, ...patch }),
      });
      const p = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(p.error || "Unable to update vehicle.");
      setVehicles((rows) => rows.map((v) => v.vehicle_number === vehicleNumber ? ({ ...v, ...patch } as FleetVehicle) : v));
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to update vehicle.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function setInventory(state: string) {
    if (!menuVehicle) return;
    const ok = await patchVehicle(menuVehicle.vehicle_number, {
      booking_inventory_state: state,
      booking_inventory_reason: reason.trim() || null,
      operational_status: state === "out_for_service" ? "out_of_service" : state === "available" ? "available" : menuVehicle.operational_status,
    });
    if (ok) {
      setMenuVehicle(null);
      setReason("");
    }
  }

  return (
    <>
      {message ? <div style={{ marginBottom:14, background:"#fff0ee", border:"1px solid #efc5bf", color:"#8f3028", padding:"10px 12px", borderRadius:10 }}>{message}</div> : null}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", gap:12, marginBottom:18 }}>
        {[
          ["Fleet", counts.total],
          ["Available", counts.available],
          ["On-Ride", counts.onRide],
          ["Service Due", counts.serviceDue],
          ["Inspection Due", counts.inspectionsDue],
          ["Unavailable", counts.unavailable],
          ["Setup Needed", counts.setup],
        ].map(([label,value]) => (
          <div key={String(label)} style={{ background:"white", border:"1px solid #e0e4e8", borderRadius:14, padding:15 }}>
            <div style={{ fontSize:11, fontWeight:900, textTransform:"uppercase", color:"#7a8490" }}>{label}</div>
            <div style={{ fontSize:30, fontWeight:900, marginTop:4 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ background:"white", border:"1px solid #e0e4e8", borderRadius:16, overflow:"hidden" }}>
        <div style={{ padding:"16px 18px", borderBottom:"1px solid #e7eaee" }}>
          <div style={{ display:"flex", justifyContent:"space-between", gap:20, alignItems:"center" }}>
            <div>
              <div style={{ fontSize:19, fontWeight:900 }}>Fleet Registry</div>
              <div style={{ color:"#6f7883", fontSize:13, marginTop:3 }}>Fleet Maintenance is the physical source of truth. Iron Jack consumes availability from the same vehicle record.</div>
            </div>
            <button onClick={() => setSetupOpen(true)} style={button}>Bulk Fleet Setup</button>
          </div>

          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginTop:16 }}>
            <select value={modelFilter} onChange={(e)=>setModelFilter(e.target.value)} style={{ ...filterControl, minWidth:190 }}>
              <option value="all">All Model Types</option>
              <option value="Pro R Boost">Pro R Boost</option>
              <option value="Xpedition">Xpedition</option>
              <option value="XP S">XP S</option>
              <option value="XP S4">XP S4</option>
              <option value="Pro S">Pro S</option>
              <option value="Pro S4">Pro S4</option>
            </select>

            {[
              ["service","Due for Service"],
              ["hard_blackout","Hard Blackout"],
              ["soft_blackout","Soft Blackout"],
              ["damage","Down for Damage"],
              ["service_hold","Hold for Service"],
            ].map(([key,labelText]) => {
              const active = attentionFilters.includes(key);
              return (
                <button
                  key={key}
                  onClick={()=>toggleAttentionFilter(key)}
                  style={{
                    ...filterControl,
                    background: active ? "#202a34" : "white",
                    color: active ? "white" : "#27313b",
                    borderColor: active ? "#202a34" : "#cfd6dd",
                    fontWeight:900,
                    cursor:"pointer",
                  }}
                >
                  {labelText}
                </button>
              );
            })}

            {(modelFilter !== "all" || attentionFilters.length > 0) ? (
              <button onClick={()=>{setModelFilter("all");setAttentionFilters([]);}} style={{ ...filterControl, border:"none", background:"transparent", color:"#6d7782", cursor:"pointer", fontWeight:800 }}>Clear Filters</button>
            ) : null}

            <div style={{ marginLeft:"auto", fontSize:12, color:"#6f7883", fontWeight:800 }}>
              Showing {filteredVehicles.length} of {vehicles.length}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,minmax(0,1fr))", gap:10, padding:14 }}>
          {filteredVehicles.map((v) => {
            const displayedStatus = v.on_ride ? "on_ride" : v.booking_inventory_state !== "available" ? v.booking_inventory_state : v.operational_status;
            const op = tone(displayedStatus);
            const svc = tone(v.service_status);
            const ins = tone(v.inspection_status);
            const techs = activeTechByVehicle.get(v.vehicle_number) || [];
            return (
              <div key={v.id} style={{ position:"relative", border:`3px solid ${modelOutline(v.model_family)}`, borderRadius:13, padding:13, background:"#fff", minHeight:170, boxShadow:`0 0 0 1px ${modelOutline(v.model_family)}18` }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8, alignItems:"start" }}>
                  <Link href={`/team/fleet-maintenance/${v.vehicle_number}`} style={{ textDecoration:"none", color:"inherit", flex:1 }}>
                    <div style={{ fontSize:26, fontWeight:900 }}>#{v.vehicle_number}</div>
                    <div style={{ fontSize:13, fontWeight:800, marginTop:2 }}>{v.model_family}</div>
                  </Link>
                  <button aria-label={`Vehicle ${v.vehicle_number} actions`} onClick={() => { setMenuVehicle(v); setReason(v.booking_inventory_reason || ""); }} style={{ border:0, background:"transparent", fontSize:24, lineHeight:1, cursor:"pointer", padding:"0 2px" }}>⋮</button>
                </div>
                <div style={{ marginTop:7 }}>
                  {techs.length ? <span style={{ ...pill, marginRight:5, background:"#fff2d8", color:"#8a5a00", borderColor:"#efcf8d" }}>TECH ON JOB · {techs.map(t=>t.technician_name).join(" + ")}</span> : null}
                  <span style={{ ...pill, background:op.bg, color:op.fg, borderColor:op.bd }}>{labelize(displayedStatus)}</span>
                  {v.setup_needed ? <span style={{ ...pill, marginLeft:5, background:"#f3f5f7", color:"#68717c", borderColor:"#dce1e6" }}>Setup Needed</span> : null}
                </div>
                <Link href={`/team/fleet-maintenance/${v.vehicle_number}`} style={{ textDecoration:"none", color:"inherit" }}>
                  <div style={{ marginTop:14, display:"grid", gap:7, fontSize:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}><span style={{ color:"#7a8490" }}>Mileage</span><strong>{v.current_mileage == null ? "—" : v.current_mileage.toLocaleString()}</strong></div>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}><span style={{ color:"#7a8490" }}>Service</span><span style={{ ...pill, background:svc.bg, color:svc.fg, borderColor:svc.bd }}>{labelize(v.service_status)}</span></div>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}><span style={{ color:"#7a8490" }}>Inspection</span><span style={{ ...pill, background:ins.bg, color:ins.fg, borderColor:ins.bd }}>{labelize(v.inspection_status)}</span></div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        <div style={{ display:"flex", gap:14, flexWrap:"wrap", padding:"0 14px 14px", fontSize:11, color:"#66717c" }}>
          {[
            ["#6f1d2b","Pro R Boost"],
            ["#0f5b45","Xpedition"],
            ["#174a7e","XP S / XP S4"],
            ["#5a2f6f","Pro S / Pro S4"],
          ].map(([color,labelText]) => (
            <span key={labelText} style={{ display:"inline-flex", alignItems:"center", gap:6, fontWeight:800 }}>
              <span style={{ width:12, height:12, borderRadius:3, background:color }} />{labelText}
            </span>
          ))}
        </div>
      </div>

      {setupOpen ? (
        <div style={modalBack}>
          <div style={{ ...modal, width:"min(1180px,96vw)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:15, alignItems:"start" }}>
              <div>
                <h2 style={{ margin:"0 0 4px" }}>Bulk Fleet Setup</h2>
                <div style={{ color:"#6e7883", fontSize:13 }}>Use this as the Polaris receiving sheet. Setup Needed disappears automatically when required fields are complete.</div>
              </div>
              <button onClick={() => setSetupOpen(false)} style={closeButton}>×</button>
            </div>
            <div style={{ overflow:"auto", maxHeight:"70vh", marginTop:16 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr>{["#","Model","VIN","M Power Ref","Mileage","Hours","In Service",""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{vehicles.map((v) => <SetupRow key={v.id} vehicle={v} saving={saving} onSave={async (patch) => { const ok=await patchVehicle(v.vehicle_number,patch); if(ok) setVehicles((rows)=>rows.map((x)=>x.vehicle_number===v.vehicle_number?{...x,...patch,setup_needed:!(String(patch.vin||"").trim()&&String(patch.mpwr_vehicle_reference||"").trim()&&String(patch.current_mileage||"").trim()&&String(patch.current_engine_hours||"").trim()&&String(patch.in_service_date||"").trim())}:x)); }} />)}</tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {menuVehicle ? (
        <div style={modalBack}>
          <div style={{ ...modal, width:"min(500px,94vw)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:15, alignItems:"start" }}>
              <div><h2 style={{ margin:"0 0 3px" }}>Vehicle #{menuVehicle.vehicle_number}</h2><div style={{ color:"#6f7883" }}>{menuVehicle.model_family}</div></div>
              <button onClick={() => setMenuVehicle(null)} style={closeButton}>×</button>
            </div>
            {menuVehicle.on_ride ? <div style={{ marginTop:14, padding:12, borderRadius:10, background:"#eef5ff", color:"#2b5f9d", fontWeight:800 }}>ON-RIDE{menuVehicle.on_ride_trip_order_id ? ` · ${menuVehicle.on_ride_trip_order_id}` : ""}</div> : null}
            <label style={label}>Reason / note</label>
            <input value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Why is availability changing?" style={input} />
            <div style={{ display:"grid", gap:9, marginTop:16 }}>
              <button disabled={saving} onClick={()=>setInventory("hard_blackout")} style={{...actionButton,background:"linear-gradient(135deg,#241f24 0%,#51222b 52%,#742c35 100%)",color:"white"}}>Hard Blackout</button>
              <button disabled={saving} onClick={()=>setInventory("out_for_service")} style={{...actionButton,background:"linear-gradient(135deg,#2c2823 0%,#59412d 48%,#765438 100%)",color:"white"}}>Out for Service</button>
              <button disabled={saving} onClick={()=>setInventory("soft_blackout")} style={{...actionButton,background:"linear-gradient(135deg,#253342 0%,#355368 48%,#526f78 100%)",color:"white"}}>Soft Blackout</button>
              <button disabled={saving} onClick={()=>setInventory("available")} style={{...actionButton,background:"linear-gradient(135deg,#21372f 0%,#285947 48%,#3f735c 100%)",color:"white"}}>Return to Available</button>
            </div>
            <p style={{ color:"#737d88", fontSize:12, lineHeight:1.5, marginBottom:0 }}>Iron Jack will read this same inventory state. Hard Blackout and Out for Service are not sellable. Soft Blackout remains overrideable by authorized staff.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SetupRow({ vehicle, saving, onSave }: { vehicle:FleetVehicle; saving:boolean; onSave:(patch:Record<string,unknown>)=>Promise<void> }) {
  const [vin,setVin]=useState(vehicle.vin||"");
  const [mpwr,setMpwr]=useState(vehicle.mpwr_vehicle_reference||"");
  const [mileage,setMileage]=useState(vehicle.current_mileage?.toString()||"");
  const [hours,setHours]=useState(vehicle.current_engine_hours?.toString()||"");
  const [date,setDate]=useState(vehicle.in_service_date||"");
  return <tr style={{ borderTop:"1px solid #e8ebee" }}>
    <td style={td}><strong>#{vehicle.vehicle_number}</strong></td>
    <td style={td}>{vehicle.model_family}</td>
    <td style={td}><input value={vin} onChange={e=>setVin(e.target.value)} style={cellInput}/></td>
    <td style={td}><input value={mpwr} onChange={e=>setMpwr(e.target.value)} style={cellInput}/></td>
    <td style={td}><input value={mileage} onChange={e=>setMileage(e.target.value.replace(/\D/g,""))} style={cellInput}/></td>
    <td style={td}><input value={hours} onChange={e=>setHours(e.target.value.replace(/[^0-9.]/g,""))} style={cellInput}/></td>
    <td style={td}><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={cellInput}/></td>
    <td style={td}><button disabled={saving} onClick={()=>onSave({vin,mpwr_vehicle_reference:mpwr,current_mileage:mileage,current_engine_hours:hours,in_service_date:date,operational_status:"available"})} style={smallButton}>Save</button></td>
  </tr>;
}

const pill: React.CSSProperties={border:"1px solid",borderRadius:999,padding:"4px 7px",fontSize:10,fontWeight:900,lineHeight:1.1,whiteSpace:"nowrap"};
const button:React.CSSProperties={border:0,borderRadius:9,padding:"9px 12px",background:"#202a34",color:"white",fontWeight:900,cursor:"pointer"};
const modalBack:React.CSSProperties={position:"fixed",inset:0,zIndex:80,background:"rgba(11,18,26,.58)",display:"grid",placeItems:"center",padding:20};
const modal:React.CSSProperties={background:"white",borderRadius:16,padding:20,boxShadow:"0 24px 70px rgba(0,0,0,.26)",maxHeight:"90vh",overflow:"auto"};
const closeButton:React.CSSProperties={border:0,background:"transparent",fontSize:28,cursor:"pointer"};
const label:React.CSSProperties={display:"block",fontWeight:900,fontSize:12,marginTop:16,marginBottom:6};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",border:"1px solid #cfd6dd",borderRadius:9,padding:"11px 12px",fontSize:14};
const actionButton:React.CSSProperties={border:"1px solid rgba(255,255,255,.12)",borderRadius:10,padding:"13px 14px",fontSize:15,fontWeight:900,cursor:"pointer",boxShadow:"inset 0 1px 0 rgba(255,255,255,.10),0 4px 12px rgba(25,31,38,.10)"};
const th:React.CSSProperties={textAlign:"left",padding:"9px 7px",background:"#f5f7f8",position:"sticky",top:0,zIndex:1,color:"#6f7883",fontSize:10,textTransform:"uppercase"};
const td:React.CSSProperties={padding:"7px"};
const cellInput:React.CSSProperties={width:"100%",minWidth:90,boxSizing:"border-box",border:"1px solid #d7dde3",borderRadius:7,padding:"7px 8px",fontSize:12};
const smallButton:React.CSSProperties={border:0,borderRadius:8,padding:"8px 10px",background:"#258b53",color:"white",fontWeight:900,cursor:"pointer"};

const filterControl:React.CSSProperties={border:"1px solid #cfd6dd",borderRadius:999,padding:"8px 12px",fontSize:12,background:"white"};
