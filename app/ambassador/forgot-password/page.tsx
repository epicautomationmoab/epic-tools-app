"use client";

import { FormEvent, useState } from "react";

export default function AmbassadorForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/ambassador/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to send password reset email.");
      setMessage(payload.message || "Check your email for a password reset link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send password reset email.");
    } finally { setSubmitting(false); }
  }

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f1f3f5",padding:24,fontFamily:"Arial,sans-serif"}}>
    <form onSubmit={submit} style={{width:"100%",maxWidth:430,background:"#fff",border:"1px solid #dfe4e9",borderRadius:18,padding:34,boxShadow:"0 18px 50px rgba(20,31,45,.12)"}}>
      <img src="/epic-logo-black.png" alt="Epic 4X4 Adventures" style={{display:"block",width:190,margin:"0 auto 18px"}}/>
      <h1 style={{margin:0,textAlign:"center",color:"#202733",fontSize:28}}>Reset Your Ambassador Password</h1>
      <p style={{textAlign:"center",color:"#68717d",margin:"8px 0 26px",lineHeight:1.5}}>Enter the email address you use for the Epic 4X4 Ambassador portal.</p>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required autoComplete="email" style={{width:"100%",height:48,border:"1px solid #cfd6de",borderRadius:9,padding:"0 12px",boxSizing:"border-box"}}/>
      {error?<p style={{color:"#b42318",marginBottom:0}}>{error}</p>:null}
      {message?<p style={{color:"#18794e",lineHeight:1.5,marginBottom:0}}>{message}</p>:null}
      <button type="submit" disabled={submitting} style={{width:"100%",height:48,marginTop:20,border:0,borderRadius:9,background:"#d5521d",color:"#fff",fontWeight:800,cursor:submitting?"wait":"pointer"}}>{submitting?"Sending…":"Send Reset Link"}</button>
      <button type="button" onClick={()=>window.location.href="/ambassador/login"} style={{width:"100%",marginTop:14,border:0,background:"transparent",color:"#4b5563",fontWeight:700,cursor:"pointer"}}>Back to sign in</button>
    </form>
  </main>;
}
