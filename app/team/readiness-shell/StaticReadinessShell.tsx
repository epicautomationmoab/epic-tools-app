"use client";

import { useEffect, useState } from "react";

const rows = [
  { guest: "Gary Stevenson", activity: "Moab Discovery Tour", assure: "Tour", docs: "5/5", mpwr: "0/5", balance: "$0", ohv: "N/A", phone: "1234", tone: "ready", note: "" },
  { guest: "Kevin McNemar", activity: "Moab Discovery Tour", assure: "Tour", docs: "0/2", mpwr: "1/2", balance: "$0", ohv: "N/A", phone: "5678", tone: "danger", note: "Guest called they are running late will arrive at 8:30." },
  { guest: "Megan Jedry", activity: "Moab Discovery Tour", assure: "Premier", docs: "0/3", mpwr: "0/3", balance: "$0", ohv: "N/A", phone: "4567", tone: "danger", note: "50th Anniversary" },
  { guest: "Melissa Farney", activity: "Moab Discovery Tour", assure: "Standard", docs: "3/5", mpwr: "0/5", balance: "$0", ohv: "N/A", phone: "2468", tone: "danger", note: "Return Guest" },
  { guest: "Raul Morales", activity: "2026 4-Seat Polaris RZR XP S 1000 Ultimate", assure: "Premier", docs: "0/1", mpwr: "0/3", balance: "$0", ohv: "Missing", phone: "7890", tone: "danger", note: "" },
  { guest: "Greg Heitkamp", activity: "Gateway to Hell's Revenge and Fins N' Things", assure: "Tour", docs: "6/6", mpwr: "4/6", balance: "Balance due", ohv: "N/A", phone: "1311", tone: "warning", note: "" },
];

const epicDocsSigners = [
  { name: "Adriane Stevenson", type: "Adult" },
  { name: "Amelia Stevenson", type: "Minor" },
  { name: "Gary Stevenson", type: "Adult" },
  { name: "Harlow Stevenson", type: "Minor" },
  { name: "Sutter Stevenson", type: "Minor" },
];

const mpwrSigners = [
  { name: "Adriane Stevenson", type: "Adult" },
  { name: "Gary Stevenson", type: "Adult" },
  { name: "Amelia Stevenson", type: "Minor" },
  { name: "Harlow Stevenson", type: "Minor" },
  { name: "Sutter Stevenson", type: "Minor" },
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
const isCompleteCount = (value: string) => {
  const [completed, required] = value.split("/").map(Number);
  return completed === required;
};
export default function StaticReadinessShell() {
  const [openPhone, setOpenPhone] = useState<string | null>("null");
  
  const [selectedGuest, setSelectedGuest] =
  useState<(typeof rows)[number] | null>(null);
const now = new Date();

const [currentTime, setCurrentTime] = useState<Date | null>(null);

useEffect(() => {
  setCurrentTime(new Date());

  const clockInterval = window.setInterval(() => {
    setCurrentTime(new Date());
  }, 1000);

  return () => window.clearInterval(clockInterval);
}, []);

const headerDate = currentTime
  ? currentTime.toLocaleString("en-US", {
      timeZone: "America/Denver",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    })
  : "";

  return (
    <main className="epicAppShell">
      <aside className="epicSidebar">
        <div className="brandBlock">
          <div className="brandMark">
  <img
    src="/epic-logo.png"
    alt="Epic 4X4 Adventures"
  />
</div>
        </div>

        <nav className="sidebarNav" aria-label="Epic Tools">
          <a className="active" href="#">◉ Guest Readiness</a>
          <a
  href="https://epic4x4.tripworks.com/"
  target="_blank"
  rel="noreferrer"
>
  Reservations
</a>

<a
  href="https://mpwr-hq.poladv.com/orders"
  target="_blank"
  rel="noreferrer"
>
  MPWR
</a>
        </nav>

        <div className="sidebarPhoto" aria-label="Epic trail photo placeholder" />

        <section className="agentCard">
          <div className="agentCardTitle">Agent Status</div>
          {[
            ["MPWR Agent", "Online"],
            ["Builder Agent", "Online"],
            ["Waiver Agent", "Online"],
            ["Portal Agent", "Online"],
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
<p className="dashboardDate">{headerDate}</p>
          </div>
          <div className="headerActions">
            <div className="syncText">↻ <span>Last synced<br /><strong>8:16 PM</strong></span></div>
            <button className="secondaryButton">Arrival Board</button>
            <button className="primaryButton">Kiosk</button>
          </div>
        </header>

        <section className="toolbar">
          <div className="filterGroup">
            <button className="filter active">All<span>315</span></button>
            <button className="filter">Tours<span>243</span></button>
            <button className="filter">Rentals<span>72</span></button>
          </div>
          <input className="searchBox" aria-label="Search" placeholder="Search guests or activities..." />
        </section>

        <section className="readinessPanel">
          <div className="readinessHeader readinessGrid">
            <span>Visit ↓</span><span>Guest</span><span>Activity</span><span>Epic Docs</span><span>MPWR Waiver</span><span>Adventure Assure</span><span>Balance</span><span>OHV</span><span>Send to Kiosk</span><span>Note</span>
          </div>

          {rows.map((row, index) => (
<div
  className={`readinessRow readinessGrid ${row.tone}`}
  key={row.guest}
onClick={() => {
  if (openPhone) {
    setOpenPhone(null);
    return;
  }

  setSelectedGuest(row);
}}
  role="button"
  tabIndex={0}
  onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      setSelectedGuest(row);
    }
  }}
>
<div className="visitCell">
  <div className="visitDate">
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="visitDateIcon"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7 3v4M17 3v4M3 9h18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 13h2M12 13h2M16 13h1M8 17h2M12 17h2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
    <strong>Jul 13</strong>
  </div>
  <small>{index < 5 ? "8:30 AM" : "9:00 AM"}</small>
  </div>
<div className="guestLink">
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="guestIcon"
  >
    <circle
      cx="12"
      cy="8"
      r="3.25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M5.5 20c.6-4.1 3-6.2 6.5-6.2s5.9 2.1 6.5 6.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
  <span>{row.guest}</span>
</div>
              <div className="activityCell">{row.activity}</div>
              <div className="countCell">
  <strong>
    <span
      className={!isCompleteCount(row.docs) ? "statusMark bad" : "statusMark good"}
      aria-hidden="true"
    >
      {!isCompleteCount(row.docs) ? "🚫" : "✓"}
    </span>
    {row.docs}
  </strong>
  <small>EZNR-NIET</small>
</div>
<div className="countCell">
  <strong>
    <span
      className={!isCompleteCount(row.mpwr) ? "statusMark bad" : "statusMark good"}
      aria-hidden="true"
    >
      {!isCompleteCount(row.mpwr) ? "🚫" : "✓"}
    </span>
    {row.mpwr}
  </strong>
  <small>CO-9PA-N2B</small>
</div>
<div className={`assureCell ${row.assure.toLowerCase()}`}>
  {row.assure}
</div>
<div className={row.balance === "$0" ? "balance good" : "balance due"}>
  <svg
  viewBox="0 0 24 24"
  aria-hidden="true"
  className="balanceIcon"
>
  <rect
    x="2.5"
    y="5"
    width="19"
    height="14"
    rx="2.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  />
  <path
    d="M2.5 9h19"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  />
  <circle cx="16.5" cy="15.2" r="1.7" fill="currentColor" opacity=".55" />
  <circle cx="18.8" cy="15.2" r="1.7" fill="currentColor" opacity=".9" />
</svg>
  <span>{row.balance === "$0" ? "$0" : "$ Due"}</span>
</div>              <div><span className={row.ohv === "Missing" ? "ohv missing" : "ohv"}>{row.ohv}</span></div>
<div
  className="kioskCell"
  onClick={(event) => event.stopPropagation()}
>
  <button
    className="phoneButton"
onClick={(event) => {
  event.stopPropagation();
  setOpenPhone(openPhone === row.phone ? null : row.phone);
}}
>
    {row.phone}<span>⌄</span>
  </button>

  {openPhone === row.phone ? (
    <div className="kioskMenu">
      <strong>Send to...</strong>
      {kiosks.map(([label, status]) => (
        <button key={label}>
          <i className={`kioskDot ${status}`} />
          {label}
        </button>
      ))}
    </div>
  ) : null}
</div>

<div className="noteCell" title={row.note || undefined}>
  {row.note ? "📝" : ""}
</div>
            </div>
          ))}
        </section>
      </section>
      {selectedGuest && (
  <div
    className="drawerBackdrop"
    onClick={() => setSelectedGuest(null)}
  >
    <aside
      className="guestDrawer"
      onClick={(event) => event.stopPropagation()}
    >
      <button
  className="drawerClose"
  onClick={() => setSelectedGuest(null)}
  aria-label="Close guest details"
>
  ✕
</button>

<div className="drawerEyebrow">Guest Details</div>

<h2 className="drawerGuestName">{selectedGuest.guest}</h2>

<div className="drawerMeta">
  <div>
    <svg
      className="drawerMetaIcon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7 3v4M17 3v4M3 9h18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
    <span>Jul 13 · 8:30 AM · {selectedGuest.activity}</span>
  </div>

  <div>
    <svg
      className="drawerMetaIcon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M6.6 3.5 9.4 6.3 7.8 9c1.4 2.8 3.5 4.9 6.3 6.3l2.7-1.6 2.8 2.8-1.8 3c-.4.7-1.2 1.1-2 1-6.6-.8-11.9-6.1-12.7-12.7-.1-.8.3-1.6 1-2l2.5-1.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span>(435) 260-1234</span>
  </div>

  <div>
    <svg
      className="drawerMetaIcon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m4 7 8 6 8-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span>gary.stevenson@email.com</span>
  </div>
</div>

<div className="drawerSummaryGrid">
  <div className="drawerSummaryCard">
    <span className="drawerSummaryLabel">TripWorks Confirmation</span>
    <strong>EZNR-NIET</strong>
  </div>

  <div className="drawerSummaryCard">
    <span className="drawerSummaryLabel">Epic Docs</span>
    <strong className={isCompleteCount(selectedGuest.docs) ? "summaryGood" : "summaryBad"}>
      {isCompleteCount(selectedGuest.docs) ? "✓" : "🚫"} {selectedGuest.docs}
    </strong>
  </div>

  <div className="drawerSummaryCard">
    <span className="drawerSummaryLabel">MPWR Confirmation</span>
    <strong>CO-9PA-N2B</strong>
  </div>

  <div className="drawerSummaryCard">
    <span className="drawerSummaryLabel">MPWR Waivers</span>
    <strong className={isCompleteCount(selectedGuest.mpwr) ? "summaryGood" : "summaryBad"}>
      {isCompleteCount(selectedGuest.mpwr) ? "✓" : "🚫"} {selectedGuest.mpwr}
    </strong>
  </div>

  <div className="drawerSummaryCard">
    <span className="drawerSummaryLabel">OHV</span>
    <strong className={selectedGuest.ohv === "Missing" ? "summaryBad" : "summaryGood"}>
      {selectedGuest.ohv}
    </strong>
  </div>

  <div className="drawerSummaryCard">
    <span className="drawerSummaryLabel">Adventure Assure</span>
    <strong className={`assureCell ${selectedGuest.assure.toLowerCase()}`}>
      {selectedGuest.assure}
    </strong>
  </div>

  <div className="drawerSummaryCard drawerSummaryCardWide">
    <span className="drawerSummaryLabel">Balance Due</span>
    <strong className={selectedGuest.balance === "$0" ? "summaryGood" : "summaryBad"}>
      💳 {selectedGuest.balance === "$0" ? "$0.00" : selectedGuest.balance}
    </strong>
  </div>
</div>
<section className="drawerNotesSection">
  <div className="drawerNotesHeader">
    <h3>Notes:</h3>
  </div>

  <textarea
    className="drawerNotesInput"
    defaultValue={selectedGuest.note}
  />
</section>

<section className="drawerSection">
  <h3 className="drawerSectionTitle">Epic Docs Signers</h3>

  <div className="signerList">
    {epicDocsSigners.map((signer) => (
      <div className="signerRow" key={signer.name}>
        <div className="signerIdentity">
          <span className="signerStatus" aria-hidden="true">
            ✓
          </span>

          <div>
            <strong>{signer.name}</strong>
            <small>
              {signer.type === "Adult" ? "🕺🏼 Adult" : "👶 Minor"}
            </small>
          </div>
        </div>

        <button className="viewWaiverButton">
          View Waiver
        </button>
      </div>
    ))}
  </div>
</section>
<section className="drawerSection">
  <h3 className="drawerSectionTitle">MPWR Waiver Signers</h3>

  <div className="signerList">
    {mpwrSigners.map((signer) => (
      <div className="signerRow" key={signer.name}>
        <div className="signerIdentity">
          <span className="signerStatus mpwr" aria-hidden="true">
            ✓
          </span>

          <div>
            <strong>{signer.name}</strong>
            <small>
              {signer.type === "Adult" ? "🕺🏼 Adult" : "👶 Minor"}
            </small>
          </div>
        </div>

        <button className="viewWaiverButton">
          View Waiver
        </button>
      </div>
    ))}
  </div>
</section>
    </aside>
  </div>
)}
    </main>
  );
}
