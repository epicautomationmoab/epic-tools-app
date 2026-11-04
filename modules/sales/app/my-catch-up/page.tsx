import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {getAuthenticatedTeamProfile} from "../../lib/team-auth";
import EpicC360Sidebar from "../EpicC360Sidebar";
import styles from "../leads/Leads.module.css";
import ui from "./CatchUp.module.css";
import CatchUpFeed from "./CatchUpFeed";
import ScheduledFollowUps from "./ScheduledFollowUps";
export default async function CatchUpPage(){
 const token=(await cookies()).get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!profile||profile.role==="workstation")redirect("/uui-login");
 const first=(profile.display_name||"there").split(" ")[0];
 return <main className={styles.shell}>
 <EpicC360Sidebar active="catch-up" profileName={profile.display_name} className={styles.sidebar} navClassName={styles.nav} activeClassName={styles.active} footerClassName={styles.sidebarFooter}/>
 <section className={ui.main}><header className={ui.hero}><div><div className={ui.eyebrow}>EPIC C360 / MY CATCH-UP</div><h1>Welcome back, {first}.</h1><p>Your follow-ups, team mentions, and customer activity in one place.</p></div><a href="/sales/inbox" className={ui.back}>← Back to Inbox</a></header>
 <ScheduledFollowUps/><CatchUpFeed profileId={profile.id} profileName={profile.display_name}/>
 </section></main>
}
