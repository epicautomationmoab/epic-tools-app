"use client";

import { useEffect, useMemo, useState } from "react";

const categories = [
  "Fluid Change",
  "Tire Rotation",
  "New Tire(s)",
  "Damage Repair",
  "Air Filter Clean",
  "Recovery",
  "Belt",
  "Inspection / Diagnosis",
  "Cleaning / Prep",
  "Other",
];

type DemoJob = {
  id: number;
  technician: string;
  vehicle: string;
  category: string;
  note: string;
  minutes: number;
};

const sampleJobs: DemoJob[] = [
  { id: 1, technician: "Tech 1", vehicle: "42", category: "Fluid Change", note: "Oil + filter", minutes: 52 },
  { id: 2, technician: "Tech 1", vehicle: "38", category: "Damage Repair", note: "LF fender and mount", minutes: 126 },
  { id: 3, technician: "Tech 1", vehicle: "54", category: "Tire Rotation", note: "", minutes: 44 },
  { id: 4, technician: "Tech 2", vehicle: "27", category: "Air Filter Clean", note: "", minutes: 31 },
  { id: 5, technician: "Tech 2", vehicle: "31", category: "Belt", note: "Inspect + replace", minutes: 68 },
  { id: 6, technician: "Tech 2", vehicle: "19", category: "Inspection / Diagnosis", note: "Front-end noise", minutes: 84 },
];

function fmt(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return `${h}h ${m}m`;
}

function elapsed(startedAt: number | null, now: number) {
  if (!startedAt) return "0:00:00";
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function TechTimeDraftPage() {
  const [view, setView] = useState<"tech" | "board" | "report">("tech");
  const [tech, setTech] = useState("Tech 1");
  const [vehicle, setVehicle] = useState("");
  const [category, setCategory] = useState("Damage Repair");
  const [note, setNote] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [recent, setRecent] = useState<DemoJob[]>(sampleJobs.slice(0, 3));

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const report = useMemo(() => {
    const salaries: Record<string, number> = { "Tech 1": 1500, "Tech 2": 1250 };
    return ["Tech 1", "Tech 2"].map((name) => {
      const rows = sampleJobs.filter((j) => j.technician === name);
      const minutes = rows.reduce((sum, j) => sum + j.minutes, 0);
      const hours = minutes / 60;
      return {
        name,
        jobs: rows.length,
        minutes,
        salary: salaries[name],
        costPerProductiveHour: hours ? salaries[name] / hours : 0,
      };
    });
  }, []);

  function stopJob() {
    if (!startedAt) return;
    const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    setRecent((rows) => [
      {
        id: Date.now(),
        technician: tech,
        vehicle: vehicle || "—",
        category,
        note,
        minutes: mins,
      },
      ...rows,
    ].slice(0, 6));
    setStartedAt(null);
    setVehicle("");
    setNote("");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f4f5f7", color: "#171b22", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header style={{ background: "#101924", color: "white", padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ width: 84, height: "auto" }} />
          <div>
            <div style={{ fontSize: 13, opacity: .7, letterSpacing: ".12em", fontWeight: 800 }}>DRAFT CONCEPT</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 28 }}>Epic Tech Time</h1>
            <div style={{ opacity: .72, fontSize: 14 }}>Simple shop timekeeping — not maintenance management</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setView("tech")} style={tab(view === "tech")}>Tech Station</button>
          <button onClick={() => setView("board")} style={tab(view === "board")}>Shop Board</button>
          <button onClick={() => setView("report")} style={tab(view === "report")}>Weekly Report</button>
        </div>
      </header>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "24px" }}>
        <div style={{ background: "#fff7e8", border: "1px solid #f0cf8b", borderRadius: 14, padding: "13px 16px", marginBottom: 20, fontSize: 14 }}>
          <strong>Conversation draft for Joe:</strong> This page is intentionally narrow. A tech identifies themselves, enters the vehicle, chooses what kind of work they are doing, and presses Start/Stop. The report shows where paid shop time went.
        </div>

        {view === "tech" ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, .65fr)", gap: 20 }}>
            <section style={card}>
              <div style={stepTitle}><span style={stepBadge}>1</span> Who is working?</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                {["Tech 1", "Tech 2"].map((name) => (
                  <button key={name} onClick={() => !startedAt && setTech(name)} disabled={!!startedAt} style={choice(tech === name)}>
                    {name}
                  </button>
                ))}
              </div>

              <div style={stepTitle}><span style={stepBadge}>2</span> What vehicle?</div>
              <input
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Vehicle number — e.g. 42"
                disabled={!!startedAt}
                style={input}
              />

              <div style={{ ...stepTitle, marginTop: 24 }}><span style={stepBadge}>3</span> What are you doing?</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {categories.map((c) => (
                  <button key={c} onClick={() => !startedAt && setCategory(c)} disabled={!!startedAt} style={choice(category === c)}>
                    {c}
                  </button>
                ))}
              </div>

              <div style={{ ...stepTitle, marginTop: 24 }}><span style={stepBadge}>4</span> Note <span style={{ color: "#7b8491", fontWeight: 500 }}>(optional)</span></div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={!!startedAt} placeholder="Anything useful about this job..." style={{ ...input, minHeight: 78, resize: "vertical" }} />

              {!startedAt ? (
                <button
                  onClick={() => vehicle && setStartedAt(Date.now())}
                  disabled={!vehicle}
                  style={{ width: "100%", marginTop: 24, border: 0, borderRadius: 14, padding: "18px", fontSize: 22, fontWeight: 900, background: vehicle ? "#1f8a4c" : "#c9ced6", color: "white", cursor: vehicle ? "pointer" : "not-allowed" }}
                >
                  START JOB
                </button>
              ) : (
                <div style={{ marginTop: 24, borderRadius: 16, border: "2px solid #1f8a4c", padding: 20, background: "#f4fff8" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#1f8a4c", letterSpacing: ".08em" }}>JOB IN PROGRESS</div>
                  <div style={{ fontSize: 42, fontWeight: 900, margin: "8px 0" }}>{elapsed(startedAt, now)}</div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{tech} · Vehicle {vehicle}</div>
                  <div style={{ color: "#58616d", marginTop: 4 }}>{category}{note ? ` — ${note}` : ""}</div>
                  <button onClick={stopJob} style={{ width: "100%", marginTop: 18, border: 0, borderRadius: 14, padding: "17px", fontSize: 20, fontWeight: 900, background: "#c7382b", color: "white", cursor: "pointer" }}>
                    STOP JOB
                  </button>
                </div>
              )}
            </section>

            <aside style={card}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>What the tech sees</h2>
              <p style={{ color: "#68717d", lineHeight: 1.5, marginTop: -4 }}>No work order to build. No maintenance record to complete. No complicated form.</p>

              <div style={{ borderTop: "1px solid #e3e6ea", margin: "20px 0" }} />

              <h3 style={{ fontSize: 16 }}>Recent jobs</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {recent.map((job) => (
                  <div key={job.id} style={{ border: "1px solid #e3e6ea", borderRadius: 12, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 800 }}>
                      <span>Vehicle {job.vehicle}</span><span>{fmt(job.minutes)}</span>
                    </div>
                    <div style={{ fontSize: 14, marginTop: 4 }}>{job.category}</div>
                    <div style={{ color: "#7b8491", fontSize: 12, marginTop: 4 }}>{job.technician}{job.note ? ` · ${job.note}` : ""}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: "#f4f6f8", color: "#58616d", fontSize: 13, lineHeight: 1.5 }}>
                Later, a <strong>Damage Repair</strong> entry could optionally link to an Incident & Damage case. Tech Time still remains its own record.
              </div>
            </aside>
          </div>
        ) : view === "board" ? (
          <section style={{ ...card, background: "#111923", color: "white", minHeight: 620 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, color: "#9aa7b5", fontWeight: 900, letterSpacing: ".12em" }}>BIG SCREEN SHOP VIEW</div>
                <h2 style={{ margin: "5px 0 0", fontSize: 34 }}>What is happening in the shop right now?</h2>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#9aa7b5", fontWeight: 800 }}>TODAY</div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>2 ACTIVE · 6 COMPLETED</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginTop: 24 }}>
              {[
                { tech: "Tech 1", vehicle: "42", task: "Damage Repair", note: "LF fender + mount", started: "9:12 AM", elapsed: "1h 38m" },
                { tech: "Tech 2", vehicle: "31", task: "Belt", note: "Inspect + replace", started: "10:04 AM", elapsed: "46m" },
              ].map((j) => (
                <div key={j.tech} style={{ border: "2px solid #2aa567", background: "#17242f", borderRadius: 18, padding: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <div>
                      <div style={{ color: "#57d58e", fontSize: 13, fontWeight: 900, letterSpacing: ".08em" }}>WORKING NOW</div>
                      <div style={{ fontSize: 30, fontWeight: 900, marginTop: 6 }}>{j.tech}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#9aa7b5", fontSize: 12, fontWeight: 800 }}>VEHICLE</div>
                      <div style={{ fontSize: 38, fontWeight: 900 }}>{j.vehicle}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 18, fontSize: 24, fontWeight: 900 }}>{j.task}</div>
                  <div style={{ color: "#b7c0ca", marginTop: 5, fontSize: 16 }}>{j.note}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, paddingTop: 16, borderTop: "1px solid #33414f" }}>
                    <span style={{ color: "#9aa7b5" }}>Started {j.started}</span>
                    <strong style={{ fontSize: 22 }}>{j.elapsed}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 14, color: "#9aa7b5", fontWeight: 900, letterSpacing: ".08em", marginBottom: 10 }}>COMPLETED TODAY</div>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr 1fr .7fr .7fr", padding: "10px 14px", color: "#9aa7b5", fontSize: 12, fontWeight: 900, borderBottom: "1px solid #35414d" }}>
                <span>TECH</span><span>VEHICLE</span><span>JOB</span><span>TIME</span><span>FINISHED</span>
              </div>
              {sampleJobs.slice(0, 6).map((job, i) => (
                <div key={job.id} style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr 1fr .7fr .7fr", padding: "14px", borderBottom: "1px solid #293541", fontSize: 16, alignItems: "center" }}>
                  <strong>{job.technician}</strong><strong>#{job.vehicle}</strong><span>{job.category}</span><strong>{fmt(job.minutes)}</strong><span style={{ color: "#b7c0ca" }}>{["8:41 AM","9:18 AM","10:02 AM","10:26 AM","11:11 AM","11:42 AM"][i]}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, marginTop: 24 }}>
              {[
                ["Productive Time Today", "6.8 hrs"],
                ["Jobs Completed", "6"],
                ["Avg Completed Job", "68 min"],
              ].map(([label,value]) => (
                <div key={label} style={{ background: "#1a2733", border: "1px solid #33414f", borderRadius: 14, padding: 16 }}>
                  <div style={{ color: "#9aa7b5", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, color: "#7b8491", fontWeight: 800, letterSpacing: ".08em" }}>SAMPLE WEEK</div>
                <h2 style={{ margin: "5px 0 0", fontSize: 28 }}>Shop Productive Time</h2>
              </div>
              <div style={{ color: "#68717d", fontSize: 14 }}>Draft numbers only — demonstrating the questions the report can answer.</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 22 }}>
              {[
                ["Productive Hours", "6.8"],
                ["Jobs Logged", String(sampleJobs.length)],
                ["Avg Job", "68 min"],
                ["Damage Repair", "2.1 hrs"],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "#f5f6f8", borderRadius: 14, padding: 16, border: "1px solid #e5e7eb" }}>
                  <div style={{ color: "#7b8491", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div>
                </div>
              ))}
            </div>

            <h3 style={{ marginTop: 28 }}>By technician</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#68717d" }}>
                    {["Technician", "Weekly Pay", "Productive Time", "Jobs", "Cost / Productive Hour"].map((h) => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.name} style={{ borderTop: "1px solid #e7e9ed" }}>
                      <td style={td}><strong>{r.name}</strong></td>
                      <td style={td}>${r.salary.toLocaleString()}</td>
                      <td style={td}>{fmt(r.minutes)}</td>
                      <td style={td}>{r.jobs}</td>
                      <td style={td}><strong>${r.costPerProductiveHour.toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{ marginTop: 28 }}>By job category</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {Array.from(new Set(sampleJobs.map((j) => j.category))).map((c) => {
                const rows = sampleJobs.filter((j) => j.category === c);
                const mins = rows.reduce((s, j) => s + j.minutes, 0);
                return (
                  <div key={c} style={{ border: "1px solid #e3e6ea", borderRadius: 12, padding: 14 }}>
                    <div style={{ fontWeight: 800 }}>{c}</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{fmt(mins)}</div>
                    <div style={{ color: "#7b8491", marginTop: 2, fontSize: 13 }}>{rows.length} job{rows.length === 1 ? "" : "s"} · avg {Math.round(mins / rows.length)} min</div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 26, borderTop: "1px solid #e3e6ea", paddingTop: 20 }}>
              <strong>Questions this should help answer:</strong>
              <div style={{ color: "#58616d", lineHeight: 1.7, marginTop: 8 }}>
                How many paid hours are identifiable as productive shop work? What categories consume the time? How long does a typical fluid change, tire rotation, belt job, recovery, or damage repair actually take? Are we improving? Where do we need better process or training?
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #e1e4e8",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 8px 28px rgba(22, 28, 36, .06)",
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cfd5dc",
  borderRadius: 12,
  padding: "14px 15px",
  fontSize: 17,
  outline: "none",
  background: "white",
};

const stepTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  fontWeight: 900,
  fontSize: 16,
  marginBottom: 10,
};

const stepBadge: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  display: "inline-grid",
  placeItems: "center",
  background: "#111923",
  color: "white",
  fontSize: 13,
};

function choice(active: boolean): React.CSSProperties {
  return {
    border: active ? "2px solid #e35f20" : "1px solid #d9dde2",
    borderRadius: 12,
    padding: "13px 14px",
    background: active ? "#fff4ee" : "white",
    color: "#1d232b",
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "left",
  };
}

function tab(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #f36b2b" : "1px solid #3c4755",
    background: active ? "#f36b2b" : "#182330",
    color: "white",
    padding: "10px 14px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
  };
}

const th: React.CSSProperties = { padding: "10px 12px", fontSize: 12, textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "14px 12px" };
