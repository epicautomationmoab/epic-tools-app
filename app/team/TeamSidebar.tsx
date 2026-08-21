import Link from "next/link";
import { cookies } from "next/headers";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getCarryoverRentalCount } from "./active-rentals/data";
import styles from "./readiness/ReadinessShell.module.css";

type Props = {
  active:
    | "Guest Readiness"
    | "Held-Over Rentals"
    | "Tour Dispatch"
    | "Previous Guest Lookup"
    | "Email Delivery"
    | "Manage Users";
};

const baseNavItems = [
  { label: "Guest Readiness", href: "/team/readiness", external: false },
  { label: "Held-Over Rentals", href: "/team/active-rentals", external: false },
  { label: "Tour Dispatch", href: "/team/tour-dispatch", external: false },
  { label: "Previous Guest Lookup", href: "/team/previous-guests", external: false },
  { label: "Email Delivery", href: "/team/email-delivery", external: false },
  { label: "Reservations", href: "https://epic4x4.tripworks.com", external: true },
  { label: "MPWR", href: "https://mpwr-hq.poladv.com/orders", external: true },
] as const;

export default async function TeamSidebar({ active }: Props) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("epic_access_token")?.value;
  const [profile, activeRentalCount] = await Promise.all([
    getAuthenticatedTeamProfile(accessToken),
    getCarryoverRentalCount(),
  ]);
  const canManageEmployees = profile?.role === "admin" || profile?.role === "manager";

  const navItems = canManageEmployees
    ? [...baseNavItems, { label: "Manage Users", href: "/team/auth-setup", external: false } as const]
    : baseNavItems;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src="/epic-logo.png" alt="Epic 4X4 Adventures" />
      </div>

      <nav className={styles.nav} aria-label="EpicTools navigation">
        {navItems.map((item) => {
          const className = item.label === active ? styles.active : undefined;
          const content = (
            <>
              <span aria-hidden="true">◇</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.label === "Held-Over Rentals" && activeRentalCount > 0 ? (
                <span
                  aria-label={`${activeRentalCount} held-over rental${activeRentalCount === 1 ? "" : "s"}`}
                  style={{
                    minWidth: 22,
                    height: 22,
                    padding: "0 7px",
                    borderRadius: 999,
                    display: "inline-grid",
                    placeItems: "center",
                    background: "#ffc107",
                    color: "#202733",
                    fontSize: 11,
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  {activeRentalCount}
                </span>
              ) : null}
            </>
          );
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
