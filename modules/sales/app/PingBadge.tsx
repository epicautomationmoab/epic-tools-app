"use client";
import {useEffect,useState} from "react";
export default function PingBadge({endpoint,href}:{endpoint:string;href:string}){
 const [unread,setUnread]=useState(0);
 useEffect(()=>{let active=true;async function refresh(){try{const r=await fetch(endpoint,{cache:"no-store"});if(!r.ok)return;const p=await r.json();if(active)setUnread((p.messages||[]).filter((m:{to_id:string;status:string|null})=>m.to_id===p.profile?.id&&!m.status).length);}catch{}}void refresh();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh()},15000);return()=>{active=false;window.clearInterval(timer)}},[endpoint]);
 if(!unread)return null;
 return <a href={href} aria-label={unread+" unread Epic Pings"} title={unread+" unread Epic Pings"} style={{background:"#d84a27",color:"#fff",borderRadius:99,padding:"3px 8px",fontSize:11,fontWeight:900,textDecoration:"none"}}>{unread}</a>;
}
