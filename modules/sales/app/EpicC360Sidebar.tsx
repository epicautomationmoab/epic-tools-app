"use client";

import { useEffect, useState } from "react";
import SharedEmployeeFooter from "@/app/shared/SharedEmployeeFooter";
type ActiveSection = "inbox" | "missed-calls" | "phone-report" | "leads" | "customers" | "quote" | "call-recordings" | "ping" | "catch-up";

type Props = {
  active: ActiveSection;
  profileName: string;
  className: string;
  navClassName: string;
  activeClassName: string;
  footerClassName: string;
  canManage?: boolean;
};

const items: Array<{ key: ActiveSection; href: string; label: string }> = [
  { key: "inbox", href: "/sales/inbox", label: "Inbox" },
  { key: "catch-up", href: "/sales/my-catch-up", label: "My Catch-Up" },
  { key: "missed-calls", href: "/sales/missed-calls", label: "Missed Calls" },
  { key: "leads", href: "/sales/leads", label: "Sales Opportunities" },
  { key: "quote", href: "/sales/quote", label: "Quote Builder" },
  { key: "customers", href: "/sales/customers", label: "C360" },
  { key: "phone-report", href: "/sales/phone-report", label: "Phone Report" },
  { key: "call-recordings", href: "/sales/call-recordings", label: "Call Recordings" },
];

export default function EpicC360Sidebar({
  active,
  profileName,
  className,
  navClassName,
  activeClassName,
  footerClassName,
  canManage = false,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mentionCount, setMentionCount] = useState(0);
  useEffect(() => { let mounted=true; const refresh=async()=>{try{const r=await fetch("/api/sales/my-catch-up",{cache:"no-store"});if(!r.ok)return;const data=await r.json();if(mounted)setMentionCount(Number(data.mentions?.unread_count||0));}catch{}};void refresh();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh()},15000);return()=>{mounted=false;window.clearInterval(timer)};},[]);
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/sales/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Unable to log out.");
      window.location.assign("/uui-login");
    } catch {
      setLoggingOut(false);
      window.alert("Unable to log out. Please try again.");
    }
  }
  return (
    <aside className={className}>
      <div className="epicC360Brand">
        <img src="https://myepicreservation.com/epic-logo.png" alt="Epic 4X4 Adventures" />
        <div className="epicC360Product">EpicC360</div>
        <div className="epicC360Tagline">Every customer. One complete history.</div>
      </div>
      <nav className={navClassName}><a href="/uui-home">← Home</a>
        {items.map((item) => item.key === "catch-up" ? (<>
          <button key="new-lead-sheet" type="button" onClick={() => window.dispatchEvent(new Event("epicc360:new-lead-sheet"))} style={{display:"block",width:"calc(100% - 22px)",margin:"7px 11px 12px",padding:"11px 12px",border:"1px solid #e33732",borderRadius:24,background:"#c92320",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",textAlign:"center"}}>+ New Lead Sheet</button>
          <a key={item.key} className={active === item.key ? activeClassName : undefined} href={item.href}>{item.label}{mentionCount>0?<span style={{marginLeft:8,padding:"2px 7px",background:"#d84a27",borderRadius:12,color:"#fff",fontSize:11,fontWeight:800}}>{mentionCount}</span>:null}</a>
        </>) : (
          <a key={item.key} className={active === item.key ? activeClassName : undefined} href={item.href}>
            {item.label}
          </a>
        ))}
        {canManage ? <a href="/sales/inbox/blocked-domains">Blocked Email Domains</a> : null}
      </nav>
      <SharedEmployeeFooter displayName={profileName}/></aside>
  );
}
