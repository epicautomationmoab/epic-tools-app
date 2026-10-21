import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(new RegExp("/+$"), "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || !accessToken || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return NextResponse.json({ error: "Customer search configuration unavailable." }, { status: 503 });

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ ok: true, customers: [] });

  try {
    async function search(fn: string) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_query: q, p_limit: 50 }),
        cache: "no-store",
      });
      const content = await response.text();
      if (!response.ok) throw new Error(content || `Customer search failed (${response.status})`);
      return content ? JSON.parse(content) as Array<Record<string, any>> : [];
    }
    const [existing, inbound] = await Promise.all([
      search("search_epic_customers"),
      search("search_epic_inbound_only_customers"),
    ]);
    const canonicalPhone=(value:unknown)=>String(value||"").replace(/\D/g,"").slice(-10);
    const existingPhones=new Set(existing.map(c=>canonicalPhone(c.phone)).filter(Boolean));
    const existingEmails=new Set(existing.map(c=>String(c.email||"").trim().toLowerCase()).filter(Boolean));
    const keys=new Set(existing.map(c=>String(c.identity_key)));
    const additions=inbound.filter(c=>{
      const phone=canonicalPhone(c.phone);
      const email=String(c.email||"").trim().toLowerCase();
      if(keys.has(String(c.identity_key))||(phone&&existingPhones.has(phone))||(email&&existingEmails.has(email)))return false;
      keys.add(String(c.identity_key));
      return true;
    });
    const all=[...existing,...additions].sort((a,b)=>new Date(b.last_seen_at||0).getTime()-new Date(a.last_seen_at||0).getTime());
    const numbers=[...new Set(all.map(c=>canonicalPhone(c.phone)).filter(Boolean))];
    let links:Array<{phone_a:string;phone_b:string;primary_phone:string|null;primary_email:string|null}>=[];
    if(numbers.length){
      const response=await fetch(SUPABASE_URL+"/rest/v1/rpc/c360_employee_search_phone_links",{
        method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},
        body:JSON.stringify({p_phones:numbers}),cache:"no-store"
      });
      if(!response.ok)throw new Error("Confirmed identity lookup failed ("+response.status+")");
      links=await response.json();
    }
    const parent=new Map<string,string>();
    function root(v:string):string{const p=parent.get(v);if(!p||p===v)return v;const r=root(p);parent.set(v,r);return r;}
    for(const n of numbers)parent.set(n,n);
    for(const link of links){if(!parent.has(link.phone_a))parent.set(link.phone_a,link.phone_a);if(!parent.has(link.phone_b))parent.set(link.phone_b,link.phone_b);parent.set(root(link.phone_b),root(link.phone_a));}
    const primaryByGroup=new Map<string,string>();
    for(const link of links)if(link.primary_phone)primaryByGroup.set(root(link.phone_a),link.primary_phone);
    const groups=new Map<string,Record<string,any>>();
    const result:Record<string,any>[]=[];
    for(const record of all){
      const phone=canonicalPhone(record.phone);
      const group=phone&&parent.has(phone)?root(phone):null;
      if(!group){result.push(record);continue;}
      const primary=primaryByGroup.get(group);
      const previous=groups.get(group);
      if(!previous){const chosen={...record};groups.set(group,chosen);result.push(chosen);continue;}
      const isCurrentPrimary=phone===primary;
      const previousIsPrimary=canonicalPhone(previous.phone)===primary;
      if(isCurrentPrimary&&!previousIsPrimary){
        const idx=result.indexOf(previous);
        const merged={...record,last_seen_at:new Date(record.last_seen_at||0)>new Date(previous.last_seen_at||0)?record.last_seen_at:previous.last_seen_at};
        if(idx>=0)result[idx]=merged;
        groups.set(group,merged);
      }
    }
    return NextResponse.json({ok:true,customers:result.slice(0,50)});
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to search customers." }, { status: 500 });
  }
}
