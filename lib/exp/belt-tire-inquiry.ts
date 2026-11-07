export const BELT_TIRE_INQUIRY_CUE_SECONDS=617;
export type BeltTireResponse='information_requested'|'declined';
export type BeltTireDriverResponse={name:string;response:BeltTireResponse|null};
export const beltTireNameKey=(name:string)=>name.trim().replace(/\s+/g,' ').toLowerCase();
/** Same Premier reservation fields used by the existing Adventure Assure display. */
export function beltTirePrice(row:{premier_adventure_assure?:boolean|null;adventure_assure_level?:string|null}){
 return row.premier_adventure_assure===true||row.adventure_assure_level?.trim().toLowerCase()==='premier'?39:59;
}
export function beltTireCueReached(position:number,watched:number[]=[]){return Number.isFinite(position)&&position>=BELT_TIRE_INQUIRY_CUE_SECONDS||watched.some(s=>s>=BELT_TIRE_INQUIRY_CUE_SECONDS)}
export function beltTireIndicator(purchased:boolean,drivers:BeltTireDriverResponse[]){
 const symbol=purchased?'🛞':drivers.some(d=>d.response==='information_requested')?'❓':drivers.length>0&&drivers.every(d=>d.response==='declined')?'⛔️':'';
 const heading=purchased?'Belt & Tire Protection — Purchased':symbol==='❓'?'Belt & Tire Protection — Information Requested':symbol==='⛔️'?'Belt & Tire Protection — All drivers declined information':'Belt & Tire Protection — Responses incomplete';
 return {symbol,detail:[heading,...drivers.map(d=>`${d.name} — ${d.response==='information_requested'?'Requested more information':d.response==='declined'?'No thank you':'Not answered'}`)].join('\n')};
}
