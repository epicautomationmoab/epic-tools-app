import Link from "next/link";

export default function Home() {
  return (
    <main className="home">
      <p className="eyebrow">EpicTools</p>
      <h1>Guest Readiness</h1>
      <div className="homeLinks">
        <Link href="/team/readiness">Staff Dashboard</Link>
        <Link href="/team/arrival-board">Arrival Board</Link>
        <Link href="/kiosk">Guest Kiosk</Link>
      </div>
    </main>
  );
}
