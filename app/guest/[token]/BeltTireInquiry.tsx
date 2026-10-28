"use client";
import {useEffect,useRef,useState} from 'react';
import type {BeltTireDriverResponse,BeltTireResponse} from '@/lib/exp/belt-tire-inquiry';
import styles from './ExpVideoPreview.module.css';
type Data={price:number;drivers:BeltTireDriverResponse[]};
export default function BeltTireInquiry({token,readinessId,sessionId,rosterKey}:{token:string;readinessId:string;sessionId:string;rosterKey:string}){
 const [data,setData]=useState<Data|null>(null);const [error,setError]=useState('');const [saving,setSaving]=useState(false);const busy=useRef(false);
 const endpoint=`/api/guest/${encodeURIComponent(token)}/exp/belt-tire-inquiry`;
 useEffect(()=>{let active=true;setData(null);setError('');void (async()=>{try{const r=await fetch(`${endpoint}?readinessId=${encodeURIComponent(readinessId)}&sessionId=${encodeURIComponent(sessionId)}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error();if(active)setData(d)}catch{if(active)setError('Optional information preferences are unavailable. You can continue your orientation.')}})();return()=>{active=false}},[endpoint,readinessId,sessionId,rosterKey]);
 async function respond(driverName:string,response:BeltTireResponse){if(busy.current)return;busy.current=true;setSaving(true);setError('');try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({readinessId,sessionId,driverName,response})});const d=await r.json();if(!r.ok)throw Error();setData(d)}catch{setError('Your response was not saved. Please try again. You can continue your orientation.')}finally{busy.current=false;setSaving(false)}}
 if(!data?.drivers.length)return error?<p className={styles.disclaimer} role="status">{error}</p>:null;
 const unanswered=data.drivers.some(d=>!d.response);
 return <aside className={styles.inquiry} aria-label="Optional Belt and Tire Protection information">
  <h3>Optional Belt &amp; Tire Protection</h3>
  {unanswered?<><p>As covered in your orientation, Moab's rocky terrain can be especially demanding on tires and drive belts. For additional peace of mind, we offer optional Belt &amp; Tire Protection.</p><p><strong>${data.price}</strong></p><p><strong>Would you like more information about Belt &amp; Tire Protection when you arrive?</strong></p></>:<p>Your information preferences are saved.</p>}
  {data.drivers.map(d=>d.response?<p className={styles.inquirySaved} key={d.name}><strong>{d.name}</strong> — {d.response==='information_requested'?"I'd like more information.":'No thank you.'} <span>Saved</span></p>:<fieldset className={styles.inquiryDriver} key={d.name}><legend>{d.name}</legend>{([['information_requested',"I'd like more information."],['declined','No thank you.']] as const).map(([value,label])=><label key={value}><input type="radio" name={`belt-tire-${sessionId}-${d.name}`} checked={false} disabled={saving} onChange={()=>void respond(d.name,value)}/>{label}</label>)}</fieldset>)}
  {unanswered?<p className={styles.disclaimer}><em>Requesting information does not add a charge to your reservation.</em></p>:null}
  {saving?<p className={styles.disclaimer} role="status">Saving response…</p>:null}{error?<p className={styles.disclaimer} role="status">{error}</p>:null}
 </aside>;
}
