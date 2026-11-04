import {NextRequest,NextResponse} from "next/server";
import {getAuthenticatedTeamProfile} from "@/lib/team-auth";

export async function GET(request:NextRequest,context:{params:Promise<{uploadId:string}>}){
 const employee=await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
 if(!employee||employee.role==="workstation")return NextResponse.json({error:"Employee login required"},{status:401});
 const {uploadId}=await context.params;
 if(!/^[0-9a-f-]{36}$/i.test(uploadId))return NextResponse.json({error:"Invalid document"},{status:400});
 const url=(process.env.NEXT_PUBLIC_SUPABASE_URL||"").replace(/\/+$/,"");
 const secret=process.env.SUPABASE_SECRET_KEY||"";
 if(!url||!secret)return NextResponse.json({error:"Document storage unavailable"},{status:503});
 const headers={apikey:secret,...(secret.startsWith("sb_secret_") ? {} : {Authorization:"Bearer "+secret})};
 const query=new URLSearchParams({id:"eq."+uploadId,select:"storage_path",limit:"1"});
 const result=await fetch(url+"/rest/v1/ohv_certificate_uploads?"+query,{headers,cache:"no-store"});
 if(!result.ok)return NextResponse.json({error:"Certificate unavailable"},{status:502});
 const rows=await result.json() as Array<{storage_path:string}>;
 const path=rows[0]?.storage_path;
 if(!path||path.includes(".."))return NextResponse.json({error:"Certificate not found"},{status:404});
 const signed=await fetch(url+"/storage/v1/object/sign/ohv-certificates/"+path.split("/").map(encodeURIComponent).join("/"),{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({expiresIn:300}),cache:"no-store"});
 if(!signed.ok)return NextResponse.json({error:"Unable to open certificate"},{status:502});
 const json=await signed.json() as {signedURL?:string;signedUrl?:string};
 const suffix=json.signedURL||json.signedUrl;
 if(!suffix)return NextResponse.json({error:"Document link unavailable"},{status:502});
 const destination=new URL(suffix.startsWith("http")?suffix:url+"/storage/v1"+suffix);
 if(destination.origin!==new URL(url).origin)return NextResponse.json({error:"Invalid document destination"},{status:502});
 return NextResponse.redirect(destination,302);
}
