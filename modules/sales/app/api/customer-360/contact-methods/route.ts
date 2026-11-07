import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "../../../../lib/team-auth";
const url=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
const apiKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
async function context(request:NextRequest){
 const token=request.cookies.get("epic_access_token")?.value;
 const profile=await getAuthenticatedTeamProfile(token);
 return token&&profile&&profile.role!=="workstation"?token:null;
}
async function rpc(token:string,fn:string,args:unknown){
 const response=await fetch(url+"/rest/v1/rpc/"+fn,{method:"POST",cache:"no-store",headers:{apikey:apiKey,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(args)});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data?.message||data?.error||"Contact request failed");
 return data;
}
export async function GET(request:NextRequest){
 const token=await context(request);
 if(!token)return NextResponse.json({error:"Employee login required"},{status:401});
 const phone=request.nextUrl.searchParams.get("phone")||"";
 if(!phone)return NextResponse.json({error:"Phone required"},{status:400});
 try{const linked=await rpc(token,"c360_employee_linked_contact_methods",{p_phone:phone});
 return NextResponse.json(linked?.linked?linked:await rpc(token,"c360_employee_regular_contact",{p_phone:phone,p_email:request.nextUrl.searchParams.get("email")||null}),{headers:{"Cache-Control":"no-store"}});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Contact lookup failed"},{status:400});}
}
export async function POST(request:NextRequest){
 const token=await context(request);
 if(!token)return NextResponse.json({error:"Employee login required"},{status:401});
 try{
 const b=await request.json();
 if(typeof b.phone!=="string"||typeof b.value!=="string"||b.value.length>254||!["phone","email"].includes(b.type)||!["add","remove","primary"].includes(b.action))return NextResponse.json({error:"Invalid contact change"},{status:400});
 const current=await rpc(token,"c360_employee_linked_contact_methods",{p_phone:b.phone});
 const result=current?.linked?await rpc(token,"c360_employee_manage_contact_method",{p_phone:b.phone,p_action:b.action,p_type:b.type,p_value:b.value,p_make_primary:b.make_primary===true}):await rpc(token,"c360_employee_regular_contact",{p_phone:b.phone,p_email:b.email||null,p_action:b.action,p_type:b.type,p_value:b.value,p_make_primary:b.make_primary===true});
 return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Contact change failed"},{status:400});}
}
