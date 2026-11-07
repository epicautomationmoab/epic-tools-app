import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedTeamProfile } from "../../lib/team-auth";
import EpicC360Sidebar from "../EpicC360Sidebar";
import CustomersClient from "./CustomersClient";
import styles from "./Customers.module.css";

export default async function CustomersPage({searchParams}:{searchParams:Promise<{q?:string;open?:string}>}){
  const params=await searchParams;
  const cookieStore=await cookies();
  const accessToken=cookieStore.get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(accessToken);
  if(!profile||!accessToken)redirect("/uui-login");

  return <main className={styles.shell}>
    <EpicC360Sidebar
      active="customers"
      profileName={profile.display_name}
      className={styles.sidebar}
      navClassName={styles.nav}
      activeClassName={styles.active}
      footerClassName={styles.sidebarFooter}
    />
    <section className={styles.main}>
      <header className={styles.header}><div><div className={styles.eyebrow}>EpicC360</div><h1>C360</h1></div></header>
      <CustomersClient initialQuery={params.q||""} autoOpen={params.open==="1"} userId={profile.user_id||profile.id}/>
    </section>
  </main>;
}
