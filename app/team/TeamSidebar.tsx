import Link from "next/link";
import { cookies } from "next/headers";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import styles from "./readiness/ReadinessShell.module.css";

type Props = {
  active: "Guest Readiness" | "Previous Guest Lookup" | "Email Delivery" | "Manage Employees";
};

const baseNavItems = [
  { label: "Guest Readiness", href: "/team/readiness", external: false },
  { label: "Previous Guest Lookup", href: "/team/previous-guests", external: false },
  { label: "Email Delivery", href: "/team/email-delivery", external: false },
  { label: "Reservations", href: "https://epic4x4.tripworks.com", external: true },
  { label: "MPWR", href: "https://mpwr-hq.poladv.com/orders", external: true },
] as const;

export default async function TeamSidebar({ active }: Props) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  const canManageEmployees = profile?.role === "admin" || profile?.role === "manager";

  const navItems = canManageEmployees
    ? [...baseNavItems, { label: "Manage Employees", href: "/team/auth-setup", external: false } as const]
    : baseNavItems;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src="/epic-logo.png" alt="Epic 4X4 Adventures" />
      </div>

      <nav className={styles.nav} aria-label="EpicTools navigation">
        {navItems.map((item) => {
          const className = item.label === active ? styles.active : undefined;
          const content = <><span aria-hidden="true">◇</span>{item.label}</>;
          return item.external ? (
            <a key={item.label} href={item.href} className={className} target="_blank" rel="noreferrer">{content}</a>
          ) : (
            <Link key={item.label} href={item.href} className={className}>{content}</Link>
          );
        })}
      </nav>

      <div className={styles.sidebarPhoto} />
    </aside>
  );
}
