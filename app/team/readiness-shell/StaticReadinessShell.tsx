"use client";

import { useState } from "react";

const rows = [
  { guest: "Gary Stevenson", activity: "Moab Discovery Tour", readiness: "Ready", docs: "5/5", mpwr: "0/5", balance: "$0", ohv: "N/A", phone: "1234", tone: "ready" },
  { guest: "Kevin McNemar", activity: "Moab Discovery Tour", readiness: "Needs docs", docs: "0/2", mpwr: "0/2", balance: "$0", ohv: "N/A", phone: "5678", tone: "danger" },
  { guest: "Megan Jedry", activity: "Moab Discovery Tour", readiness: "Needs docs", docs: "0/3", mpwr: "0/3", balance: "$0", ohv: "N/A", phone: "4567", tone: "danger" },
  { guest: "Melissa Farney", activity: "Moab Discovery Tour", readiness: "Needs docs", docs: "0/5", mpwr: "0/5", balance: "$0", ohv: "N/A", phone: "2468", tone: "danger" },
  { guest: "Raul Morales", activity: "2026 4-Seat Polaris RZR XP S 1000 Ultimate", readiness: "OHV missing", docs: "0/1", mpwr: "0/?", balance: "$0", ohv: "Missing", phone: "7890", tone: "danger" },
  { guest: "Greg Heitkamp", activity: "Gateway to Hell's Revenge and Fins N' Things", readiness: "Partial", docs: "6/6", mpwr: "0/6", balance: "Balance due", ohv: "N/A", phone: "1311", tone: "warning" },
];

const kiosks = [
  ["Kiosk 1", "available"],
  ["Kiosk 2 · In Use — Smith", "busy"],
  ["Kiosk 3", "available"],
  ["Kiosk 4", "available"],
  ["Kiosk 5 · Idle on guest portal", "idle"],
  ["Kiosk 6", "available"],
  ["Kiosk 7", "available"],
];

export default function StaticReadinessShell() {
  const [openPhone, setOpenPhone] = useState<string | null>("5678");

  return (
    <main className="epicAppShell">
      <aside className="epicSidebar">
        <div className="brandBlock">
          <div className="brandMark">E4X4</div>
          <div><strong>EPIC</strong><span>TOOLS</span></div>
        </div>

        <nav className="sidebarNav" aria-label="Epic Tools">
          <a className="active" href="#">◉ Guest Readiness</a>
          <a href="#">▣ Reservations</a>
          <a href="#">◆ MPWR</a>
        </nav>

        <div className="sidebarPhoto" aria-label="Epic trail photo placeholder" />

        <section className="agentCard">
          <div className="agentCardTitle">Agent Status</div>
          {[
            ["MPWR Agent", "Online"],
            ["Builder Agent", "Online"],
            ["Waiver Agent · Tanya", "Online"],
            ["Portal Agent · Patti", "Online"],
          ].map(([name, status]) => (
            <div className="agentRow" key={name}>
              <span className="statusDot" />
              <span>{name}</span>
              <small>{status}</small>
            </div>
          ))}
        </section>
      </aside>

      <section className="epicWorkspace">
        <header className="workspaceHeader">
          <div>
            <h1>Guest Readiness</h1>
            <p>One view. Every guest. Fully ready.</p>
          </div>
          <div className="headerActions">
            <div className="syncText">↻ <span>Last synced<br /><strong>8:16 PM</strong></span></div>
            <button className="secondaryButton">Arrival Board</button>
            <button className="primaryButton">Kiosk</button>
          </div>
        </header>

        <section className="metricGrid">
          {[
            ["315", "Visits Loaded", "Today & Upcoming", "blue", "◎"],
            ["271", "Need Attention", "Require action", "orange", "△"],
            ["84", "Balance Due", "Total outstanding", "red", "▭"],
            ["72", "OHV Needed", "Not yet assigned", "purple", "◇"],
          ].map(([value, label, sub, tone, icon]) => (
            <article className={`metricCard ${tone}`} key={label}>
              <div className="metricIcon">{icon}</div>
              <div><strong>{value}</strong><span>{label}</span><small>{sub}</small></div>
            </article>
          ))}
        </section>

        <section className="toolbar">
          <div className="filterGroup">
            <button className="filter active">All</button>
            <button className="filter">Needs Attention <span>271</span></button>
            <button className="filter">Docs</button>
            <button className="filter">Balance</button>
            <button className="filter">OHV</button>
            <button className="filter">Ready <span className="greenBadge">126</span></button>
          </div>
          <input className="searchBox" aria-label="Search" placeholder="Search guests or activities..." />
        </section>

        <section className="readinessPanel">
          <div className="readinessHeader readinessGrid">
            <span>Visit ↓</span><span>Guest</span><span>Activity</span><span>Readiness</span><span>Epic Docs</span><span>MPWR</span><span>Balance</span><span>OHV</span><span>Send to Kiosk</span>
          </div>

          {rows.map((row, index) => (
            <div className={`readinessRow readinessGrid ${row.tone}`} key={row.guest}>
              <div className="visitCell"><strong>Jul 13</strong><small>{index < 5 ? "8:30 AM" : "9:00 AM"}</small></div>
              <button className="guestLink">♙ {row.guest}</button>
              <div className="activityCell">{row.activity}</div>
              <div><span className={`readinessPill ${row.tone}`}>{row.readiness}</span></div>
              <div className="countCell"><strong><i className={row.docs.startsWith("0") ? "dot red" : "dot green"} />{row.docs}</strong><small>EZNR-NIET</small></div>
              <div className="countCell"><strong><i className="dot red" />{row.mpwr}</strong><small>CO-9PA-N2B</small></div>
              <div className={row.balance === "$0" ? "balance good" : "balance due"}>{row.balance === "$0" ? "▣ $0" : "▣ Balance due"}</div>
              <div><span className={row.ohv === "Missing" ? "ohv missing" : "ohv"}>{row.ohv}</span></div>
              <div className="kioskCell">
                <button className="phoneButton" onClick={() => setOpenPhone(openPhone === row.phone ? null : row.phone)}>
                  {row.phone}<span>⌄</span>
                </button>
                {openPhone === row.phone ? (
                  <div className="kioskMenu">
                    <strong>Send to...</strong>
                    {kiosks.map(([label, status]) => (
                      <button key={label}><i className={`kioskDot ${status}`} />{label}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}
