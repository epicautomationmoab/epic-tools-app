"use client";
import {useState} from 'react';
import ExpDrawnInitials from './ExpDrawnInitials';
import type {ExpParticipantDraft} from './ExpParticipants';
import styles from './ExpParticipants.module.css';
export type ExpSessionChoices={drivers:Array<{name:string;orientationComplete:boolean}>;sessions:Array<{sessionId:string;readinessId:string;names:string[];outcome:string}>};
const key=(name:string)=>name.trim().replace(/\s+/g,' ').toLowerCase();
export default function ExpSessionChoice({choices,busy,onStart,onResume}:{choices:ExpSessionChoices;busy:boolean;onStart:(participants:ExpParticipantDraft[])=>void;onResume:(sessionId:string)=>void}){
 const [selected,setSelected]=useState<string[]>([]);
 const [signed,setSigned]=useState<Record<string,string>>({});
 const [signing,setSigning]=useState<string|null>(null);
 const occupied=new Set(choices.sessions.flatMap(s=>s.names.map(key)));
 const available=choices.drivers.filter(d=>!d.orientationComplete&&!occupied.has(key(d.name)));
 return <section className={styles.wrap} aria-label="Choose orientation drivers">
  <h3>Who’s completing orientation?</h3>
  {choices.drivers.filter(d=>d.orientationComplete).map(d=><div className={styles.confirm} key={d.name}><span>✓ <strong>{d.name}</strong><br/>Orientation Complete</span></div>)}
  {choices.sessions.map(s=><div className={styles.sessionRow} key={s.sessionId}><div><strong>{s.names.length?s.names.join(' & '):'Saved orientation'}</strong><p>{s.names.length>1?'Group orientation · In progress':'Individual orientation · In progress'}</p></div><button className={styles.back} type="button" disabled={busy} aria-label={`Resume ${s.names.join(' and ')||'saved orientation'}`} onClick={()=>onResume(s.sessionId)}>Resume</button></div>)}
  {available.map(d=><label className={styles.confirm} key={d.name}><input type="checkbox" disabled={busy} checked={selected.includes(d.name)} onChange={e=>{setSelected(names=>e.target.checked?[...names,d.name]:names.filter(n=>n!==d.name));if(e.target.checked&&!signed[d.name])setSigning(d.name);}}/><span><strong>{d.name}</strong><br/>Not started</span>{selected.includes(d.name)?<button type="button" className={styles.signatureThumb} onClick={e=>{e.preventDefault();setSigning(d.name)}}>{signed[d.name]?<img src={signed[d.name]} alt={`Initials for ${d.name}`}/>:"Add initials"}</button>:null}</label>)}
  {signing?<div className={styles.signatureOverlay} onMouseDown={e=>{if(e.target===e.currentTarget)setSigning(null)}}><section className={styles.signatureDialog} role="dialog" aria-modal="true" aria-label="Draw driver initials"><h3>Your initials, {signing}</h3><p>Draw your initials to confirm you are participating in the orientation.</p><ExpDrawnInitials key={signing} name={signing} onChange={value=>setSigned(prev=>({...prev,[signing]:value}))}/><div className={styles.actions}><button type="button" disabled={!signed[signing]} onClick={()=>setSigning(null)}>Save Initials</button><button type="button" className={styles.back} onClick={()=>setSigning(null)}>Cancel</button></div></section></div>:null}
  {available.length?<><p>Completing orientation together? Select multiple drivers to participate as a group.</p><div className={styles.actions}><button type="button" disabled={busy||!selected.length||selected.some(name=>!signed[name])} onClick={()=>onStart(selected.map(name=>({fullName:name,initials:signed[name],waiverMatched:true})))}>Continue to Orientation</button></div></>:null}
  <p className={styles.note}>Your progress is saved. You can leave and pick up where you left off.</p>
 </section>;
}
