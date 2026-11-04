'use client';
import {useState} from 'react';
import styles from '../uui-home/Workflow.module.css';
export default function SignIn(){
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 return <main className={styles.login}><section className={styles.loginPanel}><div className={styles.logo}><img src="/epic-logo.png" alt="Epic 4X4 Adventures"/></div><p className={styles.eyebrow}>EPICTOOLS</p><h1>Employee sign-in</h1><p>Use your individual EpicTools account.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const data=new FormData(e.currentTarget);try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),password:data.get('password')})});const result=await r.json();if(!r.ok)throw new Error(result.error);window.location.assign('/uui-home');}catch(err){setError(err instanceof Error?err.message:'Sign-in failed.');setBusy(false);}}}><label>Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={512}/></label>{error&&<p role="alert" className={styles.error}>{error}</p>}<button disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form></section></main>;
}
