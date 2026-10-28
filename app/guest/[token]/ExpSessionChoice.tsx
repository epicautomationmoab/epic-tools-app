"use client";
import {useState} from 'react';
import styles from './ExpParticipants.module.css';
export type ExpSessionChoices={drivers:Array<{name:string;orientationComplete:boolean}>;sessions:Array<{sessionId:string;readinessId:string;names:string[];outcome:string}>};
const key=(name:string)=>name.trim().replace(/\s+/g,' ').toLowerCase();
export default function ExpSessionChoice({choices,busy,onStart,onResume}:{choices:ExpSessionChoices;busy:boolean;onStart:(names:string[])=>void;onResume:(sessionId:string)=>void}){
 const [selected,setSelected]=useState<string[]>([]);
 const occupied=new Set(choices.sessions.flatMap(s=>s.names.map(key)));
 const available=choices.drivers.filter(d=>!d.orientationComplete&&!occupied.has(key(d.name)));
 return <section className={styles.wrap} aria-label="Choose orientation drivers">
  <h3>Who’s completing orientation?</h3>
  {choices.drivers.filter(d=>d.orientationComplete).map(d=><div className={styles.confirm} key={d.name}><span>✓ <strong>{d.name}</strong><br/>Orientation Complete</span></div>)}
  {choices.sessions.map(s=><div className={styles.sessionRow} key={s.sessionId}><div><strong>{s.names.length?s.names.join(' & '):'Saved orientation'}</strong><p>{s.names.length>1?'Group orientation · In progress':'Individual orientation · In progress'}</p></div><button className={styles.back} type="button" disabled={busy} aria-label={`Resume ${s.names.join(' and ')||'saved orientation'}`} onClick={()=>onResume(s.sessionId)}>{s.names.length>1?"Resume Together":"Resume"}</button></div>)}
  {available.map(d=><label className={styles.confirm} key={d.name}><input type="checkbox" disabled={busy} checked={selected.includes(d.name)} onChange={e=>setSelected(names=>e.target.checked?[...names,d.name]:names.filter(n=>n!==d.name))}/><span><strong>{d.name}</strong><br/>Not started</span></label>)}
  {available.length?<><p>Completing orientation together? Select multiple drivers to participate as a group.</p><div className={styles.actions}><button type="button" disabled={busy||!selected.length} onClick={()=>onStart(selected)}>Start Orientation</button></div></>:null}
  <p className={styles.note}>Your progress is saved. Group sessions have one shared Resume Together button; separately started orientations remain separate.</p>
 </section>;
}
