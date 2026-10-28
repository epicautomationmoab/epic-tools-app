"use client";

import { useState } from "react";
import styles from "./ExpParticipants.module.css";
import ExpDrawnInitials from "./ExpDrawnInitials";

export type ExpParticipantDraft = { fullName: string; initials: string; waiverMatched?: boolean };
export default function ExpParticipants({
  onContinue, onBack, waiverDrivers = [], reviewerMode = false,
}: {
  onContinue: (participants: ExpParticipantDraft[]) => void;
  onBack: () => void;
  waiverDrivers?: string[];
  reviewerMode?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState<string[]>([]);
  const [signed, setSigned] = useState<Record<string,string>>({});
  const [signing, setSigning] = useState<string | null>(null);
  const distinctWaivers = Array.from(new Set(waiverDrivers.map(n=>n.trim()).filter(Boolean)));
  const all = selected.map(n=>({name:n,matched:true})).filter(x=>x.name);
  const valid = all.length>0 && all.every(x=>x.name.length>=3 && x.name.includes(" ") && Boolean(signed[x.name])) && new Set(all.map(x=>x.name.toLowerCase())).size===all.length;
  return <section className={styles.wrap} aria-label="Orientation participating drivers">
    <h3>Almost trail-ready!</h3>
    <p>Everyone watching together can complete one knowledge check. Select the drivers present and have each person initial that they are participating.</p>
    {distinctWaivers.length ? <>
      <strong>Select drivers with signed waivers</strong>
      <p className={styles.note}>Choose everyone participating. More than one selection is welcome.</p>
      {distinctWaivers.map(name=><label key={name} className={styles.confirm} style={{marginBottom:8}}>
        <input type="checkbox" checked={selected.includes(name)} onChange={e=>{setSelected(prev=>e.target.checked?[...prev,name]:prev.filter(n=>n!==name));if(e.target.checked&&!signed[name])setSigning(name);}}/>
        <span style={{flex:1}}>{name}</span>
        {selected.includes(name) ? <button type="button" className={styles.signatureThumb} onClick={e=>{e.preventDefault();setSigning(name);}} aria-label={`Draw or update initials for ${name}`}>
          {signed[name] ? <img src={signed[name]} alt={`Initials captured for ${name}`} /> : "Add initials"}
        </button> : null}
      </label>)}
    </> : <p className={styles.note}>No signed driver agreements have been found. Complete the required rental paperwork before starting your orientation.</p>}
    {signing ? <div className={styles.signatureOverlay} onMouseDown={e=>{if(e.target===e.currentTarget)setSigning(null);}}>
      <section className={styles.signatureDialog} role="dialog" aria-modal="true" aria-labelledby="exp-initials-title">
        <h3 id="exp-initials-title">Your initials, {signing}</h3>
        <p>Draw your initials with a finger, mouse, or stylus. They'll appear beside your name.</p>
        <ExpDrawnInitials key={signing} name={signing} onChange={value=>setSigned(prev=>({...prev,[signing]:value}))}/>
        <div className={styles.actions}>
          <button type="button" disabled={!signed[signing]} onClick={()=>setSigning(null)}>Save Initials</button>
          <button className={styles.back} type="button" onClick={()=>setSigning(null)}>Cancel</button>
        </div>
      </section>
    </div> : null}
    {!valid && all.length > 0 ? <p role="status" className={styles.note} style={{color:"#93431d",fontWeight:700}}>{all.some(x=>x.name.length<3||!x.name.includes(" ")) ? "Enter each driver's first and last name." : all.some(x=>!signed[x.name]) ? "Draw and save initials for each selected driver." : "Remove duplicate driver entries."}</p> : null}
    <div className={styles.actions}>
      <button type="button" disabled={!valid} onClick={()=>onContinue(all.map(x=>({fullName:x.name,initials:signed[x.name],waiverMatched:x.matched})))}>Let's Do the Knowledge Check</button>
      {reviewerMode ? <button type="button" className={styles.back} onClick={()=>onContinue(all.length ? all.map(x=>({fullName:x.name,initials:signed[x.name]||"",waiverMatched:x.matched})) : [{fullName:"Preview Reviewer",initials:"",waiverMatched:false}])}>Reviewer shortcut: Open knowledge check</button> : null}
      <button type="button" className={styles.back} onClick={onBack}>Back</button>
    </div>
  </section>;
}
