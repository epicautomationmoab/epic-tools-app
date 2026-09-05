"use client";

import { usePathname, useRouter } from "next/navigation";

export default function AmbassadorAdminLayout({children}:{children:React.ReactNode}){
  const path=usePathname(); const router=useRouter();
  if(path.includes("/ambassador/admin/login")||path.includes("/ambassador/admin/portal/")) return <>{children}</>;
  const items=[
    ["Ambassadors","/ambassador/admin"],
    ["Partner Management","/ambassador/admin/partners"],
    ["Redemptions","/ambassador/admin/redemptions"],
    ["Rewards Catalog","/ambassador/admin/rewards"],
  ];
  const active=(href:string)=>href==="/ambassador/admin"?path===href:path.startsWith(href);
  return <><div style={{position:"sticky",top:0,zIndex:50,display:"flex",justifyContent:"center",gap:8,padding:"9px 14px",background:"#0f1722",borderBottom:"1px solid rgba(255,255,255,.08)",fontFamily:"Arial,sans-serif"}}>{items.map(([label,href])=><button key={href} onClick={()=>router.push(href)} style={{border:active(href)?0:"1px solid rgba(255,255,255,.20)",borderRadius:9,padding:"9px 13px",background:active(href)?"#d5521d":"rgba(255,255,255,.06)",color:"white",fontWeight:active(href)?900:800,cursor:"pointer"}}>{label}</button>)}</div>{children}</>;
}
