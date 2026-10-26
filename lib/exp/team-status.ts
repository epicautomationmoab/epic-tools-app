/** EXP rollup for team-only presentation; no automatic checkout bypass. */
export type ExpTeamStatus = { ready: number; total: number; allReady: boolean; status: "ready" | "partial" | "not_started" };
export function expTeamStatus(ready: number, total: number): ExpTeamStatus {
 const count = Math.max(0,Math.floor(total));
 const done = Math.max(0,Math.min(count,Math.floor(ready)));
 return { ready:done,total:count,allReady:count>0&&done===count,status:done===0?"not_started":done===count?"ready":"partial" };
}
export function expBoardDirection(existingIsKiosk:boolean, businessLine:string, exp:ExpTeamStatus|null) {
 return businessLine==="rental" && exp?.allReady===true ? "agent" : existingIsKiosk ? "kiosk" : "agent";
}
