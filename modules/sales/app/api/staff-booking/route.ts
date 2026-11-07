import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";

const SUPABASE_URL=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

export async function GET(request:NextRequest){
  const token=request.cookies.get("epic_access_token")?.value;
  const profile=await getAuthenticatedTeamProfile(token);
  if(!profile||!token||profile.role==="workstation") return NextResponse.json({error:"Employee login required."},{status:401});
  const draft=request.nextUrl.searchParams.get("draft");
  if(!draft)return NextResponse.json({error:"Draft is required."},{status:400});
  const params=new URLSearchParams({id:"eq."+draft,select:"id,confirmation_code,customer_name,activity_date,start_time,experience_name,option_name,value_cents,tripworks_customer_code,raw_payload"});
  const response=await fetch(SUPABASE_URL+"/rest/v1/sales_drafts?"+params.toString(),{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+token},cache:"no-store"});
  const rows=await response.json().catch(()=>[]);
  if(!response.ok)return NextResponse.json({error:"Unable to load draft."},{status:response.status});
  const row=rows[0];
  if(!row)return NextResponse.json({error:"Draft not found."},{status:404});
  const trip=row.raw_payload||{};
  const order=Array.isArray(trip.tripOrders)?trip.tripOrders[0]||{}:{};
  const booking=Array.isArray(order.bookings)?order.bookings[0]||{}:{};
  const slot=order.experience_timeslot||{};
  const addons=(Array.isArray(booking.addons)?booking.addons:[]).map((a:any)=>({name:a?.name||null,title:a?.experience_addon?.title||null,price_cents:typeof a?.price==="number"?a.price:null}));
  const products=(Array.isArray(booking.booking_products)?booking.booking_products:[]).map((p:any)=>({name:p?.name||p?.product?.name||null,price_cents:typeof p?.price==="number"?p.price:null,quantity:p?.quantity??null}));
  const code=row.tripworks_customer_code||trip?.customer?.code||null;
  return NextResponse.json({ok:true,draft:{id:row.id,confirmation_code:row.confirmation_code,customer_name:row.customer_name,activity_date:row.activity_date,experience_name:row.experience_name,option_name:row.option_name,value_cents:row.value_cents,time_label:slot?.time_label||null,start_time:slot?.start_time||row.start_time||null,end_time:slot?.end_time||null,addons,products,tripworks_customer_code:code,tripworks_customer_url:code?"https://epic4x4.tripworks.com/customer/"+encodeURIComponent(code)+"/trips":null}});
}
