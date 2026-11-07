import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../lib/team-auth";
export async function GET(request:NextRequest){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 if(!profile||!token)return NextResponse.json({error:"Unauthorized"},{status:401});
 const confirmation=(request.nextUrl.searchParams.get("confirmation")||"").toUpperCase();
 if(!/^[A-Z0-9-]{3,25}$/.test(confirmation))return NextResponse.json({error:"Invalid booking"},{status:400});
 const url=new URL("/api/sales/customer-readiness",request.url);url.searchParams.set("confirmation",confirmation);
 const response=await fetch(url,{headers:{Cookie:"epic_access_token="+encodeURIComponent(token)},cache:"no-store"});
 if(!response.ok)return NextResponse.json({error:"Reservation unavailable"},{status:502});
 const docs=await response.json();const d=docs.documents?.[0];
 if(!d?.readinessId)return NextResponse.json({error:"Not ready"},{status:404});
 return NextResponse.json({readiness_id:d.readinessId,confirmation_code:confirmation,customer_name:d.customerName||"Guest",customer_phone:d.customerPhone||null,customer_email:d.customerEmail||null,product_display_name:d.productName||"Reservation"});
}