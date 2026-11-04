'use client';
import { useState } from 'react';
export default function SignOut(){
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  return <div><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await fetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw new Error();window.location.assign('/uui-login');}catch{setError('Please retry sign out.');setBusy(false);}}}>{busy?'Signing out…':'Sign out'}</button>{error&&<span role="alert">{error}</span>}</div>;
}
