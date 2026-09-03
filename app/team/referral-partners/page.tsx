import HeaderClock from "../readiness/HeaderClock";
import LogoutButton from "../readiness/LogoutButton";
import TeamSidebar from "../TeamSidebar";
import ReferralPartnersClient from "./ReferralPartnersClient";

export const dynamic = "force-dynamic";

export default function ReferralPartnersPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f1f3f5", color: "#202733" }}>
      <div style={{ display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)", minHeight: "100vh" }}>
        <TeamSidebar active="Referral Partners" />
        <section style={{ minWidth: 0 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "16px 24px", borderBottom: "1px solid #dfe4ea", background: "white" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24 }}>Referral Partners</h1>
              <p style={{ margin: "4px 0 0", color: "#68717d", fontSize: 13 }}>Manage partner links, guest discounts, referral rewards, and attribution rules.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}><HeaderClock /><LogoutButton /></div>
          </header>
          <div style={{ padding: 24 }}><ReferralPartnersClient /></div>
        </section>
      </div>
    </main>
  );
}
