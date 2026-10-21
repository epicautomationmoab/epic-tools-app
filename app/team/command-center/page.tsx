import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import NativeCustomerSearch from "./NativeCustomerSearch";

// Native EpicTools employee surface, not a link to another app.
export default async function CommandCenterCustomerPage() {
  const token = (await cookies()).get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(token);
  if (!profile || profile.role === "workstation") redirect("/team/login");

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6f9", padding: "clamp(16px,3vw,44px)", color: "#17263b" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ fontWeight: 900, letterSpacing: 2, color: "#ba332b", fontSize: 13 }}>EPIC COMMAND CENTER</div>
        <h1 style={{ marginBottom: 5 }}>Customers</h1>
        <p style={{ color: "#54667c", maxWidth: 690 }}>Native customer search in the unified team application. Existing customer detail, Lead Sheet, communication and booking capabilities remain in their current production applications while the full native migration is tested.</p>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e0e6ee", padding: "clamp(14px,3vw,24px)", marginTop: 22 }}>
          <NativeCustomerSearch />
        </div>
      </div>
    </main>
  );
}
