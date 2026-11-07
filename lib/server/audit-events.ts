export type EventRow = {
  id: string;
  at: string;
  actor: string;
  actor_id: string | null;
  domain: string;
  action: string;
  object: string;
  detail: string;
};

const PAGE_SIZE = 50;
type AuditFilters = { employee?: string; area?: string; cursor?: string };
export async function loadAuditEvents(filters: AuditFilters = {}): Promise<{ events: EventRow[]; errors: string[]; nextCursor?: string }> {
  const employee = (filters.employee || "").trim().slice(0,100);
  const area = (filters.area || "").slice(0,40);
  let offsets: Record<string,number> = {};
  let asOf = new Date().toISOString();
  try {
    const cursor = JSON.parse(Buffer.from((filters.cursor || "").slice(0,2000),"base64url").toString());
    if (typeof cursor.asOf === "string" && Number.isFinite(Date.parse(cursor.asOf)) && cursor.employee === employee && cursor.area === area && cursor.offsets && typeof cursor.offsets === "object") {
      asOf = new Date(Math.min(Date.now(),Date.parse(cursor.asOf))).toISOString();
      offsets = Object.fromEntries(Object.entries(cursor.offsets).filter(([,value]) => Number.isSafeInteger(value) && Number(value)>=0 && Number(value)<=10_000_000)) as Record<string,number>;
    }
  } catch { /* Invalid or stale cursor starts at the newest matching event. */ }
  const literal = (value:string) => '"' + value.replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"';

  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/[/]$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!origin || !secret) return {events: [], errors: ["Operational database configuration unavailable."]};
  const headers = { apikey: secret, ...(secret.startsWith("sb_secret_") ? {} : {Authorization: `Bearer ${secret}`}) };
  const tasks = [
    {
      domain:"Notes", actorField:"actor_name", actorIdField:"actor_profile_id", name: "Reservation notes", table: "epic_unified_note_audit",
      fields: "id,created_at,note_id,actor_profile_id,actor_name,action,before_value,after_value", sort: "created_at",
      map: (r: Record<string, unknown>): EventRow => ({
        id: String(r.id), at: String(r.created_at), actor: String(r.actor_name || "Unknown"),
        actor_id: r.actor_profile_id ? String(r.actor_profile_id) : null,
        domain: "Notes", action: (r.after_value as Record<string,unknown> | null)?.archived_at ? "Note archived" : String(r.action), object: String(r.note_id),
        detail: [r.before_value ? `Before: ${String((r.before_value as Record<string,unknown>).note_text)}; Readiness: ${String((r.before_value as Record<string,unknown>).visible_in_readiness)}` : "Created",
          r.after_value ? `After: ${String((r.after_value as Record<string,unknown>).note_text)}; Readiness: ${String((r.after_value as Record<string,unknown>).visible_in_readiness)}${(r.after_value as Record<string,unknown>).archived_at ? "; Archived: " + String((r.after_value as Record<string,unknown>).archived_at) : ""}` : "Removed"].join(" → "),
      }),
    },
    {
      domain:"Sales", actorField:"changed_by_name", actorIdField:"changed_by_profile_id", name: "Sales opportunities",
      table: "sales_opportunity_status_history",
      fields: "id,changed_at,changed_by_profile_id,changed_by_name,opportunity_id,from_status,to_status,reason",
      sort: "changed_at",
      map: (r: Record<string, unknown>): EventRow => ({
        id: String(r.id), at: String(r.changed_at), actor: String(r.changed_by_name || "Unknown"),
        actor_id: r.changed_by_profile_id ? String(r.changed_by_profile_id) : null,
        domain: "Sales", action: "Opportunity status", object: String(r.opportunity_id),
        detail: `${String(r.from_status || "—")} → ${String(r.to_status || "—")}`,
      }),
    },
    {
      domain:"Sales", actorField:"actor.display_name", actorIdField:"actor_profile_id", name:"Sales follow-ups",
      table:"sales_followup_events", sort:"created_at",
      fields:"id,created_at,followup_id,actor_profile_id,event_type,note,previous_due_at,next_due_at,actor:team_profiles!sales_followup_events_actor_profile_id_fkey(display_name)",
      map:(r:Record<string,unknown>):EventRow=>({
        id:String(r.id),at:String(r.created_at),actor:String((r.actor as {display_name?:string}|null)?.display_name||"Unknown"),actor_id:r.actor_profile_id?String(r.actor_profile_id):null,
        domain:"Sales",action:`Follow-up: ${String(r.event_type)}`,object:String(r.followup_id),
        detail:[r.note?String(r.note):"",r.previous_due_at||r.next_due_at?`Due: ${String(r.previous_due_at||"—")} → ${String(r.next_due_at||"—")}`:""].filter(Boolean).join(" · ")
      })
    },
    {
      domain:"Fleet", actorField:"changed_by_name", actorIdField:"changed_by_profile_id", name: "Fleet availability",
      table: "fleet_inventory_events",
      fields: "id,created_at,changed_by_profile_id,changed_by_name,vehicle_number,previous_state,new_state",
      sort: "created_at",
      map: (r: Record<string, unknown>): EventRow => ({
        id: String(r.id), at: String(r.created_at), actor: String(r.changed_by_name || "Unknown"),
        actor_id: r.changed_by_profile_id ? String(r.changed_by_profile_id) : null,
        domain: "Fleet", action: "Vehicle state", object: `Vehicle ${String(r.vehicle_number ?? "unknown")}`,
        detail: `${String(r.previous_state || "—")} → ${String(r.new_state || "—")}`,
      }),
    },

    {
      domain:"Readiness", actorField:"recorded_by", actorIdField:"", name:"Reservation events",
      table:"epic_reservation_events", sort:"recorded_at",
      fields:"id,readiness_id,event_type,event_notes,recorded_by,recorded_at",
      map:(r:Record<string,unknown>):EventRow=>({
        id:String(r.id),at:String(r.recorded_at),actor:String(r.recorded_by||"Unknown"),actor_id:null,
        domain:"Readiness",action:String(r.event_type),object:String(r.readiness_id),detail:String(r.event_notes||"")
      })
    },
    {
      domain:"Documents", actorField:"signer_name", actorIdField:"", name:"Cancellation acceptances",
      table:"cancellation_agreement_acceptances", sort:"accepted_at",
      // Read the immutable snapshot, never mutable current-request state. Do not
      // expose signatures, IP addresses, device metadata or customer contacts.
      fields:"id,request_id,readiness_id,confirmation_code,policy_version,policy_title,signer_name,accepted_at",
      map:(r:Record<string,unknown>):EventRow=>({
        id:String(r.id),at:String(r.accepted_at),actor:r.signer_name?`Guest: ${String(r.signer_name)}`:"Unknown",actor_id:null,
        domain:"Documents",action:"Cancellation policy accepted",object:String(r.request_id),
        detail:`${String(r.confirmation_code)} · ${String(r.policy_title)} · Version ${String(r.policy_version)}`
      })
    },
  ];
  const selectedTasks = tasks.filter(t=>!area||t.domain===area);
  const results = await Promise.all(selectedTasks.map(async t => {
    try {
      const params = new URLSearchParams({select:t.fields, order:`${t.sort}.desc,id.desc`, limit:String(PAGE_SIZE+1),offset:String(offsets[t.table]||0)})
      params.set(t.sort,`lte.${asOf}`);
      if (employee) {
        const pattern = "%"+employee.replace(/[\\%_*]/g, "\\$&")+"%";
        if (t.table === "sales_followup_events") {
          if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(employee)) params.set(t.actorIdField,`eq.${employee}`);
          else { params.set("select",t.fields.replace("_fkey(display_name)","_fkey!inner(display_name)")); params.set(t.actorField,`ilike.${pattern}`); }
        } else if (t.actorIdField && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(employee)) params.set("or",`(${t.actorField}.ilike.${literal(pattern)},${t.actorIdField}.eq.${employee})`);
        else params.set(t.actorField,`ilike.${pattern}`);
      };
      const response = await fetch(`${origin}/rest/v1/${t.table}?${params}`, {headers, cache:"no-store"});
      if (!response.ok) return { name: t.name, error: `HTTP ${response.status}`, events: [] as Array<EventRow & {source:string;sourceIndex:number}> };
      const rows = await response.json();
      if (!Array.isArray(rows)) return {name:t.name,error:"Invalid response",events:[] as Array<EventRow & {source:string;sourceIndex:number}>};
      return {name:t.name,error:null,events:rows.map((row,index)=>({...t.map(row),source:t.table,sourceIndex:index}))};
    } catch {
      return {name:t.name,error:"Source not reachable",events:[] as Array<EventRow & {source:string;sourceIndex:number}>};
    }
  }));
  const merged=results.flatMap(x=>x.events).sort((a,b)=>b.at.localeCompare(a.at)||a.source.localeCompare(b.source)||a.sourceIndex-b.sourceIndex);
  const events=merged.slice(0,PAGE_SIZE);
  const nextOffsets={...offsets};
  for(const event of events) nextOffsets[event.source]=(nextOffsets[event.source]||0)+1;
  const errors=results.filter(x=>x.error).map(x=>`${x.name}: ${x.error}`);
  return {
    events:events.map(({source,sourceIndex,...event})=>event),errors,
    nextCursor:errors.length===0&&merged.length>PAGE_SIZE ? Buffer.from(JSON.stringify({employee,area,asOf,offsets:nextOffsets})).toString("base64url") : undefined,
  };
}
