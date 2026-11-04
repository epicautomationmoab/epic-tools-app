"use client";
import PingBadge from '../team/PingBadge';
import SignOut from '../uui-home/SignOut';
export default function SharedEmployeeFooter({displayName}:{displayName:string}){
 return <div data-shared-employee-tools style={{padding:'14px 12px',background:'#111926',color:'#d9e0ea',borderTop:'1px solid #ffffff20',display:'grid',gap:12}}>
 <div style={{display:'flex',gap:8,alignItems:'center',fontWeight:800,color:'inherit',textDecoration:'none'}}><a href="/team/epic-ping" style={{color:'inherit',textDecoration:'none'}}>Epic Ping</a> <PingBadge endpoint="/api/team/epic-ping" href="/team/epic-ping"/></div>
 <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><strong>{displayName}</strong><SignOut/></div>
 </div>;
}
