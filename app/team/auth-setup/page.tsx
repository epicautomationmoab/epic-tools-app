import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import TeamSidebar from "../TeamSidebar";
import InviteTeamPanel from "./InviteTeamPanel";
import styles from "../readiness/ReadinessShell.module.css";

export default async function EmployeeAuthSetupPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  const hasPreviewAccess = Boolean(
    previewToken && cookieStore.get("epic_preview_access")?.value === previewToken,
  );
  const canManageEmployees = profile?.role === "admin" || profile?.role === "manager";

  if (!canManageEmployees && !hasPreviewAccess) {
    redirect("/team/readiness");
  }

  return (
    <div className={styles.page}>
      <TeamSidebar active="Manage Users" />
      <main className={styles.main}>
        <InviteTeamPanel />
      </main>
    </div>
  );
}
