export async function previewUnifiedNotes<T>(name:string,args:Record<string,unknown>):Promise<T|null>{
 const base=process.env.EPIC_NOTES_PREVIEW_URL?.replace(/\/+$/,"");
 const key=process.env.EPIC_NOTES_PREVIEW_KEY;
 if(!base||!key)return null;
 const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=representation"};
 let path="epic_unified_notes",method="GET",body:string|undefined;
 if(name==="epic_unified_notes_for_reservations"){
   const codes=Array.isArray(args.p_confirmations)?args.p_confirmations as string[]:[];
   path+="?"+new URLSearchParams({confirmation_code:"in.("+codes.join(",")+")",archived_at:"is.null",order:"created_at.desc",limit:"250"});
 }else if(name==="epic_unified_notes_add"){
   method="POST";body=JSON.stringify({confirmation_code:args.p_confirmation,note_text:args.p_note_text,note_scope:"reservation",source:"c360",visible_in_readiness:args.p_show_in_readiness===true,author_name:args.p_author});
 }else if(name==="epic_unified_notes_set_readiness"){
   method="PATCH";path+="?"+new URLSearchParams({note_id:"eq."+args.p_note_id,note_scope:"eq.reservation"});
   body=JSON.stringify({visible_in_readiness:args.p_visible===true,updated_at:new Date().toISOString()});
 }else throw Error("Unknown notes operation.");
 const r=await fetch(base+"/rest/v1/"+path,{method,headers,body,cache:"no-store"});
 const text=await r.text();if(!r.ok)throw Error(text||"Preview notes request failed: "+r.status);
 return (text?JSON.parse(text):[]) as T;
}
