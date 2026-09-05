import HeaderClock from "../readiness/HeaderClock";
import LogoutButton from "../readiness/LogoutButton";
import TeamSidebar from "../TeamSidebar";
import ManualAttributionClient from "./ManualAttributionClient";

export const dynamic = "force-dynamic";

export default function ReferralPartnersPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f1f3f5", color: "#202733" }}>
      <TeamSidebar active="Referral Partners" />
      <main style={{ marginLeft: 220, minHeight: "100vh", padding: "28px 30px 42px" }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.035em", lineHeight: 1.05 }}>Referral Partners</h1>
            <p style={{ margin: "6px 0 0", color: "#7b8491", fontSize: 14 }}>Credit phone reservations to active Ambassadors. Program administration is managed at epic4x4ambassador.com.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}><HeaderClock /><LogoutButton /></div>
        </header>
        <section style={{ marginTop: 26 }}>
          <ManualAttributionClient />
        </section>
      </main>
    </div>
  );
}
