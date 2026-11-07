/** Read existing linked customer threads without moving notes or changing their owners. */
export async function loadCustomerNotes<T extends {id:string;created_at:string;thread_key?:string}>(keys:string[]):Promise<T[]> {
  const groups=await Promise.all(Array.from(new Set(keys.filter(Boolean))).map(async key=>{
    const response=await fetch('/api/sales/inbox?thread_key='+encodeURIComponent(key),{cache:'no-store'});
    if(!response.ok)throw new Error('Customer notes could not be loaded. Please retry.');
    const payload=await response.json();
    if(!Array.isArray(payload.notes))throw new Error('Customer notes could not be loaded. Please retry.');
    return payload.notes.map((note:T)=>({...note,thread_key:note.thread_key||key}));
  }));
  return Array.from(new Map(groups.flat().map((note:T)=>[note.id,note])).values())
    .sort((a,b)=>a.created_at.localeCompare(b.created_at));
}
