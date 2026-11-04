"use client";
import { useEffect, useState } from "react";
export type ExpPreviewResult={confirmationCode:string;drivers:string[];completedAt:string;videoSkipped:boolean};
const key="epic-exp-demo-v2";
export function saveExpDemo(result:ExpPreviewResult){try{const old=JSON.parse(localStorage.getItem(key)||"{}");localStorage.setItem(key,JSON.stringify({...old,[result.confirmationCode]:result}));window.dispatchEvent(new Event("epic-exp-demo-updated"));}catch{}}
export function useExpDemo(){const [data,setData]=useState<Record<string,ExpPreviewResult>>({});useEffect(()=>{const read=()=>{try{setData(JSON.parse(localStorage.getItem(key)||"{}"))}catch{setData({})}};read();window.addEventListener("storage",read);window.addEventListener("epic-exp-demo-updated",read);return()=>{window.removeEventListener("storage",read);window.removeEventListener("epic-exp-demo-updated",read)}},[]);return data;}
export function normalizeExpName(name:string){return name.toLocaleLowerCase("en-US").replace(/\b[a-z]\b/g,"").replace(/[^a-z]/g,"").trim();}
