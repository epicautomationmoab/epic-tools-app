import {cookies} from "next/headers";
import {getAuthenticatedTeamProfile} from "@/lib/team-auth";
import SharedIncomingCall from "./SharedIncomingCall";
export default async function SharedCallHost(){const token=(await cookies()).get("epic_access_token")?.value;if(!token)return null;const profile=await getAuthenticatedTeamProfile(token);return profile && profile.role!=="workstation"?<SharedIncomingCall employeeId={profile.id}/>:null}
