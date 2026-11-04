import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {getAuthenticatedTeamProfile} from "./team-auth";
export async function requireUnifiedEmployee(management=false) {
 const profile=await getAuthenticatedTeamProfile((await cookies()).get("epic_access_token")?.value);
 if(!profile || profile.role==="workstation") redirect("/uui-login");
 if(management && profile.role!=="admin" && profile.role!=="manager") redirect("/uui-home");
 return profile;
}
