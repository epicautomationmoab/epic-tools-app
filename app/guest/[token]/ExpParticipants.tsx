"use client";

import { useState } from "react";
import styles from "./ExpParticipants.module.css";
import ExpDrawnInitials from "./ExpDrawnInitials";

export type ExpParticipantDraft = { fullName: string; initials: string; waiverMatched?: boolean };
export default function ExpParticipants({
  onContinue, onBack, waiverDrivers = [],
}: {
  onContinue: (participants: ExpParticipantDraft[]) => void;
  onBack: () => void;
  waiverDrivers?: string[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState<string[]>([]);
  const [signed, setSigned] = useState<Record<string,string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const distinctWaivers = Array.from(new Set(waiverDrivers.map(n=>n.trim()).filter(Boolean)));
  const all = [...selected.map(n=>({name:n,matched:true})),...manual.map(n=>({name:n.trim(),matched:false}))].filter(x=>x.name);
  const valid = confirmed && all.length>0 && all.every(x=>x.name.length>=3 && x.name.includes(" ") && Boolean(signed[x.name])) && new Set(all.map(x=>x.name.toLowerCase())).size===all.length;
  return <section className={styles.wrap} aria-label="EXP participating drivers">
    <h3>Almost trail-ready!</h3>
    <p>Everyone watching together can complete one knowledge check. Select each participating driver, then have each person draw their initials to confirm they watched the video.</p>
    {distinctWaivers.length ? <>
      <strong>Select drivers with signed waivers</strong>
      <p className={styles.note}>Choose everyone participating. More than one selection is welcome.</p>
      {distinctWaivers.map(name=><label key={name} className={styles.confirm} style={{marginBottom:8}}>
        <input type="checkbox" checked={selected.includes(name)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,name]:prev.filter(n=>n!==name))}/>
        <span>{name}</span>
      </label>)}
    </> : <p className={styles.note}>Driver waivers have not been loaded yet. You can enter names now; they will need to be matched to signed waivers before EXP status is verified.</p>}
    {manual.map((name,i)=><div key={i} className={styles.driver}>
      <label>Driver without a listed waiver — full name
        <input value={name} onChange={e=>setManual(prev=>prev.map((n,j)=>j===i?e.target.value:n))} placeholder="First and last name" maxLength={120}/>
      </label>
      <button type="button" className={styles.remove} onClick={()=>setManual(prev=>prev.filter((_,j)=>j!==i))}>Remove</button>
    </div>)}
    <button className={styles.add} type="button" disabled={selected.length+manual.length>=20} onClick={()=>setManual(prev=>[...prev,""])}>+ Add driver not listed</button>
    {all.map(({name,matched})=><div key={name} style={{padding:"12px 0",borderBottom:"1px solid #dde3e8"}}>
      <strong>{name}</strong> <span className={styles.note}>{matched?"Signed waiver listed":"Waiver matching required"}</span>
      <ExpDrawnInitials name={name} onChange={value=>setSigned(prev=>({...prev,[name]:value}))}/>
    </div>)}
    <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
      <span>All participating drivers watched the Epic Xpress Ready safety orientation.</span>
    </label>
    <div className={styles.actions}>
      <button type="button" disabled={!valid} onClick={()=>onContinue(all.map(x=>({fullName:x.name,initials:signed[x.name],waiverMatched:x.matched})))}>Let's Do the Knowledge Check</button>
      <button type="button" className={styles.back} onClick={onBack}>Back</button>
    </div>
    <p className={styles.note}>Testing preview: drawn initials and names are not saved. Actual waiver verification and completion recording will be enabled only in production after validation.</p>
  </section>;
}
