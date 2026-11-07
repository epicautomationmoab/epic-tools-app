import EpicToolsHome from "@/app/team/EpicToolsHome";
import InviteTeamPanel from "@/app/team/auth-setup/InviteTeamPanel";
import {requireUnifiedEmployee} from "@/lib/unified-session";
export default async function Users(){const profile=await requireUnifiedEmployee(true);return <EpicToolsHome profile={profile} title="User Administration"><InviteTeamPanel/></EpicToolsHome>}
