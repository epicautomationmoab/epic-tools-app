import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";
import EpicC360Sidebar from "../../EpicC360Sidebar";
import styles from "../Inbox.module.css";
import BlockedDomainsClient from "./BlockedDomainsClient";

export default async function BlockedDomainsPage(){
  const cookieStore=await cookies();
  const accessToken=cookieStore.get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(accessToken);
  if(!profile||!accessToken)redirect("/uui-login");
  if(profile.role!=="admin"&&profile.role!=="manager")redirect("/sales/inbox");

  return (
    <main className={styles.shell}>
      <EpicC360Sidebar
        active="inbox"
        profileName={profile.display_name}
        className={styles.sidebar}
        navClassName={styles.nav}
        activeClassName={styles.active}
        footerClassName={styles.sidebarFooter}
        canManage
      />
      <section className={styles.main}>
        <BlockedDomainsClient/>
      </section>
    </main>
  );
}
