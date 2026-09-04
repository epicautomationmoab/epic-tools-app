"use client";

import { FormEvent, useEffect, useState } from "react";

export default function AmbassadorResetPasswordPage() {
  const [accessToken,setAccessToken]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{
    const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
    const access=hash.get("access_token")||"";
    setAccessToken(access);
    if(access) window.history.replaceState({},"",window.location.pathname);
  },[]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setError(""); setMessage("");
    if(password.length<8){setError("Choose a password with at least 8 characters.");return;}
    if(password!==confirmPassword){setError("The passwords do not match.");return;}
    setSubmitting(true);
    try{
      const response=await fetch("/api/ambassador/auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({access_token:accessToken,password})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||"Unable to reset password.");
      setMessage("Password updated. You can sign in with your new password.");
      setTimeout(()=>{window.location.href="/ambassador/login";},1000);
    }catch(err){setError(err instanceof Error?err.message:"Unable to reset password.");}
    finally{setSubmitting(false);}
  }

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f1f3f5",padding:24,fontFamily:"Arial,sans-serif"}}>
    <form onSubmit={submit} style={{width:"100%",maxWidth:430,background:"#fff",border:"1px solid #dfe4e9",borderRadius:18,padding:34,boxShadow:"0 18px 50px rgba(20,31,45,.12)"}}>
      <img src="/epic-logo-black.png" alt="Epic 4X4 Adventures" style={{display:"block",width:190,margin:"0 auto 18px"}}/>
      <h1 style={{margin:0,textAlign:"center",color:"#202733",fontSize:28}}>Choose a New Password</h1>
      <p style={{textAlign:"center",color:"#68717d",margin:"8px 0 26px"}}>Set a new password for your Ambassador account.</p>
      {!accessToken?<div style={{background:"#fff4e8",border:"1px solid #f1c99e",borderRadius:10,padding:14,color:"#7a4517",lineHeight:1.5}}>This reset link is missing its recovery credentials or has expired. Request a new reset link.</div>:<>
        <label style={{display:"grid",gap:6,fontWeight:800,fontSize:13,color:"#39414b"}}>New Password<div style={{position:"relative"}}><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={{width:"100%",height:48,border:"1px solid #cfd6de",borderRadius:9,padding:"0 46px 0 12px",boxSizing:"border-box"}}/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"} style={{position:"absolute",right:8,top:7,width:34,height:34,border:0,background:"transparent",cursor:"pointer",fontSize:18}}>{showPassword?"🙈":"👁"}</button></div></label>
        <label style={{display:"grid",gap:6,fontWeight:800,fontSize:13,color:"#39414b",marginTop:14}}>Confirm Password<input type={showPassword?"text":"password"} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={{width:"100%",height:48,border:"1px solid #cfd6de",borderRadius:9,padding:"0 12px",boxSizing:"border-box"}}/></label>
        {error?<p style={{color:"#b42318",marginBottom:0}}>{error}</p>:null}{message?<p style={{color:"#18794e",marginBottom:0}}>{message}</p>:null}
        <button type="submit" disabled={submitting} style={{width:"100%",height:48,marginTop:20,border:0,borderRadius:9,background:"#d5521d",color:"#fff",fontWeight:800,cursor:submitting?"wait":"pointer"}}>{submitting?"Updating…":"Update Password"}</button>
      </>}
    </form>
  </main>;
}
