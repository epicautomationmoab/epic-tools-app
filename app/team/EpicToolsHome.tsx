import type { ReactNode } from "react";
import type { TeamProfile as Employee } from "@/lib/team-auth";
import SharedEmployeeFooter from "../shared/SharedEmployeeFooter";
import SignOut from "../uui-home/SignOut";
import shell from "./readiness/ReadinessShell.module.css";
import styles from "./EpicToolsHome.module.css";

export type PreviewRole = "team" | "management" | "owner";
export const previewRoles: PreviewRole[] = ["team", "management", "owner"];
const labels = { team: "Team", management: "Management", owner: "Owner" };
function Icon({kind}:{kind:string}) {
  const paths:Record<string,string>={readiness:"M9 5h10v16H5V5h4m0-2h6v4H9V3m0 10 2 2 4-4",sales:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m9 3a4 4 0 0 1 4 4v3m-5-18a4 4 0 0 1 0 8",reports:"M4 3v18h17M8 17v-4m5 4V9m5 8V5",iron:"M3 18h18M5 18V9l7-5 7 5v9M9 18v-6h6v6",users:"M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6M5 20v-3a7 7 0 0 1 14 0v3",audit:"M6 3h9l3 3v6M6 3v18h7M9 8h5M9 12h3m5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0 2v2l2 1",ambassador:"m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1 3-6",home:"m3 11 9-8 9 8M5 9v12h14V9M9 21v-7h6v7"};
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;
}
export default function EpicToolsHome({profile,title="Home",children}:{profile:Employee;title?:string;children?:ReactNode}) {
  const role=profile.role, managed=(role==="admin" || role==="manager");
  const workspaces=[{id:"readiness",name:"Readiness",note:"Guests & departures",href:"/team/readiness"},{id:"sales",name:"C360 / Sales",note:"Customers & conversations",href:"/sales/inbox"},...(managed?[{id:"reports",name:"Management & Reports",note:"Team activity & business reports",href:"/management"}]:[]),{id:"iron",name:"Bookings",note:"Planned",href:null}];
  const administration=managed?[{id:"users",name:"User Administration",href:"/admin/users"},...(process.env.EPIC_AUDIT_OWNER_PROFILE_IDS?.split(",").map(id=>id.trim()).includes(profile.id)?[{id:"audit",name:"User Audit Trail",href:"/admin/audit"}]:[]),{id:"ambassador",name:"Ambassador Administration",href:null}]:[];
  return <div className={shell.page}>
    <div className={styles.preview}><span>EPICTOOLS</span></div>
    <aside className={`${shell.sidebar} ${styles.sidebar}`}>
      <div className={shell.brand}><img src="/epic-logo.png" alt="Epic 4X4 Adventures"/></div>
      <nav className={styles.nav} aria-label="EpicTools navigation"><a href="/uui-home" className={title==="Home"?styles.active:undefined}><Icon kind="home"/>Home</a>{workspaces.map(w=>w.href?<a key={w.id} href={w.href} className={title===w.name?styles.active:undefined}><Icon kind={w.id}/>{w.name}</a>:<span key={w.id} className={styles.navItem} aria-disabled="true"><Icon kind={w.id}/>{w.name}</span>)}</nav>
      {managed&&<div className={styles.adminNav}><p>ADMINISTRATION</p>{administration.map(a=>a.href?<a key={a.id} href={a.href} className={styles.navItem}><Icon kind={a.id}/>{a.name}</a>:<span key={a.id} className={styles.navItem} aria-disabled="true"><Icon kind={a.id}/>{a.name}</span>)}</div>}
      <div className={shell.sidebarPhoto}/><SharedEmployeeFooter displayName={profile.display_name}/>
    </aside>
    <main className={`${shell.main} ${styles.main}`}>
      <header className={shell.topbar}><div className={shell.titleBlock}><h1>{title}</h1></div><span className={styles.role}>{profile.display_name}</span></header>
      {title!=="Home"&&<a className={styles.back} href="/uui-home">← Home</a>}
      {children??<><section className={styles.section} aria-labelledby="workspaces"><h2 id="workspaces">Workspaces</h2><div className={styles.grid}>{workspaces.map(w=>{const content=<><span className={styles.icon}><Icon kind={w.id}/></span><div><h3>{w.name}</h3>{w.href?<p>{w.note}</p>:<span className={styles.badge}>{w.note}</span>}</div><span className={styles.arrow} aria-hidden="true">{w.href?"→":""}</span></>;return w.href?<a key={w.id} href={w.href} className={styles.card}>{content}</a>:<article key={w.id} className={styles.card} aria-disabled="true">{content}</article>;})}</div></section>
      {managed&&<section className={styles.section} aria-labelledby="administration"><h2 id="administration">Administration</h2><div className={styles.adminPanel}>{administration.map(a=>a.href?<a key={a.id} href={a.href} className={styles.adminRow}><Icon kind={a.id}/><strong>{a.name}</strong><span className={styles.arrow}>→</span></a>:<div key={a.id} className={styles.adminRow} aria-disabled="true"><Icon kind={a.id}/><strong>{a.name}</strong><span className={styles.badge}>Planned</span></div>)}</div></section>}</>}
    </main>
  </div>;
}
