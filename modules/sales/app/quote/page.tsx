import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QuoteBuilder from "../quote-builder";
import EpicC360Sidebar from "../EpicC360Sidebar";
import { getAuthenticatedTeamProfile } from "../../lib/team-auth";

const navStyle = "epicC360QuoteNav";
const activeStyle = "epicC360QuoteActive";
const footerStyle = "epicC360QuoteFooter";

export default async function QuotePage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || !profile.active || profile.role === "workstation") redirect("/uui-login");

  return (
    <>
      <style>{`
        .quote-host .topbar{display:none!important}
        .${navStyle}{padding:16px 12px 8px;display:grid;gap:6px}
        .${navStyle} a{color:#cfd7e3;text-decoration:none;font-size:14px;font-weight:800;padding:11px 12px;border-radius:8px}
        .${navStyle} a:hover{background:rgba(255,255,255,.06)}
        .${activeStyle}{background:rgba(255,255,255,.08)!important;color:#fff!important;box-shadow:inset 3px 0 0 #d71920}
        .${footerStyle}{margin-top:auto;padding:16px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;color:#8f9aaa}
        .${footerStyle} strong{display:block;margin-top:4px;color:#fff;font-size:13px}
      `}</style>
      <EpicC360Sidebar
        active="quote"
        profileName={profile.display_name}
        className="epicC360QuoteSidebar"
        navClassName={navStyle}
        activeClassName={activeStyle}
        footerClassName={footerStyle}
      />
      <style>{`.epicC360QuoteSidebar{position:fixed;inset:0 auto 0 0;width:220px;background:#111926;color:#cfd7e3;display:flex;flex-direction:column;z-index:30;box-shadow:8px 0 28px rgba(9,17,29,.12)}.quote-host{margin-left:220px}.quote-host .content{margin-left:0;max-width:1240px;margin-right:auto;padding:28px 34px 42px}.quote-host .quoteGrid{grid-template-columns:minmax(520px,1.15fr) minmax(390px,.85fr);gap:28px}@media(max-width:1100px){.quote-host .quoteGrid{grid-template-columns:1fr}}`}</style>
      <div className="quote-host"><QuoteBuilder /></div>
    </>
  );
}
