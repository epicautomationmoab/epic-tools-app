import EpicToolsHome from "../team/EpicToolsHome";
import {requireUnifiedEmployee} from "@/lib/unified-session";
export const dynamic="force-dynamic";
export default async function Home(){return <EpicToolsHome profile={await requireUnifiedEmployee()}/>}
