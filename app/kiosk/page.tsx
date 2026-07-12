import Link from "next/link";

export default function KioskPage() {
  return (
    <main className="home">
      <p className="eyebrow">EpicTools</p>
      <h1>Guest Kiosk</h1>
      <p>Next build: find today&apos;s reservation by booking phone last 4.</p>
      <div className="homeLinks">
        <Link href="/team/readiness">Back to Staff Dashboard</Link>
      </div>
    </main>
  );
}
