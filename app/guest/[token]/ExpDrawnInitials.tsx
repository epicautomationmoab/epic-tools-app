"use client";
import { useEffect, useRef, useState } from "react";
export default function ExpDrawnInitials({ name, onChange }: {name:string;onChange:(value:string)=>void}) {
 const canvas=useRef<HTMLCanvasElement>(null);const drawing=useRef(false);const [hasInk,setHasInk]=useState(false);
 useEffect(()=>{const c=canvas.current;if(!c)return;const ctx=c.getContext("2d");if(!ctx)return;ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=3;ctx.strokeStyle="#24303b";},[]);
 function point(e:React.PointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)*e.currentTarget.width/r.width,y:(e.clientY-r.top)*e.currentTarget.height/r.height};}
 function save(){const c=canvas.current;if(c)onChange(c.toDataURL("image/png"));}
 function start(e:React.PointerEvent<HTMLCanvasElement>){const c=canvas.current,ctx=c?.getContext("2d");if(!c||!ctx)return;try{c.setPointerCapture(e.pointerId);}catch{/* Some browsers do not support capture here. */}drawing.current=true;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.1,p.y+.1);ctx.stroke();setHasInk(true);save();}
 function move(e:React.PointerEvent<HTMLCanvasElement>){if(!drawing.current)return;const ctx=canvas.current?.getContext("2d");if(!ctx)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();save();}
 function end(){if(!drawing.current)return;drawing.current=false;save();}
 function clear(){const c=canvas.current;c?.getContext("2d")?.clearRect(0,0,c.width,c.height);setHasInk(false);onChange("");}
 return <div style={{marginTop:12}}>
  <label style={{display:"block",fontWeight:700,marginBottom:5}}>Draw initials — {name}</label>
  <canvas ref={canvas} width={480} height={108} aria-label={`Draw initials for ${name}`} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
    style={{display:"block",width:"100%",maxWidth:480,height:108,touchAction:"none",border:"1px solid #b8c2ca",borderRadius:10,background:"white"}} />
  <button type="button" style={{background:"transparent",border:0,textDecoration:"underline",color:"#586676",padding:"8px 0",cursor:"pointer"}} onClick={clear}>Clear initials</button>
  <span style={{marginLeft:12,fontSize:12,color:"#687785"}}>{hasInk?"Initials captured":"Use your finger, mouse, or stylus"}</span>
 </div>;
}
