"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ServiceQueueRow = {
  vehicle_number: number;
  model_family: string;
  current_mileage: number | null;
  miles_until_service: number | null;
  service_status: string;
  booking_inventory_state: string;
  operational_status: string;
  on_ride: boolean;
};

type Profile = { id: string; display_name: string; role: string; pin_set_at: string | null };
type BoardRow = {
  job_id: string;
  job_number: number;
  vehicle_number: string;
  category: string;
  description: string | null;
  job_status: string;
  book_minutes: number | null;
  entry_id: string;
  technician_profile_id: string;
  technician_name: string;
  entry_state: "running" | "paused";
  started_at: string;
  current_segment_started_at: string | null;
  paused_at: string | null;
  accumulated_seconds: number;
  pause_reason: string | null;
  two_person_acknowledged: boolean;
  elapsed_seconds: number;
};
type RecentRow = {
  id: string;
  job_id: string;
  technician_profile_id: string;
  technician_name: string;
  state: string;
  started_at: string;
  stopped_at: string | null;
  accumulated_seconds: number;
  completion_result: string | null;
  two_person_acknowledged: boolean;
  job: {
    id: string;
    job_number: number;
    vehicle_number: string;
    category: string;
    description: string | null;
    status: string;
    book_minutes: number | null;
  } | null;
};

const categories = [
  "Scheduled Maintenance",
  "Weekly Inspection",
  "Damage Repair",
  "Inspection / Diagnosis",
  "Belt",
  "Tires",
  "Recovery / Field Repair",
  "Final Inspection",
  "Other Vehicle Work",
];

const pauseReasons = [
  ["waiting_for_parts", "Waiting for Parts"],
  ["waiting_for_approval", "Waiting for Approval"],
  ["pulled_to_another_vehicle", "Pulled to Another Vehicle"],
  ["break_or_shift_end", "Break / Shift End"],
  ["other", "Other"],
] as const;

const completionResults = [
  ["done", "Done"],
  ["needs_more_work", "Needs More Work"],
  ["waiting_for_parts", "Waiting for Parts"],
  ["out_of_service", "Out of Service"],
] as const;

function fmtSeconds(value: number) {
  const s = Math.max(0, Math.floor(value || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
}

function fmtClock(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtResult(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "—";
}

function minutesFromSeconds(seconds: number) {
  return Math.round((seconds || 0) / 60);
}

export default function TechTimePage() {
  const [view, setView] = useState<"tech" | "board" | "report">("tech");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [serviceQueue, setServiceQueue] = useState<ServiceQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [workstationPassword, setWorkstationPassword] = useState("");
  const [message, setMessage] = useState("");

  const [selectedTech, setSelectedTech] = useState("");
  const [pin, setPin] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const [existingPrompt, setExistingPrompt] = useState<any>(null);
  const [twoPersonPrompt, setTwoPersonPrompt] = useState<any>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);

  const [editEntry, setEditEntry] = useState<RecentRow | null>(null);
  const [editMinutes, setEditMinutes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [managerPin, setManagerPin] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/tech-time", { cache: "no-store" });
      if (r.status === 401) {
        setAuthorized(false);
        setProfiles([]);
        setBoard([]);
        setRecent([]);
        setServiceQueue([]);
        return;
      }
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || "Unable to load Tech Time.");
      setAuthorized(true);
      setProfiles(p.profiles || []);
      setBoard(p.board || []);
      setRecent(p.recent || []);
      setServiceQueue(p.serviceQueue || []);
      if (!selectedTech && p.profiles?.length) setSelectedTech(p.profiles[0].display_name);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load Tech Time.");
    } finally {
      setLoading(false);
    }
  }, [selectedTech]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!authorized) return;
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [authorized, load]);

  const selectedBoardRow = useMemo(
    () => board.find((r) => r.technician_name === selectedTech) || null,
    [board, selectedTech],
  );

  const groupedBoard = useMemo(() => {
    const m = new Map<string, { job: BoardRow; techs: BoardRow[] }>();
    for (const row of board) {
      const found = m.get(row.job_id);
      if (found) found.techs.push(row);
      else m.set(row.job_id, { job: row, techs: [row] });
    }
    return Array.from(m.values());
  }, [board]);

  const todayRecent = useMemo(() => {
    const today = new Date().toDateString();
    return recent.filter((r) => r.stopped_at && new Date(r.stopped_at).toDateString() === today);
  }, [recent]);

  const productiveTodaySeconds = todayRecent.reduce((sum, r) => sum + (r.accumulated_seconds || 0), 0);
  const avgToday = todayRecent.length ? productiveTodaySeconds / todayRecent.length : 0;

  async function loginWorkstation(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const r = await fetch("/api/auth/workstation-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: workstationPassword }),
    });
    const p = await r.json().catch(() => ({}));
    if (!r.ok) return setMessage(p.error || "Unable to sign in.");
    setWorkstationPassword("");
    await load();
  }

  async function action(payload: any) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/tech-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, actorPin: pin }),
      });
      const p = await r.json().catch(() => ({}));
      if (r.status === 409 && p.code === "EXISTING_OPEN_ENTRY") {
        setExistingPrompt(p);
        return false;
      }
      if (r.status === 409 && p.code === "TWO_PERSON_CONFIRMATION_REQUIRED") {
        setTwoPersonPrompt(p);
        return false;
      }
      if (!r.ok) throw new Error(p.error || "Tech Time action failed.");
      setExistingPrompt(null);
      setTwoPersonPrompt(null);
      await load();
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Tech Time action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function startServiceVehicle(row: ServiceQueueRow) {
    if (!selectedTech || !pin) {
      setMessage("Choose your name and enter your PIN before grabbing a service.");
      return;
    }
    setVehicle(String(row.vehicle_number));
    setCategory("Scheduled Maintenance");
    setDescription("1,000-mile service");
    const ok = await action({
      action: "start",
      vehicleNumber: String(row.vehicle_number),
      category: "Scheduled Maintenance",
      description: "1,000-mile service",
      confirmTwoPerson: false,
    });
    if (ok) {
      setVehicle("");
      setDescription("");
    }
  }

  async function start(confirmTwoPerson = false) {
    if (!selectedTech || !pin || !vehicle.trim()) {
      setMessage("Choose your name, enter your PIN, and enter a vehicle number.");
      return;
    }
    const ok = await action({
      action: "start",
      vehicleNumber: vehicle.trim(),
      category,
      description: description.trim(),
      confirmTwoPerson,
    });
    if (ok) {
      setVehicle("");
      setDescription("");
    }
  }

  async function pause(reason: string) {
    const ok = await action({ action: "pause", reason });
    if (ok) setPauseOpen(false);
  }

  async function resume() {
    await action({ action: "resume" });
  }

  async function stop(result: string) {
    const ok = await action({ action: "stop", result });
    if (ok) setStopOpen(false);
  }

  async function saveEdit() {
    if (!editEntry) return;
    const minutes = Number(editMinutes);
    if (!Number.isFinite(minutes) || minutes < 0 || !managerPin || !editReason.trim()) {
      setMessage("Corrected minutes, manager PIN, and edit reason are required.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/tech-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_entry",
          entryId: editEntry.id,
          accumulatedSeconds: Math.round(minutes * 60),
          reason: editReason.trim(),
          actorPin: managerPin,
        }),
      });
      const p = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(p.error || "Unable to correct entry.");
      setEditEntry(null);
      setEditMinutes("");
      setEditReason("");
      setManagerPin("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to correct entry.");
    } finally {
      setBusy(false);
    }
  }

  if (!authorized && !loading) {
    return (
      <main style={shell}>
        <section style={{ ...card, maxWidth: 520, margin: "80px auto" }}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ width: 120 }} />
          <h1 style={{ marginBottom: 6 }}>Epic Tech Time</h1>
          <p style={{ color: "#66717d", lineHeight: 1.5 }}>Sign this shop device into the shared Epic workstation. Technicians will identify themselves with their individual PIN when they start, pause, resume, or stop work.</p>
          <form onSubmit={loginWorkstation}>
            <input type="password" value={workstationPassword} onChange={(e) => setWorkstationPassword(e.target.value)} placeholder="Workstation password" style={input} autoFocus />
            <button style={{ ...primary, width: "100%", marginTop: 12 }}>Open Tech Time</button>
          </form>
          {message ? <div style={errorBox}>{message}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <main style={shell}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ width: 86 }} />
          <div>
            <div style={{ fontSize: 12, opacity: .65, letterSpacing: ".12em", fontWeight: 900 }}>SHOP OPERATIONS</div>
            <h1 style={{ margin: "3px 0 0", fontSize: 29 }}>Epic Tech Time</h1>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setView("tech")} style={tab(view === "tech")}>Tech Station</button>
          <button onClick={() => setView("board")} style={tab(view === "board")}>Shop Board</button>
          <button onClick={() => setView("report")} style={tab(view === "report")}>Weekly Report</button>
        </div>
      </header>

      <section style={{ maxWidth: 1240, margin: "0 auto", padding: 22 }}>
        {message ? <div style={errorBox}>{message}</div> : null}

        {view === "tech" ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(330px,.7fr)", gap: 18 }}>
            <section style={card}>
              <h2 style={{ marginTop: 0 }}>Tech Station</h2>

              <label style={label}>Technician</label>
              <select value={selectedTech} onChange={(e) => { setSelectedTech(e.target.value); setPin(""); }} style={input}>
                {profiles.map((p) => <option key={p.id}>{p.display_name}</option>)}
              </select>

              <label style={label}>Your PIN</label>
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="4–6 digit PIN" inputMode="numeric" type="password" style={input} />

              {selectedBoardRow ? (
                <div style={{ marginTop: 22, border: selectedBoardRow.entry_state === "running" ? "2px solid #26945b" : "2px solid #d49a28", borderRadius: 16, padding: 18, background: selectedBoardRow.entry_state === "running" ? "#f4fff8" : "#fffaf0" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: selectedBoardRow.entry_state === "running" ? "#20804e" : "#a16e13", letterSpacing: ".1em" }}>{selectedBoardRow.entry_state === "running" ? "WORKING NOW" : "PAUSED"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 15, marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 900 }}>Job #{selectedBoardRow.job_number} · Vehicle {selectedBoardRow.vehicle_number}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 5 }}>{selectedBoardRow.category}</div>
                      {selectedBoardRow.description ? <div style={{ color: "#5f6873", marginTop: 4 }}>{selectedBoardRow.description}</div> : null}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 900 }}>{fmtSeconds(selectedBoardRow.elapsed_seconds)}</div>
                  </div>
                  {selectedBoardRow.entry_state === "paused" && selectedBoardRow.pause_reason ? <div style={{ marginTop: 10, color: "#8b6118" }}>Paused: {fmtResult(selectedBoardRow.pause_reason)}</div> : null}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 18 }}>
                    {selectedBoardRow.entry_state === "running" ? <button disabled={busy} onClick={() => { if (!pin) { setMessage("Enter your PIN above to pause this job."); return; } setPauseOpen(true); }} style={secondary}>Pause</button> : <button disabled={busy} onClick={() => { if (!pin) { setMessage("Enter your PIN above to resume this job."); return; } resume(); }} style={primary}>Resume</button>}
                    <button disabled={busy} onClick={() => { if (!pin) { setMessage("Enter your PIN above to stop this job."); return; } setStopOpen(true); }} style={danger}>Stop Job</button>
                    <div style={{ border: "1px solid #dfe3e8", borderRadius: 12, padding: 11, textAlign: "center", color: "#69727e" }}>
                      {selectedBoardRow.book_minutes == null ? "Book time: —" : `Book time: ${selectedBoardRow.book_minutes}m`}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <label style={label}>Vehicle Number</label>
                  <input value={vehicle} onChange={(e) => setVehicle(e.target.value.replace(/[^0-9A-Za-z-]/g, ""))} placeholder="e.g. 42" style={input} />

                  {serviceQueue.length ? (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"end", marginBottom:8 }}>
                        <div>
                          <div style={{ fontWeight:900 }}>Vehicles Needing Service</div>
                          <div style={{ color:"#707b87", fontSize:12, marginTop:2 }}>Most critical first. Grab one to start Scheduled Maintenance automatically.</div>
                        </div>
                        <div style={{ color:"#7d8792", fontSize:12 }}>{serviceQueue.length} due / approaching</div>
                      </div>
                      <div style={{ display:"grid", gap:8, maxHeight:270, overflowY:"auto" }}>
                        {serviceQueue.map((row) => {
                          const overdue = (row.miles_until_service ?? 999999) < 0;
                          return (
                            <div key={row.vehicle_number} style={{
                              display:"grid",
                              gridTemplateColumns:"1fr auto auto",
                              alignItems:"center",
                              gap:12,
                              border: overdue ? "2px solid #9d2f2a" : "1px solid #dfe4e9",
                              background: overdue ? "#fff1ef" : "#f8fafb",
                              borderRadius:11,
                              padding:"10px 12px"
                            }}>
                              <div>
                                <div style={{ fontWeight:900 }}>Vehicle {row.vehicle_number} · {row.model_family}</div>
                                <div style={{ color:"#6d7782", fontSize:12, marginTop:2 }}>
                                  {row.current_mileage?.toLocaleString() ?? "—"} miles
                                </div>
                              </div>
                              <div style={{ textAlign:"right" }}>
                                {overdue ? (
                                  <div style={{ color:"#982f28", fontWeight:900 }}>
                                    {Math.abs(row.miles_until_service || 0)} mi OVERDUE
                                  </div>
                                ) : (
                                  <div style={{ fontWeight:900, color:(row.miles_until_service ?? 9999) <= 25 ? "#9b5d0e" : "#36414d" }}>
                                    {row.miles_until_service} mi to service
                                  </div>
                                )}
                              </div>
                              <button disabled={busy} onClick={() => startServiceVehicle(row)} style={overdue ? danger : smallButton}>
                                Grab
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <label style={label}>Vehicle Work</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={input}>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>

                  <label style={label}>What are you doing? <span style={{ fontWeight: 500, color: "#818995" }}>(optional)</span></label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note about the job" style={{ ...input, minHeight: 80, resize: "vertical" }} />

                  <button disabled={busy || !selectedTech || !pin || !vehicle.trim()} onClick={() => start(false)} style={{ ...primary, width: "100%", marginTop: 22, padding: 18, fontSize: 21 }}>
                    START JOB
                  </button>
                </>
              )}
            </section>

            <aside style={card}>
              <h3 style={{ marginTop: 0 }}>Shop rules</h3>
              <div style={{ color: "#5f6873", lineHeight: 1.65, fontSize: 14 }}>
                One open job per technician. Vehicle work only. Pausing requires a reason. Waiting for parts stops labor time. Another tech on the same vehicle triggers a 2-person-job confirmation.
              </div>
              <div style={{ borderTop: "1px solid #e5e8ec", margin: "18px 0" }} />
              <h3>Working now</h3>
              {groupedBoard.length ? groupedBoard.map((g) => (
                <div key={g.job.job_id} style={{ border: "1px solid #dfe3e8", borderRadius: 12, padding: 13, marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>#{g.job.job_number} · Vehicle {g.job.vehicle_number}</strong>
                    <strong>{fmtSeconds(Math.max(...g.techs.map((t) => t.elapsed_seconds)))}</strong>
                  </div>
                  <div style={{ marginTop: 4 }}>{g.job.category}</div>
                  <div style={{ color: "#77818d", marginTop: 5, fontSize: 13 }}>{g.techs.map((t) => t.technician_name).join(" + ")}{g.techs.length > 1 ? " · 2-person job" : ""}</div>
                </div>
              )) : <div style={{ color: "#7c8590" }}>Nobody is clocked onto vehicle work right now.</div>}
            </aside>
          </div>
        ) : view === "board" ? (
          <section style={{ ...card, background: "#111923", color: "white", minHeight: 650 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "end", flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#93a1b0", fontWeight: 900, fontSize: 12, letterSpacing: ".12em" }}>LIVE SHOP BOARD</div>
                <h2 style={{ fontSize: 36, margin: "5px 0 0" }}>What is happening in the shop?</h2>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#93a1b0", fontSize: 12, fontWeight: 900 }}>TODAY</div>
                <div style={{ fontSize: 25, fontWeight: 900 }}>{groupedBoard.length} ACTIVE · {todayRecent.length} COMPLETED</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16, marginTop: 24 }}>
              {groupedBoard.map((g) => (
                <div key={g.job.job_id} style={{ border: g.techs.some((t) => t.entry_state === "running") ? "2px solid #35b46d" : "2px solid #d59b2c", background: "#182531", borderRadius: 18, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <div>
                      <div style={{ color: g.techs.some((t) => t.entry_state === "running") ? "#5ad98e" : "#e1b651", fontSize: 12, fontWeight: 900, letterSpacing: ".08em" }}>{g.techs.some((t) => t.entry_state === "running") ? "WORKING NOW" : "PAUSED"}</div>
                      <div style={{ fontSize: 29, fontWeight: 900, marginTop: 6 }}>{g.techs.map((t) => t.technician_name).join(" + ")}</div>
                      {g.techs.length > 1 ? <div style={{ display: "inline-block", marginTop: 8, padding: "4px 9px", borderRadius: 999, background: "#30445a", fontSize: 12, fontWeight: 900 }}>2 TECHS ON THIS JOB</div> : null}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#91a0af", fontSize: 11, fontWeight: 900 }}>VEHICLE</div>
                      <div style={{ fontSize: 40, fontWeight: 900 }}>{g.job.vehicle_number}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 23, fontWeight: 900, marginTop: 17 }}>Job #{g.job.job_number} · {g.job.category}</div>
                  {g.job.description ? <div style={{ color: "#bac3cd", marginTop: 5 }}>{g.job.description}</div> : null}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 18, borderTop: "1px solid #334352", paddingTop: 14 }}>
                    <div><span style={{ color: "#91a0af" }}>Started </span>{fmtClock(g.techs[0]?.started_at || null)}</div>
                    <div style={{ textAlign: "right", fontSize: 22, fontWeight: 900 }}>{fmtSeconds(Math.max(...g.techs.map((t) => t.elapsed_seconds)))}</div>
                  </div>
                </div>
              ))}
              {!groupedBoard.length ? <div style={{ color: "#91a0af", fontSize: 24, padding: 28 }}>No active shop jobs.</div> : null}
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ color: "#91a0af", fontSize: 12, fontWeight: 900, letterSpacing: ".1em", marginBottom: 8 }}>COMPLETED TODAY</div>
              <div style={{ display: "grid", gridTemplateColumns: ".8fr .7fr 1fr .8fr .8fr", padding: "9px 12px", color: "#91a0af", fontSize: 11, fontWeight: 900, borderBottom: "1px solid #334352" }}>
                <span>TECH</span><span>VEHICLE</span><span>JOB</span><span>LABOR</span><span>RESULT</span>
              </div>
              {todayRecent.slice(0, 10).map((r) => (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: ".8fr .7fr 1fr .8fr .8fr", padding: "12px", borderBottom: "1px solid #283643", alignItems: "center" }}>
                  <strong>{r.technician_name}</strong><strong>{r.job?.vehicle_number || "—"}</strong><span>{r.job?.category || "—"}</span><strong>{fmtSeconds(r.accumulated_seconds)}</strong><span>{fmtResult(r.completion_result)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginTop: 24 }}>
              {[["Productive Time Today", fmtSeconds(productiveTodaySeconds)],["Jobs Completed", String(todayRecent.length)],["Avg Completed Job", fmtSeconds(avgToday)]].map(([l,v]) => (
                <div key={l} style={{ background: "#1a2835", border: "1px solid #334352", borderRadius: 13, padding: 15 }}>
                  <div style={{ color: "#91a0af", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>{l}</div>
                  <div style={{ fontSize: 27, fontWeight: 900, marginTop: 5 }}>{v}</div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#7d8792", fontSize: 12, fontWeight: 900, letterSpacing: ".1em" }}>LAST 7 DAYS</div>
                <h2 style={{ margin: "5px 0 0", fontSize: 29 }}>Tech Time Report</h2>
              </div>
              <div style={{ color: "#6c7681", fontSize: 13 }}>Manager corrections are audit logged. Technicians cannot edit recorded time.</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginTop: 20 }}>
              {Array.from(new Set(recent.map((r) => r.technician_name))).map((name) => {
                const rows = recent.filter((r) => r.technician_name === name);
                const sec = rows.reduce((s, r) => s + r.accumulated_seconds, 0);
                return <div key={name} style={{ background: "#f6f7f9", border: "1px solid #e3e6ea", borderRadius: 13, padding: 15 }}><strong>{name}</strong><div style={{ fontSize: 27, fontWeight: 900, marginTop: 5 }}>{fmtSeconds(sec)}</div><div style={{ color: "#7d8792", marginTop: 3 }}>{rows.length} completed entr{rows.length === 1 ? "y" : "ies"}</div></div>;
              })}
            </div>

            <div style={{ overflowX: "auto", marginTop: 22 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead><tr style={{ textAlign: "left", color: "#6d7782" }}>{["Stopped","Tech","Job","Vehicle","Work","Actual","Book","Result",""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #e5e8ec" }}>
                      <td style={td}>{r.stopped_at ? new Date(r.stopped_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                      <td style={td}><strong>{r.technician_name}</strong></td>
                      <td style={td}>#{r.job?.job_number || "—"}</td>
                      <td style={td}>{r.job?.vehicle_number || "—"}</td>
                      <td style={td}>{r.job?.category || "—"}</td>
                      <td style={td}><strong>{fmtSeconds(r.accumulated_seconds)}</strong></td>
                      <td style={td}>{r.job?.book_minutes == null ? "—" : `${r.job.book_minutes}m`}</td>
                      <td style={td}>{fmtResult(r.completion_result)}</td>
                      <td style={td}><button onClick={() => { setEditEntry(r); setEditMinutes(String(minutesFromSeconds(r.accumulated_seconds))); }} style={smallButton}>Correct</button></td>
                    </tr>
                  ))}
                  {!recent.length ? <tr><td colSpan={9} style={{ padding: 30, textAlign: "center", color: "#7d8792" }}>No completed Tech Time entries yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>

      {twoPersonPrompt ? (
        <Modal title="Another technician is already on this vehicle" onClose={() => setTwoPersonPrompt(null)}>
          <p style={{ lineHeight: 1.55 }}>
            {twoPersonPrompt.technicians?.join(" + ")} {twoPersonPrompt.technicians?.length === 1 ? "is" : "are"} already working on Job #{twoPersonPrompt.existingJob?.job_number}, Vehicle {twoPersonPrompt.existingJob?.vehicle_number}.
          </p>
          <div style={{ fontWeight: 900, fontSize: 18, margin: "14px 0" }}>Is this a 2-person job?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={busy} onClick={() => start(true)} style={{ ...primary, flex: 1 }}>Yes — Join Job</button>
            <button onClick={() => setTwoPersonPrompt(null)} style={{ ...secondary, flex: 1 }}>No — Find Other Work</button>
          </div>
        </Modal>
      ) : null}

      {existingPrompt ? (
        <Modal title={`You already have Job #${existingPrompt.existingJob?.job_number} open`} onClose={() => setExistingPrompt(null)}>
          <p style={{ lineHeight: 1.55 }}>Vehicle {existingPrompt.existingJob?.vehicle_number} · {existingPrompt.existingJob?.category}</p>
          <p style={{ color: "#68727e" }}>Stop that job before starting another one, or return to it and resume.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setExistingPrompt(null); setStopOpen(true); }} style={{ ...danger, flex: 1 }}>Stop Job #{existingPrompt.existingJob?.job_number}</button>
            <button onClick={() => { setExistingPrompt(null); setSelectedTech(existingPrompt.existingEntry?.technician_name || selectedTech); }} style={{ ...secondary, flex: 1 }}>Return to Job</button>
          </div>
        </Modal>
      ) : null}

      {pauseOpen ? (
        <Modal title="Why are you pausing?" onClose={() => setPauseOpen(false)}>
          <div style={{ display: "grid", gap: 9 }}>
            {pauseReasons.map(([value, labelText]) => <button key={value} disabled={busy} onClick={() => pause(value)} style={secondary}>{labelText}</button>)}
          </div>
        </Modal>
      ) : null}

      {stopOpen ? (
        <Modal title="How are you leaving this job?" onClose={() => setStopOpen(false)}>
          <div style={{ display: "grid", gap: 9 }}>
            {completionResults.map(([value, labelText]) => <button key={value} disabled={busy} onClick={() => stop(value)} style={value === "done" ? primary : value === "out_of_service" ? danger : secondary}>{labelText}</button>)}
          </div>
        </Modal>
      ) : null}

      {editEntry ? (
        <Modal title={`Correct Job #${editEntry.job?.job_number || ""} time`} onClose={() => setEditEntry(null)}>
          <label style={label}>Corrected productive minutes</label>
          <input value={editMinutes} onChange={(e) => setEditMinutes(e.target.value.replace(/[^0-9.]/g, ""))} style={input} />
          <label style={label}>Why is this being corrected?</label>
          <input value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Required audit note" style={input} />
          <label style={label}>Manager PIN</label>
          <input value={managerPin} onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" style={input} />
          <button disabled={busy} onClick={saveEdit} style={{ ...primary, width: "100%", marginTop: 15 }}>Save Correction</button>
        </Modal>
      ) : null}
    </main>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.52)", display: "grid", placeItems: "center", padding: 20, zIndex: 50 }}><section style={{ ...card, width: "min(520px,100%)", boxShadow: "0 24px 70px rgba(0,0,0,.28)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 15, alignItems: "start" }}><h2 style={{ marginTop: 0 }}>{title}</h2><button onClick={onClose} style={{ border: 0, background: "transparent", fontSize: 24, cursor: "pointer" }}>×</button></div>{children}</section></div>;
}

const shell: React.CSSProperties = { minHeight: "100vh", background: "#f3f5f7", color: "#171c23", fontFamily: "Arial, Helvetica, sans-serif" };
const header: React.CSSProperties = { background: "#101924", color: "white", padding: "18px 28px", display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", flexWrap: "wrap" };
const card: React.CSSProperties = { background: "white", border: "1px solid #e0e4e8", borderRadius: 18, padding: 22, boxShadow: "0 7px 25px rgba(20,28,36,.06)" };
const label: React.CSSProperties = { display: "block", fontWeight: 900, fontSize: 14, marginTop: 16, marginBottom: 7 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #cfd5dc", borderRadius: 11, padding: "13px 14px", fontSize: 16, background: "white" };
const primary: React.CSSProperties = { border: 0, borderRadius: 11, padding: "12px 15px", background: "#218b50", color: "white", fontWeight: 900, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #cfd5dc", borderRadius: 11, padding: "12px 15px", background: "white", color: "#222a33", fontWeight: 900, cursor: "pointer" };
const danger: React.CSSProperties = { border: 0, borderRadius: 11, padding: "12px 15px", background: "#c73b2f", color: "white", fontWeight: 900, cursor: "pointer" };
const smallButton: React.CSSProperties = { border: "1px solid #ccd2d9", borderRadius: 9, padding: "7px 10px", background: "white", fontWeight: 800, cursor: "pointer" };
const errorBox: React.CSSProperties = { margin: "10px 0 16px", padding: "11px 13px", borderRadius: 10, background: "#fff1ef", border: "1px solid #efc2bd", color: "#8d2f27" };
const th: React.CSSProperties = { padding: "10px 9px", fontSize: 11, textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "12px 9px", verticalAlign: "top" };
function tab(active: boolean): React.CSSProperties { return { border: active ? "1px solid #f06b2f" : "1px solid #3b4754", background: active ? "#f06b2f" : "#182431", color: "white", padding: "10px 13px", borderRadius: 10, fontWeight: 900, cursor: "pointer" }; }
