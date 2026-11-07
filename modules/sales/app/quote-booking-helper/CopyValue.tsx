"use client";

import {useState} from "react";
import styles from "../staff-booking/StaffBooking.module.css";

export default function CopyValue({label,value}:{label:string;value:string}){
  const[copied,setCopied]=useState(false);
  async function copy(){
    try{
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),1200);
    }catch{
      setCopied(false);
    }
  }
  return <div className={styles.copyField}>
    <div className={styles.copyFieldText}>
      <span>{label}</span>
      <strong>{value||"—"}</strong>
    </div>
    {value?<button type="button" className={styles.copyButton} onClick={copy} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
      {copied?"✓":<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 7V5a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-2v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h2Zm3-3a1 1 0 0 0-1 1v2h3a3 3 0 0 1 3 3v3h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-7ZM6 9a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H6Z"/></svg>}
    </button>:null}
  </div>;
}
